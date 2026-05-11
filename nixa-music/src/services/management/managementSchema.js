const pool = require("../../config/db");

let schemaReady = false;

const ensureManagementSchema = async () => {
  if (schemaReady) {
    return;
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  await pool.query(`
    ALTER TABLE users
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  `);

  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS password TEXT,
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'artist',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS last_login TIMESTAMP,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  await pool.query(`
    ALTER TABLE artists
      ADD COLUMN IF NOT EXISTS user_id UUID,
      ADD COLUMN IF NOT EXISTS label_id UUID,
      ADD COLUMN IF NOT EXISTS artist_name TEXT,
      ADD COLUMN IF NOT EXISTS legal_name TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS pan TEXT,
      ADD COLUMN IF NOT EXISTS gst_number TEXT,
      ADD COLUMN IF NOT EXISTS bank_name TEXT,
      ADD COLUMN IF NOT EXISTS account_number TEXT,
      ADD COLUMN IF NOT EXISTS ifsc TEXT,
      ADD COLUMN IF NOT EXISTS upi_id TEXT,
      ADD COLUMN IF NOT EXISTS payment_method TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS created_by UUID,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS labels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid()
    );
  `);

  await pool.query(`
    ALTER TABLE labels
      ADD COLUMN IF NOT EXISTS user_id UUID,
      ADD COLUMN IF NOT EXISTS label_name TEXT,
      ADD COLUMN IF NOT EXISTS name TEXT,
      ADD COLUMN IF NOT EXISTS legal_business_name TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS gst_number TEXT,
      ADD COLUMN IF NOT EXISTS pan TEXT,
      ADD COLUMN IF NOT EXISTS bank_name TEXT,
      ADD COLUMN IF NOT EXISTS account_number TEXT,
      ADD COLUMN IF NOT EXISTS ifsc TEXT,
      ADD COLUMN IF NOT EXISTS upi_id TEXT,
      ADD COLUMN IF NOT EXISTS payment_method TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS created_by UUID,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
  `);

  await pool.query(`
    UPDATE labels
    SET name = COALESCE(NULLIF(name, ''), label_name)
    WHERE name IS NULL OR name = '';
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_label_map (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      artist_id UUID NOT NULL,
      label_id UUID NOT NULL,
      assigned_by UUID,
      assigned_at TIMESTAMP DEFAULT NOW(),
      removed_at TIMESTAMP,
      status TEXT DEFAULT 'active'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id UUID,
      metadata_json JSONB,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email)) WHERE email IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_role_status ON users(role, status);
    CREATE INDEX IF NOT EXISTS idx_artists_user ON artists(user_id);
    CREATE INDEX IF NOT EXISTS idx_artists_label ON artists(label_id);
    CREATE INDEX IF NOT EXISTS idx_artists_status ON artists(status);
    CREATE INDEX IF NOT EXISTS idx_artists_search ON artists(LOWER(artist_name));
    CREATE INDEX IF NOT EXISTS idx_labels_user ON labels(user_id);
    CREATE INDEX IF NOT EXISTS idx_labels_status ON labels(status);
    CREATE INDEX IF NOT EXISTS idx_labels_search ON labels(LOWER(label_name));
    CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_label_active
      ON artist_label_map(artist_id, label_id)
      WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_artist_label_label ON artist_label_map(label_id, status);
    CREATE INDEX IF NOT EXISTS idx_artist_label_artist ON artist_label_map(artist_id, status);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
  `);

  schemaReady = true;
};

module.exports = {
  ensureManagementSchema,
};
