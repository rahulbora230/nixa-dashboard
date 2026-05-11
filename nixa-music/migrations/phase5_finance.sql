CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

ALTER TABLE calculated_revenues
  ADD COLUMN IF NOT EXISTS company_share NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS split_id UUID,
  ADD COLUMN IF NOT EXISTS gst_deduction NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tds_deduction NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payable_amount NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(14, 6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finance_status TEXT DEFAULT 'unpaid';

CREATE TABLE IF NOT EXISTS finance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID,
  label_id UUID,
  calculated_revenue_id UUID,
  amount NUMERIC(14, 6) NOT NULL DEFAULT 0,
  payment_type TEXT DEFAULT 'royalty',
  status TEXT DEFAULT 'paid',
  reference TEXT,
  notes TEXT,
  paid_at TIMESTAMP,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_splits_artist ON revenue_splits(artist_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_label ON revenue_splits(label_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_release ON revenue_splits(release_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_track ON revenue_splits(track_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_splits_isrc ON revenue_splits(UPPER(isrc), effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_calculated_revenues_status ON calculated_revenues(payout_status, finance_status);
CREATE INDEX IF NOT EXISTS idx_finance_payments_artist ON finance_payments(artist_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_payments_label ON finance_payments(label_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_payments_calculated ON finance_payments(calculated_revenue_id);
