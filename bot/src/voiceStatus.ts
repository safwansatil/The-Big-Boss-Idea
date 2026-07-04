import type { Client, VoiceChannel } from 'discord.js';
import { logger } from './logger';

let lastBroadcastedWatts: number | null = null;
const HYSTERESIS_W = 5;

export function shouldUpdateVoice(watts: number): boolean {
  if (lastBroadcastedWatts === null) return true;
  return Math.abs(watts - lastBroadcastedWatts) >= HYSTERESIS_W;
}

export function recordVoiceUpdate(watts: number) {
  lastBroadcastedWatts = watts;
}

export async function updateVoiceChannelName(
  client: Client,
  voiceChannelId: string,
  wattage: number,
) {
  if (!voiceChannelId) return;
  if (!shouldUpdateVoice(wattage)) return;

  try {
    const channel = await client.channels.fetch(voiceChannelId);
    if (!channel?.isVoiceBased()) return;

    const me = channel.guild.members.resolve(client.user!.id);
    if (!me) return;
    const missing = channel.permissionsFor(me)?.missing('ManageChannels');
    if (Array.isArray(missing) && missing.length > 0) {
      logger.warn('[Voice] Missing ManageChannels permission; skipping voice rename');
      return;
    }

    await (channel as VoiceChannel).setName(`⚡ Load: ${wattage}W`);
    recordVoiceUpdate(wattage);
    logger.info(`[Voice] Updated channel name to ⚡ Load: ${wattage}W`);
  } catch (err: any) {
    if (err?.code === 50013) {
      logger.warn('[Voice] Missing ManageChannels permission (HTTP 50013). Grant the bot Manage Channels in the server settings and reload the application.');
    } else {
      logger.warn({ err }, '[Voice] Failed to update channel name');
    }
  }
}
