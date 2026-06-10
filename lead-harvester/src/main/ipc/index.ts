import { registerProjectHandlers } from './projects';
import { registerScraperHandlers } from './scraper';
import { registerSettingsHandlers } from './settings';

/**
 * Register all IPC handlers
 */
export function registerAllHandlers(): void {
  registerProjectHandlers();
  registerScraperHandlers();
  registerSettingsHandlers();
}
