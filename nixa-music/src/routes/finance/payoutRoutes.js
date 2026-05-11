const express = require("express");
const pool = require("../../config/db");
const { verifyToken, onlyAdmin } = require("../../middleware/authMiddleware");
const { ensureFinanceSchema } = require("../../services/finance/financeSchema");

const router = express.Router();

// GET /api/payouts - Get payouts with filters
router.get("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Extract filters
    const { status, userId, artistId, labelId, dateFrom, dateTo } = req.query;
    
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramCount = 1;
    
    // Add status filter
    if (status) {
      whereClause += ` AND p.status = $${paramCount}`;
      queryParams.push(status);
      paramCount++;
    }
    
    // Add user/artist/label filters
    if (userId) {
      whereClause += ` AND p.user_id = $${paramCount}`;
      queryParams.push(userId);
      paramCount++;
    }
    
    if (artistId) {
      whereClause += ` AND p.artist_id = $${paramCount}`;
      queryParams.push(artistId);
      paramCount++;
    }
    
    if (labelId) {
      whereClause += ` AND p.label_id = $${paramCount}`;
      queryParams.push(labelId);
      paramCount++;
    }
    
    // Add date range filter
    if (dateFrom) {
      whereClause += ` AND p.created_at >= $${paramCount}`;
      queryParams.push(dateFrom);
      paramCount++;
    }
    
    if (dateTo) {
      whereClause += ` AND p.created_at <= $${paramCount}`;
      queryParams.push(dateTo);
      paramCount++;
    }
    
    // Add role-based filtering
    if (req.user.role === 'artist') {
      whereClause += ` AND (p.user_id = $${paramCount} OR p.artist_id = $${paramCount})`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        p.user_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        p.artist_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        p.label_id = $${paramCount}
      )`;
      queryParams.push(req.user.id, req.user.id, req.user.id);
      paramCount += 3;
    }

    const result = await client.query(`
      SELECT 
        p.*,
        u.name as created_by_name,
        user.name as user_name,
        artist.name as artist_name,
        label.name as label_name,
        COUNT(pa.id) as attachment_count,
        COUNT(*) OVER() as total_count
      FROM payouts p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN users user ON p.user_id = user.id
      LEFT JOIN users artist ON p.artist_id = artist.id
      LEFT JOIN users label ON p.label_id = label.id
      LEFT JOIN payout_attachments pa ON p.id = pa.payout_id
      ${whereClause}
      GROUP BY p.id, u.name, user.name, artist.name, label.name
      ORDER BY p.created_at DESC
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
      filters: { status, userId, artistId, labelId, dateFrom, dateTo }
    });
  } catch (error) {
    console.error("Get payouts error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payouts"
    });
  } finally {
    client.release();
  }
});

// GET /api/payouts/:id - Get specific payout
router.get("/:id", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const result = await client.query(`
      SELECT 
        p.*,
        u.name as created_by_name,
        user.name as user_name,
        artist.name as artist_name,
        label.name as label_name
      FROM payouts p
      LEFT JOIN users u ON p.created_by = u.id
      LEFT JOIN users user ON p.user_id = user.id
      LEFT JOIN users artist ON p.artist_id = artist.id
      LEFT JOIN users label ON p.label_id = label.id
      WHERE p.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payout not found"
      });
    }

    // Get attachments
    const attachmentsResult = await client.query(
      "SELECT * FROM payout_attachments WHERE payout_id = $1 ORDER BY created_at DESC",
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        attachments: attachmentsResult.rows
      }
    });
  } catch (error) {
    console.error("Get payout error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch payout"
    });
  } finally {
    client.release();
  }
});

// POST /api/payouts - Create new payout
router.post("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { 
      userId, 
      artistId, 
      labelId, 
      amount, 
      paymentMethod, 
      referenceNumber, 
      remarks 
    } = req.body;
    
    // Validate required fields
    if (!amount || !userId || !artistId) {
      return res.status(400).json({
        success: false,
        message: "Amount, user ID, and artist ID are required"
      });
    }

    // Check available balance
    const balanceResult = await client.query(`
      SELECT 
        SUM(CASE WHEN entry_type = 'revenue' THEN amount ELSE -amount END) as available_balance
      FROM ledger_entries 
      WHERE user_id = $1 AND artist_id = $2
    `, [userId, artistId]);

    const availableBalance = parseFloat(balanceResult.rows[0]?.available_balance) || 0;
    const payoutAmount = parseFloat(amount);

    if (payoutAmount > availableBalance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: $${availableBalance.toFixed(2)}, Requested: $${payoutAmount.toFixed(2)}`
      });
    }

    await client.query("BEGIN");
    
    // Create payout
    const payoutResult = await client.query(`
      INSERT INTO payouts (
        user_id, artist_id, label_id, amount, currency, status,
        payment_method, reference_number, remarks, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, 'USD', 'pending', $5, $6, $7, $8, NOW(), NOW()
      ) RETURNING *
    `, [
      userId,
      artistId,
      labelId || null,
      payoutAmount,
      paymentMethod || null,
      referenceNumber || null,
      remarks || null,
      req.user.id
    ]);

    // Create ledger entry for payout
    await client.query(`
      INSERT INTO ledger_entries (
        user_id, artist_id, label_id, entry_type, amount, balance, currency,
        description, reference_id, reference_type, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'payout', -$4, $5, 'USD',
        $6, $7, $8, $9, NOW(), NOW()
      )
    `, [
      userId,
      artistId,
      labelId || null,
      payoutAmount,
      availableBalance - payoutAmount,
      `Payout - ${paymentMethod || 'Manual'}${referenceNumber ? ` (${referenceNumber})` : ''}`,
      payoutResult.rows[0].id,
      'payout',
      req.user.id
    ]);

    await client.query("COMMIT");

    // Log payout creation
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'create_payout', 'payout', $2)
    `, [req.user.id, JSON.stringify({
      payoutId: payoutResult.rows[0].id,
      userId,
      artistId,
      labelId,
      amount: payoutAmount,
      paymentMethod,
      referenceNumber
    })]);

    res.status(201).json({
      success: true,
      message: "Payout created successfully",
      data: payoutResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create payout error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create payout"
    });
  } finally {
    client.release();
  }
});

// PATCH /api/payouts/:id - Update payout
router.patch("/:id", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const payoutId = req.params.id;
    const { status, paymentMethod, referenceNumber, remarks } = req.body;
    
    // Check if payout exists
    const existingPayout = await client.query(
      "SELECT id, status FROM payouts WHERE id = $1",
      [payoutId]
    );
    
    if (existingPayout.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Payout not found"
      });
    }

    // Only allow status updates to paid/processing/cancelled
    const allowedStatuses = ['pending', 'processing', 'paid', 'cancelled'];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed: pending, processing, paid, cancelled"
      });
    }

    await client.query("BEGIN");
    
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    if (status !== undefined) {
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
      paramCount++;
    }
    
    if (paymentMethod !== undefined) {
      updateFields.push(`payment_method = $${paramCount}`);
      updateValues.push(paymentMethod);
      paramCount++;
    }
    
    if (referenceNumber !== undefined) {
      updateFields.push(`reference_number = $${paramCount}`);
      updateValues.push(referenceNumber);
      paramCount++;
    }
    
    if (remarks !== undefined) {
      updateFields.push(`remarks = $${paramCount}`);
      updateValues.push(remarks);
      paramCount++;
    }
    
    if (updateFields.length > 0) {
      updateFields.push(`updated_at = NOW()`);
      
      await client.query(`
        UPDATE payouts 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `, [...updateValues, payoutId]);
    }

    await client.query("COMMIT");

    // Log payout update
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'update_payout', 'payout', $2)
    `, [req.user.id, JSON.stringify({
      payoutId,
      updatedFields: Object.keys(req.body)
    })]);

    res.json({
      success: true,
      message: "Payout updated successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update payout error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update payout"
    });
  } finally {
    client.release();
  }
});

// GET /api/ledger - Get ledger entries
router.get("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    // Extract filters
    const { entryType, userId, artistId, labelId, dateFrom, dateTo } = req.query;
    
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramCount = 1;
    
    // Add entry type filter
    if (entryType) {
      whereClause += ` AND le.entry_type = $${paramCount}`;
      queryParams.push(entryType);
      paramCount++;
    }
    
    // Add user/artist/label filters
    if (userId) {
      whereClause += ` AND le.user_id = $${paramCount}`;
      queryParams.push(userId);
      paramCount++;
    }
    
    if (artistId) {
      whereClause += ` AND le.artist_id = $${paramCount}`;
      queryParams.push(artistId);
      paramCount++;
    }
    
    if (labelId) {
      whereClause += ` AND le.label_id = $${paramCount}`;
      queryParams.push(labelId);
      paramCount++;
    }
    
    // Add date range filter
    if (dateFrom) {
      whereClause += ` AND le.created_at >= $${paramCount}`;
      queryParams.push(dateFrom);
      paramCount++;
    }
    
    if (dateTo) {
      whereClause += ` AND le.created_at <= $${paramCount}`;
      queryParams.push(dateTo);
      paramCount++;
    }
    
    // Add role-based filtering
    if (req.user.role === 'artist') {
      whereClause += ` AND (le.user_id = $${paramCount} OR le.artist_id = $${paramCount})`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        le.user_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        le.artist_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        le.label_id = $${paramCount}
      )`;
      queryParams.push(req.user.id, req.user.id, req.user.id);
      paramCount += 3;
    }

    const result = await client.query(`
      SELECT 
        le.*,
        u.name as created_by_name,
        user.name as user_name,
        artist.name as artist_name,
        label.name as label_name,
        COUNT(*) OVER() as total_count
      FROM ledger_entries le
      LEFT JOIN users u ON le.created_by = u.id
      LEFT JOIN users user ON le.user_id = user.id
      LEFT JOIN users artist ON le.artist_id = artist.id
      LEFT JOIN users label ON le.label_id = label.id
      ${whereClause}
      ORDER BY le.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `, [...queryParams, limit, offset]);

    // Get current balance summary
    const balanceResult = await client.query(`
      SELECT 
        SUM(CASE WHEN entry_type = 'revenue' THEN amount ELSE -amount END) as current_balance,
        SUM(CASE WHEN entry_type = 'revenue' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN entry_type = 'payout' THEN amount ELSE 0 END) as total_payouts,
        SUM(CASE WHEN entry_type = 'adjustment' THEN amount ELSE 0 END) as total_adjustments
      FROM ledger_entries le
      ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}
    `, queryParams);

    res.json({
      success: true,
      data: {
        entries: result.rows,
        summary: balanceResult.rows[0] || {
          current_balance: 0,
          total_revenue: 0,
          total_payouts: 0,
          total_adjustments: 0
        }
      },
      pagination: {
        page,
        limit,
        total: result.rows.length > 0 ? result.rows[0].total_count : 0,
        totalPages: Math.ceil((result.rows.length > 0 ? result.rows[0].total_count : 0) / limit)
      },
      filters: { entryType, userId, artistId, labelId, dateFrom, dateTo }
    });
  } catch (error) {
    console.error("Get ledger error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch ledger entries"
    });
  } finally {
    client.release();
  }
});

// POST /api/ledger/adjustment - Create manual adjustment
router.post("/adjustment", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { userId, artistId, labelId, amount, description } = req.body;
    
    // Validate required fields
    if (!amount || !description) {
      return res.status(400).json({
        success: false,
        message: "Amount and description are required"
      });
    }

    // Only admin can create adjustments
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: "Only admin can create manual adjustments"
      });
    }

    await client.query("BEGIN");
    
    // Get current balance
    const balanceResult = await client.query(`
      SELECT 
        SUM(CASE WHEN entry_type = 'revenue' THEN amount ELSE -amount END) as current_balance
      FROM ledger_entries 
      WHERE user_id = $1 AND artist_id = $2
    `, [userId, artistId]);

    const currentBalance = parseFloat(balanceResult.rows[0]?.current_balance) || 0;
    const adjustmentAmount = parseFloat(amount);

    // Create ledger entry for adjustment
    await client.query(`
      INSERT INTO ledger_entries (
        user_id, artist_id, label_id, entry_type, amount, balance, currency,
        description, reference_type, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, 'adjustment', $4, $5, 'USD',
        $6, 'manual_adjustment', $7, NOW(), NOW()
      )
    `, [
      userId,
      artistId,
      labelId || null,
      adjustmentAmount,
      currentBalance + adjustmentAmount,
      description,
      req.user.id
    ]);

    await client.query("COMMIT");

    // Log adjustment creation
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'create_adjustment', 'ledger_entry', $2)
    `, [req.user.id, JSON.stringify({
      userId,
      artistId,
      labelId,
      amount: adjustmentAmount,
      description,
      previousBalance: currentBalance,
      newBalance: currentBalance + adjustmentAmount
    })]);

    res.status(201).json({
      success: true,
      message: "Manual adjustment created successfully",
      data: {
        amount: adjustmentAmount,
        description,
        previousBalance: currentBalance,
        newBalance: currentBalance + adjustmentAmount
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create adjustment error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create manual adjustment"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
