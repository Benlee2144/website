// SQL schema for LeadHarvester database

// Tables only - no indexes that depend on new columns
export const SCHEMA_TABLES = `
-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keyword TEXT NOT NULL,
  location TEXT NOT NULL,
  radius INTEGER,
  max_results INTEGER NOT NULL DEFAULT 50,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle'
);

-- Leads table (base columns only - new columns added by migration)
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  category TEXT,
  rating REAL,
  review_count INTEGER,
  address TEXT,
  phone TEXT,
  website_url TEXT,
  emails TEXT NOT NULL DEFAULT '[]',
  contact_page_url TEXT,
  google_maps_url TEXT NOT NULL,
  lead_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  enrichment_status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  is_duplicate INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Run state table for pause/resume
CREATE TABLE IF NOT EXISTS run_state (
  project_id TEXT PRIMARY KEY,
  phase TEXT NOT NULL,
  scroll_position INTEGER NOT NULL DEFAULT 0,
  scraped_count INTEGER NOT NULL DEFAULT 0,
  enriched_count INTEGER NOT NULL DEFAULT 0,
  pending_enrichment_ids TEXT NOT NULL DEFAULT '[]',
  last_processed_url TEXT,
  started_at TEXT NOT NULL,
  paused_at TEXT,
  error TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  metadata TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Settings table (base columns only - new columns added by migration)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  safe_mode INTEGER NOT NULL DEFAULT 1,
  concurrency INTEGER NOT NULL DEFAULT 1,
  delay_between_actions INTEGER NOT NULL DEFAULT 2000,
  max_results_default INTEGER NOT NULL DEFAULT 50,
  website_crawl_timeout INTEGER NOT NULL DEFAULT 15000,
  user_agent TEXT NOT NULL,
  show_onboarding INTEGER NOT NULL DEFAULT 1,
  theme TEXT NOT NULL DEFAULT 'system'
);

-- Search templates table
CREATE TABLE IF NOT EXISTS search_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keyword TEXT NOT NULL,
  location TEXT NOT NULL,
  radius INTEGER,
  max_results INTEGER NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL
);

-- Lead notes table
CREATE TABLE IF NOT EXISTS lead_notes (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

-- Backups table
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  created_at TEXT NOT NULL,
  size INTEGER NOT NULL
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TEXT NOT NULL
);

-- Lead-Tag junction table
CREATE TABLE IF NOT EXISTS lead_tags (
  lead_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (lead_id, tag_id),
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Email verification cache table
CREATE TABLE IF NOT EXISTS email_verifications (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unverified',
  mx_valid INTEGER,
  syntax_valid INTEGER NOT NULL DEFAULT 1,
  verified_at TEXT
);

-- Base indexes (only on columns that exist in base schema)
CREATE INDEX IF NOT EXISTS idx_leads_project_id ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_enrichment_status ON leads(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_logs_project_id ON logs(project_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_lead_tags_lead_id ON lead_tags(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_tag_id ON lead_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id);
`;

// Keep SCHEMA as alias for backwards compatibility
export const SCHEMA = SCHEMA_TABLES;

export const INITIAL_SETTINGS = `
INSERT OR IGNORE INTO settings (
  id, safe_mode, concurrency, delay_between_actions,
  max_results_default, website_crawl_timeout, user_agent, show_onboarding, theme
) VALUES (
  1, 1, 1, 2000, 50, 15000,
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  1, 'system'
);
`;

// Migration for existing databases
export const MIGRATIONS = `
-- Add new columns to leads if they don't exist (SQLite doesn't have IF NOT EXISTS for columns)
-- These will be handled in code with try-catch

-- Add new columns to settings if they don't exist
-- These will be handled in code with try-catch
`;
