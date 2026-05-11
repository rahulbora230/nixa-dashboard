const pool = require("../config/db");

let schemaReady = false;

const getColumnSqlType = async (tableName, columnName) => {
  const result = await pool.query(
    `
    SELECT data_type, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [tableName, columnName]
  );

  const column = result.rows[0];

  if (!column) {
    return "UUID";
  }

  if (column.udt_name === "uuid") {
    return "UUID";
  }

  if (column.udt_name === "int4") {
    return "INTEGER";
  }

  if (column.udt_name === "int8") {
    return "BIGINT";
  }

  return "TEXT";
};

const ensureReleaseSchema = async () => {
  if (schemaReady) {
    return;
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS releases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  const releaseIdType = await getColumnSqlType("releases", "id");

  await pool.query(`
    ALTER TABLE releases
      ADD COLUMN IF NOT EXISTS release_type VARCHAR(20),
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS release_title TEXT,
      ADD COLUMN IF NOT EXISTS permalink_slug TEXT,
      ADD COLUMN IF NOT EXISTS primary_artist TEXT,
      ADD COLUMN IF NOT EXISTS featured_artists TEXT,
      ADD COLUMN IF NOT EXISTS label_name TEXT,
      ADD COLUMN IF NOT EXISTS sub_label_name TEXT,
      ADD COLUMN IF NOT EXISTS genre TEXT,
      ADD COLUMN IF NOT EXISTS sub_genre TEXT,
      ADD COLUMN IF NOT EXISTS language TEXT,
      ADD COLUMN IF NOT EXISTS original_release_date DATE,
      ADD COLUMN IF NOT EXISTS release_date DATE,
      ADD COLUMN IF NOT EXISTS go_live_date DATE,
      ADD COLUMN IF NOT EXISTS upc TEXT,
      ADD COLUMN IF NOT EXISTS copyright_owner TEXT,
      ADD COLUMN IF NOT EXISTS copyright_holder TEXT,
      ADD COLUMN IF NOT EXISTS copyright_line TEXT,
      ADD COLUMN IF NOT EXISTS production_year INTEGER,
      ADD COLUMN IF NOT EXISTS catalog_number TEXT,
      ADD COLUMN IF NOT EXISTS publisher TEXT,
      ADD COLUMN IF NOT EXISTS explicit BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS internal_notes TEXT,
      ADD COLUMN IF NOT EXISTS territory_mode TEXT DEFAULT 'worldwide',
      ADD COLUMN IF NOT EXISTS included_territories JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS excluded_territories JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS store_selection JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS distribution_type TEXT DEFAULT 'standard',
      ADD COLUMN IF NOT EXISTS promotional_release BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS admin_notes TEXT,
      ADD COLUMN IF NOT EXISTS user_id INTEGER,
      ADD COLUMN IF NOT EXISTS created_by TEXT,
      ADD COLUMN IF NOT EXISTS current_owner TEXT,
      ADD COLUMN IF NOT EXISTS previous_owner TEXT,
      ADD COLUMN IF NOT EXISTS ownership_transferable BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS metadata_completion_percentage INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS qc_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS qc_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS qc_warnings JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS qc_errors JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS release_health_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS metadata_locked BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS metadata_lock_reason TEXT,
      ADD COLUMN IF NOT EXISTS metadata_unlocked_until TIMESTAMP,
      ADD COLUMN IF NOT EXISTS metadata_format_version TEXT,
      ADD COLUMN IF NOT EXISTS uploaded_template_type TEXT,
      ADD COLUMN IF NOT EXISTS metadata_import_id UUID,
      ADD COLUMN IF NOT EXISTS metadata_raw JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS artist_id UUID,
      ADD COLUMN IF NOT EXISTS label_id UUID,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tracks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  await pool.query(`
    ALTER TABLE tracks
      ADD COLUMN IF NOT EXISTS release_id ${releaseIdType},
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS song_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS primary_artist TEXT,
      ADD COLUMN IF NOT EXISTS featuring_artist TEXT,
      ADD COLUMN IF NOT EXISTS remixer TEXT,
      ADD COLUMN IF NOT EXISTS isrc TEXT,
      ADD COLUMN IF NOT EXISTS iswc TEXT,
      ADD COLUMN IF NOT EXISTS composer TEXT,
      ADD COLUMN IF NOT EXISTS lyricist TEXT,
      ADD COLUMN IF NOT EXISTS producer TEXT,
      ADD COLUMN IF NOT EXISTS director TEXT,
      ADD COLUMN IF NOT EXISTS star_cast TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS duration VARCHAR(24),
      ADD COLUMN IF NOT EXISTS version TEXT,
      ADD COLUMN IF NOT EXISTS language TEXT,
      ADD COLUMN IF NOT EXISTS genre VARCHAR(255),
      ADD COLUMN IF NOT EXISTS subgenre TEXT,
      ADD COLUMN IF NOT EXISTS mood TEXT,
      ADD COLUMN IF NOT EXISTS explicit BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_explicit BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS instrumental BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS preview_start_time VARCHAR(24),
      ADD COLUMN IF NOT EXISTS tiktok_clip_start VARCHAR(24),
      ADD COLUMN IF NOT EXISTS crbt_title TEXT,
      ADD COLUMN IF NOT EXISTS crbt_start_time_1 VARCHAR(24),
      ADD COLUMN IF NOT EXISTS crbt_start_time_2 VARCHAR(24),
      ADD COLUMN IF NOT EXISTS audio_file_path TEXT,
      ADD COLUMN IF NOT EXISTS audio_url TEXT,
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
      ADD COLUMN IF NOT EXISTS metadata_locked BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS metadata_raw JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS contributors JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS platforms JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'artist',
      ADD COLUMN IF NOT EXISTS owner_id UUID,
      ADD COLUMN IF NOT EXISTS album_name TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE tracks
      ALTER COLUMN owner_type SET DEFAULT 'artist';
  `);

  await pool.query(`
    ALTER TABLE tracks
      DROP CONSTRAINT IF EXISTS tracks_title_not_null,
      DROP CONSTRAINT IF EXISTS tracks_isrc_not_null;
  `);

  await pool.query(`
    UPDATE releases
    SET
      release_title = COALESCE(release_title, title),
      copyright_holder = COALESCE(copyright_holder, copyright_owner),
      copyright_line = COALESCE(copyright_line, copyright_owner),
      current_owner = COALESCE(current_owner, created_by, user_id::text),
      production_year = COALESCE(production_year, EXTRACT(YEAR FROM COALESCE(original_release_date, release_date, created_at))::int)
    WHERE release_title IS NULL
       OR copyright_holder IS NULL
       OR copyright_line IS NULL
       OR current_owner IS NULL
       OR production_year IS NULL;
  `);

  await pool.query(`
    UPDATE releases
    SET permalink_slug = LOWER(REGEXP_REPLACE(TRIM(COALESCE(permalink_slug, release_title, title, id::text)), '[^a-zA-Z0-9]+', '-', 'g'))
    WHERE permalink_slug IS NULL OR permalink_slug = '';
  `);

  await pool.query(`
    UPDATE tracks
    SET
      song_name = COALESCE(song_name, title),
      primary_artist = COALESCE(primary_artist, (
        SELECT primary_artist FROM releases WHERE releases.id = tracks.release_id LIMIT 1
      )),
      genre = COALESCE(genre, (
        SELECT genre FROM releases WHERE releases.id = tracks.release_id LIMIT 1
      ))
    WHERE song_name IS NULL OR primary_artist IS NULL OR genre IS NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS release_files (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      file_type VARCHAR(20) NOT NULL,
      file_name TEXT,
      file_path TEXT,
      file_url TEXT,
      mime_type TEXT,
      size BIGINT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE release_files
      ADD COLUMN IF NOT EXISTS release_id ${releaseIdType},
      ADD COLUMN IF NOT EXISTS file_type VARCHAR(20),
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS file_path TEXT,
      ADD COLUMN IF NOT EXISTS file_url TEXT,
      ADD COLUMN IF NOT EXISTS mime_type TEXT,
      ADD COLUMN IF NOT EXISTS size BIGINT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    UPDATE release_files
    SET file_path = COALESCE(file_path, file_url)
    WHERE file_path IS NULL AND file_url IS NOT NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS release_status_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      from_status VARCHAR(20),
      to_status VARCHAR(20) NOT NULL,
      notes TEXT,
      changed_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE release_status_logs
      ADD COLUMN IF NOT EXISTS release_id ${releaseIdType},
      ADD COLUMN IF NOT EXISTS from_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS to_status VARCHAR(20),
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS changed_by TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS isrc_sequences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      country_code TEXT NOT NULL,
      registrant_code TEXT NOT NULL,
      year INTEGER NOT NULL,
      last_sequence INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(country_code, registrant_code, year)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ownership_transfer_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      old_owner TEXT,
      new_owner TEXT NOT NULL,
      transferred_by TEXT,
      reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
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
  `);

  await pool.query(`
    ALTER TABLE metadata_imports
      ADD COLUMN IF NOT EXISTS format_version TEXT,
      ADD COLUMN IF NOT EXISTS uploaded_template_type TEXT,
      ADD COLUMN IF NOT EXISTS validation_summary JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS error_report JSONB DEFAULT '[]'::jsonb;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS metadata_import_rows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      import_id UUID REFERENCES metadata_imports(id) ON DELETE CASCADE,
      row_number INTEGER,
      row_data JSONB DEFAULT '{}'::jsonb,
      validation_errors JSONB DEFAULT '[]'::jsonb,
      validation_warnings JSONB DEFAULT '[]'::jsonb,
      matched_release_id ${releaseIdType},
      matched_track_id UUID,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE metadata_import_rows
      ADD COLUMN IF NOT EXISTS normalized_data JSONB DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS release_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
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
  `);

  await pool.query(`
    ALTER TABLE release_deliveries
      ADD COLUMN IF NOT EXISTS remark TEXT,
      ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
      ADD COLUMN IF NOT EXISTS updated_by TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS track_platform_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType},
      track_id UUID,
      platform TEXT NOT NULL,
      platform_track_id TEXT,
      platform_url TEXT NOT NULL,
      imported_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(track_id, platform)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS daily_track_analytics (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      track_id UUID,
      release_id ${releaseIdType},
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
  `);

  await pool.query(`
    ALTER TABLE daily_track_analytics
      ADD COLUMN IF NOT EXISTS upc TEXT,
      ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
  `);

  await pool.query(`
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
  `);

  await pool.query(`
    ALTER TABLE daily_artist_analytics
      ADD COLUMN IF NOT EXISTS revenue NUMERIC DEFAULT 0,
      ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS release_qc_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      qc_score INTEGER DEFAULT 0,
      metadata_completion INTEGER DEFAULT 0,
      release_health INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      categories JSONB DEFAULT '{}'::jsonb,
      warnings JSONB DEFAULT '[]'::jsonb,
      errors JSONB DEFAULT '[]'::jsonb,
      suggestions JSONB DEFAULT '[]'::jsonb,
      conflicts JSONB DEFAULT '[]'::jsonb,
      run_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS track_qc_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      track_id UUID,
      qc_score INTEGER DEFAULT 0,
      metadata_completion INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      categories JSONB DEFAULT '{}'::jsonb,
      warnings JSONB DEFAULT '[]'::jsonb,
      errors JSONB DEFAULT '[]'::jsonb,
      suggestions JSONB DEFAULT '[]'::jsonb,
      run_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_queue (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      track_id UUID,
      platform TEXT NOT NULL,
      priority INTEGER DEFAULT 5,
      delivery_status TEXT DEFAULT 'queued',
      retry_count INTEGER DEFAULT 0,
      last_attempt TIMESTAMP,
      next_retry TIMESTAMP,
      delivery_logs JSONB DEFAULT '[]'::jsonb,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE delivery_queue
      ADD COLUMN IF NOT EXISTS release_id ${releaseIdType},
      ADD COLUMN IF NOT EXISTS track_id UUID,
      ADD COLUMN IF NOT EXISTS platform TEXT,
      ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 5,
      ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'queued',
      ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_attempt TIMESTAMP,
      ADD COLUMN IF NOT EXISTS next_retry TIMESTAMP,
      ADD COLUMN IF NOT EXISTS delivery_logs JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS created_by TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_queue_unique_active
    ON delivery_queue(release_id, COALESCE(track_id::text, ''), LOWER(platform))
    WHERE delivery_status NOT IN ('cancelled', 'removed', 'takedown_complete');
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      queue_id UUID,
      release_id ${releaseIdType},
      track_id UUID,
      platform TEXT,
      action TEXT NOT NULL,
      old_status TEXT,
      new_status TEXT,
      message TEXT,
      performed_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS takedown_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      track_id UUID,
      platform TEXT,
      territory TEXT,
      takedown_type TEXT DEFAULT 'full',
      status TEXT DEFAULT 'requested',
      reason TEXT,
      requested_by TEXT,
      approved_by TEXT,
      effective_date DATE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS metadata_lock_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      track_id UUID,
      field_name TEXT,
      action TEXT NOT NULL,
      reason TEXT,
      performed_by TEXT,
      locked_snapshot JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS release_health_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType} REFERENCES releases(id) ON DELETE CASCADE,
      health_score INTEGER DEFAULT 0,
      factors JSONB DEFAULT '{}'::jsonb,
      suggestions JSONB DEFAULT '[]'::jsonb,
      created_by TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conflict_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id ${releaseIdType},
      track_id UUID,
      conflict_type TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      status TEXT DEFAULT 'open',
      message TEXT,
      details JSONB DEFAULT '{}'::jsonb,
      detected_at TIMESTAMP DEFAULT NOW(),
      resolved_at TIMESTAMP,
      resolved_by TEXT
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
    CREATE INDEX IF NOT EXISTS idx_releases_user_id ON releases(user_id);
    CREATE INDEX IF NOT EXISTS idx_releases_created_by ON releases(created_by);
    CREATE INDEX IF NOT EXISTS idx_releases_current_owner ON releases(current_owner);
    CREATE INDEX IF NOT EXISTS idx_releases_permalink_slug ON releases(permalink_slug);
    CREATE INDEX IF NOT EXISTS idx_releases_qc_status ON releases(qc_status);
    CREATE INDEX IF NOT EXISTS idx_releases_health_score ON releases(release_health_score);
    CREATE INDEX IF NOT EXISTS idx_releases_delivery_status ON releases(delivery_status);
    CREATE INDEX IF NOT EXISTS idx_releases_upc ON releases(upc);
    CREATE INDEX IF NOT EXISTS idx_tracks_release_id ON tracks(release_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(UPPER(isrc));
    CREATE INDEX IF NOT EXISTS idx_tracks_qc_status ON tracks(qc_status);
    CREATE INDEX IF NOT EXISTS idx_release_files_release_id ON release_files(release_id);
    CREATE INDEX IF NOT EXISTS idx_release_status_logs_release_id ON release_status_logs(release_id, created_at DESC);
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
    CREATE INDEX IF NOT EXISTS idx_release_qc_reports_release_id ON release_qc_reports(release_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_track_qc_reports_release_id ON track_qc_reports(release_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_track_qc_reports_track_id ON track_qc_reports(track_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_delivery_queue_release_id ON delivery_queue(release_id);
    CREATE INDEX IF NOT EXISTS idx_delivery_queue_platform ON delivery_queue(platform);
    CREATE INDEX IF NOT EXISTS idx_delivery_queue_status ON delivery_queue(delivery_status);
    CREATE INDEX IF NOT EXISTS idx_delivery_queue_next_retry ON delivery_queue(next_retry);
    CREATE INDEX IF NOT EXISTS idx_delivery_logs_release_id ON delivery_logs(release_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_takedown_requests_release_id ON takedown_requests(release_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_takedown_requests_status ON takedown_requests(status);
    CREATE INDEX IF NOT EXISTS idx_metadata_lock_logs_release_id ON metadata_lock_logs(release_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_release_health_reports_release_id ON release_health_reports(release_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conflict_reports_release_id ON conflict_reports(release_id, detected_at DESC);
    CREATE INDEX IF NOT EXISTS idx_conflict_reports_status ON conflict_reports(status);
  `);

  schemaReady = true;
};

module.exports = {
  ensureReleaseSchema,
};
