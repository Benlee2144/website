import { BrowserWindow } from 'electron';
import { addLog } from '../database';
import type { LogEntry } from '../../shared/types';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  projectId: string;
  runId: string;
}

let currentConfig: LoggerConfig | null = null;
let logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 100;

/**
 * Initialize logger for a specific project run
 */
export function initLogger(projectId: string, runId: string): void {
  currentConfig = { projectId, runId };
  logBuffer = [];
}

/**
 * Clear logger configuration
 */
export function clearLogger(): void {
  currentConfig = null;
  logBuffer = [];
}

/**
 * Log a message
 */
export function log(
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();

  // Console output for development
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  switch (level) {
    case 'debug':
      console.debug(prefix, message, metadata || '');
      break;
    case 'info':
      console.info(prefix, message, metadata || '');
      break;
    case 'warn':
      console.warn(prefix, message, metadata || '');
      break;
    case 'error':
      console.error(prefix, message, metadata || '');
      break;
  }

  // Store in database if configured
  if (currentConfig) {
    try {
      const entry = addLog({
        projectId: currentConfig.projectId,
        runId: currentConfig.runId,
        level,
        message,
        timestamp,
        metadata,
      });

      // Buffer for UI streaming
      logBuffer.push(entry);
      if (logBuffer.length > MAX_BUFFER_SIZE) {
        logBuffer.shift();
      }

      // Send to renderer if window exists
      broadcastLog(entry);
    } catch (error) {
      console.error('Failed to persist log:', error);
    }
  }
}

/**
 * Convenience methods
 */
export const logger = {
  debug: (message: string, metadata?: Record<string, unknown>) => log('debug', message, metadata),
  info: (message: string, metadata?: Record<string, unknown>) => log('info', message, metadata),
  warn: (message: string, metadata?: Record<string, unknown>) => log('warn', message, metadata),
  error: (message: string, metadata?: Record<string, unknown>) => log('error', message, metadata),
};

/**
 * Get recent logs from buffer
 */
export function getRecentLogs(): LogEntry[] {
  return [...logBuffer];
}

/**
 * Broadcast log entry to all renderer windows
 */
function broadcastLog(entry: LogEntry): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('log:entry', entry);
    }
  }
}

/**
 * Create a scoped logger for a specific component
 */
export function createScopedLogger(scope: string) {
  return {
    debug: (message: string, metadata?: Record<string, unknown>) =>
      log('debug', `[${scope}] ${message}`, metadata),
    info: (message: string, metadata?: Record<string, unknown>) =>
      log('info', `[${scope}] ${message}`, metadata),
    warn: (message: string, metadata?: Record<string, unknown>) =>
      log('warn', `[${scope}] ${message}`, metadata),
    error: (message: string, metadata?: Record<string, unknown>) =>
      log('error', `[${scope}] ${message}`, metadata),
  };
}
