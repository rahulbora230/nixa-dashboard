-- Phase 10: QC Engine, DSP Delivery Automation & Catalog Intelligence
-- Safe additive migration. It does not remove or rewrite existing catalog data.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE releases
  ADD COLUMN IF NOT EXISTS release_health_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS metadata_locked BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata_lock_reason TEXT,
  ADD COLUMN IF NOT EXISTS metadata_unlocked_until TIMESTAMP;

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS metadata_locked BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS release_qc_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS track_qc_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_queue_unique_active
ON delivery_queue(release_id, COALESCE(track_id::text, ''), LOWER(platform))
WHERE delivery_status NOT IN ('cancelled', 'removed', 'takedown_complete');

CREATE TABLE IF NOT EXISTS delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID,
  release_id UUID,
  track_id UUID,
  platform TEXT,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  message TEXT,
  performed_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS takedown_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS metadata_lock_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
  track_id UUID,
  field_name TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  performed_by TEXT,
  locked_snapshot JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS release_health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
  health_score INTEGER DEFAULT 0,
  factors JSONB DEFAULT '{}'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conflict_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID,
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

CREATE INDEX IF NOT EXISTS idx_releases_health_score ON releases(release_health_score);
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
