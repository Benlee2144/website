import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SCHEMA, INITIAL_SETTINGS } from './schema';
import type {
  Project,
  Lead,
  RunState,
  AppSettings,
  LogEntry,
  LeadFilters,
  EnrichmentStatus,
  ProjectStatus,
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

  // Run schema
  db.exec(SCHEMA);
  db.exec(INITIAL_SETTINGS);

  return db;
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
  }

  query += ' ORDER BY lead_score DESC, created_at DESC';

  const stmt = db.prepare(query);
  const rows = stmt.all(...params) as any[];
  return rows.map(mapLeadRow);
}

export function updateLead(id: string, input: Partial<{
  emails: string[];
  contactPageUrl: string | null;
  leadScore: number;
  enrichmentStatus: EnrichmentStatus;
  errorMessage: string | null;
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
  const stmt = db.prepare(`
    SELECT * FROM leads
    WHERE project_id = ?
    AND enrichment_status = 'pending'
    AND website_url IS NOT NULL
    AND website_url != ''
    AND is_duplicate = 0
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
