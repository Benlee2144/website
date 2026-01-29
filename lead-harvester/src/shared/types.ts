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

// Lead status for pipeline
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'won' | 'lost';

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
  // New fields for features
  leadStatus: LeadStatus;
  notes?: string;
  followUpDate?: string;
  socialMedia?: SocialMediaLinks;
  businessHours?: string;
  hasContactForm?: boolean;
  latitude?: number;
  longitude?: number;
  reviewSentiment?: 'positive' | 'neutral' | 'negative';
}

// Social media links
export interface SocialMediaLinks {
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  twitter?: string;
  youtube?: string;
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

// Theme settings
export type ThemeMode = 'light' | 'dark' | 'system';

// Settings
export interface AppSettings {
  safeMode: boolean;
  concurrency: 1 | 2 | 3;
  delayBetweenActions: number;
  maxResultsDefault: number;
  websiteCrawlTimeout: number;
  userAgent: string;
  showOnboarding: boolean;
  theme: ThemeMode;
  autoBackupEnabled: boolean;
  autoBackupInterval: number; // hours
  maxBackups: number;
  extractSocialMedia: boolean;
  extractBusinessHours: boolean;
  detectContactForms: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  safeMode: true,
  concurrency: 1,
  delayBetweenActions: 2000,
  maxResultsDefault: 50,
  websiteCrawlTimeout: 15000,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  showOnboarding: true,
  theme: 'system',
  autoBackupEnabled: true,
  autoBackupInterval: 24, // daily
  maxBackups: 7,
  extractSocialMedia: true,
  extractBusinessHours: true,
  detectContactForms: true,
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
  leadStatus?: LeadStatus;
  hasFollowUp?: boolean;
  hasSocialMedia?: boolean;
}

// Search template for saved searches
export interface SearchTemplate {
  id: string;
  name: string;
  keyword: string;
  location: string;
  radius?: number;
  maxResults: number;
  createdAt: string;
}

// Lead note/comment
export interface LeadNote {
  id: string;
  leadId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// Statistics for dashboard
export interface ProjectStats {
  totalLeads: number;
  leadsWithEmail: number;
  leadsWithWebsite: number;
  leadsWithPhone: number;
  enrichedLeads: number;
  leadsByStatus: Record<LeadStatus, number>;
  avgRating: number;
  avgReviewCount: number;
  leadsByCategory: Record<string, number>;
  leadsOverTime: { date: string; count: number }[];
}

// Backup info
export interface BackupInfo {
  id: string;
  filename: string;
  createdAt: string;
  size: number;
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
  format?: 'csv' | 'json' | 'xlsx';
  selectedIds?: string[];
}

// Email verification status
export type EmailVerificationStatus = 'unverified' | 'valid' | 'invalid' | 'checking';

export interface VerifiedEmail {
  email: string;
  status: EmailVerificationStatus;
  mxValid?: boolean;
  syntaxValid?: boolean;
  verifiedAt?: string;
}

// Tags system
export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface LeadTag {
  leadId: string;
  tagId: string;
}

// Extended Lead with tags and email verification
export interface LeadWithTags extends Lead {
  tags?: Tag[];
  verifiedEmails?: VerifiedEmail[];
}

// Bulk action types
export type BulkActionType = 'delete' | 'export' | 'tag' | 'untag' | 'verify_emails';

export interface BulkActionPayload {
  action: BulkActionType;
  leadIds: string[];
  tagId?: string;
  exportFormat?: 'csv' | 'json' | 'xlsx';
}

// Extended filters with score range
export interface ExtendedLeadFilters extends LeadFilters {
  minScore?: number;
  maxScore?: number;
  tags?: string[];
  emailStatus?: EmailVerificationStatus;
  reviewSentiment?: 'positive' | 'neutral' | 'negative';
}

// Keyboard shortcuts
export interface KeyboardShortcut {
  key: string;
  action: string;
  description: string;
}

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  { key: 'n', action: 'newProject', description: 'New Project' },
  { key: 's', action: 'startScrape', description: 'Start Scrape' },
  { key: 'p', action: 'pauseScrape', description: 'Pause Scrape' },
  { key: 'e', action: 'exportLeads', description: 'Export Leads' },
  { key: 'f', action: 'focusSearch', description: 'Focus Search' },
  { key: 'Escape', action: 'clearSelection', description: 'Clear Selection' },
  { key: 'a', action: 'selectAll', description: 'Select All (with Ctrl/Cmd)' },
  { key: 'd', action: 'toggleDetails', description: 'Toggle Details Panel' },
  { key: '1', action: 'statusNew', description: 'Set Status: New' },
  { key: '2', action: 'statusContacted', description: 'Set Status: Contacted' },
  { key: '3', action: 'statusInterested', description: 'Set Status: Interested' },
  { key: '4', action: 'statusWon', description: 'Set Status: Won' },
  { key: '5', action: 'statusLost', description: 'Set Status: Lost' },
];
