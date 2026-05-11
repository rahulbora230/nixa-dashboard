const express = require("express");
const pool = require("../../config/db");
const { verifyToken, onlyAdmin } = require("../../middleware/authMiddleware");
const { ensureFinanceSchema } = require("../../services/finance/financeSchema");

const router = express.Router();

// POST /api/revenue/recalculate - Recalculate revenue for selected month/platform
router.post("/revenue/recalculate", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { reportMonth, platform } = req.body;
    
    if (!reportMonth) {
      return res.status(400).json({
        success: false,
        message: "Report month is required"
      });
    }

    await client.query("BEGIN");
    
    // Get revenue splits for the period
    const splitResult = await client.query(`
      SELECT * FROM revenue_splits 
      WHERE effective_from <= $1 AND (effective_to IS NULL OR effective_to >= $1)
      AND is_active = true
      ORDER BY effective_from DESC
      LIMIT 1
    `, [reportMonth]);

    let artistShare = 0.5; // Default 50%
    let labelShare = 0.2; // Default 20%
    let companyShare = 0.3; // Default 30%
    
    if (splitResult.rows.length > 0) {
      const split = splitResult.rows[0];
      artistShare = parseFloat(split.artist_share) || 0.5;
      labelShare = parseFloat(split.label_share) || 0.2;
      companyShare = parseFloat(split.company_share) || 0.3;
    }

    // Build WHERE clause for recalculation
    let whereClause = `WHERE rr.report_month = $1`;
    let queryParams = [reportMonth];
    let paramCount = 2;
    
    if (platform) {
      whereClause += ` AND rr.platform = $${paramCount}`;
      queryParams.push(platform);
      paramCount++;
    }

    // Get raw revenues to recalculate
    const rawRevenuesResult = await client.query(`
      SELECT 
        rr.*,
        t.id as track_id,
        ar.id as artist_id,
        l.id as label_id
      FROM raw_revenues rr
      LEFT JOIN tracks t ON t.isrc = rr.isrc
      LEFT JOIN users ar ON ar.name = rr.artist_name AND ar.role = 'artist'
      LEFT JOIN users l ON l.name = rr.label_name AND l.role = 'label'
      ${whereClause}
      ORDER BY rr.created_at
    `, queryParams);

    // Delete existing calculated revenues for the period/platform
    await client.query(`
      DELETE FROM calculated_revenues 
      WHERE report_month = $1 ${platform ? 'AND raw_revenue_id IN (SELECT rr.id FROM raw_revenues rr WHERE rr.platform = $2 AND rr.report_month = $1)' : ''}
    `, platform ? [reportMonth, platform, reportMonth] : [reportMonth]);

    // Delete existing ledger entries for the period/platform
    await client.query(`
      DELETE FROM ledger_entries 
      WHERE entry_type = 'revenue' AND reference_id IN (
        SELECT cr.id FROM calculated_revenues cr
        LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
        WHERE cr.report_month = $1 ${platform ? 'AND rr.platform = $2' : ''}
      )
    `, platform ? [reportMonth, platform] : [reportMonth]);

    // Recalculate and insert new calculated revenues
    const calculatedRevenues = [];
    let totalGrossRevenue = 0;
    
    for (const raw of rawRevenuesResult.rows) {
      const grossRevenue = parseFloat(raw.revenue) || 0;
      const artistShareAmount = grossRevenue * artistShare;
      const labelShareAmount = grossRevenue * labelShare;
      const companyShareAmount = grossRevenue * companyShare;
      const payableAmount = grossRevenue * (artistShare + labelShare + companyShare);
      
      totalGrossRevenue += grossRevenue;
      
      calculatedRevenues.push({
        raw_revenue_id: raw.id,
        user_id: raw.artist_id,
        artist_id: raw.artist_id,
        label_id: raw.label_id,
        split_id: splitResult.rows.length > 0 ? splitResult.rows[0].id : null,
        report_month: raw.report_month,
        gross_revenue,
        artist_share: artistShareAmount,
        label_share: labelShareAmount,
        company_share: companyShareAmount,
        payable_amount: payableAmount,
        currency: raw.currency || 'USD'
      });
    }

    // Insert calculated revenues
    for (const calc of calculatedRevenues) {
      await client.query(`
        INSERT INTO calculated_revenues (
          raw_revenue_id, user_id, artist_id, label_id, split_id,
          report_month, gross_revenue, artist_share, label_share, company_share, payable_amount,
          currency, status, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'calculated', NOW(), NOW()
        )
      `, [
        calc.raw_revenue_id,
        calc.user_id,
        calc.artist_id,
        calc.label_id,
        calc.split_id,
        calc.report_month,
        calc.gross_revenue,
        calc.artist_share,
        calc.label_share,
        calc.company_share,
        calc.payable_amount,
        calc.currency
      ]);
    }

    // Create ledger entries
    for (const calc of calculatedRevenues) {
      await client.query(`
        INSERT INTO ledger_entries (
          user_id, artist_id, label_id, entry_type, amount, balance, currency,
          description, reference_id, reference_type, created_by, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'revenue', $4, $4, 'USD',
          $5, $6, $7, NOW(), NOW()
        )
      `, [
        calc.user_id,
        calc.artist_id,
        calc.label_id,
        calc.gross_revenue,
        calc.gross_revenue,
        `Revenue from ${rawRevenuesResult.rows.find(r => r.id === calc.raw_revenue_id)?.platform || 'Unknown'}`,
        (await client.query('SELECT id FROM calculated_revenues WHERE raw_revenue_id = $1', [calc.raw_revenue_id])).rows[0]?.id,
        'calculated_revenue',
        req.user.id
      ]);
    }

    await client.query("COMMIT");

    // Log recalculation
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'recalculate_revenue', 'calculated_revenue', $2)
    `, [req.user.id, JSON.stringify({
      reportMonth,
      platform,
      totalRevenues: rawRevenuesResult.rows.length,
      totalGrossRevenue,
      split: {
        artistShare,
        labelShare,
        companyShare
      }
    })]);

    res.json({
      success: true,
      message: `Recalculated ${rawRevenuesResult.rows.length} revenue records for ${reportMonth}${platform ? ` (${platform})` : ''}`,
      data: {
        reportMonth,
        platform,
        totalRevenues: rawRevenuesResult.rows.length,
        totalGrossRevenue,
        totalPayable: totalGrossRevenue * (artistShare + labelShare + companyShare),
        split: {
          artistShare,
          labelShare,
          companyShare
        }
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Recalculate revenue error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to recalculate revenue"
    });
  } finally {
    client.release();
  }
});

// GET /api/finance/summary - Get finance summary
router.get("/summary", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
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

    const result = await client.query(`
      SELECT 
        COUNT(*) as total_revenues,
        COUNT(DISTINCT cr.user_id) as total_artists,
        COUNT(DISTINCT cr.label_id) as total_labels,
        COUNT(DISTINCT cr.report_month) as total_months,
        COUNT(DISTINCT rr.platform) as total_platforms,
        SUM(cr.gross_revenue) as total_gross_revenue,
        SUM(cr.artist_share) as total_artist_share,
        SUM(cr.label_share) as total_label_share,
        SUM(cr.company_share) as total_company_share,
        SUM(cr.payable_amount) as total_payable_amount,
        SUM(CASE WHEN cr.status = 'calculated' THEN cr.payable_amount ELSE 0 END) as pending_payable,
        SUM(CASE WHEN cr.status = 'paid' THEN cr.payable_amount ELSE 0 END) as paid_amount
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause}
    `, queryParams);

    // Get top platforms
    const topPlatformsResult = await client.query(`
      SELECT 
        rr.platform,
        SUM(cr.gross_revenue) as revenue,
        COUNT(*) as count
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause}
      GROUP BY rr.platform
      ORDER BY revenue DESC
      LIMIT 5
    `, queryParams);

    // Get top countries
    const topCountriesResult = await client.query(`
      SELECT 
        rr.country,
        SUM(cr.gross_revenue) as revenue,
        COUNT(*) as count
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause} AND rr.country IS NOT NULL
      GROUP BY rr.country
      ORDER BY revenue DESC
      LIMIT 5
    `, queryParams);

    res.json({
      success: true,
      data: {
        summary: result.rows[0] || {
          total_revenues: 0,
          total_artists: 0,
          total_labels: 0,
          total_months: 0,
          total_platforms: 0,
          total_gross_revenue: 0,
          total_artist_share: 0,
          total_label_share: 0,
          total_company_share: 0,
          total_payable_amount: 0,
          pending_payable: 0,
          paid_amount: 0
        },
        top_platforms: topPlatformsResult.rows,
        top_countries: topCountriesResult.rows
      }
    });
  } catch (error) {
    console.error("Get finance summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch finance summary"
    });
  } finally {
    client.release();
  }
});

// GET /api/finance/monthly - Get monthly finance data
router.get("/monthly", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { year, platform } = req.query;
    
    if (!year) {
      return res.status(400).json({
        success: false,
        message: "Year is required"
      });
    }

    // Build WHERE clause
    let whereClause = "WHERE cr.report_month::text LIKE $1";
    let queryParams = [`${year}-%`];
    let paramCount = 2;
    
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

    const result = await client.query(`
      SELECT 
        cr.report_month,
        COUNT(*) as revenue_count,
        SUM(cr.gross_revenue) as gross_revenue,
        SUM(cr.artist_share) as artist_share,
        SUM(cr.label_share) as label_share,
        SUM(cr.company_share) as company_share,
        SUM(cr.payable_amount) as payable_amount,
        SUM(CASE WHEN cr.status = 'calculated' THEN cr.payable_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN cr.status = 'paid' THEN cr.payable_amount ELSE 0 END) as paid_amount
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause}
      GROUP BY cr.report_month
      ORDER BY cr.report_month DESC
    `, queryParams);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Get monthly finance error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch monthly finance data"
    });
  } finally {
    client.release();
  }
});

// GET /api/finance/platforms - Get platform-wise data
router.get("/platforms", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { reportMonth } = req.query;
    
    // Build WHERE clause
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramCount = 1;
    
    if (reportMonth) {
      whereClause += ` AND cr.report_month = $${paramCount}`;
      queryParams.push(reportMonth);
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

    const result = await client.query(`
      SELECT 
        rr.platform,
        COUNT(*) as revenue_count,
        SUM(cr.gross_revenue) as gross_revenue,
        SUM(cr.artist_share) as artist_share,
        SUM(cr.label_share) as label_share,
        SUM(cr.company_share) as company_share,
        SUM(cr.payable_amount) as payable_amount,
        SUM(CASE WHEN cr.status = 'calculated' THEN cr.payable_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN cr.status = 'paid' THEN cr.payable_amount ELSE 0 END) as paid_amount
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause}
      GROUP BY rr.platform
      ORDER BY gross_revenue DESC
    `, queryParams);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Get platforms data error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch platform data"
    });
  } finally {
    client.release();
  }
});

// GET /api/finance/countries - Get country-wise data
router.get("/countries", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { reportMonth } = req.query;
    
    // Build WHERE clause
    let whereClause = "WHERE rr.country IS NOT NULL";
    let queryParams = [];
    let paramCount = 1;
    
    if (reportMonth) {
      whereClause += ` AND cr.report_month = $${paramCount}`;
      queryParams.push(reportMonth);
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

    const result = await client.query(`
      SELECT 
        rr.country,
        COUNT(*) as revenue_count,
        SUM(cr.gross_revenue) as gross_revenue,
        SUM(cr.artist_share) as artist_share,
        SUM(cr.label_share) as label_share,
        SUM(cr.company_share) as company_share,
        SUM(cr.payable_amount) as payable_amount,
        SUM(CASE WHEN cr.status = 'calculated' THEN cr.payable_amount ELSE 0 END) as pending_amount,
        SUM(CASE WHEN cr.status = 'paid' THEN cr.payable_amount ELSE 0 END) as paid_amount
      FROM calculated_revenues cr
      LEFT JOIN raw_revenues rr ON cr.raw_revenue_id = rr.id
      ${whereClause}
      GROUP BY rr.country
      ORDER BY gross_revenue DESC
    `, queryParams);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Get countries data error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch country data"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
