const pool = require("../../config/db");

let schemaReady = false;

const ensureMarketingSchema = async () => {
  if (schemaReady) {
    return;
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS smart_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
      track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
      slug TEXT NOT NULL,
      title TEXT,
      description TEXT,
      artwork_url TEXT,
      status TEXT DEFAULT 'active',
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      click_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE smart_links
      ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS slug TEXT,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS artwork_url TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS smart_links_slug_unique_idx
      ON smart_links (LOWER(slug));
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS smart_links_release_idx ON smart_links (release_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS smart_links_track_idx ON smart_links (track_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS smart_links_created_by_idx ON smart_links (created_by);");
  await pool.query("CREATE INDEX IF NOT EXISTS smart_links_status_idx ON smart_links (status);");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS smart_link_platforms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      smart_link_id UUID NOT NULL REFERENCES smart_links(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      url TEXT NOT NULL,
      button_text TEXT,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE smart_link_platforms
      ADD COLUMN IF NOT EXISTS smart_link_id UUID REFERENCES smart_links(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS platform TEXT,
      ADD COLUMN IF NOT EXISTS url TEXT,
      ADD COLUMN IF NOT EXISTS button_text TEXT,
      ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS smart_link_platform_unique_idx
      ON smart_link_platforms (smart_link_id, LOWER(platform));
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS smart_link_platforms_link_idx ON smart_link_platforms (smart_link_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS smart_link_platforms_active_idx ON smart_link_platforms (smart_link_id, is_active, display_order);");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS smart_link_clicks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      smart_link_id UUID NOT NULL REFERENCES smart_links(id) ON DELETE CASCADE,
      platform TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      country TEXT,
      city TEXT,
      referrer TEXT,
      clicked_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE smart_link_clicks
      ADD COLUMN IF NOT EXISTS smart_link_id UUID REFERENCES smart_links(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS platform TEXT,
      ADD COLUMN IF NOT EXISTS ip_hash TEXT,
      ADD COLUMN IF NOT EXISTS user_agent TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT,
      ADD COLUMN IF NOT EXISTS city TEXT,
      ADD COLUMN IF NOT EXISTS referrer TEXT,
      ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query("CREATE INDEX IF NOT EXISTS smart_link_clicks_link_idx ON smart_link_clicks (smart_link_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS smart_link_clicks_clicked_at_idx ON smart_link_clicks (clicked_at);");
  await pool.query("CREATE INDEX IF NOT EXISTS smart_link_clicks_platform_idx ON smart_link_clicks (smart_link_id, platform);");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pre_save_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      status TEXT DEFAULT 'inactive',
      release_date DATE,
      spotify_uri TEXT,
      apple_music_url TEXT,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE pre_save_campaigns
      ADD COLUMN IF NOT EXISTS release_id UUID REFERENCES releases(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS title TEXT,
      ADD COLUMN IF NOT EXISTS slug TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'inactive',
      ADD COLUMN IF NOT EXISTS release_date DATE,
      ADD COLUMN IF NOT EXISTS spotify_uri TEXT,
      ADD COLUMN IF NOT EXISTS apple_music_url TEXT,
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS pre_save_campaigns_slug_unique_idx
      ON pre_save_campaigns (LOWER(slug));
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS pre_save_campaigns_release_idx ON pre_save_campaigns (release_id);");
  await pool.query("CREATE INDEX IF NOT EXISTS pre_save_campaigns_status_idx ON pre_save_campaigns (status);");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pre_save_subscribers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES pre_save_campaigns(id) ON DELETE CASCADE,
      name TEXT,
      email TEXT NOT NULL,
      platform TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE pre_save_subscribers
      ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES pre_save_campaigns(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS platform TEXT,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS pre_save_subscribers_campaign_email_idx
      ON pre_save_subscribers (campaign_id, LOWER(email));
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS pre_save_subscribers_campaign_idx ON pre_save_subscribers (campaign_id);");

  schemaReady = true;
};

module.exports = {
  ensureMarketingSchema,
};
