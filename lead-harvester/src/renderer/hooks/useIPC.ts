import { useState, useCallback, useEffect } from 'react';
import type {
  Project,
  Lead,
  AppSettings,
  LeadFilters,
  LogEntry,
  ScrapeProgress,
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
  return useIPCQuery(() => window.api.projects.getAll(), []);
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

  return { exportCSV, loading };
}
