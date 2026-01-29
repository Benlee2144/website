// Project types
export interface Project {
  id: string;
  name: string;
  keyword: string;
  location: string;
  radius?: number;
  maxResults: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  totalLeads: number;
  enrichedLeads: number;
}

export type ProjectStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';

// Lead types
export interface Lead {
  id: string;
  projectId: string;
  businessName: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  websiteUrl?: string;
  emails: string[];
  contactPageUrl?: string;
  googleMapsUrl: string;
  leadScore: number;
  createdAt: string;
  updatedAt: string;
  enrichmentStatus: EnrichmentStatus;
  errorMessage?: string;
  isDuplicate: boolean;
}

export type EnrichmentStatus = 'pending' | 'in_progress' | 'done' | 'error' | 'skipped';

// Run state for pause/resume
export interface RunState {
  projectId: string;
  phase: 'scraping' | 'enriching' | 'completed';
  scrollPosition: number;
  scrapedCount: number;
  enrichedCount: number;
  pendingEnrichmentIds: string[];
  lastProcessedUrl?: string;
  startedAt: string;
  pausedAt?: string;
  error?: string;
}

// Settings
export interface AppSettings {
  safeMode: boolean;
  concurrency: 1 | 2 | 3;
  delayBetweenActions: number;
  maxResultsDefault: number;
  websiteCrawlTimeout: number;
  userAgent: string;
  showOnboarding: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  safeMode: true,
  concurrency: 1,
  delayBetweenActions: 2000,
  maxResultsDefault: 50,
  websiteCrawlTimeout: 15000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  showOnboarding: true,
};

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
];

// Log entry
export interface LogEntry {
  id: string;
  projectId: string;
  runId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Filters for leads table
export interface LeadFilters {
  hasEmail?: boolean;
  hasWebsite?: boolean;
  minRating?: number;
  minReviews?: number;
  showDuplicates?: boolean;
  opportunityFinder?: boolean;
  searchQuery?: string;
}

// Progress info for UI
export interface ScrapeProgress {
  phase: 'idle' | 'starting' | 'scraping' | 'enriching' | 'paused' | 'completed' | 'error';
  totalFound: number;
  scraped: number;
  enriched: number;
  errors: number;
  currentItem?: string;
  eta?: number;
  message?: string;
}

// IPC response wrapper
export interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// CSV export options
export interface ExportOptions {
  projectId: string;
  filters?: LeadFilters;
  filePath: string;
}
