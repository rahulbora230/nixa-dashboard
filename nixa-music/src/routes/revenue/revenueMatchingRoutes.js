const express = require("express");
const pool = require("../../config/db");
const { verifyToken, onlyAdmin } = require("../../middleware/authMiddleware");
const { ensureFinanceSchema } = require("../../services/finance/financeSchema");

const router = express.Router();

// ISRC matching system - case-insensitive and trim-safe
const normalizeISRC = (isrc) => {
  if (!isrc) return null;
  return String(isrc).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
};

// GET /api/revenue/unmatched - Get unmatched revenue rows
router.get("/unmatched", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    // Extract filters
    const { search, platform, reportMonth, status = 'unmatched' } = req.query;
    
    let whereClause = `WHERE ur.status = $1`;
    let queryParams = [status];
    let paramCount = 2;
    
    // Add search filter
    if (search) {
      whereClause += ` AND (
        ur.isrc ILIKE $${paramCount} OR 
        ur.track_title ILIKE $${paramCount + 1} OR 
        ur.artist_name ILIKE $${paramCount + 2}
      )`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 3;
    }
    
    // Add platform filter
    if (platform) {
      whereClause += ` AND ur.platform = $${paramCount}`;
      queryParams.push(platform);
      paramCount++;
    }
    
    // Add report month filter
    if (reportMonth) {
      whereClause += ` AND ur.report_month = $${paramCount}`;
      queryParams.push(reportMonth);
      paramCount++;
    }
    
    // Add role-based filtering
    let roleFilter = '';
    if (req.user.role === 'artist') {
      roleFilter = `AND ur.artist_name = (SELECT name FROM users WHERE id = $${paramCount})`;
      queryParams.push(req.user.id);
      paramCount++;
    } else if (req.user.role === 'label') {
      roleFilter = `AND (
        ur.artist_name IN (SELECT name FROM users WHERE label_id = $${paramCount}) OR
        ur.label_name = (SELECT name FROM users WHERE id = $${paramCount})
      )`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    }
    
    whereClause += ` ${roleFilter}`;
    
    const result = await client.query(`
      SELECT 
        ur.*,
        u.name as created_by_name,
        COUNT(*) OVER() as total_count
      FROM unmatched_revenues ur
      LEFT JOIN users u ON ur.created_at = u.id
      ${whereClause}
      ORDER BY ur.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, [...queryParams, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: result.rows.length > 0 ? result.rows[0].total_count : 0,
        totalPages: Math.ceil((result.rows.length > 0 ? result.rows[0].total_count : 0) / limit)
      },
      filters: { search, platform, reportMonth, status }
    });
  } catch (error) {
    console.error("Get unmatched revenue error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch unmatched revenue"
    });
  } finally {
    client.release();
  }
});

// POST /api/revenue/unmatched/:id/assign - Manually assign unmatched revenue to track
router.post("/:id/assign", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const unmatchedId = req.params.id;
    const { trackId, releaseId, artistId, labelId, notes } = req.body;
    
    if (!trackId && !releaseId) {
      return res.status(400).json({
        success: false,
        message: "Track ID or Release ID is required"
      });
    }

    await client.query("BEGIN");
    
    // Check if unmatched revenue exists
    const unmatchedResult = await client.query(
      "SELECT * FROM unmatched_revenues WHERE id = $1",
      [unmatchedId]
    );
    
    if (unmatchedResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Unmatched revenue not found"
      });
    }

    const unmatched = unmatchedResult.rows[0];
    
    // Update raw_revenue with track/release info
    await client.query(`
      UPDATE raw_revenues 
      SET 
        track_title = COALESCE(t.track_title, rr.track_title),
        release_title = COALESCE(r.release_title, rr.release_title),
        artist_name = COALESCE(ar.name, rr.artist_name),
        label_name = COALESCE(l.name, rr.label_name),
        updated_at = NOW()
      FROM raw_revenues rr
      LEFT JOIN tracks t ON t.id = $1
      LEFT JOIN releases r ON r.id = $2
      LEFT JOIN users ar ON ar.id = $3
      LEFT JOIN users l ON l.id = $4
      WHERE rr.id = $5
    `, [trackId, releaseId, artistId, labelId, unmatched.raw_revenue_id]);

    // Create calculated revenue entry
    const grossRevenue = parseFloat(unmatched.revenue) || 0;
    
    // Get revenue split for the period
    const splitResult = await client.query(`
      SELECT * FROM revenue_splits 
      WHERE effective_from <= $1 AND (effective_to IS NULL OR effective_to >= $1)
      AND is_active = true
      ORDER BY effective_from DESC
      LIMIT 1
    `, [unmatched.report_month]);

    let artistShare = 0.5; // Default 50%
    let labelShare = 0.2; // Default 20%
    let companyShare = 0.3; // Default 30%
    
    if (splitResult.rows.length > 0) {
      const split = splitResult.rows[0];
      artistShare = parseFloat(split.artist_share) || 0.5;
      labelShare = parseFloat(split.label_share) || 0.2;
      companyShare = parseFloat(split.company_share) || 0.3;
    }

    const calculatedResult = await client.query(`
      INSERT INTO calculated_revenues (
        raw_revenue_id, user_id, artist_id, label_id, split_id,
        report_month, gross_revenue, artist_share, label_share, company_share, payable_amount,
        currency, status, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'calculated', NOW(), NOW()
      ) RETURNING id
    `, [
      unmatched.raw_revenue_id,
      artistId || null,
      artistId,
      labelId,
      splitResult.rows.length > 0 ? splitResult.rows[0].id : null,
      unmatched.report_month,
      grossRevenue,
      grossRevenue * artistShare,
      grossRevenue * labelShare,
      grossRevenue * companyShare,
      grossRevenue * (artistShare + labelShare + companyShare),
      'USD'
    ]);

    // Update unmatched revenue status
    await client.query(`
      UPDATE unmatched_revenues 
      SET status = 'matched', notes = $1, updated_at = NOW()
      WHERE id = $2
    `, [notes || `Manually assigned to track ${trackId}`, unmatchedId]);

    // Create ledger entry
    await client.query(`
      INSERT INTO ledger_entries (
        user_id, artist_id, label_id, entry_type, amount, balance, currency,
        description, reference_id, reference_type, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'revenue', $4, $4, 'USD',
        $5, $6, $7, $8, NOW(), NOW()
      )
    `, [
      artistId || null,
      artistId,
      labelId,
      grossRevenue,
      grossRevenue,
      `Revenue from ${unmatched.platform} - ${unmatched.track_title}`,
      calculatedResult.rows[0].id,
      'calculated_revenue',
      req.user.id
    ]);

    await client.query("COMMIT");

    // Log the assignment
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'assign_unmatched', 'unmatched_revenue', $2)
    `, [req.user.id, JSON.stringify({
      unmatchedId,
      trackId,
      releaseId,
      artistId,
      labelId,
      grossRevenue,
      split: {
        artistShare,
        labelShare,
        companyShare
      }
    })]);

    res.json({
      success: true,
      message: "Unmatched revenue assigned successfully",
      data: {
        unmatchedId,
        calculatedRevenueId: calculatedResult.rows[0].id,
        trackId,
        releaseId,
        grossRevenue,
        splits: {
          artistShare,
          labelShare,
          companyShare
        }
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Assign unmatched revenue error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to assign unmatched revenue"
    });
  } finally {
    client.release();
  }
});

// POST /api/revenue/unmatched/:id/ignore - Ignore unmatched revenue
router.post("/:id/ignore", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const unmatchedId = req.params.id;
    const { notes } = req.body;
    
    await client.query("BEGIN");
    
    // Check if unmatched revenue exists
    const unmatchedResult = await client.query(
      "SELECT * FROM unmatched_revenues WHERE id = $1",
      [unmatchedId]
    );
    
    if (unmatchedResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Unmatched revenue not found"
      });
    }

    // Update status to ignored
    await client.query(`
      UPDATE unmatched_revenues 
      SET status = 'ignored', notes = $1, updated_at = NOW()
      WHERE id = $2
    `, [notes || 'Manually ignored', unmatchedId]);

    await client.query("COMMIT");

    // Log the action
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'ignore_unmatched', 'unmatched_revenue', $2)
    `, [req.user.id, JSON.stringify({
      unmatchedId,
      notes
    })]);

    res.json({
      success: true,
      message: "Unmatched revenue ignored successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Ignore unmatched revenue error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to ignore unmatched revenue"
    });
  } finally {
    client.release();
  }
});

// GET /api/revenue/matching-summary - Get ISRC matching summary
router.get("/matching-summary", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { reportMonth, platform } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;
    
    if (reportMonth) {
      whereClause += ` AND rr.report_month = $${paramCount}`;
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
      whereClause += ` AND rr.artist_name = (SELECT name FROM users WHERE id = $${paramCount})`;
      queryParams.push(req.user.id);
      paramCount++;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        rr.artist_name IN (SELECT name FROM users WHERE label_id = $${paramCount}) OR
        rr.label_name = (SELECT name FROM users WHERE id = $${paramCount})
      )`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    }
    
    const result = await client.query(`
      SELECT 
        COUNT(*) as total_revenue_rows,
        COUNT(CASE WHEN ur.id IS NOT NULL THEN 1 END) as unmatched_rows,
        COUNT(CASE WHEN t.id IS NOT NULL THEN 1 END) as matched_rows,
        COUNT(CASE WHEN ur.status = 'unmatched' THEN 1 END) as pending_unmatched,
        COUNT(CASE WHEN ur.status = 'matched' THEN 1 END) as resolved_unmatched,
        COUNT(CASE WHEN ur.status = 'ignored' THEN 1 END) as ignored_unmatched,
        SUM(CASE WHEN ur.id IS NULL THEN rr.revenue ELSE 0 END) as matched_revenue,
        SUM(CASE WHEN ur.id IS NOT NULL THEN rr.revenue ELSE 0 END) as unmatched_revenue
      FROM raw_revenues rr
      LEFT JOIN unmatched_revenues ur ON rr.id = ur.raw_revenue_id
      LEFT JOIN tracks t ON t.isrc = rr.isrc
      ${whereClause}
    `, queryParams);

    res.json({
      success: true,
      data: result.rows[0] || {
        total_revenue_rows: 0,
        unmatched_rows: 0,
        matched_rows: 0,
        pending_unmatched: 0,
        resolved_unmatched: 0,
        ignored_unmatched: 0,
        matched_revenue: 0,
        unmatched_revenue: 0
      }
    });
  } catch (error) {
    console.error("Get matching summary error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch matching summary"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
