import fs from 'fs';
import path from 'path';
import { logger } from './logger';

const CONFIG_FILE = path.resolve(process.env.THRESHOLD_OVERRIDE_FILE || 'threshold-override.json');

const STATE_FILE = path.resolve('config-state.json');

interface FileConfig {
  stuckOnThresholdMs?: number;
}

interface FileState {
  stuckOnThresholdMs?: number;
}

let inMemory: FileState = {};

function ensureFile(filePath: string, defaultValue: object) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf-8');
  }
}

function readFileConfig(): FileConfig {
  try {
    ensureFile(CONFIG_FILE, {});
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) as FileConfig;
  } catch (err) {
    logger.warn({ err }, '[Config] Failed to read config file');
    return {};
  }
}

function writeFileConfig(config: FileConfig) {
  ensureFile(CONFIG_FILE, {});
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function readFileState(): FileState {
  try {
    ensureFile(STATE_FILE, {});
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as FileState;
  } catch {
    return {};
  }
}

function writeFileState(state: FileState) {
  ensureFile(STATE_FILE, {});
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

export function getStuckOnThresholdMs(): number {
  const fileState = readFileState();
  if (typeof fileState.stuckOnThresholdMs === 'number') {
    return fileState.stuckOnThresholdMs;
  }

  const fileConfig = readFileConfig();
  if (typeof fileConfig.stuckOnThresholdMs === 'number') {
    return fileConfig.stuckOnThresholdMs;
  }

  return Number(process.env.STUCK_ON_THRESHOLD_MS) || 2 * 60 * 60 * 1000;
}

export function setStuckOnThresholdMs(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`Invalid stuck-on threshold: ${ms}. Must be a positive number.`);
  }

  inMemory.stuckOnThresholdMs = ms;
  const currentState = readFileState();
  currentState.stuckOnThresholdMs = ms;
  writeFileState(currentState);
  writeFileConfig({ ...readFileConfig(), stuckOnThresholdMs: ms });
}

export function validateConfig() {
  const envMs = process.env.STUCK_ON_THRESHOLD_MS;
  if (envMs !== undefined) {
    const parsed = Number(envMs);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid STUCK_ON_THRESHOLD_MS env: ${envMs}. Must be a positive number.`);
    }
  }

  const computed = getStuckOnThresholdMs();
  if (!Number.isFinite(computed) || computed <= 0) {
    throw new Error(`Computed stuck-on threshold is invalid (<= 0): ${computed}`);
  }
}
