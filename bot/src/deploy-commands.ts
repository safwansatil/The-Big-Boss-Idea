import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN || '';
const clientId = process.env.DISCORD_CLIENT_ID || '';
const guildId = process.env.DISCORD_GUILD_ID || '';

if (!token) {
  console.error('[Deploy] DISCORD_BOT_TOKEN is not set');
  process.exit(1);
}

if (!clientId) {
  console.error('[Deploy] DISCORD_CLIENT_ID is not set');
  process.exit(1);
}

const commands = [
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

const rest = new REST().setToken(token);

(async () => {
  try {
    console.log(`[Deploy] Refreshing ${commands.length} application (/) commands...`);

    const target = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
    const data = (await rest.put(target, { body: commands.map((c) => c.toJSON()) })) as any;

    console.log(`[Deploy] Successfully reloaded ${(data as any[])?.length ?? '?'} commands.`);
  } catch (error) {
    console.error('[Deploy] Failed to deploy commands:', error);
  }
})();
