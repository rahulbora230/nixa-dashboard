-- Phase 11: Daily Play Reports, Streaming Analytics & Music Intelligence
-- Safe additive migration for daily play import, analytics, trend alerts and estimated RPM settings.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS daily_report_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT,
  file_hash TEXT,
  platform TEXT,
  report_date DATE,
  uploaded_by UUID,
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  unmatched_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  error_log JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE daily_report_imports
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_hash TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID,
  ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS imported_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unmatched_rows INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS error_log JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS daily_track_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID,
  track_id UUID,
  release_id UUID,
  artist_id UUID,
  label_id UUID,
  isrc TEXT,
  upc TEXT,
  platform TEXT,
  country TEXT,
  city TEXT,
  streams INTEGER DEFAULT 0,
  listeners INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  playlist_adds INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  report_date DATE NOT NULL,
  raw_data_json JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE daily_track_analytics
  ADD COLUMN IF NOT EXISTS import_id UUID,
  ADD COLUMN IF NOT EXISTS track_id UUID,
  ADD COLUMN IF NOT EXISTS release_id UUID,
  ADD COLUMN IF NOT EXISTS artist_id UUID,
  ADD COLUMN IF NOT EXISTS label_id UUID,
  ADD COLUMN IF NOT EXISTS isrc TEXT,
  ADD COLUMN IF NOT EXISTS upc TEXT,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS streams INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listeners INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS playlist_adds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followers INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS raw_data_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS track_title TEXT,
  ADD COLUMN IF NOT EXISTS artist_name TEXT,
  ADD COLUMN IF NOT EXISTS estimated_revenue NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_payout NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS source_row_hash TEXT,
  ADD COLUMN IF NOT EXISTS row_number INTEGER,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS daily_artist_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID,
  label_id UUID,
  platform TEXT,
  country TEXT,
  city TEXT,
  streams INTEGER DEFAULT 0,
  listeners INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  playlist_adds INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  monthly_listeners INTEGER DEFAULT 0,
  profile_views INTEGER DEFAULT 0,
  playlist_reach INTEGER DEFAULT 0,
  report_date DATE NOT NULL,
  raw_data_json JSONB DEFAULT '{}'::jsonb,
  estimated_revenue NUMERIC(14, 6) DEFAULT 0,
  estimated_payout NUMERIC(14, 6) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE daily_artist_analytics
  ADD COLUMN IF NOT EXISTS artist_id UUID,
  ADD COLUMN IF NOT EXISTS label_id UUID,
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS streams INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS listeners INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS playlist_adds INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS followers INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_listeners INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_views INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS playlist_reach INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS raw_data_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_revenue NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_payout NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS trend_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID,
  artist_id UUID,
  alert_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  metric TEXT,
  old_value NUMERIC(14, 6) DEFAULT 0,
  new_value NUMERIC(14, 6) DEFAULT 0,
  growth_percentage NUMERIC(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS estimated_rpm_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'GLOBAL',
  rpm NUMERIC(12, 6) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  updated_by UUID,
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE trend_alerts
  ADD COLUMN IF NOT EXISTS track_id UUID,
  ADD COLUMN IF NOT EXISTS artist_id UUID,
  ADD COLUMN IF NOT EXISTS alert_type TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS metric TEXT,
  ADD COLUMN IF NOT EXISTS old_value NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_value NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS growth_percentage NUMERIC(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE estimated_rpm_settings
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'GLOBAL',
  ADD COLUMN IF NOT EXISTS rpm NUMERIC(12, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS updated_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_report_imports_hash
  ON daily_report_imports(file_hash, platform, report_date)
  WHERE file_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_report_imports_created_at
  ON daily_report_imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_daily_report_imports_platform_date
  ON daily_report_imports(platform, report_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_track_source_hash
  ON daily_track_analytics(source_row_hash)
  WHERE source_row_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_track_import_id
  ON daily_track_analytics(import_id);
CREATE INDEX IF NOT EXISTS idx_daily_track_date
  ON daily_track_analytics(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_track_track_date
  ON daily_track_analytics(track_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_track_release_date
  ON daily_track_analytics(release_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_track_artist_date
  ON daily_track_analytics(artist_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_track_label_date
  ON daily_track_analytics(label_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_track_isrc
  ON daily_track_analytics(UPPER(isrc));
CREATE INDEX IF NOT EXISTS idx_daily_track_platform_country
  ON daily_track_analytics(platform, country);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_track_unique_scope_phase11
  ON daily_track_analytics(track_id, report_date, platform, country, city);

CREATE INDEX IF NOT EXISTS idx_daily_artist_artist_date
  ON daily_artist_analytics(artist_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_artist_label_date
  ON daily_artist_analytics(label_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_artist_platform_country
  ON daily_artist_analytics(platform, country);
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_artist_unique_scope_phase11
  ON daily_artist_analytics(artist_id, report_date, platform, country, city);

CREATE INDEX IF NOT EXISTS idx_trend_alerts_track
  ON trend_alerts(track_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_alerts_artist
  ON trend_alerts(artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trend_alerts_type
  ON trend_alerts(alert_type, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estimated_rpm_scope
  ON estimated_rpm_settings(LOWER(platform), UPPER(country));

INSERT INTO estimated_rpm_settings (platform, country, rpm, currency)
VALUES
  ('Spotify', 'GLOBAL', 2.80, 'INR'),
  ('Apple Music', 'GLOBAL', 6.50, 'INR'),
  ('YouTube', 'GLOBAL', 1.20, 'INR'),
  ('YouTube Music', 'GLOBAL', 1.60, 'INR'),
  ('Meta', 'GLOBAL', 0.85, 'INR'),
  ('Instagram', 'GLOBAL', 0.70, 'INR'),
  ('Facebook', 'GLOBAL', 0.70, 'INR'),
  ('TikTok', 'GLOBAL', 0.45, 'INR'),
  ('Amazon Music', 'GLOBAL', 4.20, 'INR'),
  ('JioSaavn', 'GLOBAL', 0.85, 'INR'),
  ('Wynk', 'GLOBAL', 0.70, 'INR'),
  ('Boomplay', 'GLOBAL', 0.35, 'INR'),
  ('Others', 'GLOBAL', 1.00, 'INR')
ON CONFLICT (LOWER(platform), UPPER(country)) DO NOTHING;
