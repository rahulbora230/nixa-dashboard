const pool = require("../../config/db");

let schemaReady = false;

const ensureSettingsSchema = async () => {
  if (schemaReady) {
    return;
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT UNIQUE NOT NULL,
      value JSONB,
      updated_by UUID,
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    INSERT INTO settings (key, value)
    VALUES
      ('company_name', '"Nixa Music"'::jsonb),
      ('default_artist_split', '80'::jsonb),
      ('minimum_payout_threshold', '1000'::jsonb),
      ('gst_percentage', '0'::jsonb),
      ('tds_percentage', '10'::jsonb),
      ('default_currency', '"INR"'::jsonb),
      ('platforms', '["Spotify", "Apple Music", "YouTube", "JioSaavn", "Wynk", "Meta"]'::jsonb),
      ('metadata_formats', '{
        "default_format": "auto",
        "formats": {
          "v1": {
            "key": "v1",
            "label": "Metadata V1",
            "enabled": true,
            "required_fields": ["release_title", "track_title", "primary_artist", "label_name", "genre", "language"],
            "optional_fields": ["version", "featuring_artist", "sub_label_name", "upc", "isrc", "subgenre", "mood", "explicit", "composer", "lyricist", "producer", "publisher", "release_date", "original_release_date", "go_live_date", "preview_start_time", "copyright_line", "metadata_notes", "contributors", "territory", "crbt_title", "crbt_start_time_1"]
          },
          "v2": {
            "key": "v2",
            "label": "Metadata V2",
            "enabled": true,
            "required_fields": ["release_title", "track_title", "primary_artist", "label_name", "genre", "language"],
            "optional_fields": ["version", "featuring_artist", "remixer", "sub_label_name", "upc", "isrc", "iswc", "subgenre", "mood", "description", "explicit", "instrumental", "composer", "lyricist", "producer", "director", "star_cast", "publisher", "release_date", "original_release_date", "go_live_date", "preview_start_time", "copyright_line", "metadata_notes", "contributors", "territory", "crbt_title", "crbt_start_time_1"]
          }
        },
        "aliases": {}
      }'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);");

  schemaReady = true;
};

module.exports = {
  ensureSettingsSchema,
};
