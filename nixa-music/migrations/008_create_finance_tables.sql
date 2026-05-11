-- Create finance and revenue management tables
-- Migration 008: Create comprehensive finance system

-- Revenue imports table
CREATE TABLE IF NOT EXISTS revenue_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    report_month DATE NOT NULL,
    platform VARCHAR(100) NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,
    errors_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) DEFAULT 'processing', -- processing, completed, failed
    mapping_id UUID REFERENCES revenue_mappings(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw revenue data table
CREATE TABLE IF NOT EXISTS raw_revenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES revenue_imports(id) ON DELETE CASCADE,
    isrc VARCHAR(12),
    upc VARCHAR(14),
    track_title TEXT NOT NULL,
    release_title TEXT,
    artist_name TEXT NOT NULL,
    label_name TEXT,
    platform VARCHAR(100) NOT NULL,
    country VARCHAR(2),
    streams INTEGER DEFAULT 0,
    revenue DECIMAL(15,4) DEFAULT 0.0000,
    currency VARCHAR(3) DEFAULT 'USD',
    report_month DATE NOT NULL,
    report_date DATE,
    mapping_id UUID REFERENCES revenue_mappings(id),
    created_by UUID NOT NULL REFERENCES users(id),
    source_file VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue header mappings table
CREATE TABLE IF NOT EXISTS revenue_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(100) NOT NULL,
    mapping JSONB NOT NULL, -- Store field mappings as JSON
    is_default BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, is_default)
);

-- Unmatched revenue table
CREATE TABLE IF NOT EXISTS unmatched_revenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_revenue_id UUID NOT NULL REFERENCES raw_revenues(id) ON DELETE CASCADE,
    isrc VARCHAR(12),
    track_title TEXT NOT NULL,
    artist_name TEXT NOT NULL,
    platform VARCHAR(100) NOT NULL,
    report_month DATE NOT NULL,
    streams INTEGER DEFAULT 0,
    revenue DECIMAL(15,4) DEFAULT 0.0000,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'unmatched', -- unmatched, matched, ignored, held
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Revenue splits configuration table
CREATE TABLE IF NOT EXISTS revenue_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    artist_id UUID REFERENCES users(id),
    label_id UUID REFERENCES users(id),
    split_type VARCHAR(50) NOT NULL, -- default, user, label
    artist_share DECIMAL(5,4) DEFAULT 0.0000, -- Percentage (0.0000 to 1.0000)
    label_share DECIMAL(5,4) DEFAULT 0.0000,
    company_share DECIMAL(5,4) DEFAULT 1.0000,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Calculated revenue table
CREATE TABLE IF NOT EXISTS calculated_revenues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_revenue_id UUID NOT NULL REFERENCES raw_revenues(id),
    user_id UUID NOT NULL REFERENCES users(id),
    artist_id UUID REFERENCES users(id),
    label_id UUID REFERENCES users(id),
    split_id UUID REFERENCES revenue_splits(id),
    report_month DATE NOT NULL,
    gross_revenue DECIMAL(15,4) NOT NULL,
    artist_share DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    label_share DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    company_share DECIMAL(15,4) NOT NULL DEFAULT 0.0000,
    payable_amount DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'calculated', -- calculated, paid, written_off
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ledger entries table
CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    artist_id UUID REFERENCES users(id),
    label_id UUID REFERENCES users(id),
    entry_type VARCHAR(50) NOT NULL, -- revenue, payout, adjustment
    amount DECIMAL(15,4) NOT NULL,
    balance DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    description TEXT,
    reference_id UUID, -- Reference to calculated_revenue or payouts
    reference_type VARCHAR(50), -- calculated_revenue, payout, manual_adjustment
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payouts table
CREATE TABLE IF NOT EXISTS payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    artist_id UUID REFERENCES users(id),
    label_id UUID REFERENCES users(id),
    amount DECIMAL(15,4) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, paid, cancelled
    payment_method VARCHAR(100),
    reference_number VARCHAR(255),
    remarks TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payout attachments table
CREATE TABLE IF NOT EXISTS payout_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_id UUID NOT NULL REFERENCES payouts(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Finance audit logs table
CREATE TABLE IF NOT EXISTS finance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_raw_revenues_isrc ON raw_revenues(isrc);
CREATE INDEX IF NOT EXISTS idx_raw_revenues_report_month ON raw_revenues(report_month);
CREATE INDEX IF NOT EXISTS idx_raw_revenues_platform ON raw_revenues(platform);
CREATE INDEX IF NOT EXISTS idx_raw_revenues_import_id ON raw_revenues(import_id);
CREATE INDEX IF NOT EXISTS idx_calculated_revenues_user_id ON calculated_revenues(user_id);
CREATE INDEX IF NOT EXISTS idx_calculated_revenues_report_month ON calculated_revenues(report_month);
CREATE INDEX IF NOT EXISTS idx_calculated_revenues_raw_revenue_id ON calculated_revenues(raw_revenue_id);
CREATE INDEX IF NOT EXISTS idx_payouts_user_id ON payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_id ON ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_entry_type ON ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS idx_unmatched_revenues_status ON unmatched_revenues(status);
CREATE INDEX IF NOT EXISTS idx_finance_audit_logs_user_id ON finance_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_finance_audit_logs_created_at ON finance_audit_logs(created_at);

-- Insert default revenue mappings
INSERT INTO revenue_mappings (name, platform, mapping, is_default, created_by) VALUES
('Spotify Default', 'Spotify', '{
  "isrc": ["ISRC", "ISRC Code"],
  "upc": ["UPC", "UPC Code"],
  "track_title": ["Track Title", "Song Title"],
  "release_title": ["Release Title", "Album Title"],
  "artist_name": ["Artist", "Primary Artist"],
  "label_name": ["Label", "Label Name"],
  "platform": ["Platform", "Store"],
  "country": ["Country", "Territory"],
  "streams": ["Streams", "Plays"],
  "revenue": ["Revenue", "Earnings", "Amount"],
  "currency": ["Currency"],
  "report_month": ["Report Month", "Month"],
  "report_date": ["Report Date"]
}', true, (SELECT id FROM users WHERE role = 'admin' LIMIT 1)),
('Apple Music Default', 'Apple Music', '{
  "isrc": ["ISRC", "ISRC Code"],
  "upc": ["UPC", "UPC Code"],
  "track_title": ["Track Title", "Song Title"],
  "release_title": ["Release Title", "Album Title"],
  "artist_name": ["Artist", "Primary Artist"],
  "label_name": ["Label", "Label Name"],
  "platform": ["Platform", "Store"],
  "country": ["Country", "Territory"],
  "streams": ["Streams", "Plays"],
  "revenue": ["Revenue", "Earnings", "Amount"],
  "currency": ["Currency"],
  "report_month": ["Report Month", "Month"],
  "report_date": ["Report Date"]
}', false, (SELECT id FROM users WHERE role = 'admin' LIMIT 1))
ON CONFLICT (platform, is_default) DO NOTHING;

-- Create default revenue split (50% artist, 20% label, 30% company)
INSERT INTO revenue_splits (user_id, artist_id, label_id, split_type, artist_share, label_share, company_share, effective_from, created_by)
SELECT 
  u.id as user_id,
  u.id as artist_id,
  l.id as label_id,
  'default' as split_type,
  0.5000 as artist_share,
  0.2000 as label_share,
  0.3000 as company_share,
  '2024-01-01' as effective_from,
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1) as created_by
FROM users u
LEFT JOIN users l ON l.role = 'label' AND l.id = u.id
WHERE u.role IN ('artist', 'label')
ON CONFLICT DO NOTHING;
