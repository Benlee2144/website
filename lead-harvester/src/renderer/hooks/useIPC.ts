import { useState, useCallback, useEffect } from 'react';
import type {
  Project,
  Lead,
  AppSettings,
  LeadFilters,
  LogEntry,
  ScrapeProgress,
  Tag,
  VerifiedEmail,
  SearchTemplate,
  LeadNote,
  ProjectStats,
  BackupInfo,
  LeadStatus,
} from '../../shared/types';

// Generic hook for IPC calls with loading state
export function useIPCQuery<T>(
  queryFn: () => Promise<{ success: boolean; data?: T; error?: string }>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await queryFn();
      if (result.success && result.data !== undefined) {
        setData(result.data);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}

// Projects hooks
export function useProjects() {
  const query = useIPCQuery(() => window.api.projects.getAll(), []);

  // Subscribe to project changes (create/delete)
  useEffect(() => {
    const unsubscribe = window.api.projects.onChange(() => {
      query.refetch();
    });
    return unsubscribe;
  }, [query.refetch]);

  return query;
}

export function useProject(id: string | null) {
  return useIPCQuery(
    () => (id ? window.api.projects.get(id) : Promise.resolve({ success: true, data: null })),
    [id]
  );
}

export function useCreateProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (input: {
      name: string;
      keyword: string;
      location: string;
      radius?: number;
      maxResults: number;
      notes?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await window.api.projects.create(input);
        if (!result.success) {
          setError(result.error || 'Failed to create project');
          return null;
        }
        return result.data;
      } catch (err) {
        setError(String(err));
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { create, loading, error };
}

export function useDeleteProject() {
  const [loading, setLoading] = useState(false);

  const deleteProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await window.api.projects.delete(id);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteProject, loading };
}

// Leads hooks
export function useLeads(projectId: string | null, filters?: LeadFilters) {
  return useIPCQuery(
    () =>
      projectId
        ? window.api.leads.getByProject(projectId, filters)
        : Promise.resolve({ success: true, data: [] as Lead[] }),
    [projectId, JSON.stringify(filters)]
  );
}

// Settings hooks
export function useSettings() {
  const query = useIPCQuery(() => window.api.settings.get(), []);

  const update = useCallback(async (input: Partial<AppSettings>) => {
    const result = await window.api.settings.update(input);
    if (result.success && result.data) {
      query.refetch();
    }
    return result;
  }, [query.refetch]);

  return { ...query, update };
}

// Scraper hooks
export function useScraper() {
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);
  const [status, setStatus] = useState<{
    isRunning: boolean;
    isPaused: boolean;
    projectId: string | null;
  }>({ isRunning: false, isPaused: false, projectId: null });

  // Subscribe to progress updates
  useEffect(() => {
    const unsubscribe = window.api.scraper.onProgress((p) => {
      setProgress(p);
      if (p.phase === 'completed' || p.phase === 'error') {
        setStatus((s) => ({ ...s, isRunning: false, isPaused: false }));
      }
    });
    return unsubscribe;
  }, []);

  // Get initial status
  useEffect(() => {
    window.api.scraper.status().then((result) => {
      if (result.success && result.data) {
        setStatus(result.data);
      }
    });
  }, []);

  const start = useCallback(async (projectId: string, demoMode = false) => {
    setProgress({ phase: 'starting', totalFound: 0, scraped: 0, enriched: 0, errors: 0 });
    setStatus({ isRunning: true, isPaused: false, projectId });
    const result = await window.api.scraper.start(projectId, demoMode);
    if (!result.success) {
      setStatus({ isRunning: false, isPaused: false, projectId: null });
    }
    return result;
  }, []);

  const pause = useCallback(async () => {
    const result = await window.api.scraper.pause();
    if (result.success) {
      setStatus((s) => ({ ...s, isPaused: true }));
    }
    return result;
  }, []);

  const resume = useCallback(async (projectId: string) => {
    setStatus({ isRunning: true, isPaused: false, projectId });
    return window.api.scraper.resume(projectId);
  }, []);

  const stop = useCallback(async () => {
    const result = await window.api.scraper.stop();
    setStatus({ isRunning: false, isPaused: false, projectId: null });
    return result;
  }, []);

  return { progress, status, start, pause, resume, stop };
}

// Logs hooks
export function useLogs(projectId: string | null) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Fetch initial logs
  useEffect(() => {
    if (projectId) {
      window.api.logs.getByProject(projectId, 100).then((result) => {
        if (result.success && result.data) {
          setLogs(result.data);
        }
      });
    } else {
      setLogs([]);
    }
  }, [projectId]);

  // Subscribe to new log entries
  useEffect(() => {
    const unsubscribe = window.api.logs.onEntry((entry) => {
      if (!projectId || entry.projectId === projectId) {
        setLogs((prev) => [entry, ...prev.slice(0, 99)]);
      }
    });
    return unsubscribe;
  }, [projectId]);

  return logs;
}

// Export hook
export function useExport() {
  const [loading, setLoading] = useState(false);

  const exportCSV = useCallback(async (projectId: string, filters?: LeadFilters) => {
    setLoading(true);
    try {
      const result = await window.api.export.csv(projectId, filters);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const exportLeads = useCallback(async (
    projectId: string,
    format: 'csv' | 'json' | 'xlsx',
    filters?: LeadFilters,
    selectedIds?: string[]
  ) => {
    setLoading(true);
    try {
      const result = await window.api.export.leads(projectId, format, filters, selectedIds);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { exportCSV, exportLeads, loading };
}

// Tags hooks
export function useTags() {
  return useIPCQuery(() => window.api.tags.getAll(), []);
}

export function useTagsForLead(leadId: string | null) {
  return useIPCQuery(
    () =>
      leadId
        ? window.api.tags.getForLead(leadId)
        : Promise.resolve({ success: true, data: [] as Tag[] }),
    [leadId]
  );
}

export function useTagOperations() {
  const [loading, setLoading] = useState(false);

  const createTag = useCallback(async (name: string, color?: string) => {
    setLoading(true);
    try {
      const result = await window.api.tags.create(name, color);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTag = useCallback(async (id: string, input: { name?: string; color?: string }) => {
    setLoading(true);
    try {
      const result = await window.api.tags.update(id, input);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTag = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const result = await window.api.tags.delete(id);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTagToLead = useCallback(async (leadId: string, tagId: string) => {
    return window.api.tags.addToLead(leadId, tagId);
  }, []);

  const removeTagFromLead = useCallback(async (leadId: string, tagId: string) => {
    return window.api.tags.removeFromLead(leadId, tagId);
  }, []);

  return { createTag, updateTag, deleteTag, addTagToLead, removeTagFromLead, loading };
}

// Email verification hooks
export function useEmailVerification() {
  const [loading, setLoading] = useState(false);

  const verifyEmail = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const result = await window.api.email.verify(email);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyEmails = useCallback(async (emails: string[]) => {
    setLoading(true);
    try {
      const result = await window.api.email.verifyBulk(emails);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { verifyEmail, verifyEmails, loading };
}

// Lead status and notes hooks
export function useLeadOperations() {
  const [loading, setLoading] = useState(false);

  const updateStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    setLoading(true);
    try {
      const result = await window.api.leads.updateStatus(leadId, status);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateNotes = useCallback(async (leadId: string, notes: string) => {
    setLoading(true);
    try {
      const result = await window.api.leads.updateNotes(leadId, notes);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateFollowUp = useCallback(async (leadId: string, followUpDate: string | null) => {
    setLoading(true);
    try {
      const result = await window.api.leads.updateFollowUp(leadId, followUpDate);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkUpdateStatus = useCallback(async (leadIds: string[], status: LeadStatus) => {
    setLoading(true);
    try {
      const result = await window.api.leads.bulkUpdateStatus(leadIds, status);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateStatus, updateNotes, updateFollowUp, bulkUpdateStatus, loading };
}

// Search templates hooks
export function useSearchTemplates() {
  const query = useIPCQuery(() => window.api.templates.getAll(), []);

  const createTemplate = useCallback(async (input: {
    name: string;
    keyword: string;
    location: string;
    radius?: number;
    maxResults: number;
  }) => {
    const result = await window.api.templates.create(input);
    if (result.success) {
      query.refetch();
    }
    return result;
  }, [query.refetch]);

  const deleteTemplate = useCallback(async (id: string) => {
    const result = await window.api.templates.delete(id);
    if (result.success) {
      query.refetch();
    }
    return result;
  }, [query.refetch]);

  return { ...query, createTemplate, deleteTemplate };
}

// Lead notes hooks
export function useLeadNotes(leadId: string | null) {
  const query = useIPCQuery(
    () => leadId
      ? window.api.notes.getForLead(leadId)
      : Promise.resolve({ success: true, data: [] as LeadNote[] }),
    [leadId]
  );

  const createNote = useCallback(async (content: string) => {
    if (!leadId) return null;
    const result = await window.api.notes.create(leadId, content);
    if (result.success) {
      query.refetch();
    }
    return result;
  }, [leadId, query.refetch]);

  const updateNote = useCallback(async (noteId: string, content: string) => {
    const result = await window.api.notes.update(noteId, content);
    if (result.success) {
      query.refetch();
    }
    return result;
  }, [query.refetch]);

  const deleteNote = useCallback(async (noteId: string) => {
    const result = await window.api.notes.delete(noteId);
    if (result.success) {
      query.refetch();
    }
    return result;
  }, [query.refetch]);

  return { ...query, createNote, updateNote, deleteNote };
}

// Project statistics hook
export function useProjectStats(projectId: string | null) {
  return useIPCQuery(
    () => projectId
      ? window.api.stats.getProject(projectId)
      : Promise.resolve({ success: true, data: null as ProjectStats | null }),
    [projectId]
  );
}

// Follow-up reminders hook
export function useFollowUps() {
  const [dueLeads, setDueLeads] = useState<Lead[]>([]);
  const [upcomingLeads, setUpcomingLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const [dueResult, upcomingResult] = await Promise.all([
        window.api.followups.getDue(),
        window.api.followups.getUpcoming(7),
      ]);

      if (dueResult.success && dueResult.data) {
        setDueLeads(dueResult.data);
      }
      if (upcomingResult.success && upcomingResult.data) {
        setUpcomingLeads(upcomingResult.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { dueLeads, upcomingLeads, loading, refetch };
}

// Backups hook
export function useBackups() {
  const query = useIPCQuery(() => window.api.backups.getAll(), []);
  const [actionLoading, setActionLoading] = useState(false);

  const createBackup = useCallback(async () => {
    setActionLoading(true);
    try {
      const result = await window.api.backups.create();
      if (result.success) {
        query.refetch();
      }
      return result;
    } finally {
      setActionLoading(false);
    }
  }, [query.refetch]);

  const restoreBackup = useCallback(async (backupId: string) => {
    setActionLoading(true);
    try {
      const result = await window.api.backups.restore(backupId);
      return result;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const deleteBackup = useCallback(async (backupId: string) => {
    setActionLoading(true);
    try {
      const result = await window.api.backups.delete(backupId);
      if (result.success) {
        query.refetch();
      }
      return result;
    } finally {
      setActionLoading(false);
    }
  }, [query.refetch]);

  return { ...query, createBackup, restoreBackup, deleteBackup, actionLoading };
}

// Import hook
export function useImport() {
  const [loading, setLoading] = useState(false);

  const importCSV = useCallback(async (projectId: string) => {
    setLoading(true);
    try {
      const result = await window.api.import.csv(projectId);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { importCSV, loading };
}

// Project merge hook
export function useMergeProjects() {
  const [loading, setLoading] = useState(false);

  const mergeProjects = useCallback(async (sourceProjectIds: string[], targetProjectId: string) => {
    setLoading(true);
    try {
      const result = await window.api.merge.projects(sourceProjectIds, targetProjectId);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mergeProjects, loading };
}
