import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { getDbPath, saveBackupRecord, getAllBackups, deleteBackupRecord, getSettings } from '../database';
import type { BackupInfo } from '../../shared/types';

const BACKUP_DIR = 'backups';

function getBackupDir(): string {
  const userDataPath = app.getPath('userData');
  const backupPath = path.join(userDataPath, BACKUP_DIR);

  if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
  }

  return backupPath;
}

/**
 * Create a backup of the database
 */
export function createBackup(): BackupInfo | null {
  try {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      return null;
    }

    const backupDir = getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `leadharvester-backup-${timestamp}.db`;
    const backupPath = path.join(backupDir, filename);

    // Copy database file
    fs.copyFileSync(dbPath, backupPath);

    // Get file size
    const stats = fs.statSync(backupPath);

    // Save record
    const record = saveBackupRecord(filename, stats.size);

    // Clean up old backups
    cleanupOldBackups();

    return record;
  } catch (error) {
    console.error('Failed to create backup:', error);
    return null;
  }
}

/**
 * Restore database from backup
 */
export function restoreBackup(backupId: string): boolean {
  try {
    const backups = getAllBackups();
    const backup = backups.find(b => b.id === backupId);

    if (!backup) {
      return false;
    }

    const backupDir = getBackupDir();
    const backupPath = path.join(backupDir, backup.filename);
    const dbPath = getDbPath();

    if (!fs.existsSync(backupPath)) {
      return false;
    }

    // Create a backup of current database before restoring
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const preRestoreBackup = path.join(backupDir, `pre-restore-${timestamp}.db`);
    if (fs.existsSync(dbPath)) {
      fs.copyFileSync(dbPath, preRestoreBackup);
    }

    // Restore
    fs.copyFileSync(backupPath, dbPath);

    return true;
  } catch (error) {
    console.error('Failed to restore backup:', error);
    return false;
  }
}

/**
 * Delete a backup
 */
export function deleteBackup(backupId: string): boolean {
  try {
    const backups = getAllBackups();
    const backup = backups.find(b => b.id === backupId);

    if (!backup) {
      return false;
    }

    const backupDir = getBackupDir();
    const backupPath = path.join(backupDir, backup.filename);

    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    deleteBackupRecord(backupId);
    return true;
  } catch (error) {
    console.error('Failed to delete backup:', error);
    return false;
  }
}

/**
 * Clean up old backups based on maxBackups setting
 */
function cleanupOldBackups(): void {
  try {
    const settings = getSettings();
    const backups = getAllBackups();

    if (backups.length <= settings.maxBackups) {
      return;
    }

    // Delete oldest backups
    const toDelete = backups.slice(settings.maxBackups);
    for (const backup of toDelete) {
      deleteBackup(backup.id);
    }
  } catch (error) {
    console.error('Failed to cleanup old backups:', error);
  }
}

/**
 * Auto-backup scheduler
 */
let backupInterval: NodeJS.Timeout | null = null;

export function startAutoBackup(): void {
  stopAutoBackup();

  const settings = getSettings();
  if (!settings.autoBackupEnabled) {
    return;
  }

  const intervalMs = settings.autoBackupInterval * 60 * 60 * 1000; // hours to ms

  backupInterval = setInterval(() => {
    const currentSettings = getSettings();
    if (currentSettings.autoBackupEnabled) {
      createBackup();
    }
  }, intervalMs);

  // Create initial backup
  createBackup();
}

export function stopAutoBackup(): void {
  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }
}

/**
 * Get list of backups with file info
 */
export function getBackupList(): BackupInfo[] {
  const backups = getAllBackups();
  const backupDir = getBackupDir();

  // Verify files exist
  return backups.filter(backup => {
    const backupPath = path.join(backupDir, backup.filename);
    return fs.existsSync(backupPath);
  });
}
