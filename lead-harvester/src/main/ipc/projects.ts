import { ipcMain, dialog, BrowserWindow } from 'electron';
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
} from '../database';
import { exportLeads, generateExportFilename } from '../utils/export';
import { verifyEmail, verifyEmails } from '../utils/email-verification';
import { ProjectSchema, LeadFiltersSchema } from '../../shared/schemas';
import type { IpcResponse, Project, Lead, LeadFilters, LogEntry, Tag, VerifiedEmail } from '../../shared/types';

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
}
