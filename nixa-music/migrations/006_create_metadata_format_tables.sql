-- Create metadata_formats table
CREATE TABLE IF NOT EXISTS metadata_formats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    key VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    enabled BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create metadata_format_fields table
CREATE TABLE IF NOT EXISTS metadata_format_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format_id UUID NOT NULL REFERENCES metadata_formats(id) ON DELETE CASCADE,
    field_name VARCHAR(255) NOT NULL,
    field_key VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) DEFAULT 'text',
    is_required BOOLEAN DEFAULT false,
    field_order INTEGER DEFAULT 1,
    options JSONB,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(format_id, field_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_metadata_formats_key ON metadata_formats(key);
CREATE INDEX IF NOT EXISTS idx_metadata_formats_enabled ON metadata_formats(enabled);
CREATE INDEX IF NOT EXISTS idx_metadata_formats_default ON metadata_formats(is_default);
CREATE INDEX IF NOT EXISTS idx_metadata_format_fields_format_id ON metadata_format_fields(format_id);
CREATE INDEX IF NOT EXISTS idx_metadata_format_fields_order ON metadata_format_fields(format_id, field_order);

-- Insert default V1 format
INSERT INTO metadata_formats (name, key, description, enabled, is_default, created_at, updated_at)
VALUES ('Metadata V1', 'v1', 'Legacy metadata format V1', true, false, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert default V2 format
INSERT INTO metadata_formats (name, key, description, enabled, is_default, created_at, updated_at)
VALUES ('Metadata V2', 'v2', 'Current metadata format V2', true, true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert V1 fields (get format_id)
DO $$
DECLARE
    v1_format_id UUID;
BEGIN
    SELECT id INTO v1_format_id FROM metadata_formats WHERE key = 'v1';
    
    IF v1_format_id IS NOT NULL THEN
        INSERT INTO metadata_format_fields (format_id, field_name, field_key, field_type, is_required, field_order, description)
        VALUES 
            (v1_format_id, 'Release Title', 'release_title', 'text', true, 1, 'Main release title'),
            (v1_format_id, 'Track Title', 'track_title', 'text', true, 2, 'Track song title'),
            (v1_format_id, 'Primary Artist', 'primary_artist', 'text', true, 3, 'Main artist name'),
            (v1_format_id, 'Label Name', 'label_name', 'text', true, 4, 'Record label'),
            (v1_format_id, 'Genre', 'genre', 'text', true, 5, 'Music genre'),
            (v1_format_id, 'Language', 'language', 'text', true, 6, 'Track language'),
            (v1_format_id, 'Version', 'version', 'text', false, 7, 'Track version'),
            (v1_format_id, 'Featuring Artist', 'featuring_artist', 'text', false, 8, 'Featured artists'),
            (v1_format_id, 'Sub Label Name', 'sub_label_name', 'text', false, 9, 'Sub-label'),
            (v1_format_id, 'UPC', 'upc', 'text', false, 10, 'Universal Product Code'),
            (v1_format_id, 'ISRC', 'isrc', 'text', false, 11, 'International Standard Recording Code'),
            (v1_format_id, 'Subgenre', 'subgenre', 'text', false, 12, 'Music subgenre'),
            (v1_format_id, 'Mood', 'mood', 'text', false, 13, 'Track mood'),
            (v1_format_id, 'Explicit', 'explicit', 'boolean', false, 14, 'Explicit content flag'),
            (v1_format_id, 'Composer', 'composer', 'text', false, 15, 'Composer name'),
            (v1_format_id, 'Lyricist', 'lyricist', 'text', false, 16, 'Lyricist name'),
            (v1_format_id, 'Producer', 'producer', 'text', false, 17, 'Producer name'),
            (v1_format_id, 'Publisher', 'publisher', 'text', false, 18, 'Publisher name'),
            (v1_format_id, 'Release Date', 'release_date', 'date', false, 19, 'Release date'),
            (v1_format_id, 'Original Release Date', 'original_release_date', 'date', false, 20, 'Original release date'),
            (v1_format_id, 'Go Live Date', 'go_live_date', 'date', false, 21, 'Go live date'),
            (v1_format_id, 'Preview Start Time', 'preview_start_time', 'text', false, 22, 'Preview start time'),
            (v1_format_id, 'Copyright Line', 'copyright_line', 'text', false, 23, 'Copyright line'),
            (v1_format_id, 'Metadata Notes', 'metadata_notes', 'text', false, 24, 'Additional metadata notes'),
            (v1_format_id, 'Contributors', 'contributors', 'text', false, 25, 'Contributors'),
            (v1_format_id, 'Territory', 'territory', 'text', false, 26, 'Territory information'),
            (v1_format_id, 'CRBT Title', 'crbt_title', 'text', false, 27, 'CRBT title'),
            (v1_format_id, 'CRBT Start Time 1', 'crbt_start_time_1', 'text', false, 28, 'CRBT start time 1')
        ON CONFLICT (format_id, field_key) DO NOTHING;
    END IF;
END $$;

-- Insert V2 fields (get format_id)
DO $$
DECLARE
    v2_format_id UUID;
BEGIN
    SELECT id INTO v2_format_id FROM metadata_formats WHERE key = 'v2';
    
    IF v2_format_id IS NOT NULL THEN
        INSERT INTO metadata_format_fields (format_id, field_name, field_key, field_type, is_required, field_order, description)
        VALUES 
            (v2_format_id, 'Release Title', 'release_title', 'text', true, 1, 'Main release title'),
            (v2_format_id, 'Track Title', 'track_title', 'text', true, 2, 'Track song title'),
            (v2_format_id, 'Primary Artist', 'primary_artist', 'text', true, 3, 'Main artist name'),
            (v2_format_id, 'Label Name', 'label_name', 'text', true, 4, 'Record label'),
            (v2_format_id, 'Genre', 'genre', 'text', true, 5, 'Music genre'),
            (v2_format_id, 'Language', 'language', 'text', true, 6, 'Track language'),
            (v2_format_id, 'Version', 'version', 'text', false, 7, 'Track version'),
            (v2_format_id, 'Featuring Artist', 'featuring_artist', 'text', false, 8, 'Featured artists'),
            (v2_format_id, 'Remixer', 'remixer', 'text', false, 9, 'Remixer name'),
            (v2_format_id, 'Sub Label Name', 'sub_label_name', 'text', false, 10, 'Sub-label'),
            (v2_format_id, 'UPC', 'upc', 'text', false, 11, 'Universal Product Code'),
            (v2_format_id, 'ISRC', 'isrc', 'text', false, 12, 'International Standard Recording Code'),
            (v2_format_id, 'ISWC', 'iswc', 'text', false, 13, 'International Standard Musical Work Code'),
            (v2_format_id, 'Subgenre', 'subgenre', 'text', false, 14, 'Music subgenre'),
            (v2_format_id, 'Mood', 'mood', 'text', false, 15, 'Track mood'),
            (v2_format_id, 'Description', 'description', 'text', false, 16, 'Track description'),
            (v2_format_id, 'Explicit', 'explicit', 'boolean', false, 17, 'Explicit content flag'),
            (v2_format_id, 'Instrumental', 'instrumental', 'boolean', false, 18, 'Instrumental flag'),
            (v2_format_id, 'Composer', 'composer', 'text', false, 19, 'Composer name'),
            (v2_format_id, 'Lyricist', 'lyricist', 'text', false, 20, 'Lyricist name'),
            (v2_format_id, 'Producer', 'producer', 'text', false, 21, 'Producer name'),
            (v2_format_id, 'Director', 'director', 'text', false, 22, 'Director name'),
            (v2_format_id, 'Star Cast', 'star_cast', 'text', false, 23, 'Star cast'),
            (v2_format_id, 'Publisher', 'publisher', 'text', false, 24, 'Publisher name'),
            (v2_format_id, 'Release Date', 'release_date', 'date', false, 25, 'Release date'),
            (v2_format_id, 'Original Release Date', 'original_release_date', 'date', false, 26, 'Original release date'),
            (v2_format_id, 'Go Live Date', 'go_live_date', 'date', false, 27, 'Go live date'),
            (v2_format_id, 'Preview Start Time', 'preview_start_time', 'text', false, 28, 'Preview start time'),
            (v2_format_id, 'Copyright Line', 'copyright_line', 'text', false, 29, 'Copyright line'),
            (v2_format_id, 'Metadata Notes', 'metadata_notes', 'text', false, 30, 'Additional metadata notes'),
            (v2_format_id, 'Contributors', 'contributors', 'text', false, 31, 'Contributors'),
            (v2_format_id, 'Territory', 'territory', 'text', false, 32, 'Territory information'),
            (v2_format_id, 'CRBT Title', 'crbt_title', 'text', false, 33, 'CRBT title'),
            (v2_format_id, 'CRBT Start Time 1', 'crbt_start_time_1', 'text', false, 34, 'CRBT start time 1')
        ON CONFLICT (format_id, field_key) DO NOTHING;
    END IF;
END $$;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_metadata_format_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_metadata_formats_updated_at
    BEFORE UPDATE ON metadata_formats
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_format_updated_at();

CREATE TRIGGER trigger_update_metadata_format_fields_updated_at
    BEFORE UPDATE ON metadata_format_fields
    FOR EACH ROW
    EXECUTE FUNCTION update_metadata_format_updated_at();
