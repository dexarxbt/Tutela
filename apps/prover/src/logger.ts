const SECRET_PATTERN = /0x[a-fA-F0-9]{64}/g;

function redact(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(SECRET_PATTERN, '[redacted]');
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redact(entry)]));
  }
  return value;
}

function write(level: 'info' | 'warn' | 'error', message: string, context = {}) {
  const record = redact({ timestamp: new Date().toISOString(), level, message, ...context });
  const output = JSON.stringify(record);
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>) => write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => write('error', message, context),
};
