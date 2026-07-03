import { Device } from '@prisma/client';
import { generateReply } from './ai';

export interface Alert {
  type: 'after-hours' | 'stuck-on';
  room: string;
  deviceIds: string[];
  message: string;
  timestamp: Date;
}

// In-memory set to track already dispatched alert signatures
const seenAlerts = new Set<string>();

/**
 * Computes all active alerts based on current device states from the database.
 */
export function computeAlerts(devices: Device[]): Alert[] {
  const alerts: Alert[] = [];
  const now = new Date();
  
  // Stuck-on threshold (default 2 hours = 7200s, configurable via env for demo)
  const stuckOnThresholdMs = (Number(process.env.STUCK_ON_THRESHOLD_SECONDS) || 7200) * 1000;
  
  // After-hours check: 9 AM to 5 PM local time (outside these hours is after-hours)
  const hour = now.getHours();
  const isAfterHours = hour < 9 || hour >= 17;

  const rooms = ['drawing', 'work1', 'work2'];

  for (const room of rooms) {
    const roomDevices = devices.filter((d) => d.room === room);
    const onDevices = roomDevices.filter((d) => d.status === 'on');

    if (onDevices.length > 0) {
      // 1. Check for after-hours alert
      if (isAfterHours) {
        const roomName = getRoomDisplayName(room);
        alerts.push({
          type: 'after-hours',
          room,
          deviceIds: onDevices.map((d) => d.id),
          message: `${roomName} has ${onDevices.length} active device(s) on after hours.`,
          timestamp: now,
        });
      }

      // 2. Check for stuck-on alert per device, grouped by room
      const stuckDevices = onDevices.filter((d) => {
        const elapsed = now.getTime() - new Date(d.lastChanged).getTime();
        return elapsed > stuckOnThresholdMs;
      });

      if (stuckDevices.length > 0) {
        const roomName = getRoomDisplayName(room);
        const deviceNames = stuckDevices.map((d) => d.name).join(', ');
        alerts.push({
          type: 'stuck-on',
          room,
          deviceIds: stuckDevices.map((d) => d.id),
          message: `Devices (${deviceNames}) in ${roomName} have been on for too long.`,
          timestamp: now,
        });
      }
    }
  }

  return alerts;
}

/**
 * Checks for new alerts and triggers Discord Webhook if configured.
 * Deduplicates in-memory using alert signatures.
 */
export async function processAlertNotifications(devices: Device[]): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  const activeAlerts = computeAlerts(devices);
  const currentSignatures = new Set<string>();

  for (const alert of activeAlerts) {
    // Generate signature: e.g., after-hours-work1-work1-fan-1,work1-light-1
    const signature = `${alert.type}-${alert.room}-${[...alert.deviceIds].sort().join(',')}`;
    currentSignatures.add(signature);

    if (!seenAlerts.has(signature)) {
      // New alert detected!
      seenAlerts.add(signature);
      console.log(`[Alerts] New alert triggered: ${signature}. Sending Discord Webhook...`);

      // Generate AI-composed friendly alert message
      const systemPrompt = 
        `You are the office energy monitoring system. You are alerting the boss/team on Discord ` +
        `about an anomalous energy event. Keep the message highly conversational, friendly, ` +
        `and slightly opinionated about energy wastage. Use a Nintendo/Stardew Valley retro feel, ` +
        `employ emojis, and be clear about which room and devices are causing the alert. Do NOT exceed 3 sentences.`;

      const aiMessage = await generateReply(systemPrompt, {
        alert: {
          type: alert.type,
          room: getRoomDisplayName(alert.room),
          message: alert.message,
          timestamp: alert.timestamp.toISOString(),
        },
        devices: devices.filter((d) => alert.deviceIds.includes(d.id)).map((d) => ({
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
        console.log(`[Alerts] Successfully posted new alert to Discord Webhook.`);
      } catch (err) {
        console.error('[Alerts] Failed to send Discord Webhook:', err);
      }
    }
  }

  // Remove signatures that are no longer active, so they can be re-triggered later if they happen again
  for (const sig of seenAlerts) {
    if (!currentSignatures.has(sig)) {
      seenAlerts.delete(sig);
    }
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
