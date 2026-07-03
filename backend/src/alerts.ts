import { prisma } from './db';
import { generateReply } from './ai';

export interface Alert {
  type: 'after-hours' | 'stuck-on';
  room: string;
  deviceIds: string[];
  message: string;
  timestamp: Date;
}

/**
 * Evaluates current device states against alert rules.
 * Writes new active alerts to the AlertLog database table and resolves completed ones.
 */
export async function getAlerts(): Promise<Alert[]> {
  const devices = await prisma.device.findMany();
  const now = new Date();
  
  // 1. Stuck-on threshold (default 2 hours = 7200000ms, configurable via env STUCK_ON_THRESHOLD_MS)
  const stuckOnThresholdMs = Number(process.env.STUCK_ON_THRESHOLD_MS) || 2 * 60 * 60 * 1000;
  
  // 2. After-hours check: 9 AM to 5 PM local time (outside these hours is after-hours)
  const hour = now.getHours();
  const isAfterHours = hour < 9 || hour >= 17;

  const activeAlerts: Alert[] = [];
  const rooms = ['drawing', 'work1', 'work2'];

  for (const room of rooms) {
    const roomDevices = devices.filter((d) => d.room === room);
    const onDevices = roomDevices.filter((d) => d.status === 'on');

    if (onDevices.length > 0) {
      const roomName = getRoomDisplayName(room);

      // Check: after-hours
      if (isAfterHours) {
        activeAlerts.push({
          type: 'after-hours',
          room,
          deviceIds: onDevices.map((d) => d.id),
          message: `${roomName} has ${onDevices.length} device(s) left ON after hours (9 AM - 5 PM).`,
          timestamp: now,
        });
      }

      // Check: stuck-on
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

  // Synchronize computed active alerts with database AlertLog table
  try {
    await syncAlertLogs(activeAlerts, devices);
  } catch (err) {
    console.error('[Alerts] Error synchronizing alert logs in DB:', err);
  }

  return activeAlerts;
}

/**
 * Handles database AlertLog inserts for new alerts and updates resolved = true for resolved alerts.
 * Also triggers Discord Webhook for new alerts.
 */
async function syncAlertLogs(activeAlerts: Alert[], allDevices: any[]) {
  // Fetch unresolved alert logs from the database
  const unresolvedLogs = await prisma.alertLog.findMany({ where: { resolved: false } });

  // 1. Process active alerts: write to DB if it doesn't already exist
  for (const alert of activeAlerts) {
    const sortedDeviceIds = [...alert.deviceIds].sort();

    // Check if there is an existing unresolved AlertLog with same type, room and device list
    const logExists = unresolvedLogs.some((log) => {
      if (log.type !== alert.type || log.room !== alert.room) return false;
      const logDeviceIds = (log.deviceIds as string[]) || [];
      return logDeviceIds.length === sortedDeviceIds.length &&
             [...logDeviceIds].sort().every((id, idx) => id === sortedDeviceIds[idx]);
    });

    if (!logExists) {
      // Create new AlertLog entry in DB
      await prisma.alertLog.create({
        data: {
          type: alert.type,
          room: alert.room,
          deviceIds: sortedDeviceIds,
          message: alert.message,
          timestamp: alert.timestamp,
          resolved: false,
        },
      });
      console.log(`[AlertLog] Fired and saved new active alert: ${alert.type} in ${alert.room}`);

      // Dispatch proactive Discord notification using Gemini wrapper
      triggerDiscordWebhook(alert, allDevices).catch((err) => {
        console.error('[Alerts] Error sending webhook notify:', err);
      });
    }
  }

  // 2. Mark resolved logs: if an unresolved log is not in the active alerts list, set resolved = true
  for (const log of unresolvedLogs) {
    const logDeviceIds = (log.deviceIds as string[]) || [];
    const sortedLogDeviceIds = [...logDeviceIds].sort();

    const stillActive = activeAlerts.some((alert) => {
      if (alert.type !== log.type || alert.room !== log.room) return false;
      return alert.deviceIds.length === sortedLogDeviceIds.length &&
             [...alert.deviceIds].sort().every((id, idx) => id === sortedLogDeviceIds[idx]);
    });

    if (!stillActive) {
      await prisma.alertLog.update({
        where: { id: log.id },
        data: { resolved: true },
      });
      console.log(`[AlertLog] Resolved alert ID ${log.id}: ${log.type} in ${log.room}`);
    }
  }
}

/**
 * Triggers Discord Webhook proactive alerting using AI-generated conversational text.
 */
async function triggerDiscordWebhook(alert: Alert, allDevices: any[]) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  console.log(`[Alerts] Sending proactive Discord alert for: ${alert.type} in ${alert.room}`);

  const systemPrompt = 
    `You are the office energy monitoring system. You are alerting the boss/team on Discord ` +
    `about an anomalous energy event. Keep the message highly conversational, friendly, ` +
    `and slightly opinionated about energy wastage. Use a Nintendo/Stardew Valley retro feel, ` +
    `employ emojis, and be clear about which room and devices are causing the alert. Do NOT exceed 3 sentences.`;

  const roomName = getRoomDisplayName(alert.room);
  const activeDevices = allDevices.filter((d) => alert.deviceIds.includes(d.id));

  const aiMessage = await generateReply(systemPrompt, {
    alert: {
      type: alert.type,
      room: roomName,
      message: alert.message,
      timestamp: alert.timestamp.toISOString(),
    },
    devices: activeDevices.map((d) => ({
      name: d.name,
      lastChanged: d.lastChanged.toISOString()
    }))
  });

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: aiMessage }),
    });
    console.log(`[Alerts] Webhook message successfully sent.`);
  } catch (err) {
    console.error('[Alerts] Failed to post Discord Webhook:', err);
  }
}

function getRoomDisplayName(room: string): string {
  switch (room) {
    case 'drawing': return 'Drawing Room';
    case 'work1': return 'Work Room 1';
    case 'work2': return 'Work Room 2';
    default: return room;
  }
}
