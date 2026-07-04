import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import type { Client } from 'discord.js';
import { generateReply } from '@big-boss/ai-utils';

const REPORTS_STATE_FILE = path.resolve('reports-state.json');

interface ReportsState {
  lastDailyReport: string | null;
  lastWeeklyReport: string | null;
}

let reportsState: ReportsState = { lastDailyReport: null, lastWeeklyReport: null };

function ensureReportsPath() {
  const dir = path.dirname(REPORTS_STATE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(REPORTS_STATE_FILE)) {
    fs.writeFileSync(REPORTS_STATE_FILE, JSON.stringify({ lastDailyReport: null, lastWeeklyReport: null }, null, 2), 'utf-8');
  }
}

function loadReportsState() {
  try {
    ensureReportsPath();
    reportsState = JSON.parse(fs.readFileSync(REPORTS_STATE_FILE, 'utf-8')) as ReportsState;
  } catch {
    reportsState = { lastDailyReport: null, lastWeeklyReport: null };
  }
}

function saveReportsState() {
  ensureReportsPath();
  fs.writeFileSync(REPORTS_STATE_FILE, JSON.stringify(reportsState, null, 2), 'utf-8');
}

function getAlertChannel(client: Client) {
  const alertChannelId = process.env.DISCORD_ALLOWED_CHANNEL_ID;
  if (!alertChannelId) return null;
  try {
    return client.channels.cache.get(alertChannelId) ?? null;
  } catch {
    return null;
  }
}

async function postDailyReport(client: Client, backendUrl: string) {
  try {
    const usageRes = await fetch(`${backendUrl}/api/usage`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json());
    const alertsRes = await fetch(`${backendUrl}/api/alerts`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json());

    const systemPrompt =
      'You are the friendly AI energy assistant for "The Big Boss Idea" office. Generate a daily summary report. Include: total kWh estimate, top consumer room, and one actionable tip. Keep it under 150 words. Use emojis and Stardew Valley style.';

    const aiText = await generateReply(systemPrompt, {
      totalWatts: (usageRes as any).totalWatts,
      perRoom: (usageRes as any).perRoom,
      alerts: alertsRes,
      date: new Date().toISOString(),
    });

    const channel = getAlertChannel(client);
    if (channel && 'send' in channel) {
      await channel.send({ content: aiText });
      reportsState.lastDailyReport = new Date().toISOString();
      saveReportsState();
    }
  } catch (err) {
    logger.error({ err }, '[Cron] Failed to post daily report');
  }
}

async function postWeeklyReport(client: Client, backendUrl: string) {
  try {
    const alertsRes = await fetch(`${backendUrl}/api/alerts`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json());
    const leaderboardRes = await fetch(`${backendUrl}/api/leaderboard`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.json());

    const systemPrompt =
      'You are the friendly AI energy assistant for "The Big Boss Idea" office. Generate a weekly trend analysis. Compare this week to prior week, highlight improvements or concerns, keep it under 200 words. Use emojis and Stardew Valley style.';

    const aiText = await generateReply(systemPrompt, {
      alerts: alertsRes,
      leaderboard: leaderboardRes,
      weekRange: {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      },
    });

    const channel = getAlertChannel(client);
    if (channel && 'send' in channel) {
      await channel.send({ content: aiText });
      reportsState.lastWeeklyReport = new Date().toISOString();
      saveReportsState();
    }
  } catch (err) {
    logger.error({ err }, '[Cron] Failed to post weekly report');
  }
}

export function setupCrons(client: Client, backendUrl: string) {
  loadReportsState();

  const dailyCronExpr = process.env.REPORT_CRON_DAILY || '0 18 * * *';
  const weeklyCronExpr = process.env.REPORT_CRON_WEEKLY || '0 9 * * 1';

  const dailyTask = cron.schedule(dailyCronExpr, async () => {
    logger.info('[Cron] Running daily report');
    await postDailyReport(client, backendUrl);
  }, { timezone: process.env.TZ || 'UTC' });

  const weeklyTask = cron.schedule(weeklyCronExpr, async () => {
    logger.info('[Cron] Running weekly report');
    await postWeeklyReport(client, backendUrl);
  }, { timezone: process.env.TZ || 'UTC' });

  dailyTask.start();
  weeklyTask.start();
  logger.info(`[Cron] Daily: ${dailyCronExpr}, Weekly: ${weeklyCronExpr}`);
}

export async function triggerDailyReportManually(client: Client, backendUrl: string) {
  logger.info('[Cron] Manual daily report triggered');
  await postDailyReport(client, backendUrl);
}
