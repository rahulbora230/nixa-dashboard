const pool = require("../../config/db");
const { ensureManagementSchema } = require("../management/managementSchema");

let schemaReady = false;

const ensureAuthSchema = async () => {
  if (schemaReady) {
    return;
  }

  await ensureManagementSchema();
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, created_at DESC);
  `);

  schemaReady = true;
};

module.exports = {
  ensureAuthSchema,
};
