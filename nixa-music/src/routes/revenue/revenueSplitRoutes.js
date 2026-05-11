const express = require("express");
const pool = require("../../config/db");
const { verifyToken, onlyAdmin } = require("../../middleware/authMiddleware");
const { ensureFinanceSchema } = require("../../services/finance/financeSchema");

const router = express.Router();

// POST /api/revenue/splits - Create or update revenue split
router.post("/", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { 
      userId, 
      artistId, 
      labelId, 
      splitType, 
      artistShare, 
      labelShare, 
      companyShare, 
      effectiveFrom,
      effectiveTo,
      isActive = true 
    } = req.body;
    
    // Validate required fields
    if (!splitType || !artistShare || !labelShare || !companyShare || !effectiveFrom) {
      return res.status(400).json({
        success: false,
        message: "Split type, shares, and effective from date are required"
      });
    }
    
    // Validate shares total to 100%
    const totalShares = parseFloat(artistShare) + parseFloat(labelShare) + parseFloat(companyShare);
    if (Math.abs(totalShares - 1.0) > 0.0001) {
      return res.status(400).json({
        success: false,
        message: "Shares must total to 100%"
      });
    }

    await client.query("BEGIN");
    
    // Deactivate existing splits for the same split type and user/artist/label
    await client.query(`
      UPDATE revenue_splits 
      SET is_active = false, updated_at = NOW()
      WHERE (
        (user_id = $1 OR artist_id = $1 OR label_id = $1) AND
        split_type = $2 AND
        is_active = true
      )
    `, [userId || artistId || labelId, splitType]);

    // Create new split
    const result = await client.query(`
      INSERT INTO revenue_splits (
        user_id, artist_id, label_id, split_type, artist_share, label_share, 
        company_share, effective_from, effective_to, is_active, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
      ) RETURNING *
    `, [
      userId || null,
      artistId || null,
      labelId || null,
      splitType,
      artistShare,
      labelShare,
      companyShare,
      effectiveFrom,
      effectiveTo || null,
      isActive,
      req.user.id
    ]);

    await client.query("COMMIT");

    // Log: action
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'create_split', 'revenue_split', $2)
    `, [req.user.id, JSON.stringify({
      splitId: result.rows[0].id,
      splitType,
      userId,
      artistId,
      labelId,
      shares: {
        artistShare,
        labelShare,
        companyShare
      },
      effectiveFrom,
      effectiveTo,
      isActive
    })]);

    res.status(201).json({
      success: true,
      message: "Revenue split created successfully",
      data: result.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create revenue split error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create revenue split"
    });
  } finally {
    client.release();
  }
});

// GET /api/revenue/splits - Get revenue splits
router.get("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    
    // Extract filters
    const { splitType, isActive } = req.query;
    
    let whereClause = "WHERE 1=1";
    let queryParams = [];
    let paramCount = 1;
    
    // Add split type filter
    if (splitType) {
      whereClause += ` AND rs.split_type = $${paramCount}`;
      queryParams.push(splitType);
      paramCount++;
    }
    
    // Add active status filter
    if (isActive !== undefined) {
      whereClause += ` AND rs.is_active = $${paramCount}`;
      queryParams.push(isActive === 'true');
      paramCount++;
    }
    
    // Add role-based filtering
    if (req.user.role === 'artist') {
      whereClause += ` AND (rs.user_id = $${paramCount} OR rs.artist_id = $${paramCount})`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    } else if (req.user.role === 'label') {
      whereClause += ` AND (
        rs.user_id IN (SELECT id FROM users WHERE label_id = $${paramCount}) OR
        rs.label_id = $${paramCount}
      )`;
      queryParams.push(req.user.id, req.user.id);
      paramCount += 2;
    }

    const result = await client.query(`
      SELECT 
        rs.*,
        u.name as created_by_name,
        user.name as user_name,
        artist.name as artist_name,
        label.name as label_name,
        COUNT(*) OVER() as total_count
      FROM revenue_splits rs
      LEFT JOIN users u ON rs.created_by = u.id
      LEFT JOIN users user ON rs.user_id = user.id
      LEFT JOIN users artist ON rs.artist_id = artist.id
      LEFT JOIN users label ON rs.label_id = label.id
      ${whereClause}
      ORDER BY rs.effective_from DESC, rs.created_at DESC
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
      filters: { splitType, isActive }
    });
  } catch (error) {
    console.error("Get revenue splits error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch revenue splits"
    });
  } finally {
    client.release();
  }
});

// GET /api/revenue/splits/:id - Get specific revenue split
router.get("/:id", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const result = await client.query(`
      SELECT 
        rs.*,
        u.name as created_by_name,
        user.name as user_name,
        artist.name as artist_name,
        label.name as label_name
      FROM revenue_splits rs
      LEFT JOIN users u ON rs.created_by = u.id
      LEFT JOIN users user ON rs.user_id = user.id
      LEFT JOIN users artist ON rs.artist_id = artist.id
      LEFT JOIN users label ON rs.label_id = label.id
      WHERE rs.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Revenue split not found"
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Get revenue split error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch revenue split"
    });
  } finally {
    client.release();
  }
});

// PATCH /api/revenue/splits/:id - Update revenue split
router.patch("/:id", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const splitId = req.params.id;
    const { 
      artistShare, 
      labelShare, 
      companyShare, 
      effectiveFrom,
      effectiveTo,
      isActive 
    } = req.body;
    
    // Check if split exists
    const existingSplit = await client.query(
      "SELECT id FROM revenue_splits WHERE id = $1",
      [splitId]
    );
    
    if (existingSplit.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Revenue split not found"
      });
    }

    // Validate shares total to 100% if provided
    if (artistShare !== undefined || labelShare !== undefined || companyShare !== undefined) {
      const currentSplit = await client.query(
        "SELECT artist_share, label_share, company_share FROM revenue_splits WHERE id = $1",
        [splitId]
      );
      
      const current = currentSplit.rows[0];
      const newArtistShare = artistShare !== undefined ? parseFloat(artistShare) : parseFloat(current.artist_share);
      const newLabelShare = labelShare !== undefined ? parseFloat(labelShare) : parseFloat(current.label_share);
      const newCompanyShare = companyShare !== undefined ? parseFloat(companyShare) : parseFloat(current.company_share);
      
      const totalShares = newArtistShare + newLabelShare + newCompanyShare;
      if (Math.abs(totalShares - 1.0) > 0.0001) {
        return res.status(400).json({
          success: false,
          message: "Shares must total to 100%"
        });
      }
    }

    await client.query("BEGIN");
    
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    if (artistShare !== undefined) {
      updateFields.push(`artist_share = $${paramCount}`);
      updateValues.push(artistShare);
      paramCount++;
    }
    
    if (labelShare !== undefined) {
      updateFields.push(`label_share = $${paramCount}`);
      updateValues.push(labelShare);
      paramCount++;
    }
    
    if (companyShare !== undefined) {
      updateFields.push(`company_share = $${paramCount}`);
      updateValues.push(companyShare);
      paramCount++;
    }
    
    if (effectiveFrom !== undefined) {
      updateFields.push(`effective_from = $${paramCount}`);
      updateValues.push(effectiveFrom);
      paramCount++;
    }
    
    if (effectiveTo !== undefined) {
      updateFields.push(`effective_to = $${paramCount}`);
      updateValues.push(effectiveTo);
      paramCount++;
    }
    
    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramCount}`);
      updateValues.push(isActive);
      paramCount++;
    }
    
    if (updateFields.length > 0) {
      updateFields.push(`updated_at = NOW()`);
      
      await client.query(`
        UPDATE revenue_splits 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `, [...updateValues, splitId]);
    }

    await client.query("COMMIT");

    // Log: action
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'update_split', 'revenue_split', $2)
    `, [req.user.id, JSON.stringify({
      splitId,
      updatedFields: Object.keys(req.body)
    })]);

    res.json({
      success: true,
      message: "Revenue split updated successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update revenue split error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update revenue split"
    });
  } finally {
    client.release();
  }
});

// DELETE /api/revenue/splits/:id - Delete revenue split
router.delete("/:id", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const splitId = req.params.id;
    
    // Check if split exists and is not default
    const existingSplit = await client.query(
      "SELECT id, split_type FROM revenue_splits WHERE id = $1",
      [splitId]
    );
    
    if (existingSplit.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Revenue split not found"
      });
    }
    
    if (existingSplit.rows[0].split_type === 'default') {
      return res.status(400).json({
        success: false,
        message: "Cannot delete default revenue split"
      });
    }

    await client.query("BEGIN");
    
    // Check if split is in use
    const usageCheck = await client.query(
      "SELECT COUNT(*) as count FROM calculated_revenues WHERE split_id = $1",
      [splitId]
    );
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete split that is in use"
      });
    }

    await client.query("DELETE FROM revenue_splits WHERE id = $1", [splitId]);
    
    // Log: action
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'delete_split', 'revenue_split', $2)
    `, [req.user.id, JSON.stringify({
      splitId,
      splitType: existingSplit.rows[0].split_type
    })]);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Revenue split deleted successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete revenue split error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete revenue split"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
