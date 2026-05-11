const pool = require("../../config/db");

let schemaReady = false;

const ensureRevenueSchema = async () => {
  if (schemaReady) {
    return;
  }

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS revenue_imports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  await pool.query(`
    ALTER TABLE revenue_imports
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS file_hash TEXT,
      ADD COLUMN IF NOT EXISTS platform TEXT,
      ADD COLUMN IF NOT EXISTS report_month DATE,
      ADD COLUMN IF NOT EXISTS currency TEXT,
      ADD COLUMN IF NOT EXISTS uploaded_by UUID,
      ADD COLUMN IF NOT EXISTS total_rows INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS imported_rows INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS duplicate_rows INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS failed_rows INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS unmatched_rows INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'processing',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS error_summary TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raw_revenues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  await pool.query(`
    ALTER TABLE raw_revenues
      ADD COLUMN IF NOT EXISTS import_id UUID,
      ADD COLUMN IF NOT EXISTS isrc TEXT,
      ADD COLUMN IF NOT EXISTS upc TEXT,
      ADD COLUMN IF NOT EXISTS track_title TEXT,
      ADD COLUMN IF NOT EXISTS track_name TEXT,
      ADD COLUMN IF NOT EXISTS album_name TEXT,
      ADD COLUMN IF NOT EXISTS artist_name TEXT,
      ADD COLUMN IF NOT EXISTS platform TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT,
      ADD COLUMN IF NOT EXISTS streams BIGINT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS revenue NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS currency TEXT,
      ADD COLUMN IF NOT EXISTS report_month DATE,
      ADD COLUMN IF NOT EXISTS raw_data_json JSONB,
      ADD COLUMN IF NOT EXISTS source_row_hash TEXT,
      ADD COLUMN IF NOT EXISTS row_number INTEGER,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS revenue_splits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_type TEXT NOT NULL DEFAULT 'artist',
      owner_id UUID,
      split_percentage NUMERIC(6, 2) NOT NULL DEFAULT 80,
      platform_fee_percentage NUMERIC(6, 2) NOT NULL DEFAULT 0,
      effective_from DATE NOT NULL DEFAULT '2000-01-01',
      created_by UUID,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE revenue_splits
      ADD COLUMN IF NOT EXISTS artist_id UUID,
      ADD COLUMN IF NOT EXISTS label_id UUID,
      ADD COLUMN IF NOT EXISTS release_id UUID,
      ADD COLUMN IF NOT EXISTS track_id UUID,
      ADD COLUMN IF NOT EXISTS isrc TEXT,
      ADD COLUMN IF NOT EXISTS split_type TEXT DEFAULT 'artist',
      ADD COLUMN IF NOT EXISTS artist_percentage NUMERIC(6, 2),
      ADD COLUMN IF NOT EXISTS company_percentage NUMERIC(6, 2),
      ADD COLUMN IF NOT EXISTS label_percentage NUMERIC(6, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS effective_to DATE,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    UPDATE revenue_splits
    SET
      split_type = COALESCE(split_type, owner_type, 'artist'),
      artist_id = CASE WHEN owner_type = 'artist' THEN COALESCE(artist_id, owner_id) ELSE artist_id END,
      label_id = CASE WHEN owner_type = 'label' THEN COALESCE(label_id, owner_id) ELSE label_id END,
      artist_percentage = COALESCE(artist_percentage, split_percentage, 80),
      label_percentage = COALESCE(label_percentage, 0),
      company_percentage = COALESCE(company_percentage, 100 - COALESCE(split_percentage, 80)),
      status = COALESCE(status, 'active'),
      updated_at = COALESCE(updated_at, created_at, NOW())
    WHERE artist_percentage IS NULL
       OR company_percentage IS NULL
       OR status IS NULL
       OR split_type IS NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calculated_revenues (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  await pool.query(`
    ALTER TABLE calculated_revenues
      ADD COLUMN IF NOT EXISTS raw_revenue_id UUID,
      ADD COLUMN IF NOT EXISTS track_id UUID,
      ADD COLUMN IF NOT EXISTS artist_id UUID,
      ADD COLUMN IF NOT EXISTS label_id UUID,
      ADD COLUMN IF NOT EXISTS gross_revenue NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS platform_fee NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_revenue NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS artist_share NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS label_share NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS company_share NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS split_percentage NUMERIC(6, 2) DEFAULT 80,
      ADD COLUMN IF NOT EXISTS split_id UUID,
      ADD COLUMN IF NOT EXISTS gst_deduction NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tds_deduction NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payable_amount NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS finance_status TEXT DEFAULT 'unpaid',
      ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'unpaid',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id UUID,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_revenue_imports_created_at ON revenue_imports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_revenue_imports_month_platform ON revenue_imports(report_month, platform);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_imports_file_hash ON revenue_imports(file_hash, platform, report_month)
      WHERE file_hash IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_raw_revenues_import_id ON raw_revenues(import_id);
    CREATE INDEX IF NOT EXISTS idx_raw_revenues_isrc ON raw_revenues(UPPER(isrc));
    CREATE INDEX IF NOT EXISTS idx_raw_revenues_month_platform ON raw_revenues(report_month, platform);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_revenues_source_hash ON raw_revenues(source_row_hash)
      WHERE source_row_hash IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_calculated_revenues_raw ON calculated_revenues(raw_revenue_id)
      WHERE raw_revenue_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_calculated_revenues_artist ON calculated_revenues(artist_id);
    CREATE INDEX IF NOT EXISTS idx_calculated_revenues_label ON calculated_revenues(label_id);
    CREATE INDEX IF NOT EXISTS idx_revenue_splits_owner ON revenue_splits(owner_type, owner_id, effective_from DESC);
    CREATE INDEX IF NOT EXISTS idx_revenue_splits_artist ON revenue_splits(artist_id, effective_from DESC);
    CREATE INDEX IF NOT EXISTS idx_revenue_splits_label ON revenue_splits(label_id, effective_from DESC);
    CREATE INDEX IF NOT EXISTS idx_revenue_splits_release ON revenue_splits(release_id, effective_from DESC);
    CREATE INDEX IF NOT EXISTS idx_revenue_splits_track ON revenue_splits(track_id, effective_from DESC);
    CREATE INDEX IF NOT EXISTS idx_revenue_splits_isrc ON revenue_splits(UPPER(isrc), effective_from DESC);
    CREATE INDEX IF NOT EXISTS idx_calculated_revenues_status ON calculated_revenues(payout_status, finance_status);
  `);

  schemaReady = true;
};

module.exports = {
  ensureRevenueSchema,
};
