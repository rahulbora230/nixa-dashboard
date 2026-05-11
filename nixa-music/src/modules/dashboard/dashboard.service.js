const pool = require('../../config/db');

// 🔥 1. Get Balance
exports.getBalance = async (owner_type, owner_id) => {
  const res = await pool.query(
    `SELECT 
      COALESCE(SUM(
        CASE 
          WHEN entry_type IN ('revenue','bonus') THEN amount
          WHEN entry_type IN ('payout','adjustment') THEN -amount
          ELSE 0
        END
      ),0) as balance
     FROM ledger
     WHERE owner_type=$1 AND owner_id=$2`,
    [owner_type, owner_id]
  );

  return res.rows[0].balance;
};
// 🔥 2. Summary
exports.getSummary = async (owner_id) => {
  const res = await pool.query(
    `SELECT 
      COALESCE(SUM(owner_share),0) as total_earnings,
      COALESCE(SUM(gross_amount),0) as total_revenue
     FROM earnings
     WHERE owner_id=$1`,
    [owner_id]
  );

  return res.rows[0];
};
exports.getMonthlyTrend = async (owner_id) => {
  const res = await pool.query(
    `SELECT 
      DATE_TRUNC('month', report_month) as month,
      SUM(owner_share) as earnings
     FROM earnings
     WHERE owner_id=$1
     GROUP BY month
     ORDER BY month ASC`,
    [owner_id]
  );

  return res.rows;
};
exports.getPlatformStats = async (owner_id) => {
  const res = await pool.query(
    `SELECT platform, SUM(revenue) as revenue
     FROM raw_revenues r
     JOIN tracks t ON r.isrc = t.isrc
     WHERE t.owner_id=$1
     GROUP BY platform
     ORDER BY revenue DESC`,
    [owner_id]
  );

  return res.rows;
};


exports.getCountryStats = async (owner_id) => {
  const res = await pool.query(
    `SELECT country, SUM(revenue) as revenue
     FROM raw_revenues r
     JOIN tracks t ON r.isrc = t.isrc
     WHERE t.owner_id=$1
     GROUP BY country
     ORDER BY revenue DESC`,
    [owner_id]
  );

  return res.rows;
};
