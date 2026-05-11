const pool = require("../../config/db");
const { ensureFinanceSchema } = require("../finance/financeSchema");

let schemaReady = false;

const ensurePayoutSchema = async () => {
  if (schemaReady) {
    return;
  }

  await ensureFinanceSchema();
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      artist_id UUID,
      label_id UUID,
      amount NUMERIC(14, 6) NOT NULL DEFAULT 0,
      gross_amount NUMERIC(14, 6) DEFAULT 0,
      gst_deduction NUMERIC(14, 6) DEFAULT 0,
      tds_deduction NUMERIC(14, 6) DEFAULT 0,
      net_amount NUMERIC(14, 6) DEFAULT 0,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      transaction_reference TEXT,
      payout_date DATE,
      notes TEXT,
      processed_by UUID,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE payouts
      ADD COLUMN IF NOT EXISTS artist_id UUID,
      ADD COLUMN IF NOT EXISTS label_id UUID,
      ADD COLUMN IF NOT EXISTS amount NUMERIC(14, 6) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gst_deduction NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tds_deduction NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_amount NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS payment_method TEXT,
      ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
      ADD COLUMN IF NOT EXISTS payout_date DATE,
      ADD COLUMN IF NOT EXISTS notes TEXT,
      ADD COLUMN IF NOT EXISTS processed_by UUID,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS failed_reason TEXT;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payout_id UUID,
      invoice_number TEXT,
      invoice_path TEXT,
      invoice_period_start DATE,
      invoice_period_end DATE,
      generated_by UUID,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE invoices
      ADD COLUMN IF NOT EXISTS payout_id UUID,
      ADD COLUMN IF NOT EXISTS invoice_number TEXT,
      ADD COLUMN IF NOT EXISTS invoice_path TEXT,
      ADD COLUMN IF NOT EXISTS invoice_period_start DATE,
      ADD COLUMN IF NOT EXISTS invoice_period_end DATE,
      ADD COLUMN IF NOT EXISTS generated_by UUID,
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS recipient_name TEXT,
      ADD COLUMN IF NOT EXISTS recipient_type TEXT,
      ADD COLUMN IF NOT EXISTS gst_number TEXT,
      ADD COLUMN IF NOT EXISTS pan_number TEXT,
      ADD COLUMN IF NOT EXISTS billing_address TEXT,
      ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gst_deduction NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tds_deduction NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS net_amount NUMERIC(14, 6) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS payment_method TEXT,
      ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
      ADD COLUMN IF NOT EXISTS payment_date DATE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payout_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payout_id UUID,
      action TEXT,
      performed_by UUID,
      old_status TEXT,
      new_status TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_transaction_reference
      ON payouts(transaction_reference)
      WHERE transaction_reference IS NOT NULL AND transaction_reference <> '';
    CREATE INDEX IF NOT EXISTS idx_payouts_artist ON payouts(artist_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payouts_label ON payouts(label_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payouts_status ON payouts(status, payout_date DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number)
      WHERE invoice_number IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_payout ON invoices(payout_id)
      WHERE payout_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_payout_logs_payout ON payout_logs(payout_id, created_at DESC);
  `);

  schemaReady = true;
};

module.exports = {
  ensurePayoutSchema,
};
