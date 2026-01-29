import { ipcMain } from 'electron';
import { getSettings, updateSettings } from '../database';
import { SettingsSchema } from '../../shared/schemas';
import type { IpcResponse, AppSettings } from '../../shared/types';

/**
 * Register settings-related IPC handlers
 */
export function registerSettingsHandlers(): void {
  // Get settings
  ipcMain.handle('settings:get', async (): Promise<IpcResponse<AppSettings>> => {
    try {
      const settings = getSettings();
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Update settings
  ipcMain.handle(
    'settings:update',
    async (_, input: unknown): Promise<IpcResponse<AppSettings>> => {
      try {
        // Partial validation - only validate provided fields
        const currentSettings = getSettings();
        const merged = { ...currentSettings, ...(input as Partial<AppSettings>) };
        const validated = SettingsSchema.parse(merged);
        const settings = updateSettings(validated);
        return { success: true, data: settings };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Reset settings to defaults
  ipcMain.handle('settings:reset', async (): Promise<IpcResponse<AppSettings>> => {
    try {
      const { DEFAULT_SETTINGS } = require('../../shared/types');
      const settings = updateSettings(DEFAULT_SETTINGS);
      return { success: true, data: settings };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });
}
