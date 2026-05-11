const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'nixa_music',
  password: process.env.DB_PASSWORD || 'Nixa@2003',
  port: Number(process.env.DB_PORT || 5432),
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
});

module.exports = pool;
