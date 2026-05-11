-- Performance Indexes for Nixa Music SaaS
-- Add indexes to optimize query performance

-- Users table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_label_id ON users(label_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Releases table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_releases_user_id ON releases(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_releases_status ON releases(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_releases_created_at ON releases(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_releases_release_date ON releases(release_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_releases_title ON releases USING gin(to_tsvector('title'));

-- Tracks table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_release_id ON tracks(release_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_isrc ON tracks(isrc);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_title ON tracks USING gin(to_tsvector('title'));

-- Revenue tables indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_revenues_isrc ON raw_revenues(isrc);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_revenues_report_month ON raw_revenues(report_month);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_revenues_platform ON raw_revenues(platform);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_raw_revenues_created_at ON raw_revenues(created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculated_revenues_user_id ON calculated_revenues(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculated_revenues_report_month ON calculated_revenues(report_month);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculated_revenues_status ON calculated_revenues(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculated_revenues_created_at ON calculated_revenues(created_at);

-- Payouts table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payouts_artist_id ON payouts(artist_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payouts_label_id ON payouts(label_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payouts_created_at ON payouts(created_at);

-- Ledger entries table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_entries_user_id ON ledger_entries(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_entries_artist_id ON ledger_entries(artist_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_entries_label_id ON ledger_entries(label_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_entries_entry_type ON ledger_entries(entry_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_entries_created_at ON ledger_entries(created_at);

-- Unmatched revenue table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unmatched_revenues_status ON unmatched_revenues(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unmatched_revenues_platform ON unmatched_revenues(platform);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_unmatched_revenues_created_at ON unmatched_revenues(created_at);

-- Revenue imports table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_revenue_imports_status ON revenue_imports(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_revenue_imports_created_at ON revenue_imports(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_revenue_imports_created_by ON revenue_imports(created_by);

-- Activity logs table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Finance audit logs table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_finance_audit_logs_user_id ON finance_audit_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_finance_audit_logs_action ON finance_audit_logs(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_finance_audit_logs_entity_type ON finance_audit_logs(entity_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_finance_audit_logs_created_at ON finance_audit_logs(created_at);

-- Add constraints for data integrity
ALTER TABLE users ADD CONSTRAINT chk_users_role 
  CHECK (role IN ('admin', 'artist', 'label', 'accountant'));

ALTER TABLE releases ADD CONSTRAINT chk_releases_status 
  CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'live', 'taken_down'));

ALTER TABLE calculated_revenues ADD CONSTRAINT chk_calculated_revenues_status 
  CHECK (status IN ('pending', 'calculated', 'paid'));

ALTER TABLE payouts ADD CONSTRAINT chk_payouts_status 
  CHECK (status IN ('pending', 'processing', 'paid', 'cancelled'));

ALTER TABLE ledger_entries ADD CONSTRAINT chk_ledger_entries_entry_type 
  CHECK (entry_type IN ('revenue', 'payout', 'adjustment'));

-- Add partial indexes for compound queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_releases_user_status ON releases(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_calculated_revenues_user_month ON calculated_revenues(user_id, report_month);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payouts_user_status ON payouts(user_id, status);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_releases_fulltext ON releases USING gin(to_tsvector('title' || ' ' || 'artist_name'));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tracks_fulltext ON tracks USING gin(to_tsvector('title' || ' ' || 'artist_name'));

-- Update table statistics
ANALYZE users;
ANALYZE releases;
ANALYZE tracks;
ANALYZE raw_revenues;
ANALYZE calculated_revenues;
ANALYZE payouts;
ANALYZE ledger_entries;
ANALYZE unmatched_revenues;
ANALYZE revenue_imports;
ANALYZE activity_logs;
ANALYZE finance_audit_logs;
