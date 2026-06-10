import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SCHEMA_TABLES, INITIAL_SETTINGS } from './schema';
import type {
  Project,
  Lead,
  RunState,
  AppSettings,
  LogEntry,
  LeadFilters,
  EnrichmentStatus,
  ProjectStatus,
  Tag,
  ThemeMode,
  VerifiedEmail,
  EmailVerificationStatus,
  LeadStatus,
  SearchTemplate,
  LeadNote,
  ProjectStats,
  BackupInfo,
  SocialMediaLinks,
} from '../../shared/types';

let db: Database.Database | null = null;

export function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'leadharvester.db');
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 1. Run base schema (tables with original columns only)
  db.exec(SCHEMA_TABLES);

  // 2. Run migrations to add new columns to existing databases
  runMigrations(db);

  // 3. Insert initial settings (after migrations add new settings columns)
  db.exec(INITIAL_SETTINGS);

  return db;
}

/**
 * Run database migrations for existing databases
 * This adds new columns and indexes that weren't in the original schema
 */
function runMigrations(db: Database.Database): void {
  // Helper to safely add column if it doesn't exist
  const addColumnIfNotExists = (table: string, column: string, type: string, defaultValue?: string) => {
    try {
      const defaultClause = defaultValue !== undefined ? ` DEFAULT ${defaultValue}` : '';
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defaultClause}`);
    } catch (e) {
      // Column already exists, ignore error
    }
  };

  // Helper to safely create index
  const createIndexIfNotExists = (indexName: string, table: string, column: string) => {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`);
    } catch (e) {
      // Index creation failed, ignore
    }
  };

  // Leads table migrations - add new columns
  addColumnIfNotExists('leads', 'lead_status', 'TEXT', "'new'");
  addColumnIfNotExists('leads', 'notes', 'TEXT', 'NULL');
  addColumnIfNotExists('leads', 'follow_up_date', 'TEXT', 'NULL');
  addColumnIfNotExists('leads', 'social_media', 'TEXT', 'NULL');
  addColumnIfNotExists('leads', 'business_hours', 'TEXT', 'NULL');
  addColumnIfNotExists('leads', 'has_contact_form', 'INTEGER', 'NULL');
  addColumnIfNotExists('leads', 'latitude', 'REAL', 'NULL');
  addColumnIfNotExists('leads', 'longitude', 'REAL', 'NULL');
  addColumnIfNotExists('leads', 'review_sentiment', 'TEXT', 'NULL');

  // Settings table migrations - add new columns
  addColumnIfNotExists('settings', 'auto_backup_enabled', 'INTEGER', '1');
  addColumnIfNotExists('settings', 'auto_backup_interval', 'INTEGER', '24');
  addColumnIfNotExists('settings', 'max_backups', 'INTEGER', '7');
  addColumnIfNotExists('settings', 'extract_social_media', 'INTEGER', '1');
  addColumnIfNotExists('settings', 'extract_business_hours', 'INTEGER', '1');
  addColumnIfNotExists('settings', 'detect_contact_forms', 'INTEGER', '1');

  // Create indexes on new columns (after columns are added)
  createIndexIfNotExists('idx_leads_lead_status', 'leads', 'lead_status');
  createIndexIfNotExists('idx_leads_follow_up_date', 'leads', 'follow_up_date');
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ============= Projects =============

export function createProject(input: {
  name: string;
  keyword: string;
  location: string;
  radius?: number;
  maxResults: number;
  notes?: string;
}): Project {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO projects (id, name, keyword, location, radius, max_results, notes, created_at, updated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle')
  `);

  stmt.run(id, input.name, input.keyword, input.location, input.radius || null, input.maxResults, input.notes || null, now, now);

  return getProject(id)!;
}

export function getProject(id: string): Project | null {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM leads WHERE project_id = p.id) as total_leads,
      (SELECT COUNT(*) FROM leads WHERE project_id = p.id AND enrichment_status = 'done') as enriched_leads
    FROM projects p
    WHERE p.id = ?
  `);

  const row = stmt.get(id) as any;
  if (!row) return null;

  return mapProjectRow(row);
}

export function getAllProjects(): Project[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT
      p.*,
      (SELECT COUNT(*) FROM leads WHERE project_id = p.id) as total_leads,
      (SELECT COUNT(*) FROM leads WHERE project_id = p.id AND enrichment_status = 'done') as enriched_leads
    FROM projects p
    ORDER BY p.updated_at DESC
  `);

  const rows = stmt.all() as any[];
  return rows.map(mapProjectRow);
}

export function updateProject(id: string, input: Partial<{
  name: string;
  keyword: string;
  location: string;
  radius: number | null;
  maxResults: number;
  notes: string | null;
  status: ProjectStatus;
}>): Project | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.keyword !== undefined) {
    updates.push('keyword = ?');
    values.push(input.keyword);
  }
  if (input.location !== undefined) {
    updates.push('location = ?');
    values.push(input.location);
  }
  if (input.radius !== undefined) {
    updates.push('radius = ?');
    values.push(input.radius);
  }
  if (input.maxResults !== undefined) {
    updates.push('max_results = ?');
    values.push(input.maxResults);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    values.push(input.notes);
  }
  if (input.status !== undefined) {
    updates.push('status = ?');
    values.push(input.status);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getProject(id);
}

export function deleteProject(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

function mapProjectRow(row: any): Project {
  return {
    id: row.id,
    name: row.name,
    keyword: row.keyword,
    location: row.location,
    radius: row.radius || undefined,
    maxResults: row.max_results,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as ProjectStatus,
    totalLeads: row.total_leads || 0,
    enrichedLeads: row.enriched_leads || 0,
  };
}

// ============= Leads =============

export function createLead(input: {
  projectId: string;
  businessName: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  websiteUrl?: string;
  googleMapsUrl: string;
}): Lead {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Check for duplicates
  const isDuplicate = checkDuplicate(input.projectId, input.googleMapsUrl, input.businessName, input.address);

  const stmt = db.prepare(`
    INSERT INTO leads (
      id, project_id, business_name, category, rating, review_count,
      address, phone, website_url, emails, google_maps_url,
      lead_score, created_at, updated_at, enrichment_status, is_duplicate
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, 0, ?, ?, 'pending', ?)
  `);

  stmt.run(
    id,
    input.projectId,
    input.businessName,
    input.category || null,
    input.rating || null,
    input.reviewCount || null,
    input.address || null,
    input.phone || null,
    input.websiteUrl || null,
    input.googleMapsUrl,
    now,
    now,
    isDuplicate ? 1 : 0
  );

  return getLead(id)!;
}

export function getLead(id: string): Lead | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM leads WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;
  return mapLeadRow(row);
}

export function getLeadsByProject(projectId: string, filters?: LeadFilters): Lead[] {
  const db = getDatabase();

  let query = 'SELECT * FROM leads WHERE project_id = ?';
  const params: any[] = [projectId];

  if (filters) {
    if (filters.hasEmail) {
      query += " AND emails != '[]'";
    }
    if (filters.hasWebsite) {
      query += ' AND website_url IS NOT NULL AND website_url != ""';
    }
    if (filters.minRating !== undefined) {
      query += ' AND rating >= ?';
      params.push(filters.minRating);
    }
    if (filters.minReviews !== undefined) {
      query += ' AND review_count >= ?';
      params.push(filters.minReviews);
    }
    if (filters.showDuplicates) {
      query += ' AND is_duplicate = 1';
    } else if (filters.showDuplicates === false) {
      query += ' AND is_duplicate = 0';
    }
    if (filters.opportunityFinder) {
      // Has phone but NO website or NO email
      query += " AND phone IS NOT NULL AND (website_url IS NULL OR website_url = '' OR emails = '[]')";
    }
    if (filters.searchQuery) {
      query += ' AND (business_name LIKE ? OR address LIKE ? OR category LIKE ?)';
      const searchTerm = `%${filters.searchQuery}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (filters.leadStatus) {
      query += ' AND lead_status = ?';
      params.push(filters.leadStatus);
    }
    if (filters.hasFollowUp) {
      query += ' AND follow_up_date IS NOT NULL';
    }
    if (filters.hasSocialMedia) {
      query += " AND social_media IS NOT NULL AND social_media != '{}'";
    }
  }

  query += ' ORDER BY lead_score DESC, created_at DESC';

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map(mapLeadRow);
}

export function updateLead(id: string, input: Partial<{
  emails: string[];
  contactPageUrl: string | null;
  websiteUrl: string | null;
  leadScore: number;
  enrichmentStatus: EnrichmentStatus;
  errorMessage: string | null;
  leadStatus: LeadStatus;
  notes: string | null;
  followUpDate: string | null;
  socialMedia: SocialMediaLinks | null;
  businessHours: string | null;
  hasContactForm: boolean | null;
  latitude: number | null;
  longitude: number | null;
  reviewSentiment: 'positive' | 'neutral' | 'negative' | null;
}>): Lead | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const updates: string[] = ['updated_at = ?'];
  const values: any[] = [now];

  if (input.emails !== undefined) {
    updates.push('emails = ?');
    values.push(JSON.stringify(input.emails));
  }
  if (input.contactPageUrl !== undefined) {
    updates.push('contact_page_url = ?');
    values.push(input.contactPageUrl);
  }
  if (input.websiteUrl !== undefined) {
    updates.push('website_url = ?');
    values.push(input.websiteUrl);
  }
  if (input.leadScore !== undefined) {
    updates.push('lead_score = ?');
    values.push(input.leadScore);
  }
  if (input.enrichmentStatus !== undefined) {
    updates.push('enrichment_status = ?');
    values.push(input.enrichmentStatus);
  }
  if (input.errorMessage !== undefined) {
    updates.push('error_message = ?');
    values.push(input.errorMessage);
  }
  if (input.leadStatus !== undefined) {
    updates.push('lead_status = ?');
    values.push(input.leadStatus);
  }
  if (input.notes !== undefined) {
    updates.push('notes = ?');
    values.push(input.notes);
  }
  if (input.followUpDate !== undefined) {
    updates.push('follow_up_date = ?');
    values.push(input.followUpDate);
  }
  if (input.socialMedia !== undefined) {
    updates.push('social_media = ?');
    values.push(input.socialMedia ? JSON.stringify(input.socialMedia) : null);
  }
  if (input.businessHours !== undefined) {
    updates.push('business_hours = ?');
    values.push(input.businessHours);
  }
  if (input.hasContactForm !== undefined) {
    updates.push('has_contact_form = ?');
    values.push(input.hasContactForm === null ? null : input.hasContactForm ? 1 : 0);
  }
  if (input.latitude !== undefined) {
    updates.push('latitude = ?');
    values.push(input.latitude);
  }
  if (input.longitude !== undefined) {
    updates.push('longitude = ?');
    values.push(input.longitude);
  }
  if (input.reviewSentiment !== undefined) {
    updates.push('review_sentiment = ?');
    values.push(input.reviewSentiment);
  }

  values.push(id);

  const stmt = db.prepare(`UPDATE leads SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return getLead(id);
}

export function deleteLeadsByProject(projectId: string): number {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM leads WHERE project_id = ?');
  const result = stmt.run(projectId);
  return result.changes;
}

export function getPendingEnrichmentLeads(projectId: string, limit: number = 10): Lead[] {
  const db = getDatabase();
  // Get all pending leads - enrichment will try to get website from Google Maps if missing
  const stmt = db.prepare(`
    SELECT * FROM leads
    WHERE project_id = ?
    AND enrichment_status = 'pending'
    AND is_duplicate = 0
    ORDER BY
      CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 0 ELSE 1 END,
      created_at ASC
    LIMIT ?
  `);
  const rows = stmt.all(projectId, limit) as any[];
  return rows.map(mapLeadRow);
}

function checkDuplicate(projectId: string, googleMapsUrl: string, businessName: string, address?: string): boolean {
  const db = getDatabase();

  // Check by Google Maps URL
  const urlStmt = db.prepare('SELECT COUNT(*) as count FROM leads WHERE project_id = ? AND google_maps_url = ?');
  const urlResult = urlStmt.get(projectId, googleMapsUrl) as { count: number };
  if (urlResult.count > 0) return true;

  // Check by normalized name + address
  if (address) {
    const normalizedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedAddress = address.toLowerCase().replace(/[^a-z0-9]/g, '');

    const nameStmt = db.prepare(`
      SELECT business_name, address FROM leads
      WHERE project_id = ? AND address IS NOT NULL
    `);
    const rows = nameStmt.all(projectId) as { business_name: string; address: string }[];

    for (const row of rows) {
      const rowName = row.business_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rowAddress = row.address.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (rowName === normalizedName && rowAddress === normalizedAddress) {
        return true;
      }
    }
  }

  return false;
}

function mapLeadRow(row: any): Lead {
  return {
    id: row.id,
    projectId: row.project_id,
    businessName: row.business_name,
    category: row.category || undefined,
    rating: row.rating || undefined,
    reviewCount: row.review_count || undefined,
    address: row.address || undefined,
    phone: row.phone || undefined,
    websiteUrl: row.website_url || undefined,
    emails: JSON.parse(row.emails || '[]'),
    contactPageUrl: row.contact_page_url || undefined,
    googleMapsUrl: row.google_maps_url,
    leadScore: row.lead_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    enrichmentStatus: row.enrichment_status as EnrichmentStatus,
    errorMessage: row.error_message || undefined,
    isDuplicate: row.is_duplicate === 1,
    leadStatus: (row.lead_status || 'new') as LeadStatus,
    notes: row.notes || undefined,
    followUpDate: row.follow_up_date || undefined,
    socialMedia: row.social_media ? JSON.parse(row.social_media) : undefined,
    businessHours: row.business_hours || undefined,
    hasContactForm: row.has_contact_form === null ? undefined : row.has_contact_form === 1,
    latitude: row.latitude || undefined,
    longitude: row.longitude || undefined,
    reviewSentiment: row.review_sentiment || undefined,
  };
}

// ============= Run State =============

export function saveRunState(state: RunState): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO run_state (
      project_id, phase, scroll_position, scraped_count, enriched_count,
      pending_enrichment_ids, last_processed_url, started_at, paused_at, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    state.projectId,
    state.phase,
    state.scrollPosition,
    state.scrapedCount,
    state.enrichedCount,
    JSON.stringify(state.pendingEnrichmentIds),
    state.lastProcessedUrl || null,
    state.startedAt,
    state.pausedAt || null,
    state.error || null
  );
}

export function getRunState(projectId: string): RunState | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM run_state WHERE project_id = ?');
  const row = stmt.get(projectId) as any;
  if (!row) return null;

  return {
    projectId: row.project_id,
    phase: row.phase,
    scrollPosition: row.scroll_position,
    scrapedCount: row.scraped_count,
    enrichedCount: row.enriched_count,
    pendingEnrichmentIds: JSON.parse(row.pending_enrichment_ids || '[]'),
    lastProcessedUrl: row.last_processed_url || undefined,
    startedAt: row.started_at,
    pausedAt: row.paused_at || undefined,
    error: row.error || undefined,
  };
}

export function deleteRunState(projectId: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM run_state WHERE project_id = ?');
  stmt.run(projectId);
}

// ============= Settings =============

export function getSettings(): AppSettings {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM settings WHERE id = 1');
  const row = stmt.get() as any;

  return {
    safeMode: row.safe_mode === 1,
    concurrency: row.concurrency as 1 | 2 | 3,
    delayBetweenActions: row.delay_between_actions,
    maxResultsDefault: row.max_results_default,
    websiteCrawlTimeout: row.website_crawl_timeout,
    userAgent: row.user_agent,
    showOnboarding: row.show_onboarding === 1,
    theme: (row.theme || 'system') as ThemeMode,
    autoBackupEnabled: row.auto_backup_enabled === 1,
    autoBackupInterval: row.auto_backup_interval || 24,
    maxBackups: row.max_backups || 7,
    extractSocialMedia: row.extract_social_media === 1,
    extractBusinessHours: row.extract_business_hours === 1,
    detectContactForms: row.detect_contact_forms === 1,
  };
}

export function updateSettings(input: Partial<AppSettings>): AppSettings {
  const db = getDatabase();

  const updates: string[] = [];
  const values: any[] = [];

  if (input.safeMode !== undefined) {
    updates.push('safe_mode = ?');
    values.push(input.safeMode ? 1 : 0);
  }
  if (input.concurrency !== undefined) {
    updates.push('concurrency = ?');
    values.push(input.concurrency);
  }
  if (input.delayBetweenActions !== undefined) {
    updates.push('delay_between_actions = ?');
    values.push(input.delayBetweenActions);
  }
  if (input.maxResultsDefault !== undefined) {
    updates.push('max_results_default = ?');
    values.push(input.maxResultsDefault);
  }
  if (input.websiteCrawlTimeout !== undefined) {
    updates.push('website_crawl_timeout = ?');
    values.push(input.websiteCrawlTimeout);
  }
  if (input.userAgent !== undefined) {
    updates.push('user_agent = ?');
    values.push(input.userAgent);
  }
  if (input.showOnboarding !== undefined) {
    updates.push('show_onboarding = ?');
    values.push(input.showOnboarding ? 1 : 0);
  }
  if (input.theme !== undefined) {
    updates.push('theme = ?');
    values.push(input.theme);
  }
  if (input.autoBackupEnabled !== undefined) {
    updates.push('auto_backup_enabled = ?');
    values.push(input.autoBackupEnabled ? 1 : 0);
  }
  if (input.autoBackupInterval !== undefined) {
    updates.push('auto_backup_interval = ?');
    values.push(input.autoBackupInterval);
  }
  if (input.maxBackups !== undefined) {
    updates.push('max_backups = ?');
    values.push(input.maxBackups);
  }
  if (input.extractSocialMedia !== undefined) {
    updates.push('extract_social_media = ?');
    values.push(input.extractSocialMedia ? 1 : 0);
  }
  if (input.extractBusinessHours !== undefined) {
    updates.push('extract_business_hours = ?');
    values.push(input.extractBusinessHours ? 1 : 0);
  }
  if (input.detectContactForms !== undefined) {
    updates.push('detect_contact_forms = ?');
    values.push(input.detectContactForms ? 1 : 0);
  }

  if (updates.length > 0) {
    const stmt = db.prepare(`UPDATE settings SET ${updates.join(', ')} WHERE id = 1`);
    stmt.run(...values);
  }

  return getSettings();
}

// ============= Logs =============

export function addLog(entry: Omit<LogEntry, 'id'>): LogEntry {
  const db = getDatabase();
  const id = uuidv4();

  const stmt = db.prepare(`
    INSERT INTO logs (id, project_id, run_id, level, message, timestamp, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    entry.projectId,
    entry.runId,
    entry.level,
    entry.message,
    entry.timestamp,
    entry.metadata ? JSON.stringify(entry.metadata) : null
  );

  return { id, ...entry };
}

export function getLogsByProject(projectId: string, limit: number = 100): LogEntry[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT * FROM logs
    WHERE project_id = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  const rows = stmt.all(projectId, limit) as any[];

  return rows.map(row => ({
    id: row.id,
    projectId: row.project_id,
    runId: row.run_id,
    level: row.level,
    message: row.message,
    timestamp: row.timestamp,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}

export function clearLogsByProject(projectId: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM logs WHERE project_id = ?');
  stmt.run(projectId);
}

// ============= Tags =============

export function createTag(name: string, color: string = '#3B82F6'): Tag {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO tags (id, name, color, created_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, name, color, now);

  return { id, name, color, createdAt: now };
}

export function getAllTags(): Tag[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM tags ORDER BY name ASC');
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  }));
}

export function getTag(id: string): Tag | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM tags WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export function updateTag(id: string, input: { name?: string; color?: string }): Tag | null {
  const db = getDatabase();

  const updates: string[] = [];
  const values: any[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    values.push(input.name);
  }
  if (input.color !== undefined) {
    updates.push('color = ?');
    values.push(input.color);
  }

  if (updates.length > 0) {
    values.push(id);
    const stmt = db.prepare(`UPDATE tags SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  return getTag(id);
}

export function deleteTag(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM tags WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function addTagToLead(leadId: string, tagId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO lead_tags (lead_id, tag_id)
    VALUES (?, ?)
  `);
  stmt.run(leadId, tagId);
}

export function removeTagFromLead(leadId: string, tagId: string): void {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM lead_tags WHERE lead_id = ? AND tag_id = ?');
  stmt.run(leadId, tagId);
}

export function getTagsForLead(leadId: string): Tag[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT t.* FROM tags t
    INNER JOIN lead_tags lt ON lt.tag_id = t.id
    WHERE lt.lead_id = ?
    ORDER BY t.name ASC
  `);
  const rows = stmt.all(leadId) as any[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  }));
}

export function getLeadsByTag(tagId: string): Lead[] {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT l.* FROM leads l
    INNER JOIN lead_tags lt ON lt.lead_id = l.id
    WHERE lt.tag_id = ?
    ORDER BY l.lead_score DESC
  `);
  const rows = stmt.all(tagId) as any[];
  return rows.map(mapLeadRow);
}

export function addTagToLeads(leadIds: string[], tagId: string): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO lead_tags (lead_id, tag_id)
    VALUES (?, ?)
  `);

  const transaction = db.transaction(() => {
    for (const leadId of leadIds) {
      stmt.run(leadId, tagId);
    }
  });

  transaction();
}

export function removeTagFromLeads(leadIds: string[], tagId: string): void {
  const db = getDatabase();
  const placeholders = leadIds.map(() => '?').join(',');
  const stmt = db.prepare(`DELETE FROM lead_tags WHERE lead_id IN (${placeholders}) AND tag_id = ?`);
  stmt.run(...leadIds, tagId);
}

// ============= Email Verification =============

export function getEmailVerification(email: string): VerifiedEmail | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM email_verifications WHERE email = ?');
  const row = stmt.get(email) as any;
  if (!row) return null;

  return {
    email: row.email,
    status: row.status as EmailVerificationStatus,
    mxValid: row.mx_valid === null ? undefined : row.mx_valid === 1,
    syntaxValid: row.syntax_valid === 1,
    verifiedAt: row.verified_at || undefined,
  };
}

export function saveEmailVerification(verification: VerifiedEmail): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO email_verifications (email, status, mx_valid, syntax_valid, verified_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    verification.email,
    verification.status,
    verification.mxValid === undefined ? null : verification.mxValid ? 1 : 0,
    verification.syntaxValid ? 1 : 0,
    verification.verifiedAt || null
  );
}

export function getEmailVerifications(emails: string[]): VerifiedEmail[] {
  if (emails.length === 0) return [];

  const db = getDatabase();
  const placeholders = emails.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT * FROM email_verifications WHERE email IN (${placeholders})`);
  const rows = stmt.all(...emails) as any[];

  return rows.map(row => ({
    email: row.email,
    status: row.status as EmailVerificationStatus,
    mxValid: row.mx_valid === null ? undefined : row.mx_valid === 1,
    syntaxValid: row.syntax_valid === 1,
    verifiedAt: row.verified_at || undefined,
  }));
}

// ============= Cross-Project Duplicates =============

export function checkCrossProjectDuplicate(
  businessName: string,
  address?: string,
  excludeProjectId?: string
): { projectId: string; projectName: string; leadId: string } | null {
  const db = getDatabase();

  if (!address) return null;

  const normalizedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedAddress = address.toLowerCase().replace(/[^a-z0-9]/g, '');

  let query = `
    SELECT l.id as lead_id, l.business_name, l.address, p.id as project_id, p.name as project_name
    FROM leads l
    INNER JOIN projects p ON l.project_id = p.id
    WHERE l.address IS NOT NULL
  `;
  const params: any[] = [];

  if (excludeProjectId) {
    query += ' AND l.project_id != ?';
    params.push(excludeProjectId);
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];

  for (const row of rows) {
    const rowName = row.business_name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rowAddress = row.address.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (rowName === normalizedName && rowAddress === normalizedAddress) {
      return {
        projectId: row.project_id,
        projectName: row.project_name,
        leadId: row.lead_id,
      };
    }
  }

  return null;
}

// ============= Bulk Operations =============

export function deleteLeads(leadIds: string[]): number {
  if (leadIds.length === 0) return 0;

  const db = getDatabase();
  const placeholders = leadIds.map(() => '?').join(',');
  const stmt = db.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`);
  const result = stmt.run(...leadIds);
  return result.changes;
}

export function getLeadsByIds(leadIds: string[]): Lead[] {
  if (leadIds.length === 0) return [];

  const db = getDatabase();
  const placeholders = leadIds.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT * FROM leads WHERE id IN (${placeholders})`);
  const rows = stmt.all(...leadIds) as any[];
  return rows.map(mapLeadRow);
}

// ============= Search Templates =============

export function createSearchTemplate(input: {
  name: string;
  keyword: string;
  location: string;
  radius?: number;
  maxResults: number;
}): SearchTemplate {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO search_templates (id, name, keyword, location, radius, max_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, input.name, input.keyword, input.location, input.radius || null, input.maxResults, now);

  return {
    id,
    name: input.name,
    keyword: input.keyword,
    location: input.location,
    radius: input.radius,
    maxResults: input.maxResults,
    createdAt: now,
  };
}

export function getAllSearchTemplates(): SearchTemplate[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM search_templates ORDER BY created_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    keyword: row.keyword,
    location: row.location,
    radius: row.radius || undefined,
    maxResults: row.max_results,
    createdAt: row.created_at,
  }));
}

export function getSearchTemplate(id: string): SearchTemplate | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM search_templates WHERE id = ?');
  const row = stmt.get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    keyword: row.keyword,
    location: row.location,
    radius: row.radius || undefined,
    maxResults: row.max_results,
    createdAt: row.created_at,
  };
}

export function deleteSearchTemplate(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM search_templates WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============= Lead Notes =============

export function createLeadNote(leadId: string, content: string): LeadNote {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO lead_notes (id, lead_id, content, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, leadId, content, now, now);

  return { id, leadId, content, createdAt: now, updatedAt: now };
}

export function getNotesForLead(leadId: string): LeadNote[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY created_at DESC');
  const rows = stmt.all(leadId) as any[];

  return rows.map(row => ({
    id: row.id,
    leadId: row.lead_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function updateLeadNote(id: string, content: string): LeadNote | null {
  const db = getDatabase();
  const now = new Date().toISOString();

  const stmt = db.prepare('UPDATE lead_notes SET content = ?, updated_at = ? WHERE id = ?');
  stmt.run(content, now, id);

  const getStmt = db.prepare('SELECT * FROM lead_notes WHERE id = ?');
  const row = getStmt.get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    leadId: row.lead_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function deleteLeadNote(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM lead_notes WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============= Project Statistics =============

export function getProjectStats(projectId: string): ProjectStats {
  const db = getDatabase();

  // Get basic counts
  const countsStmt = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN emails != '[]' THEN 1 ELSE 0 END) as with_email,
      SUM(CASE WHEN website_url IS NOT NULL AND website_url != '' THEN 1 ELSE 0 END) as with_website,
      SUM(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END) as with_phone,
      SUM(CASE WHEN enrichment_status = 'done' THEN 1 ELSE 0 END) as enriched,
      AVG(rating) as avg_rating,
      AVG(review_count) as avg_reviews
    FROM leads WHERE project_id = ? AND is_duplicate = 0
  `);
  const counts = countsStmt.get(projectId) as any;

  // Get status breakdown
  const statusStmt = db.prepare(`
    SELECT lead_status, COUNT(*) as count
    FROM leads WHERE project_id = ? AND is_duplicate = 0
    GROUP BY lead_status
  `);
  const statusRows = statusStmt.all(projectId) as any[];
  const leadsByStatus: Record<LeadStatus, number> = {
    new: 0,
    contacted: 0,
    interested: 0,
    won: 0,
    lost: 0,
  };
  for (const row of statusRows) {
    if (row.lead_status in leadsByStatus) {
      leadsByStatus[row.lead_status as LeadStatus] = row.count;
    }
  }

  // Get category breakdown
  const categoryStmt = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM leads WHERE project_id = ? AND is_duplicate = 0 AND category IS NOT NULL
    GROUP BY category ORDER BY count DESC LIMIT 10
  `);
  const categoryRows = categoryStmt.all(projectId) as any[];
  const leadsByCategory: Record<string, number> = {};
  for (const row of categoryRows) {
    leadsByCategory[row.category] = row.count;
  }

  // Get leads over time (last 30 days)
  const timeStmt = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count
    FROM leads WHERE project_id = ? AND is_duplicate = 0
    AND created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at) ORDER BY date ASC
  `);
  const timeRows = timeStmt.all(projectId) as any[];
  const leadsOverTime = timeRows.map(row => ({
    date: row.date,
    count: row.count,
  }));

  return {
    totalLeads: counts.total || 0,
    leadsWithEmail: counts.with_email || 0,
    leadsWithWebsite: counts.with_website || 0,
    leadsWithPhone: counts.with_phone || 0,
    enrichedLeads: counts.enriched || 0,
    leadsByStatus,
    avgRating: counts.avg_rating || 0,
    avgReviewCount: counts.avg_reviews || 0,
    leadsByCategory,
    leadsOverTime,
  };
}

// ============= Follow-up Reminders =============

export function getLeadsWithFollowUpDue(): Lead[] {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const stmt = db.prepare(`
    SELECT * FROM leads
    WHERE follow_up_date IS NOT NULL
    AND DATE(follow_up_date) <= DATE(?)
    AND lead_status NOT IN ('won', 'lost')
    ORDER BY follow_up_date ASC
  `);
  const rows = stmt.all(today) as any[];
  return rows.map(mapLeadRow);
}

export function getUpcomingFollowUps(days: number = 7): Lead[] {
  const db = getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const stmt = db.prepare(`
    SELECT * FROM leads
    WHERE follow_up_date IS NOT NULL
    AND DATE(follow_up_date) > DATE(?)
    AND DATE(follow_up_date) <= DATE(?, '+' || ? || ' days')
    AND lead_status NOT IN ('won', 'lost')
    ORDER BY follow_up_date ASC
  `);
  const rows = stmt.all(today, today, days) as any[];
  return rows.map(mapLeadRow);
}

// ============= Backups =============

export function saveBackupRecord(filename: string, size: number): BackupInfo {
  const db = getDatabase();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO backups (id, filename, created_at, size)
    VALUES (?, ?, ?, ?)
  `);
  stmt.run(id, filename, now, size);

  return { id, filename, createdAt: now, size };
}

export function getAllBackups(): BackupInfo[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM backups ORDER BY created_at DESC');
  const rows = stmt.all() as any[];

  return rows.map(row => ({
    id: row.id,
    filename: row.filename,
    createdAt: row.created_at,
    size: row.size,
  }));
}

export function deleteBackupRecord(id: string): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM backups WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============= Multi-Project Merge =============

export function mergeProjects(sourceProjectIds: string[], targetProjectId: string): number {
  const db = getDatabase();
  let mergedCount = 0;

  const transaction = db.transaction(() => {
    for (const sourceId of sourceProjectIds) {
      if (sourceId === targetProjectId) continue;

      // Get leads from source project
      const sourceLeads = getLeadsByProject(sourceId);

      for (const lead of sourceLeads) {
        // Check if duplicate exists in target
        const isDupe = checkDuplicateInProject(
          targetProjectId,
          lead.googleMapsUrl,
          lead.businessName,
          lead.address
        );

        if (!isDupe) {
          // Create lead in target project
          const stmt = db.prepare(`
            INSERT INTO leads (
              id, project_id, business_name, category, rating, review_count,
              address, phone, website_url, emails, contact_page_url, google_maps_url,
              lead_score, created_at, updated_at, enrichment_status, error_message,
              is_duplicate, lead_status, notes, follow_up_date, social_media,
              business_hours, has_contact_form, latitude, longitude, review_sentiment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          const newId = uuidv4();
          const now = new Date().toISOString();

          stmt.run(
            newId,
            targetProjectId,
            lead.businessName,
            lead.category || null,
            lead.rating || null,
            lead.reviewCount || null,
            lead.address || null,
            lead.phone || null,
            lead.websiteUrl || null,
            JSON.stringify(lead.emails),
            lead.contactPageUrl || null,
            lead.googleMapsUrl,
            lead.leadScore,
            now,
            now,
            lead.enrichmentStatus,
            lead.errorMessage || null,
            0, // not duplicate in target
            lead.leadStatus,
            lead.notes || null,
            lead.followUpDate || null,
            lead.socialMedia ? JSON.stringify(lead.socialMedia) : null,
            lead.businessHours || null,
            lead.hasContactForm === undefined ? null : lead.hasContactForm ? 1 : 0,
            lead.latitude || null,
            lead.longitude || null,
            lead.reviewSentiment || null
          );

          mergedCount++;
        }
      }
    }
  });

  transaction();
  return mergedCount;
}

function checkDuplicateInProject(
  projectId: string,
  googleMapsUrl: string,
  businessName: string,
  address?: string
): boolean {
  const db = getDatabase();

  // Check by Google Maps URL
  const urlStmt = db.prepare('SELECT COUNT(*) as count FROM leads WHERE project_id = ? AND google_maps_url = ?');
  const urlResult = urlStmt.get(projectId, googleMapsUrl) as { count: number };
  if (urlResult.count > 0) return true;

  // Check by normalized name + address
  if (address) {
    const normalizedName = businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedAddress = address.toLowerCase().replace(/[^a-z0-9]/g, '');

    const nameStmt = db.prepare(`
      SELECT business_name, address FROM leads
      WHERE project_id = ? AND address IS NOT NULL
    `);
    const rows = nameStmt.all(projectId) as { business_name: string; address: string }[];

    for (const row of rows) {
      const rowName = row.business_name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const rowAddress = row.address.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (rowName === normalizedName && rowAddress === normalizedAddress) {
        return true;
      }
    }
  }

  return false;
}

// ============= Bulk Lead Status Update =============

export function updateLeadStatuses(leadIds: string[], status: LeadStatus): number {
  if (leadIds.length === 0) return 0;

  const db = getDatabase();
  const now = new Date().toISOString();
  const placeholders = leadIds.map(() => '?').join(',');

  const stmt = db.prepare(`
    UPDATE leads SET lead_status = ?, updated_at = ?
    WHERE id IN (${placeholders})
  `);
  const result = stmt.run(status, now, ...leadIds);
  return result.changes;
}

// ============= Import Leads from CSV =============

export function importLeads(projectId: string, leads: Array<{
  businessName: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  phone?: string;
  websiteUrl?: string;
  emails?: string[];
  googleMapsUrl?: string;
}>): { imported: number; duplicates: number } {
  const db = getDatabase();
  let imported = 0;
  let duplicates = 0;

  const transaction = db.transaction(() => {
    for (const lead of leads) {
      const googleMapsUrl = lead.googleMapsUrl || `imported-${uuidv4()}`;

      const isDupe = checkDuplicateInProject(
        projectId,
        googleMapsUrl,
        lead.businessName,
        lead.address
      );

      if (isDupe) {
        duplicates++;
        continue;
      }

      const id = uuidv4();
      const now = new Date().toISOString();

      const stmt = db.prepare(`
        INSERT INTO leads (
          id, project_id, business_name, category, rating, review_count,
          address, phone, website_url, emails, google_maps_url,
          lead_score, created_at, updated_at, enrichment_status, is_duplicate, lead_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        projectId,
        lead.businessName,
        lead.category || null,
        lead.rating || null,
        lead.reviewCount || null,
        lead.address || null,
        lead.phone || null,
        lead.websiteUrl || null,
        JSON.stringify(lead.emails || []),
        googleMapsUrl,
        0,
        now,
        now,
        lead.websiteUrl ? 'pending' : 'skipped',
        0,
        'new'
      );

      imported++;
    }
  });

  transaction();
  return { imported, duplicates };
}
