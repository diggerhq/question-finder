CREATE TABLE sites (
  domain TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT '',
  project_id TEXT NOT NULL,
  location_code INTEGER NOT NULL DEFAULT 2840,
  language_code TEXT NOT NULL DEFAULT 'en',
  competitors_json TEXT NOT NULL DEFAULT '[]',
  monitoring_enabled INTEGER NOT NULL DEFAULT 0 CHECK (monitoring_enabled IN (0,1)),
  last_attempt_at TEXT,
  last_success_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE research_runs (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL REFERENCES sites(domain),
  period TEXT NOT NULL,
  session_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','complete','partial','blocked','failed')),
  report_url TEXT,
  summary TEXT,
  limitations_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE opportunities (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL REFERENCES sites(domain),
  query_key TEXT NOT NULL,
  query TEXT NOT NULL,
  question TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','improve')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','dismissed','published')),
  brief_json TEXT NOT NULL,
  first_run_id TEXT NOT NULL REFERENCES research_runs(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(domain,query_key)
);
CREATE INDEX opportunities_by_site ON opportunities(domain,status);
CREATE INDEX runs_by_site ON research_runs(domain,created_at);
