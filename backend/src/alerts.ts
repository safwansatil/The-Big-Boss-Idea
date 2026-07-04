import { prisma } from './db';
import { generateReply } from './ai';
import { getStuckOnThresholdMs } from './config';
import { logger } from './logger';

export interface Alert {
  type: 'after-hours' | 'stuck-on';
  room: string;
  deviceIds: string[];
  message: string;
  timestamp: Date;
}

const AI_CACHE_TTL_MS = 10 * 60 * 1000;
const aiMessageCache = new Map<string, { message: string; expiresAt: number }>();

function getAiCacheKey(alert: Alert): string {
  const sortedIds = [...alert.deviceIds].sort();
  return `${alert.type}:${alert.room}:${sortedIds.join(',')}`;
}

const recentlyNotifiedKeys = new Map<string, number>();

function getNotifiedKey(alert: Alert): string {
  const sorted = [...alert.deviceIds].sort();
  return `${alert.type}:${alert.room}:${sorted.join(',')}`;
}

export async function getAlerts(): Promise<Alert[]> {
  const devices = await prisma.device.findMany();
  const now = new Date();

  const stuckOnThresholdMs = getStuckOnThresholdMs();

  const hour = now.getHours();
  const isAfterHours = hour < 9 || hour >= 17;

  const activeAlerts: Alert[] = [];
  const rooms = ['drawing', 'work1', 'work2'];

  for (const room of rooms) {
    const roomDevices = devices.filter((d) => d.room === room);
    const onDevices = roomDevices.filter((d) => d.status === 'on');

    if (onDevices.length > 0) {
      const roomName = getRoomDisplayName(room);

      if (isAfterHours) {
        activeAlerts.push({
          type: 'after-hours',
          room,
          deviceIds: onDevices.map((d) => d.id),
          message: `${roomName} has ${onDevices.length} device(s) left ON after hours (9 AM - 5 PM).`,
          timestamp: now,
        });
      }

      const stuckDevices = onDevices.filter((d) => {
        const elapsed = now.getTime() - new Date(d.lastChanged).getTime();
        return elapsed > stuckOnThresholdMs;
      });

      if (stuckDevices.length > 0) {
        const deviceNames = stuckDevices.map((d) => d.name).join(', ');
        activeAlerts.push({
          type: 'stuck-on',
          room,
          deviceIds: stuckDevices.map((d) => d.id),
          message: `Devices (${deviceNames}) in ${roomName} have been ON for over ${Math.floor(stuckOnThresholdMs / 60000)} mins continuously.`,
          timestamp: now,
        });
      }
    }
  }

  try {
    await syncAlertLogs(activeAlerts, devices);
  } catch (err) {
    logger.error({ err }, '[Alerts] Error synchronizing alert logs in DB');
  }

  return activeAlerts;
}

async function syncAlertLogs(activeAlerts: Alert[], allDevices: any[]) {
  const unresolvedLogs = await prisma.alertLog.findMany({ where: { resolved: false } });

  for (const alert of activeAlerts) {
    const sortedDeviceIds = [...alert.deviceIds].sort();

    const logExists = unresolvedLogs.some((log) => {
      if (log.type !== alert.type || log.room !== alert.room) return false;
      const logDeviceIds = (log.deviceIds as string[]) || [];
      return logDeviceIds.length === sortedDeviceIds.length &&
             [...logDeviceIds].sort().every((id, idx) => id === sortedDeviceIds[idx]);
    });

    if (!logExists) {
      const aiPromptPayload = {
        alert: {
          type: alert.type,
          room: getRoomDisplayName(alert.room),
          message: alert.message,
        },
        devices: allDevices
          .filter((d) => alert.deviceIds.includes(d.id))
          .map((d) => ({ name: d.name })),
      };

      const notifyKey = getNotifiedKey(alert);
      const lastNotifiedAt = recentlyNotifiedKeys.get(notifyKey);
      let aiMessage: string | undefined;

      if (lastNotifiedAt && Date.now() - lastNotifiedAt < 5 * 60 * 1000) {
        await prisma.alertLog.create({
          data: {
            type: alert.type,
            room: alert.room,
            deviceIds: sortedDeviceIds,
            message: alert.message,
            aiMessage: aiMessage ?? null,
            timestamp: alert.timestamp,
            resolved: false,
          },
        });
        logger.info(`[AlertLog] Suppressed repeat webhook for ${alert.type} in ${alert.room}`);
      } else {
        const cacheKey = getAiCacheKey(alert);
        const cached = aiMessageCache.get(cacheKey);

        if (cached && cached.expiresAt > Date.now()) {
          aiMessage = cached.message;
        } else {
          try {
            const systemPrompt =
              'You are the office energy monitoring system. Alert the boss/team on Discord about an anomalous energy event. Keep the message highly conversational, friendly, slightly opinionated about energy wastage. Use a Nintendo/Stardew Valley retro feel, employ emojis, and be clear about which room and devices are causing the alert. Do NOT exceed 3 sentences.';
            aiMessage = await generateReply(systemPrompt, aiPromptPayload);
            aiMessageCache.set(cacheKey, { message: aiMessage || '', expiresAt: Date.now() + AI_CACHE_TTL_MS });
          } catch (err) {
            logger.error({ err }, '[Alerts] Failed to generate AI message');
          }
        }

        await prisma.alertLog.create({
          data: {
            type: alert.type,
            room: alert.room,
            deviceIds: sortedDeviceIds,
            message: alert.message,
            aiMessage: aiMessage ?? null,
            timestamp: alert.timestamp,
            resolved: false,
          },
        });
        logger.info(`[AlertLog] Fired and saved new active alert: ${alert.type} in ${alert.room}`);

        triggerDiscordWebhook(alert, allDevices, aiMessage).catch((err) => {
          logger.error({ err }, '[Alerts] Error sending webhook notify');
        });

        recentlyNotifiedKeys.set(notifyKey, Date.now());
      }
    }
  }

  for (const log of unresolvedLogs) {
    const logDeviceIds = (log.deviceIds as string[]) || [];
    const sortedLogDeviceIds = [...logDeviceIds].sort();

    const stillActive = activeAlerts.some((alert) => {
      if (alert.type !== log.type || log.room !== alert.room) return false;
      return alert.deviceIds.length === sortedLogDeviceIds.length &&
             [...alert.deviceIds].sort().every((id, idx) => id === sortedLogDeviceIds[idx]);
    });

    if (!stillActive) {
      const notifyKey = `${log.type}:${log.room}:${sortedLogDeviceIds.join(',')}`;
      recentlyNotifiedKeys.delete(notifyKey);

      await prisma.alertLog.update({
        where: { id: log.id },
        data: { resolved: true },
      });
      logger.info(`[AlertLog] Resolved alert ID ${log.id}: ${log.type} in ${log.room}`);
    }
  }
}

async function triggerDiscordWebhook(alert: Alert, allDevices: any[], aiMessage?: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  logger.info(`[Alerts] Sending proactive Discord alert for: ${alert.type} in ${alert.room}`);

  const content = aiMessage || alert.message;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
    signal: AbortSignal.timeout(10_000),
  });

  logger.info('[Alerts] Webhook message successfully sent.');
}

function getRoomDisplayName(room: string): string {
  switch (room) {
    case 'drawing': return 'Drawing Room';
    case 'work1': return 'Work Room 1';
    case 'work2': return 'Work Room 2';
    default: return room;
  }
}
