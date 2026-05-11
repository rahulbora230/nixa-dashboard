const pool = require("../../config/db");
const { ensureRevenueSchema } = require("../revenue/revenueSchema");

let schemaReady = false;

const ensureFinanceSchema = async () => {
  if (schemaReady) {
    return;
  }

  await ensureRevenueSchema();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance_payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      artist_id UUID,
      label_id UUID,
      calculated_revenue_id UUID,
      amount NUMERIC(14, 6) NOT NULL DEFAULT 0,
      payment_type TEXT DEFAULT 'royalty',
      status TEXT DEFAULT 'paid',
      reference TEXT,
      notes TEXT,
      paid_at TIMESTAMP,
      created_by UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_finance_payments_artist ON finance_payments(artist_id, paid_at DESC);
    CREATE INDEX IF NOT EXISTS idx_finance_payments_label ON finance_payments(label_id, paid_at DESC);
    CREATE INDEX IF NOT EXISTS idx_finance_payments_calculated ON finance_payments(calculated_revenue_id);
  `);

  schemaReady = true;
};

module.exports = {
  ensureFinanceSchema,
};
