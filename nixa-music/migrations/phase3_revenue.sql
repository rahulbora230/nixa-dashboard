CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS revenue_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT,
  file_hash TEXT,
  platform TEXT,
  report_month DATE,
  currency TEXT,
  uploaded_by UUID,
  total_rows INTEGER DEFAULT 0,
  imported_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  unmatched_rows INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  notes TEXT,
  error_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raw_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

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

CREATE TABLE IF NOT EXISTS calculated_revenues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_revenue_id UUID,
  track_id UUID,
  artist_id UUID,
  label_id UUID,
  gross_revenue NUMERIC(14, 6) DEFAULT 0,
  platform_fee NUMERIC(14, 6) DEFAULT 0,
  net_revenue NUMERIC(14, 6) DEFAULT 0,
  artist_share NUMERIC(14, 6) DEFAULT 0,
  label_share NUMERIC(14, 6) DEFAULT 0,
  split_percentage NUMERIC(6, 2) DEFAULT 80,
  payout_status TEXT DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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
