import { ipcMain, dialog } from 'electron';
import {
  createProject,
  getProject,
  getAllProjects,
  updateProject,
  deleteProject,
  getLeadsByProject,
  getLead,
  getRunState,
  deleteRunState,
  getLogsByProject,
  clearLogsByProject,
} from '../database';
import { exportToCSV, generateCSVFilename } from '../utils/csv-export';
import { ProjectSchema, LeadFiltersSchema } from '../../shared/schemas';
import type { IpcResponse, Project, Lead, LeadFilters, LogEntry } from '../../shared/types';

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

  // Export leads to CSV
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

        // Show save dialog
        const defaultFilename = generateCSVFilename(project);
        const result = await dialog.showSaveDialog({
          title: 'Export Leads to CSV',
          defaultPath: defaultFilename,
          filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        });

        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled' };
        }

        const leads = getLeadsByProject(projectId, validatedFilters);
        const exportResult = exportToCSV(leads, project, result.filePath);

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
}
