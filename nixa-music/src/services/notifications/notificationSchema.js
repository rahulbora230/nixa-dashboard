const pool = require("../../config/db");

let schemaReady = false;

const ensureNotificationSchema = async () => {
  if (schemaReady) {
    return;
  }

  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  await pool.query(`
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
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
  `);

  schemaReady = true;
};

module.exports = {
  ensureNotificationSchema,
};
