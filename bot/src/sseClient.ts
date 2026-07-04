import { logger } from './logger';
import { state, type Device, type UsagePayload, type Alert, type SSEPayload } from './state';

export type SSEMessage = SSEPayload;

export class SSEClient {
  private url: string;
  private backoffMs: number;
  private maxBackoffMs: number;
  private isConnected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private abortController: AbortController | null = null;
  private onStateUpdate?: (payload: SSEMessage) => void;

  constructor(url: string, backoffMs = 1000, maxBackoffMs = 30000) {
    this.url = url;
    this.backoffMs = backoffMs;
    this.maxBackoffMs = maxBackoffMs;
  }

  onUpdate(handler: (payload: SSEMessage) => void) {
    this.onStateUpdate = handler;
  }

  start() {
    this.connect();
  }

  stop() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.abortController?.abort();
    this.isConnected = false;
  }

  getStatus() {
    return this.isConnected;
  }

  private async connect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    try {
      const response = await fetch(this.url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      this.isConnected = true;
      logger.info('[SSE] Connected to backend stream');
      this.backoffMs = 1000;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data) as SSEMessage;
              state.devices = parsed.devices;
              state.usage = parsed.usage;
              state.alerts = parsed.alerts;
              state.sseConnected = true;
              this.onStateUpdate?.(parsed);
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      if (signal.aborted) return;
      this.isConnected = false;
      state.sseConnected = false;
      logger.warn({ err }, '[SSE] Connection lost, will reconnect');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    logger.info(`[SSE] Reconnecting in ${this.backoffMs}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
      this.connect();
    }, this.backoffMs);
  }
}
