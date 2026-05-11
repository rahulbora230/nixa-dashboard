-- Phase 9: Catalog Architecture Refactor & Metadata Engine
-- Safe additive migration for the Nixa Music catalog foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS release_title TEXT,
  ADD COLUMN IF NOT EXISTS permalink_slug TEXT,
  ADD COLUMN IF NOT EXISTS sub_label_name TEXT,
  ADD COLUMN IF NOT EXISTS original_release_date DATE,
  ADD COLUMN IF NOT EXISTS go_live_date DATE,
  ADD COLUMN IF NOT EXISTS copyright_holder TEXT,
  ADD COLUMN IF NOT EXISTS copyright_line TEXT,
  ADD COLUMN IF NOT EXISTS production_year INTEGER,
  ADD COLUMN IF NOT EXISTS catalog_number TEXT,
  ADD COLUMN IF NOT EXISTS territory_mode TEXT DEFAULT 'worldwide',
  ADD COLUMN IF NOT EXISTS included_territories JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excluded_territories JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS store_selection JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS distribution_type TEXT DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS promotional_release BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS current_owner TEXT,
  ADD COLUMN IF NOT EXISTS previous_owner TEXT,
  ADD COLUMN IF NOT EXISTS ownership_transferable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata_completion_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qc_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS qc_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qc_warnings JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qc_errors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS metadata_format_version TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_template_type TEXT,
  ADD COLUMN IF NOT EXISTS metadata_import_id UUID,
  ADD COLUMN IF NOT EXISTS metadata_raw JSONB DEFAULT '{}'::jsonb;

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS song_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_artist TEXT,
  ADD COLUMN IF NOT EXISTS featuring_artist TEXT,
  ADD COLUMN IF NOT EXISTS remixer TEXT,
  ADD COLUMN IF NOT EXISTS iswc TEXT,
  ADD COLUMN IF NOT EXISTS director TEXT,
  ADD COLUMN IF NOT EXISTS star_cast TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS genre TEXT,
  ADD COLUMN IF NOT EXISTS subgenre TEXT,
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS instrumental BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview_start_time TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_clip_start TEXT,
  ADD COLUMN IF NOT EXISTS crbt_title TEXT,
  ADD COLUMN IF NOT EXISTS crbt_start_time_1 TEXT,
  ADD COLUMN IF NOT EXISTS crbt_start_time_2 TEXT,
  ADD COLUMN IF NOT EXISTS lyrics_file TEXT,
  ADD COLUMN IF NOT EXISTS bitrate INTEGER,
  ADD COLUMN IF NOT EXISTS sample_rate INTEGER,
  ADD COLUMN IF NOT EXISTS stereo_mono TEXT,
  ADD COLUMN IF NOT EXISTS dolby_atmos BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata_completion_percentage INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qc_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS qc_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS qc_warnings JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS qc_errors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS metadata_raw JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contributors JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS platforms JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE tracks ALTER COLUMN title DROP NOT NULL;
ALTER TABLE tracks ALTER COLUMN isrc DROP NOT NULL;

CREATE TABLE IF NOT EXISTS isrc_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  registrant_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_isrc_sequences_scope ON isrc_sequences(country_code, registrant_code, year);

CREATE TABLE IF NOT EXISTS ownership_transfer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
  old_owner TEXT,
  new_owner TEXT NOT NULL,
  transferred_by TEXT,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metadata_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_type TEXT NOT NULL,
  file_name TEXT,
  status TEXT DEFAULT 'preview',
  total_rows INTEGER DEFAULT 0,
  valid_rows INTEGER DEFAULT 0,
  error_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  imported_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS metadata_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES metadata_imports(id) ON DELETE CASCADE,
  row_number INTEGER,
  row_data JSONB DEFAULT '{}'::jsonb,
  validation_errors JSONB DEFAULT '[]'::jsonb,
  validation_warnings JSONB DEFAULT '[]'::jsonb,
  matched_release_id UUID,
  matched_track_id UUID,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE metadata_imports
  ADD COLUMN IF NOT EXISTS format_version TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_template_type TEXT,
  ADD COLUMN IF NOT EXISTS validation_summary JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_report JSONB DEFAULT '[]'::jsonb;

ALTER TABLE metadata_import_rows
  ADD COLUMN IF NOT EXISTS normalized_data JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS release_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
  track_id UUID,
  platform TEXT NOT NULL,
  platform_track_id TEXT,
  platform_url TEXT,
  delivery_status TEXT DEFAULT 'pending',
  delivery_date DATE,
  last_updated TIMESTAMP DEFAULT NOW(),
  delivery_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE release_deliveries
  ADD COLUMN IF NOT EXISTS remark TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE TABLE IF NOT EXISTS track_platform_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID,
  track_id UUID,
  platform TEXT NOT NULL,
  platform_track_id TEXT,
  platform_url TEXT NOT NULL,
  imported_by TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(track_id, platform)
);

CREATE TABLE IF NOT EXISTS daily_track_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID,
  release_id UUID,
  report_date DATE NOT NULL,
  platform TEXT,
  country TEXT,
  city TEXT,
  streams INTEGER DEFAULT 0,
  listeners INTEGER DEFAULT 0,
  playlist_adds INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(track_id, report_date, platform, country, city)
);

ALTER TABLE daily_track_analytics
  ADD COLUMN IF NOT EXISTS upc TEXT,
  ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

CREATE TABLE IF NOT EXISTS daily_artist_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID,
  report_date DATE NOT NULL,
  platform TEXT,
  country TEXT,
  city TEXT,
  streams INTEGER DEFAULT 0,
  listeners INTEGER DEFAULT 0,
  playlist_adds INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(artist_id, report_date, platform, country, city)
);

ALTER TABLE daily_artist_analytics
  ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

UPDATE releases
SET release_title = COALESCE(release_title, title),
    copyright_holder = COALESCE(copyright_holder, copyright_owner),
    copyright_line = COALESCE(copyright_line, copyright_owner),
    current_owner = COALESCE(current_owner, created_by, user_id::text),
    production_year = COALESCE(production_year, EXTRACT(YEAR FROM COALESCE(original_release_date, release_date, created_at))::int),
    permalink_slug = COALESCE(
      permalink_slug,
      LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(COALESCE(title, id::text), '[^a-zA-Z0-9]+', '-', 'g')))
    )
WHERE release_title IS NULL
   OR copyright_holder IS NULL
   OR copyright_line IS NULL
   OR current_owner IS NULL
   OR production_year IS NULL
   OR permalink_slug IS NULL;

UPDATE tracks t
SET song_name = COALESCE(t.song_name, t.title),
    primary_artist = COALESCE(t.primary_artist, r.primary_artist),
    genre = COALESCE(t.genre, r.genre)
FROM releases r
WHERE t.release_id = r.id
  AND (t.song_name IS NULL OR t.primary_artist IS NULL OR t.genre IS NULL);

CREATE INDEX IF NOT EXISTS idx_releases_permalink_slug ON releases(permalink_slug);
CREATE INDEX IF NOT EXISTS idx_releases_current_owner ON releases(current_owner);
CREATE INDEX IF NOT EXISTS idx_releases_qc_status ON releases(qc_status);
CREATE INDEX IF NOT EXISTS idx_releases_delivery_status ON releases(delivery_status);
CREATE INDEX IF NOT EXISTS idx_tracks_song_name ON tracks(song_name);
CREATE INDEX IF NOT EXISTS idx_tracks_qc_status ON tracks(qc_status);
CREATE INDEX IF NOT EXISTS idx_ownership_transfer_release_id ON ownership_transfer_logs(release_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_metadata_import_rows_import_id ON metadata_import_rows(import_id);
CREATE INDEX IF NOT EXISTS idx_release_deliveries_release_id ON release_deliveries(release_id);
CREATE INDEX IF NOT EXISTS idx_release_deliveries_track_id ON release_deliveries(track_id);
CREATE INDEX IF NOT EXISTS idx_release_deliveries_platform ON release_deliveries(platform);
CREATE INDEX IF NOT EXISTS idx_release_deliveries_status ON release_deliveries(delivery_status);
CREATE INDEX IF NOT EXISTS idx_track_platform_links_track_id ON track_platform_links(track_id);
CREATE INDEX IF NOT EXISTS idx_track_platform_links_platform ON track_platform_links(platform);
CREATE INDEX IF NOT EXISTS idx_daily_track_analytics_date ON daily_track_analytics(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_track_analytics_platform ON daily_track_analytics(platform);
CREATE INDEX IF NOT EXISTS idx_daily_track_analytics_country ON daily_track_analytics(country);
CREATE INDEX IF NOT EXISTS idx_daily_artist_analytics_date ON daily_artist_analytics(report_date);
CREATE INDEX IF NOT EXISTS idx_metadata_imports_format ON metadata_imports(format_version);
