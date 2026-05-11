-- Phase 12: Smart Links, Marketing Kit & Promo Tools
-- Additive migration. Keeps catalog, DSP delivery, daily analytics, revenue, finance,
-- payouts, invoices, ownership transfer, imports and exports untouched.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

CREATE UNIQUE INDEX IF NOT EXISTS smart_links_slug_unique_idx
  ON smart_links (LOWER(slug));

CREATE INDEX IF NOT EXISTS smart_links_release_idx ON smart_links (release_id);
CREATE INDEX IF NOT EXISTS smart_links_track_idx ON smart_links (track_id);
CREATE INDEX IF NOT EXISTS smart_links_created_by_idx ON smart_links (created_by);
CREATE INDEX IF NOT EXISTS smart_links_status_idx ON smart_links (status);

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

CREATE UNIQUE INDEX IF NOT EXISTS smart_link_platform_unique_idx
  ON smart_link_platforms (smart_link_id, LOWER(platform));

CREATE INDEX IF NOT EXISTS smart_link_platforms_link_idx ON smart_link_platforms (smart_link_id);
CREATE INDEX IF NOT EXISTS smart_link_platforms_active_idx ON smart_link_platforms (smart_link_id, is_active, display_order);

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

CREATE INDEX IF NOT EXISTS smart_link_clicks_link_idx ON smart_link_clicks (smart_link_id);
CREATE INDEX IF NOT EXISTS smart_link_clicks_clicked_at_idx ON smart_link_clicks (clicked_at);
CREATE INDEX IF NOT EXISTS smart_link_clicks_platform_idx ON smart_link_clicks (smart_link_id, platform);

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

CREATE UNIQUE INDEX IF NOT EXISTS pre_save_campaigns_slug_unique_idx
  ON pre_save_campaigns (LOWER(slug));

CREATE INDEX IF NOT EXISTS pre_save_campaigns_release_idx ON pre_save_campaigns (release_id);
CREATE INDEX IF NOT EXISTS pre_save_campaigns_status_idx ON pre_save_campaigns (status);

CREATE TABLE IF NOT EXISTS pre_save_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES pre_save_campaigns(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT NOT NULL,
  platform TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pre_save_subscribers_campaign_email_idx
  ON pre_save_subscribers (campaign_id, LOWER(email));

CREATE INDEX IF NOT EXISTS pre_save_subscribers_campaign_idx ON pre_save_subscribers (campaign_id);
