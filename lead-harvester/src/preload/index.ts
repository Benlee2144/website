import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  Project,
  Lead,
  AppSettings,
  LeadFilters,
  LogEntry,
  ScrapeProgress,
  IpcResponse,
  Tag,
  VerifiedEmail,
  SearchTemplate,
  LeadNote,
  ProjectStats,
  BackupInfo,
  LeadStatus,
} from '../shared/types';

// Type-safe API for renderer
const api = {
  // Projects
  projects: {
    getAll: (): Promise<IpcResponse<Project[]>> => ipcRenderer.invoke('projects:getAll'),
    get: (id: string): Promise<IpcResponse<Project | null>> =>
      ipcRenderer.invoke('projects:get', id),
    create: (input: {
      name: string;
      keyword: string;
      location: string;
      radius?: number;
      maxResults: number;
      notes?: string;
    }): Promise<IpcResponse<Project>> => ipcRenderer.invoke('projects:create', input),
    update: (id: string, input: Partial<Project>): Promise<IpcResponse<Project | null>> =>
      ipcRenderer.invoke('projects:update', id, input),
    delete: (id: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke('projects:delete', id),
    onChange: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('projects:changed', handler);
      return () => ipcRenderer.removeListener('projects:changed', handler);
    },
  },

  // Leads
  leads: {
    getByProject: (projectId: string, filters?: LeadFilters): Promise<IpcResponse<Lead[]>> =>
      ipcRenderer.invoke('leads:getByProject', projectId, filters),
    get: (id: string): Promise<IpcResponse<Lead | null>> => ipcRenderer.invoke('leads:get', id),
    updateStatus: (leadId: string, status: LeadStatus): Promise<IpcResponse<Lead | null>> =>
      ipcRenderer.invoke('leads:updateStatus', leadId, status),
    updateNotes: (leadId: string, notes: string): Promise<IpcResponse<Lead | null>> =>
      ipcRenderer.invoke('leads:updateNotes', leadId, notes),
    updateFollowUp: (leadId: string, followUpDate: string | null): Promise<IpcResponse<Lead | null>> =>
      ipcRenderer.invoke('leads:updateFollowUp', leadId, followUpDate),
    bulkUpdateStatus: (leadIds: string[], status: LeadStatus): Promise<IpcResponse<number>> =>
      ipcRenderer.invoke('leads:bulkUpdateStatus', leadIds, status),
  },

  // Scraper
  scraper: {
    start: (projectId: string, demoMode?: boolean): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('scraper:start', projectId, demoMode),
    pause: (): Promise<IpcResponse<void>> => ipcRenderer.invoke('scraper:pause'),
    resume: (projectId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('scraper:resume', projectId),
    stop: (): Promise<IpcResponse<void>> => ipcRenderer.invoke('scraper:stop'),
    status: (): Promise<
      IpcResponse<{ isRunning: boolean; isPaused: boolean; projectId: string | null }>
    > => ipcRenderer.invoke('scraper:status'),
    onProgress: (callback: (progress: ScrapeProgress) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, progress: ScrapeProgress) => callback(progress);
      ipcRenderer.on('scraper:progress', handler);
      return () => ipcRenderer.removeListener('scraper:progress', handler);
    },
  },

  // Settings
  settings: {
    get: (): Promise<IpcResponse<AppSettings>> => ipcRenderer.invoke('settings:get'),
    update: (input: Partial<AppSettings>): Promise<IpcResponse<AppSettings>> =>
      ipcRenderer.invoke('settings:update', input),
    reset: (): Promise<IpcResponse<AppSettings>> => ipcRenderer.invoke('settings:reset'),
  },

  // Run state
  runState: {
    get: (projectId: string): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke('runState:get', projectId),
    clear: (projectId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('runState:clear', projectId),
  },

  // Logs
  logs: {
    getByProject: (projectId: string, limit?: number): Promise<IpcResponse<LogEntry[]>> =>
      ipcRenderer.invoke('logs:getByProject', projectId, limit),
    clear: (projectId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('logs:clear', projectId),
    onEntry: (callback: (entry: LogEntry) => void): (() => void) => {
      const handler = (_: IpcRendererEvent, entry: LogEntry) => callback(entry);
      ipcRenderer.on('log:entry', handler);
      return () => ipcRenderer.removeListener('log:entry', handler);
    },
  },

  // Export
  export: {
    csv: (
      projectId: string,
      filters?: LeadFilters
    ): Promise<IpcResponse<{ path: string; count: number }>> =>
      ipcRenderer.invoke('export:csv', projectId, filters),
    leads: (
      projectId: string,
      format: 'csv' | 'json' | 'xlsx',
      filters?: LeadFilters,
      selectedIds?: string[]
    ): Promise<IpcResponse<{ path: string; count: number }>> =>
      ipcRenderer.invoke('export:leads', projectId, format, filters, selectedIds),
  },

  // Tags
  tags: {
    getAll: (): Promise<IpcResponse<Tag[]>> => ipcRenderer.invoke('tags:getAll'),
    create: (name: string, color?: string): Promise<IpcResponse<Tag>> =>
      ipcRenderer.invoke('tags:create', name, color),
    update: (id: string, input: { name?: string; color?: string }): Promise<IpcResponse<Tag | null>> =>
      ipcRenderer.invoke('tags:update', id, input),
    delete: (id: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke('tags:delete', id),
    getForLead: (leadId: string): Promise<IpcResponse<Tag[]>> =>
      ipcRenderer.invoke('tags:getForLead', leadId),
    addToLead: (leadId: string, tagId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('tags:addToLead', leadId, tagId),
    removeFromLead: (leadId: string, tagId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('tags:removeFromLead', leadId, tagId),
  },

  // Bulk actions
  bulk: {
    addTag: (leadIds: string[], tagId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('bulk:addTag', leadIds, tagId),
    removeTag: (leadIds: string[], tagId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('bulk:removeTag', leadIds, tagId),
    deleteLeads: (leadIds: string[]): Promise<IpcResponse<number>> =>
      ipcRenderer.invoke('bulk:deleteLeads', leadIds),
  },

  // Email verification
  email: {
    verify: (email: string): Promise<IpcResponse<VerifiedEmail>> =>
      ipcRenderer.invoke('email:verify', email),
    verifyBulk: (emails: string[]): Promise<IpcResponse<VerifiedEmail[]>> =>
      ipcRenderer.invoke('email:verifyBulk', emails),
  },

  // Search templates
  templates: {
    getAll: (): Promise<IpcResponse<SearchTemplate[]>> =>
      ipcRenderer.invoke('templates:getAll'),
    create: (input: { name: string; keyword: string; location: string; radius?: number; maxResults: number }): Promise<IpcResponse<SearchTemplate>> =>
      ipcRenderer.invoke('templates:create', input),
    delete: (id: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke('templates:delete', id),
  },

  // Lead notes
  notes: {
    getForLead: (leadId: string): Promise<IpcResponse<LeadNote[]>> =>
      ipcRenderer.invoke('notes:getForLead', leadId),
    create: (leadId: string, content: string): Promise<IpcResponse<LeadNote>> =>
      ipcRenderer.invoke('notes:create', leadId, content),
    update: (noteId: string, content: string): Promise<IpcResponse<LeadNote | null>> =>
      ipcRenderer.invoke('notes:update', noteId, content),
    delete: (noteId: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke('notes:delete', noteId),
  },

  // Statistics
  stats: {
    getProject: (projectId: string): Promise<IpcResponse<ProjectStats>> =>
      ipcRenderer.invoke('stats:getProject', projectId),
  },

  // Follow-up reminders
  followups: {
    getDue: (): Promise<IpcResponse<Lead[]>> =>
      ipcRenderer.invoke('followups:getDue'),
    getUpcoming: (days?: number): Promise<IpcResponse<Lead[]>> =>
      ipcRenderer.invoke('followups:getUpcoming', days),
  },

  // Backups
  backups: {
    getAll: (): Promise<IpcResponse<BackupInfo[]>> =>
      ipcRenderer.invoke('backups:getAll'),
    create: (): Promise<IpcResponse<BackupInfo | null>> =>
      ipcRenderer.invoke('backups:create'),
    restore: (backupId: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke('backups:restore', backupId),
    delete: (backupId: string): Promise<IpcResponse<boolean>> =>
      ipcRenderer.invoke('backups:delete', backupId),
  },

  // Import
  import: {
    csv: (projectId: string): Promise<IpcResponse<{ imported: number; duplicates: number }>> =>
      ipcRenderer.invoke('import:csv', projectId),
  },

  // Project merge
  merge: {
    projects: (sourceProjectIds: string[], targetProjectId: string): Promise<IpcResponse<number>> =>
      ipcRenderer.invoke('projects:merge', sourceProjectIds, targetProjectId),
  },
};

// Expose API to renderer
contextBridge.exposeInMainWorld('api', api);

// Type declaration for renderer
export type ElectronAPI = typeof api;
