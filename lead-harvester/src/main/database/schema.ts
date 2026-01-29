// SQL schema for LeadHarvester database

export const SCHEMA = `
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

-- Leads table
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

-- Settings table (single row)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  safe_mode INTEGER NOT NULL DEFAULT 1,
  concurrency INTEGER NOT NULL DEFAULT 1,
  delay_between_actions INTEGER NOT NULL DEFAULT 2000,
  max_results_default INTEGER NOT NULL DEFAULT 50,
  website_crawl_timeout INTEGER NOT NULL DEFAULT 15000,
  user_agent TEXT NOT NULL,
  show_onboarding INTEGER NOT NULL DEFAULT 1
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_project_id ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_enrichment_status ON leads(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score);
CREATE INDEX IF NOT EXISTS idx_logs_project_id ON logs(project_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
`;

export const INITIAL_SETTINGS = `
INSERT OR IGNORE INTO settings (
  id, safe_mode, concurrency, delay_between_actions,
  max_results_default, website_crawl_timeout, user_agent, show_onboarding
) VALUES (
  1, 1, 1, 2000, 50, 15000,
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  1
);
`;
