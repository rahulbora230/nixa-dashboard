CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  metadata_json JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB,
  updated_by UUID,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO settings (key, value)
VALUES
  ('company_name', '"Nixa Music"'::jsonb),
  ('default_artist_split', '80'::jsonb),
  ('minimum_payout_threshold', '1000'::jsonb),
  ('gst_percentage', '0'::jsonb),
  ('tds_percentage', '10'::jsonb),
  ('default_currency', '"INR"'::jsonb),
  ('platforms', '["Spotify", "Apple Music", "YouTube", "JioSaavn", "Wynk", "Meta"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE artists ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE labels ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE releases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_releases_user_id ON releases(user_id);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
CREATE INDEX IF NOT EXISTS idx_tracks_isrc ON tracks(UPPER(isrc));
CREATE INDEX IF NOT EXISTS idx_raw_revenues_isrc_phase8 ON raw_revenues(UPPER(isrc));
CREATE INDEX IF NOT EXISTS idx_raw_revenues_report_month_phase8 ON raw_revenues(report_month);
CREATE INDEX IF NOT EXISTS idx_raw_revenues_platform_phase8 ON raw_revenues(platform);
CREATE INDEX IF NOT EXISTS idx_calculated_revenues_artist_phase8 ON calculated_revenues(artist_id);
CREATE INDEX IF NOT EXISTS idx_calculated_revenues_label_phase8 ON calculated_revenues(label_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status_phase8 ON payouts(status);
