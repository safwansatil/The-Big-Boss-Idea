import type { Logger } from 'pino';
import pino from 'pino';
import pinoHttp from 'pino-http';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const httpLogger: any = pinoHttp({ logger: logger as any });

export default logger;
