import { env } from '../config/env.js';

const SENSITIVE = /password|secret|token|authorization|cookie|private[_-]?key|otp|api[_-]?key/i;

function redact(input: unknown): unknown {
  if (typeof input === 'string') {
    return SENSITIVE.test(input) ? '[redacted]' : input;
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      out[key] = SENSITIVE.test(key) ? '[redacted]' : redact(value);
    }
    return out;
  }
  return input;
}

export const logger = {
  info(message: string, extra?: Record<string, unknown>) {
    if (env.logLevel === 'silent') return;
    console.log(JSON.stringify({ level: 'info', message, extra: extra ? redact(extra) : undefined, t: new Date().toISOString() }));
  },
  warn(message: string, extra?: Record<string, unknown>) {
    console.warn(JSON.stringify({ level: 'warn', message, extra: extra ? redact(extra) : undefined, t: new Date().toISOString() }));
  },
  error(message: string, extra?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: 'error', message, extra: extra ? redact(extra) : undefined, t: new Date().toISOString() }));
  },
};
