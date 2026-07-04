import './loadEnv'; // Must be first import to load root .env before others resolve
import { Client, GatewayIntentBits } from 'discord.js';
import { logger } from './logger';
import { state, type Alert } from './state';
import { SSEClient } from './sseClient';
import { setupCrons } from './crons';
import { updateVoiceChannelName } from './voiceStatus';
import { handleSlashCommand, handleModalSubmit, handleSelectToggle, getRoomDisplayName } from './slashCommands';
import { generateReply } from './ai';
import { createEmbed, COLORS } from './embeds';

const token = process.env.DISCORD_BOT_TOKEN || '';
const backendPort = process.env.BACKEND_PORT || 5000;
const backendUrl = `http://localhost:${backendPort}`;
const voiceChannelId = process.env.VOICE_CHANNEL_ID || '';
const alertChannelId = process.env.DISCORD_ALLOWED_CHANNEL_ID || '';

if (!token) {
  logger.error('[Bot] Error: DISCORD_BOT_TOKEN is not defined in the environment.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const postedAlertKeys = new Set<string>();

function getAlertKey(alert: Alert): string {
  const sortedIds = [...(alert.deviceIds || [])].sort();
  return `${alert.type}:${alert.room}:${sortedIds.join(',')}`;
}

async function postAlertIfNew(client: any, alert: Alert) {
  if (!alertChannelId) return;
  const channel = client.channels.cache.get(alertChannelId);
  if (!channel || !('send' in channel)) return;

  const key = getAlertKey(alert);
  if (postedAlertKeys.has(key)) {
    return;
  }
  postedAlertKeys.add(key);

  try {
    const roomName = getRoomDisplayName(alert.room);
    const description = alert.type === 'after-hours'
      ? `After-hours alert in ${roomName}: ${alert.message}`
      : `Stuck-on alert in ${roomName}: ${alert.message}`;

    const embed = createEmbed(
      alert.type === 'after-hours' ? '🌙 After-Hours Alert' : '⚠️ Stuck-On Alert',
      description,
      COLORS.alert,
    );

    await channel.send({ embeds: [embed] });
    logger.info(`[Alerts] Proactively posted ${alert.type} alert to alert channel for ${roomName}`);
  } catch (err) {
    logger.error({ err }, '[Alerts] Failed to post proactive alert to channel');
  }
}

async function syncPostedAlerts(alerts: Alert[]) {
  const activeKeys = new Set(alerts.map(getAlertKey));
  for (const key of postedAlertKeys) {
    if (!activeKeys.has(key)) {
      postedAlertKeys.delete(key);
    }
  }
}

client.once('ready', () => {
  logger.info(`Bot online as ${client.user?.tag}`);

  const sse = new SSEClient(`${backendUrl}/api/stream`);
  sse.onUpdate(() => {
    if (voiceChannelId && state.usage) {
      updateVoiceChannelName(client, voiceChannelId, state.usage.totalWatts).catch((err) => {
        logger.warn({ err }, '[Voice] Failed to update channel on SSE tick');
      });
    }

    if (alertChannelId && state.alerts) {
      for (const alert of state.alerts) {
        postAlertIfNew(client, alert).catch((err) => {
          logger.error({ err }, '[Alerts] Error posting proactive alert');
        });
      }
      syncPostedAlerts(state.alerts);
    }
  });
  sse.start();

  setupCrons(client, backendUrl);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot || !message.guild) return;
    const content = message.content.trim();
    if (!content.startsWith('!')) return;

    const parts = content.slice(1).trim().split(/\s+/);
    const cmd = (parts.shift() || '').toLowerCase();
    const args = parts;

    if (cmd === 'room') {
      await handlePrefixRoom(message, args[0]);
    } else if (cmd === 'usage') {
      await handlePrefixUsage(message);
    } else if (cmd === 'ask') {
      await handlePrefixAsk(message, args.join(' '));
    } else if (cmd === 'help') {
      await message.reply({
        content: '🤖 Available: `/room`, `/usage`, `/ask`, `/toggle`, `/leaderboard`, `/health`, `/predict`, `/set-threshold`.\nPrefix: `!room <room>`, `!usage`, `!ask <question>`, `!help`.',
      });
    }
  } catch (err) {
    logger.error({ err }, '[Bot] Prefix command error');
    try {
      await message.reply('⚠️ Something went wrong. Try again later.');
    } catch {
      // ignore
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction, backendUrl);
    } else if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
    } else if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;
      if (customId.startsWith('toggle-')) {
        const deviceId = interaction.values[0];
        if (!deviceId) {
          await interaction.update({ content: '⚠️ Invalid selection.', components: [] });
          return;
        }
        await interaction.deferUpdate();
        const result = await handleSelectToggle(client, backendUrl, deviceId);
        const msg = result.embed.data.description ?? (result.success ? 'Updated.' : 'Failed.');
        await interaction.editReply({
          content: msg,
          embeds: [result.embed],
          components: [],
        });
      }
    }
  } catch (err) {
    logger.error({ err }, '[Bot] Unhandled interaction error');
    try {
      if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: '⚠️ Something went wrong. Try again later.', ephemeral: true });
      }
    } catch {
      // ignore follow-up errors
    }
  }
});

client.login(token);

async function handlePrefixRoom(message: any, roomArg: string | undefined) {
  const room = roomArg?.toLowerCase();
  if (!room || !['drawing', 'work1', 'work2'].includes(room)) {
    await message.reply('⚠️ Usage: `!room <drawing|work1|work2>`');
    return;
  }

  const devices = state.devices.filter((d: any) => d.room === room);

  const systemPrompt =
    `Translate this list of devices in ${getRoomDisplayName(room)} into a conversational, fun update. ` +
    `If everything is off, praise the room occupants. If things are left on, make a playful, judgey remark. ` +
    `Keep it under 100 words. Use emojis.`;

  const aiMessage = await generateReply(systemPrompt, {
    roomName: getRoomDisplayName(room),
    devices: devices.map((d: any) => ({
      name: d.name,
      status: d.status,
      powerDraw: d.powerDraw,
      lastChanged: d.lastChanged,
    })),
  });

  const { createEmbed, COLORS } = await import('./embeds');
  const embed = createEmbed(`📋 ${getRoomDisplayName(room)}`, aiMessage, COLORS.neutral);
  await message.reply({ embeds: [embed] });
}

async function handlePrefixUsage(message: any) {
  const usage = state.usage;
  if (!usage) {
    await message.reply('⚠️ Usage data not available yet. Try again in a moment.');
    return;
  }

  const now = new Date();
  const hoursElapsed = now.getHours() + now.getMinutes() / 60;
  const todayKwhEstimate = Number(((usage.totalWatts * hoursElapsed) / 1000).toFixed(2));

  const systemPrompt =
    'You are the friendly, opinionated AI energy assistant for "The Big Boss Idea" office. Interpret the current power draw and the estimated daily usage (kWh). Provide a playful, conversational response. If usage is high (e.g. > 200W), warn the boss. If it\'s low, congratulate the team. Keep it under 100 words. Use emojis.';

  const aiMessage = await generateReply(systemPrompt, {
    totalWatts: usage.totalWatts,
    perRoom: usage.perRoom,
    todayKwhEstimate,
    timeOfDay: now.toLocaleTimeString(),
  });

  const { createEmbed, COLORS } = await import('./embeds');
  const embed = createEmbed('📊 Power Usage', aiMessage, COLORS.neutral);
  await message.reply({ embeds: [embed] });
}

async function handlePrefixAsk(message: any, question: string | undefined) {
  if (!question) {
    await message.reply('⚠️ Usage: `!ask <your question>`');
    return;
  }

  const systemPrompt =
    'You are the friendly, opinionated AI assistant for "The Big Boss Idea" office. You answer questions about office energy usage, device status, room conditions, and energy-saving tips. If you don\'t know something, say so honestly. Be conversational, use emojis, Nintendo/Stardew Valley style, and keep answers under 150 words.';

  const aiMessage = await generateReply(systemPrompt, {
    question,
    user: message.author.tag,
    timestamp: new Date().toISOString(),
  });

  const { createEmbed, COLORS } = await import('./embeds');
  const embed = createEmbed('🤖 AI Response', aiMessage, COLORS.neutral);
  await message.reply({ embeds: [embed] });
}
