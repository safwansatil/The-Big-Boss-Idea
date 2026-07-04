import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { generateReply } from '@big-boss/ai-utils';
import { logger } from './logger';
import { state } from './state';
import { createEmbed, COLORS } from './embeds';

export function getRoomDisplayName(room: string): string {
  switch (room) {
    case 'drawing': return 'Drawing Room';
    case 'work1': return 'Work Room 1';
    case 'work2': return 'Work Room 2';
    default: return room;
  }
}

export const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Show power and device status per room'),
  new SlashCommandBuilder().setName('room').setDescription('Show detailed devices in a room')
    .addStringOption((option) =>
      option
        .setName('name')
        .setDescription('Room name')
        .setRequired(true)
        .addChoices(
          { name: 'Drawing Room', value: 'drawing' },
          { name: 'Work Room 1', value: 'work1' },
          { name: 'Work Room 2', value: 'work2' },
        ),
    ),
  new SlashCommandBuilder().setName('usage').setDescription('Show current power draw and estimated daily kWh'),
  new SlashCommandBuilder().setName('ask').setDescription('Ask the AI anything using a modal'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Show energy saving leaderboard per room'),
  new SlashCommandBuilder().setName('health').setDescription('Check backend health and bot status'),
  new SlashCommandBuilder()
    .setName('set-threshold')
    .setDescription('Set stuck-on alert threshold in minutes')
    .addIntegerOption((option) => option.setName('minutes').setDescription('Minutes').setRequired(true)),
  new SlashCommandBuilder()
    .setName('toggle')
    .setDescription('Toggle a device on/off')
    .addStringOption((option) =>
      option
        .setName('room')
        .setDescription('Room name')
        .setRequired(true)
        .addChoices(
          { name: 'Drawing Room', value: 'drawing' },
          { name: 'Work Room 1', value: 'work1' },
          { name: 'Work Room 2', value: 'work2' },
        ),
    ),
  new SlashCommandBuilder().setName('predict').setDescription('Predict EOD usage and get one actionable tip'),
];

export async function handleSlashCommand(
  interaction: ChatInputCommandInteraction,
  backendUrl: string,
) {
  const cmd = interaction.commandName;

  if (cmd === 'status') {
    await handleStatus(interaction);
  } else if (cmd === 'room') {
    await handleRoom(interaction);
  } else if (cmd === 'usage') {
    await handleUsage(interaction);
  } else if (cmd === 'ask') {
    await handleAsk(interaction);
  } else if (cmd === 'leaderboard') {
    await handleLeaderboard(interaction, backendUrl);
  } else if (cmd === 'health') {
    await handleHealth(interaction, backendUrl);
  } else if (cmd === 'set-threshold') {
    await handleSetThreshold(interaction, backendUrl);
  } else if (cmd === 'toggle') {
    await handleToggle(interaction);
  } else if (cmd === 'predict') {
    await handlePredict(interaction, backendUrl);
  }
}

async function handleStatus(interaction: ChatInputCommandInteraction) {
  const devices = state.devices;
  const roomSummary: Record<string, { fansOn: number; lightsOn: number; totalDevices: number }> = {
    'Drawing Room': { fansOn: 0, lightsOn: 0, totalDevices: 0 },
    'Work Room 1': { fansOn: 0, lightsOn: 0, totalDevices: 0 },
    'Work Room 2': { fansOn: 0, lightsOn: 0, totalDevices: 0 },
  };

  for (const d of devices) {
    const displayName = getRoomDisplayName(d.room);
    roomSummary[displayName].totalDevices++;
    if (d.status === 'on') {
      if (d.type === 'fan') roomSummary[displayName].fansOn++;
      if (d.type === 'light') roomSummary[displayName].lightsOn++;
    }
  }

  const systemPrompt =
    'You are the friendly AI energy assistant for "The Big Boss Idea" office. Translate the raw device summary into a warm, natural, and conversational Discord message. Do not output markdown tables. Use bullets or text paragraphs. Be playful, use emojis, and comment on which rooms have devices left ON. Keep it under 150 words.';

  const aiMessage = await generateReply(systemPrompt, { rooms: roomSummary });

  const embed = createEmbed('⚡ Office Status', aiMessage, COLORS.neutral);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleRoom(interaction: ChatInputCommandInteraction) {
  const room = interaction.options.getString('name', true);
  const devices = state.devices.filter((d) => d.room === room);

  const sorted = [...devices].sort((a, b) => a.name.localeCompare(b.name));
  const lines = sorted.map((d) => {
    const status = d.status.toUpperCase();
    const icon = status === 'ON' ? '🟢 ON' : '🔴 OFF';
    const power = d.powerDraw > 0 ? `${d.powerDraw}W` : '0W';
    const time = new Date(d.lastChanged).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${d.name}: ${icon} | Power: ${power} | Last: ${time}`;
  });

  const systemPrompt =
    `You are the snarky but friendly office energy assistant. Give a SHORT clever summary of this room's current status. ` +
    `If everything is off, praise room occupants. If things are left on, make a playful, judgey remark. Keep it under 40 words. Use emojis. Do NOT repeat or list the devices.`;

  const aiSummary = await generateReply(systemPrompt, {
    roomName: getRoomDisplayName(room),
    devices: sorted.map((d) => ({
      name: d.name,
      status: d.status,
      powerDraw: d.powerDraw,
      lastChanged: d.lastChanged,
    })),
  });

  const description = `${lines.join('\n')}\n\n${aiSummary}`;
  const embed = createEmbed(`📋 ${getRoomDisplayName(room)}`, description, COLORS.neutral);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleUsage(interaction: ChatInputCommandInteraction) {
  const usage = state.usage;
  if (!usage) {
    await interaction.reply({ content: '⚠️ Usage data not available yet. Try again in a moment.', ephemeral: true });
    return;
  }

  const now = new Date();
  const hoursElapsed = now.getHours() + now.getMinutes() / 60;
  const todayKwhEstimate = Number(((usage.totalWatts * hoursElapsed) / 1000).toFixed(2));

  const systemPrompt =
    'You are the friendly, opinionated AI energy assistant for "The Big Boss Idea" office. Interpret the current power draw and the estimated daily usage (kWh). Provide a playful, conversational response. If usage is high (e.g. > 200W), warn the boss. If it\'s low, congratulate the team. Keep it under 100 words.';

  const aiMessage = await generateReply(systemPrompt, {
    totalWatts: usage.totalWatts,
    perRoom: usage.perRoom,
    todayKwhEstimate,
    timeOfDay: now.toLocaleTimeString(),
  });

  const embed = createEmbed('📊 Power Usage', aiMessage, COLORS.neutral);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleAsk(interaction: ChatInputCommandInteraction) {
  const modal = new ModalBuilder()
    .setCustomId('ask-modal')
    .setTitle('Ask the AI');

  const questionInput = new TextInputBuilder()
    .setCustomId('question')
    .setLabel('What do you want to know?')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(questionInput));
  await interaction.showModal(modal);
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  if (interaction.customId !== 'ask-modal') return;

  const question = interaction.fields.getTextInputValue('question');

  const systemPrompt =
    'You are the friendly, opinionated AI assistant for "The Big Boss Idea" office. You answer questions about office energy usage, device status, room conditions, and energy-saving tips. If you don\'t know something, say so honestly. Be conversational, use emojis, Nintendo/Stardew Valley style, and keep answers under 150 words.';

  const aiMessage = await generateReply(systemPrompt, {
    question,
    user: interaction.user.tag,
    timestamp: new Date().toISOString(),
  });

  const embed = createEmbed('🤖 AI Response', aiMessage, COLORS.neutral);
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction, backendUrl: string) {
  try {
    const res = await fetch(`${backendUrl}/api/leaderboard`);
    const data = (await res.json()) as Array<{ room: string; resolved: number; unresolved: number }>;
    data.sort((a, b) => b.resolved - a.resolved);

    const lines = data.map((entry, idx) => `${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''} ${getRoomDisplayName(entry.room)} — ${entry.resolved} resolved, ${entry.unresolved} active`);

    const embed = createEmbed('🏆 Energy Leaderboard', lines.join('\n') || 'No data yet.', COLORS.good);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch {
    await interaction.reply({ content: '⚠️ Failed to load leaderboard.', ephemeral: true });
  }
}

async function handleHealth(interaction: ChatInputCommandInteraction, backendUrl: string) {
  try {
    const res = await fetch(`${backendUrl}/api/health`);
    const health = (await res.json()) as any;

    const lines = [
      `**Backend:** ${health.status ?? 'unknown'}`,
      `**Database:** ${health.database ?? 'unknown'}`,
      `**SSE:** ${state.sseConnected ? '✅ Connected' : '❌ Disconnected'}`,
      `**Active Alerts:** ${state.alerts.length}`,
      `**Devices Online:** ${state.devices.filter((d) => d.status === 'on').length} / ${state.devices.length}`,
    ];

    const embed = createEmbed('💓 Health Check', lines.join('\n'), COLORS.neutral);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch {
    await interaction.reply({ content: '⚠️ Backend health check failed.', ephemeral: true });
  }
}

async function handleSetThreshold(interaction: ChatInputCommandInteraction, backendUrl: string) {
  const minutes = interaction.options.getInteger('minutes', true);
  if (minutes <= 0) {
    await interaction.reply({ content: '⚠️ Minutes must be a positive number.', ephemeral: true });
    return;
  }

  const ms = minutes * 60 * 1000;

  try {
    const res = await fetch(`${backendUrl}/api/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stuckOnThresholdMs: ms }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Backend rejected config update');
    }

    await interaction.reply({
      content: `✅ Stuck-on threshold updated to **${minutes} minute(s)**. Alerts will use the new value immediately.`,
      ephemeral: true,
    });
  } catch (err: any) {
    logger.error({ err }, '[Slash] Failed to set threshold');
    await interaction.reply({ content: `⚠️ ${err.message || 'Failed to update threshold.'}`, ephemeral: true });
  }
}

async function handleToggle(interaction: ChatInputCommandInteraction) {
  const room = interaction.options.getString('room', true);
  const devices = state.devices.filter((d) => d.room === room);

  if (devices.length === 0) {
    await interaction.reply({ content: '⚠️ No devices found for that room.', ephemeral: true });
    return;
  }

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`toggle-${room}-${interaction.id}`)
      .setPlaceholder('Select a device to toggle')
      .addOptions(
        devices.map((d) => ({
          label: d.name,
          value: d.id,
          description: `${d.status.toUpperCase()} — ${d.powerDraw}W`,
        })),
      ),
  );

  await interaction.reply({
    content: `Pick a ${getRoomDisplayName(room)} device to toggle:`,
    components: [row],
    ephemeral: true,
  });
}

export async function handleSelectToggle(
  _client: unknown,
  backendUrl: string,
  deviceId: string,
) {
  try {
    let devicesList: any[] = state.devices;
    if (!devicesList || devicesList.length === 0) {
      const devicesRes = await fetch(`${backendUrl}/api/devices`);
      if (devicesRes.ok) {
        devicesList = (await devicesRes.json()) as any[];
      }
    }

    const prev = devicesList.find((d: any) => d.id === deviceId);
    if (!prev) throw new Error('Device not found');

    const res = await fetch(`${backendUrl}/api/devices/${deviceId}/toggle`, { method: 'POST' });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Backend failed to toggle device');
    }

    const updated = (await res.json()) as {
      status: string;
      previousStatus: string;
      wattsDelta: number;
    };

    const delta = updated.wattsDelta ?? 0;
    const changed = delta >= 0 ? `+${delta}W` : `${delta}W`;

    const embed = createEmbed(
      '🔌 Device Toggled',
      `**${prev.name}** changed from **${prev.status.toUpperCase()} → ${updated.status.toUpperCase()}**\nDelta: ${changed}`,
      updated.status === 'on' ? COLORS.alert : COLORS.good,
    );

    return { success: true, embed };
  } catch (err: any) {
    logger.error({ err }, '[Slash] Toggle failed');
    return {
      success: false,
      embed: createEmbed('⚠️ Toggle Failed', err.message || 'Unknown error', COLORS.alert),
    };
  }
}

async function handlePredict(interaction: ChatInputCommandInteraction, backendUrl: string) {
  try {
    const [usageRes, alertsRes] = await Promise.all([
      fetch(`${backendUrl}/api/usage`).then((r) => r.json()),
      fetch(`${backendUrl}/api/alerts`).then((r) => r.json()),
    ]);

    const systemPrompt =
      'Based on the current power draw and time of day, project end-of-day usage and give one actionable tip. Keep it under 120 words. Use emojis and Stardew Valley style.';

    const aiText = await generateReply(systemPrompt, {
      totalWatts: (usageRes as any).totalWatts,
      perRoom: (usageRes as any).perRoom,
      timeOfDay: new Date().toLocaleTimeString(),
      alerts: alertsRes,
    });

    const embed = createEmbed('🔮 EOD Prediction', aiText, COLORS.neutral);
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } catch {
    await interaction.reply({ content: '⚠️ Failed to generate prediction.', ephemeral: true });
  }
}
