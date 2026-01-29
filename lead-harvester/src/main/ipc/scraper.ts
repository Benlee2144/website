import { ipcMain } from 'electron';
import {
  startRun,
  pauseRun,
  resumeRun,
  stopRun,
  isRunning,
  isPaused,
  getCurrentRunProjectId,
} from '../scraper';
import { runDemoMode, stopDemoMode, isDemoModeRunning } from '../demo/demo-scraper';
import type { IpcResponse } from '../../shared/types';

/**
 * Register scraper-related IPC handlers
 */
export function registerScraperHandlers(): void {
  // Start scraping run
  ipcMain.handle(
    'scraper:start',
    async (_, projectId: string, demoMode: boolean = false): Promise<IpcResponse<void>> => {
      try {
        if (demoMode) {
          await runDemoMode(projectId);
        } else {
          await startRun(projectId);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Pause scraping run
  ipcMain.handle('scraper:pause', async (): Promise<IpcResponse<void>> => {
    try {
      pauseRun();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Resume scraping run
  ipcMain.handle('scraper:resume', async (_, projectId: string): Promise<IpcResponse<void>> => {
    try {
      await resumeRun(projectId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Stop scraping run
  ipcMain.handle('scraper:stop', async (): Promise<IpcResponse<void>> => {
    try {
      if (isDemoModeRunning()) {
        stopDemoMode();
      } else {
        await stopRun();
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get scraper status
  ipcMain.handle(
    'scraper:status',
    async (): Promise<
      IpcResponse<{ isRunning: boolean; isPaused: boolean; projectId: string | null }>
    > => {
      try {
        const running = isRunning() || isDemoModeRunning();
        const paused = isPaused();
        const projectId = getCurrentRunProjectId();
        return { success: true, data: { isRunning: running, isPaused: paused, projectId } };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );
}
