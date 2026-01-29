import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import {
  createProject,
  getProject,
  getAllProjects,
  updateProject,
  deleteProject,
  getLeadsByProject,
  getLead,
  getLeadsByIds,
  getRunState,
  deleteRunState,
  getLogsByProject,
  clearLogsByProject,
  createTag,
  getAllTags,
  getTag,
  updateTag,
  deleteTag,
  addTagToLead,
  removeTagFromLead,
  getTagsForLead,
  addTagToLeads,
  removeTagFromLeads,
  deleteLeads,
  updateLead,
  createSearchTemplate,
  getAllSearchTemplates,
  getSearchTemplate,
  deleteSearchTemplate,
  createLeadNote,
  getNotesForLead,
  updateLeadNote,
  deleteLeadNote,
  getProjectStats,
  getLeadsWithFollowUpDue,
  getUpcomingFollowUps,
  mergeProjects,
  updateLeadStatuses,
  importLeads,
} from '../database';
import { exportLeads, generateExportFilename } from '../utils/export';
import { verifyEmail, verifyEmails } from '../utils/email-verification';
import { createBackup, restoreBackup, deleteBackup, getBackupList } from '../utils/backup';
import { ProjectSchema, LeadFiltersSchema } from '../../shared/schemas';
import type {
  IpcResponse,
  Project,
  Lead,
  LeadFilters,
  LogEntry,
  Tag,
  VerifiedEmail,
  SearchTemplate,
  LeadNote,
  ProjectStats,
  BackupInfo,
  LeadStatus,
} from '../../shared/types';

/**
 * Broadcast project changes to all windows
 */
function broadcastProjectsChanged(): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('projects:changed');
    }
  }
}

/**
 * Register project-related IPC handlers
 */
export function registerProjectHandlers(): void {
  // Get all projects
  ipcMain.handle('projects:getAll', async (): Promise<IpcResponse<Project[]>> => {
    try {
      const projects = getAllProjects();
      return { success: true, data: projects };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get single project
  ipcMain.handle('projects:get', async (_, id: string): Promise<IpcResponse<Project | null>> => {
    try {
      const project = getProject(id);
      return { success: true, data: project };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Create project
  ipcMain.handle('projects:create', async (_, input: unknown): Promise<IpcResponse<Project>> => {
    try {
      const validated = ProjectSchema.parse(input);
      const project = createProject(validated);
      broadcastProjectsChanged();
      return { success: true, data: project };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Update project
  ipcMain.handle(
    'projects:update',
    async (_, id: string, input: unknown): Promise<IpcResponse<Project | null>> => {
      try {
        const project = updateProject(id, input as any);
        return { success: true, data: project };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Delete project
  ipcMain.handle('projects:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const result = deleteProject(id);
      broadcastProjectsChanged();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get leads for project
  ipcMain.handle(
    'leads:getByProject',
    async (_, projectId: string, filters?: unknown): Promise<IpcResponse<Lead[]>> => {
      try {
        let validatedFilters: LeadFilters | undefined;
        if (filters) {
          validatedFilters = LeadFiltersSchema.parse(filters);
        }
        const leads = getLeadsByProject(projectId, validatedFilters);
        return { success: true, data: leads };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Get single lead
  ipcMain.handle('leads:get', async (_, id: string): Promise<IpcResponse<Lead | null>> => {
    try {
      const lead = getLead(id);
      return { success: true, data: lead };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get run state
  ipcMain.handle('runState:get', async (_, projectId: string): Promise<IpcResponse<any>> => {
    try {
      const state = getRunState(projectId);
      return { success: true, data: state };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Clear run state
  ipcMain.handle('runState:clear', async (_, projectId: string): Promise<IpcResponse<void>> => {
    try {
      deleteRunState(projectId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get logs for project
  ipcMain.handle(
    'logs:getByProject',
    async (_, projectId: string, limit?: number): Promise<IpcResponse<LogEntry[]>> => {
      try {
        const logs = getLogsByProject(projectId, limit || 100);
        return { success: true, data: logs };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Clear logs for project
  ipcMain.handle('logs:clear', async (_, projectId: string): Promise<IpcResponse<void>> => {
    try {
      clearLogsByProject(projectId);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Export leads (supports CSV, JSON, XLSX)
  ipcMain.handle(
    'export:leads',
    async (
      _,
      projectId: string,
      format: 'csv' | 'json' | 'xlsx' = 'csv',
      filters?: unknown,
      selectedIds?: string[]
    ): Promise<IpcResponse<{ path: string; count: number }>> => {
      try {
        const project = getProject(projectId);
        if (!project) {
          return { success: false, error: 'Project not found' };
        }

        let validatedFilters: LeadFilters | undefined;
        if (filters) {
          validatedFilters = LeadFiltersSchema.parse(filters);
        }

        // Show save dialog
        const defaultFilename = generateExportFilename(project, format);
        const filterOptions: { name: string; extensions: string[] }[] = [];

        switch (format) {
          case 'json':
            filterOptions.push({ name: 'JSON Files', extensions: ['json'] });
            break;
          case 'xlsx':
            filterOptions.push({ name: 'Excel Files', extensions: ['xls', 'xlsx'] });
            break;
          default:
            filterOptions.push({ name: 'CSV Files', extensions: ['csv'] });
        }

        const result = await dialog.showSaveDialog({
          title: `Export Leads to ${format.toUpperCase()}`,
          defaultPath: defaultFilename,
          filters: filterOptions,
        });

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled' };
        }

        // Get leads - either selected or all matching filters
        let leads: Lead[];
        if (selectedIds && selectedIds.length > 0) {
          leads = getLeadsByIds(selectedIds);
        } else {
          leads = getLeadsByProject(projectId, validatedFilters);
        }

        const exportResult = exportLeads(leads, project, result.filePath, format);

        if (!exportResult.success) {
          return { success: false, error: exportResult.error };
        }

        return {
          success: true,
          data: { path: result.filePath, count: exportResult.count },
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Legacy export:csv handler for backward compatibility
  ipcMain.handle(
    'export:csv',
    async (_, projectId: string, filters?: unknown): Promise<IpcResponse<{ path: string; count: number }>> => {
      try {
        const project = getProject(projectId);
        if (!project) {
          return { success: false, error: 'Project not found' };
        }

        let validatedFilters: LeadFilters | undefined;
        if (filters) {
          validatedFilters = LeadFiltersSchema.parse(filters);
        }

        const defaultFilename = generateExportFilename(project, 'csv');
        const result = await dialog.showSaveDialog({
          title: 'Export Leads to CSV',
          defaultPath: defaultFilename,
          filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        });

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled' };
        }

        const leads = getLeadsByProject(projectId, validatedFilters);
        const exportResult = exportLeads(leads, project, result.filePath, 'csv');

        if (!exportResult.success) {
          return { success: false, error: exportResult.error };
        }

        return {
          success: true,
          data: { path: result.filePath, count: exportResult.count },
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // ============= Tags Handlers =============

  // Get all tags
  ipcMain.handle('tags:getAll', async (): Promise<IpcResponse<Tag[]>> => {
    try {
      const tags = getAllTags();
      return { success: true, data: tags };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Create tag
  ipcMain.handle(
    'tags:create',
    async (_, name: string, color?: string): Promise<IpcResponse<Tag>> => {
      try {
        const tag = createTag(name, color);
        return { success: true, data: tag };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Update tag
  ipcMain.handle(
    'tags:update',
    async (_, id: string, input: { name?: string; color?: string }): Promise<IpcResponse<Tag | null>> => {
      try {
        const tag = updateTag(id, input);
        return { success: true, data: tag };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Delete tag
  ipcMain.handle('tags:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const result = deleteTag(id);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get tags for a lead
  ipcMain.handle('tags:getForLead', async (_, leadId: string): Promise<IpcResponse<Tag[]>> => {
    try {
      const tags = getTagsForLead(leadId);
      return { success: true, data: tags };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Add tag to lead
  ipcMain.handle(
    'tags:addToLead',
    async (_, leadId: string, tagId: string): Promise<IpcResponse<void>> => {
      try {
        addTagToLead(leadId, tagId);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Remove tag from lead
  ipcMain.handle(
    'tags:removeFromLead',
    async (_, leadId: string, tagId: string): Promise<IpcResponse<void>> => {
      try {
        removeTagFromLead(leadId, tagId);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // ============= Bulk Actions Handlers =============

  // Bulk add tag to leads
  ipcMain.handle(
    'bulk:addTag',
    async (_, leadIds: string[], tagId: string): Promise<IpcResponse<void>> => {
      try {
        addTagToLeads(leadIds, tagId);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Bulk remove tag from leads
  ipcMain.handle(
    'bulk:removeTag',
    async (_, leadIds: string[], tagId: string): Promise<IpcResponse<void>> => {
      try {
        removeTagFromLeads(leadIds, tagId);
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Bulk delete leads
  ipcMain.handle(
    'bulk:deleteLeads',
    async (_, leadIds: string[]): Promise<IpcResponse<number>> => {
      try {
        const count = deleteLeads(leadIds);
        return { success: true, data: count };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // ============= Email Verification Handlers =============

  // Verify single email
  ipcMain.handle(
    'email:verify',
    async (_, email: string): Promise<IpcResponse<VerifiedEmail>> => {
      try {
        const result = await verifyEmail(email);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Verify multiple emails
  ipcMain.handle(
    'email:verifyBulk',
    async (_, emails: string[]): Promise<IpcResponse<VerifiedEmail[]>> => {
      try {
        const results = await verifyEmails(emails);
        return { success: true, data: results };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // ============= Lead Updates =============

  // Update lead status
  ipcMain.handle(
    'leads:updateStatus',
    async (_, leadId: string, status: LeadStatus): Promise<IpcResponse<Lead | null>> => {
      try {
        const lead = updateLead(leadId, { leadStatus: status });
        return { success: true, data: lead };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Update lead notes
  ipcMain.handle(
    'leads:updateNotes',
    async (_, leadId: string, notes: string): Promise<IpcResponse<Lead | null>> => {
      try {
        const lead = updateLead(leadId, { notes: notes || null });
        return { success: true, data: lead };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Update follow-up date
  ipcMain.handle(
    'leads:updateFollowUp',
    async (_, leadId: string, followUpDate: string | null): Promise<IpcResponse<Lead | null>> => {
      try {
        const lead = updateLead(leadId, { followUpDate });
        return { success: true, data: lead };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // Bulk update lead statuses
  ipcMain.handle(
    'leads:bulkUpdateStatus',
    async (_, leadIds: string[], status: LeadStatus): Promise<IpcResponse<number>> => {
      try {
        const count = updateLeadStatuses(leadIds, status);
        return { success: true, data: count };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // ============= Search Templates =============

  ipcMain.handle('templates:getAll', async (): Promise<IpcResponse<SearchTemplate[]>> => {
    try {
      const templates = getAllSearchTemplates();
      return { success: true, data: templates };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(
    'templates:create',
    async (_, input: { name: string; keyword: string; location: string; radius?: number; maxResults: number }): Promise<IpcResponse<SearchTemplate>> => {
      try {
        const template = createSearchTemplate(input);
        return { success: true, data: template };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle('templates:delete', async (_, id: string): Promise<IpcResponse<boolean>> => {
    try {
      const result = deleteSearchTemplate(id);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ============= Lead Notes =============

  ipcMain.handle(
    'notes:getForLead',
    async (_, leadId: string): Promise<IpcResponse<LeadNote[]>> => {
      try {
        const notes = getNotesForLead(leadId);
        return { success: true, data: notes };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    'notes:create',
    async (_, leadId: string, content: string): Promise<IpcResponse<LeadNote>> => {
      try {
        const note = createLeadNote(leadId, content);
        return { success: true, data: note };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle(
    'notes:update',
    async (_, noteId: string, content: string): Promise<IpcResponse<LeadNote | null>> => {
      try {
        const note = updateLeadNote(noteId, content);
        return { success: true, data: note };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  ipcMain.handle('notes:delete', async (_, noteId: string): Promise<IpcResponse<boolean>> => {
    try {
      const result = deleteLeadNote(noteId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ============= Statistics =============

  ipcMain.handle(
    'stats:getProject',
    async (_, projectId: string): Promise<IpcResponse<ProjectStats>> => {
      try {
        const stats = getProjectStats(projectId);
        return { success: true, data: stats };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // ============= Follow-up Reminders =============

  ipcMain.handle('followups:getDue', async (): Promise<IpcResponse<Lead[]>> => {
    try {
      const leads = getLeadsWithFollowUpDue();
      return { success: true, data: leads };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle(
    'followups:getUpcoming',
    async (_, days?: number): Promise<IpcResponse<Lead[]>> => {
      try {
        const leads = getUpcomingFollowUps(days || 7);
        return { success: true, data: leads };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // ============= Backups =============

  ipcMain.handle('backups:getAll', async (): Promise<IpcResponse<BackupInfo[]>> => {
    try {
      const backups = getBackupList();
      return { success: true, data: backups };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('backups:create', async (): Promise<IpcResponse<BackupInfo | null>> => {
    try {
      const backup = createBackup();
      return { success: true, data: backup };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('backups:restore', async (_, backupId: string): Promise<IpcResponse<boolean>> => {
    try {
      const result = restoreBackup(backupId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('backups:delete', async (_, backupId: string): Promise<IpcResponse<boolean>> => {
    try {
      const result = deleteBackup(backupId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // ============= Multi-Project Merge =============

  ipcMain.handle(
    'projects:merge',
    async (_, sourceProjectIds: string[], targetProjectId: string): Promise<IpcResponse<number>> => {
      try {
        const count = mergeProjects(sourceProjectIds, targetProjectId);
        broadcastProjectsChanged();
        return { success: true, data: count };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );

  // ============= Import CSV =============

  ipcMain.handle(
    'import:csv',
    async (_, projectId: string): Promise<IpcResponse<{ imported: number; duplicates: number }>> => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Import Leads from CSV',
          filters: [{ name: 'CSV Files', extensions: ['csv'] }],
          properties: ['openFile'],
        });

        if (result.canceled || !result.filePaths[0]) {
          return { success: false, error: 'Import cancelled' };
        }

        const filePath = result.filePaths[0];
        const content = fs.readFileSync(filePath, 'utf-8');

        // Parse CSV
        const lines = content.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          return { success: false, error: 'CSV file is empty or has no data rows' };
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
        const leads: Array<{
          businessName: string;
          category?: string;
          rating?: number;
          reviewCount?: number;
          address?: string;
          phone?: string;
          websiteUrl?: string;
          emails?: string[];
          googleMapsUrl?: string;
        }> = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < headers.length) continue;

          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx]?.replace(/"/g, '').trim() || '';
          });

          const businessName = row['business_name'] || row['businessname'] || row['name'] || row['company'];
          if (!businessName) continue;

          leads.push({
            businessName,
            category: row['category'] || row['type'] || undefined,
            rating: row['rating'] ? parseFloat(row['rating']) : undefined,
            reviewCount: row['review_count'] || row['reviews'] ? parseInt(row['review_count'] || row['reviews']) : undefined,
            address: row['address'] || row['location'] || undefined,
            phone: row['phone'] || row['telephone'] || undefined,
            websiteUrl: row['website'] || row['website_url'] || row['url'] || undefined,
            emails: row['email'] || row['emails'] ? (row['email'] || row['emails']).split(';').filter(Boolean) : undefined,
            googleMapsUrl: row['google_maps_url'] || row['maps_url'] || undefined,
          });
        }

        if (leads.length === 0) {
          return { success: false, error: 'No valid leads found in CSV' };
        }

        const importResult = importLeads(projectId, leads);
        return { success: true, data: importResult };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    }
  );
}

// Helper function to parse CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
