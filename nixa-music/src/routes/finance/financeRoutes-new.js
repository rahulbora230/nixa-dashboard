const express = require("express");
const pool = require("../../config/db");
const { verifyToken, onlyAdmin } = require("../../middleware/authMiddleware");

const router = express.Router();

// GET /api/finance/summary - Get finance summary with safe fallbacks
router.get("/summary", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { reportMonth, platform } = req.query;
    
    // Build WHERE clause
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramCount = 1;
    
    if (reportMonth) {
      whereClause += ` AND cr.report_month = $${paramCount}`;
      queryParams.push(reportMonth);
      paramCount++;
    }
    
    if (platform) {
      whereClause += ` AND rr.platform = $${paramCount}`;
      queryParams.push(platform);
      paramCount++;
    }
    
    // Add role-based filtering
    if (req.user.role === 'artist') {
      whereClause += ` AND cr.user_id = $${paramCount}`;
      queryParams.push(req.user.id);
      paramCount++;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        cr.user_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        cr.label_id = $${paramCount}
      )`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    }

    // Check if tables exist first
    const tablesExist = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'calculated_revenues'
      ) as calculated_revenues_exists,
      EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'raw_revenues'
      ) as raw_revenues_exists
    `);

    const { calculated_revenues_exists, raw_revenues_exists } = tablesExist.rows[0];

    // Return safe default if tables don't exist
    if (!calculated_revenues_exists || !raw_revenues_exists) {
      return res.json({
        success: true,
        data: {
          total_revenue: 0,
          total_streams: 0,
          pending_payouts: 0,
          paid_payouts: 0,
          monthly_revenue: [],
          platform_summary: [],
          top_tracks: []
        }
      });
    }

    // Use COALESCE to handle null values safely
    const result = await client.query(`
      SELECT 
        COALESCE(COUNT(*), 0) as total_revenues,
        COALESCE(COUNT(DISTINCT cr.user_id), 0) as total_artists,
        COALESCE(COUNT(DISTINCT cr.label_id), 0) as total_labels,
        COALESCE(COUNT(DISTINCT cr.report_month), 0) as total_months,
        COALESCE(COUNT(DISTINCT rr.platform), 0) as total_platforms,
        COALESCE(SUM(cr.gross_revenue), 0) as total_gross_revenue,
        COALESCE(SUM(cr.artist_share), 0) as total_artist_share,
        COALESCE(SUM(cr.label_share), 0) as total_label_share,
        COALESCE(SUM(cr.company_share), 0) as total_company_share,
        COALESCE(SUM(cr.payable_amount), 0) as total_payable_amount,
        COALESCE(SUM(CASE WHEN cr.status = 'calculated' THEN cr.payable_amount ELSE 0 END), 0) as pending_payable,
        COALESCE(SUM(CASE WHEN cr.status = 'paid' THEN cr.payable_amount ELSE 0 END), 0) as paid_amount
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause}
    `, queryParams);

    // Get top platforms with safe fallback
    let topPlatformsResult;
    try {
      topPlatformsResult = await client.query(`
        SELECT 
          rr.platform,
          COALESCE(SUM(cr.gross_revenue), 0) as revenue,
          COALESCE(COUNT(*), 0) as count
        FROM calculated_revenues cr
        LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
        ${whereClause}
        GROUP BY rr.platform
        ORDER BY revenue DESC
        LIMIT 5
      `, queryParams);
    } catch (platformError) {
      console.warn("Platform query failed:", platformError.message);
      topPlatformsResult = { rows: [] };
    }

    // Get monthly revenue with safe fallback
    let monthlyRevenueResult;
    try {
      monthlyRevenueResult = await client.query(`
        SELECT 
          cr.report_month,
          COALESCE(SUM(cr.gross_revenue), 0) as revenue,
          COALESCE(COUNT(*), 0) as count
        FROM calculated_revenues cr
        LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
        ${whereClause}
        GROUP BY cr.report_month
        ORDER BY cr.report_month DESC
        LIMIT 12
      `, queryParams);
    } catch (monthlyError) {
      console.warn("Monthly revenue query failed:", monthlyError.message);
      monthlyRevenueResult = { rows: [] };
    }

    // Get top tracks with safe fallback
    let topTracksResult;
    try {
      topTracksResult = await client.query(`
        SELECT 
          rr.track_title,
          rr.artist_name,
          COALESCE(SUM(cr.gross_revenue), 0) as revenue,
          COALESCE(COUNT(*), 0) as streams
        FROM calculated_revenues cr
        LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
        ${whereClause}
        GROUP BY rr.track_title, rr.artist_name
        ORDER BY revenue DESC
        LIMIT 10
      `, queryParams);
    } catch (tracksError) {
      console.warn("Top tracks query failed:", tracksError.message);
      topTracksResult = { rows: [] };
    }

    // Get payout summary with safe fallback
    let payoutSummary;
    try {
      const payoutResult = await client.query(`
        SELECT 
          COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_payouts,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) as paid_payouts
        FROM payouts
        WHERE ${req.user.role === 'artist' ? 'user_id = $1' : '1=1'}
        ${req.user.role === 'artist' ? 'AND created_at >= NOW() - INTERVAL \'12 months\'' : ''}
      `, req.user.role === 'artist' ? [req.user.id] : []);
      payoutSummary = payoutResult.rows[0];
    } catch (payoutError) {
      console.warn("Payout query failed:", payoutError.message);
      payoutSummary = { pending_payouts: 0, paid_payouts: 0 };
    }

    res.json({
      success: true,
      data: {
        total_revenue: parseFloat(result.rows[0]?.total_gross_revenue || 0),
        total_streams: parseInt(result.rows[0]?.total_revenues || 0),
        pending_payouts: parseFloat(payoutSummary?.pending_payouts || 0),
        paid_payouts: parseFloat(payoutSummary?.paid_payouts || 0),
        monthly_revenue: monthlyRevenueResult?.rows || [],
        platform_summary: topPlatformsResult?.rows || [],
        top_tracks: topTracksResult?.rows || []
      }
    });
  } catch (error) {
    console.error("Get finance summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load finance summary",
      error: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
