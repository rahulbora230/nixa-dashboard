-- Create metadata format management tables
-- Migration 007: Create metadata format management system

-- Create metadata_formats table
CREATE TABLE IF NOT EXISTS metadata_formats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create metadata_format_fields table
CREATE TABLE IF NOT EXISTS metadata_format_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format_id UUID NOT NULL REFERENCES metadata_formats(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    field_label VARCHAR(200) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- 'text', 'number', 'boolean', 'date', 'select'
    is_required BOOLEAN DEFAULT false,
    field_order INTEGER DEFAULT 0,
    validation_rules JSONB, -- Store validation rules as JSON
    options JSONB, -- For select type fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(format_id, field_key)
);

-- Insert default metadata formats (V1 and V2)
INSERT INTO metadata_formats (key, label, description, enabled, is_default) VALUES
('v1', 'Metadata V1', 'Basic metadata format with essential fields', true, false),
('v2', 'Metadata V2', 'Extended metadata format with additional fields', true, true)
ON CONFLICT (key) DO NOTHING;

-- Insert V1 format fields
INSERT INTO metadata_format_fields (format_id, field_key, field_label, field_type, is_required, field_order) VALUES
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'release_title', 'Release Title', 'text', true, 1),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'track_title', 'Track Title', 'text', true, 2),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'primary_artist', 'Primary Artist', 'text', true, 3),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'featuring_artist', 'Featuring Artist', 'text', false, 4),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'label_name', 'Label Name', 'text', true, 5),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'genre', 'Genre', 'text', true, 6),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'language', 'Language', 'text', true, 7),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'release_date', 'Release Date', 'date', true, 8),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'upc', 'UPC', 'text', false, 9),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'isrc', 'ISRC', 'text', false, 10),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'composer', 'Composer', 'text', false, 11),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'lyricist', 'Lyricist', 'text', false, 12),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'producer', 'Producer', 'text', false, 13),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'explicit', 'Explicit', 'boolean', false, 14),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'copyright', 'Copyright', 'text', false, 15),
((SELECT id FROM metadata_formats WHERE key = 'v1'), 'publishing', 'Publishing', 'text', false, 16)
ON CONFLICT (format_id, field_key) DO NOTHING;

-- Insert V2 format fields
INSERT INTO metadata_format_fields (format_id, field_key, field_label, field_type, is_required, field_order) VALUES
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'release_title', 'Release Title', 'text', true, 1),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'track_title', 'Track Title', 'text', true, 2),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'primary_artist', 'Primary Artist', 'text', true, 3),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'featuring_artist', 'Featuring Artist', 'text', false, 4),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'remixer', 'Remixer', 'text', false, 5),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'label_name', 'Label Name', 'text', true, 6),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'genre', 'Genre', 'text', true, 7),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'language', 'Language', 'text', true, 8),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'release_date', 'Release Date', 'date', true, 9),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'upc', 'UPC', 'text', false, 10),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'isrc', 'ISRC', 'text', false, 11),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'iswc', 'ISWC', 'text', false, 12),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'composer', 'Composer', 'text', false, 13),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'lyricist', 'Lyricist', 'text', false, 14),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'producer', 'Producer', 'text', false, 15),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'director', 'Director', 'text', false, 16),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'star_cast', 'Star Cast', 'text', false, 17),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'description', 'Description', 'text', false, 18),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'explicit', 'Explicit', 'boolean', false, 19),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'instrumental', 'Instrumental', 'boolean', false, 20),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'copyright', 'Copyright', 'text', false, 21),
((SELECT id FROM metadata_formats WHERE key = 'v2'), 'publishing', 'Publishing', 'text', false, 22)
ON CONFLICT (format_id, field_key) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_metadata_formats_key ON metadata_formats(key);
CREATE INDEX IF NOT EXISTS idx_metadata_formats_enabled ON metadata_formats(enabled);
CREATE INDEX IF NOT EXISTS idx_metadata_format_fields_format_id ON metadata_format_fields(format_id);
CREATE INDEX IF NOT EXISTS idx_metadata_format_fields_order ON metadata_format_fields(format_id, field_order);
