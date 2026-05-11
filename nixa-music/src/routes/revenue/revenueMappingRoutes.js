const express = require("express");
const pool = require("../../config/db");
const { verifyToken, onlyAdmin } = require("../../middleware/authMiddleware");
const { ensureFinanceSchema } = require("../../services/finance/financeSchema");

const router = express.Router();

// GET /api/revenue/mappings - Get all revenue mappings
router.get("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const result = await client.query(`
      SELECT 
        rm.*,
        u.name as created_by_name,
        COUNT(rr.id) as usage_count
      FROM revenue_mappings rm
      LEFT JOIN users u ON rm.created_by = u.id
      LEFT JOIN raw_revenues rr ON rr.mapping_id = rm.id
      GROUP BY rm.id, rm.name, rm.platform, rm.mapping, rm.is_default, rm.created_by, rm.created_at, rm.updated_at, u.name
      ORDER BY rm.is_default DESC, rm.created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Get revenue mappings error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch revenue mappings"
    });
  } finally {
    client.release();
  }
});

// POST /api/revenue/mappings - Create new revenue mapping
router.post("/", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { name, platform, mapping, isDefault = false } = req.body;
    
    // Validate required fields
    if (!name || !platform || !mapping) {
      return res.status(400).json({
        success: false,
        message: "Name, platform, and mapping are required"
      });
    }

    // Validate mapping is valid JSON
    let parsedMapping;
    try {
      parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Mapping must be valid JSON"
      });
    }

    await client.query("BEGIN");
    
    // If setting as default, unset other defaults for this platform
    if (isDefault) {
      await client.query(
        "UPDATE revenue_mappings SET is_default = false WHERE platform = $1",
        [platform]
      );
    }

    const result = await client.query(`
      INSERT INTO revenue_mappings (name, platform, mapping, is_default, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `, [name, platform, JSON.stringify(parsedMapping), isDefault, req.user.id]);

    await client.query("COMMIT");

    // Log the action
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'create_mapping', 'revenue_mapping', $2)
    `, [req.user.id, JSON.stringify({
      mappingId: result.rows[0].id,
      name,
      platform,
      isDefault
    })]);

    res.status(201).json({
      success: true,
      message: "Revenue mapping created successfully",
      data: result.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create revenue mapping error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create revenue mapping"
    });
  } finally {
    client.release();
  }
});

// PATCH /api/revenue/mappings/:id - Update revenue mapping
router.patch("/:id", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const mappingId = req.params.id;
    const { name, platform, mapping, isDefault } = req.body;
    
    // Check if mapping exists
    const existingMapping = await client.query(
      "SELECT id FROM revenue_mappings WHERE id = $1",
      [mappingId]
    );
    
    if (existingMapping.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Revenue mapping not found"
      });
    }

    await client.query("BEGIN");
    
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name);
      paramCount++;
    }
    
    if (platform !== undefined) {
      updateFields.push(`platform = $${paramCount}`);
      updateValues.push(platform);
      paramCount++;
    }
    
    if (mapping !== undefined) {
      let parsedMapping;
      try {
        parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
      } catch (error) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Mapping must be valid JSON"
        });
      }
      
      updateFields.push(`mapping = $${paramCount}`);
      updateValues.push(JSON.stringify(parsedMapping));
      paramCount++;
    }
    
    if (isDefault !== undefined) {
      updateFields.push(`is_default = $${paramCount}`);
      updateValues.push(isDefault);
      paramCount++;
    }
    
    if (updateFields.length > 0) {
      updateFields.push(`updated_at = NOW()`);
      
      // If setting as default, unset other defaults for this platform
      if (isDefault && platform) {
        await client.query(
          "UPDATE revenue_mappings SET is_default = false WHERE platform = $1 AND id != $2",
          [platform, mappingId]
        );
      }
      
      await client.query(`
        UPDATE revenue_mappings 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
      `, [...updateValues, mappingId]);
    }

    await client.query("COMMIT");

    // Log the action
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'update_mapping', 'revenue_mapping', $2)
    `, [req.user.id, JSON.stringify({
      mappingId,
      updatedFields: Object.keys(req.body)
    })]);

    res.json({
      success: true,
      message: "Revenue mapping updated successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update revenue mapping error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update revenue mapping"
    });
  } finally {
    client.release();
  }
});

// POST /api/revenue/preview - Preview revenue upload with mapping
router.post("/preview", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const { file, mapping, platform } = req.body;
    
    if (!file || !mapping || !platform) {
      return res.status(400).json({
        success: false,
        message: "File, mapping, and platform are required"
      });
    }

    // Parse the base64 file
    const buffer = Buffer.from(file.split(',')[1], 'base64');
    const XLSX = require("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Get mapping
    let parsedMapping;
    try {
      parsedMapping = typeof mapping === 'string' ? JSON.parse(mapping) : mapping;
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: "Invalid mapping format"
      });
    }

    // Apply mapping and preview results
    const preview = [];
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    const mappedHeaders = Object.keys(parsedMapping);
    const unmappedHeaders = headers.filter(header => !mappedHeaders.some(mapped => 
      parsedMapping[mapped].includes(header)
    ));

    for (let i = 0; i < Math.min(data.length, 10); i++) {
      const row = data[i];
      const normalized = {};
      
      // Apply mapping
      Object.keys(parsedMapping).forEach(targetField => {
        const sourceFields = parsedMapping[targetField];
        if (Array.isArray(sourceFields)) {
          for (const header of sourceFields) {
            if (row[header] !== undefined && row[header] !== null && row[header] !== '') {
              normalized[targetField] = String(row[header]).trim();
              break;
            }
          }
        } else if (row[sourceFields] !== undefined && row[sourceFields] !== null && row[sourceFields] !== '') {
          normalized[targetField] = String(row[sourceFields]).trim();
        }
      });

      preview.push({
        row: i + 2,
        original: row,
        mapped: normalized,
        isValid: Object.keys(normalized).length > 0
      });
    }

    res.json({
      success: true,
      data: {
        totalRows: data.length,
        previewRows: preview.length,
        headers,
        mappedHeaders,
        unmappedHeaders,
        mapping: parsedMapping,
        platform,
        preview
      }
    });
  } catch (error) {
    console.error("Revenue preview error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to preview revenue data"
    });
  } finally {
    client.release();
  }
});

// DELETE /api/revenue/mappings/:id - Delete revenue mapping
router.delete("/:id", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    const mappingId = req.params.id;
    
    // Check if mapping exists and is not default
    const existingMapping = await client.query(
      "SELECT id, is_default FROM revenue_mappings WHERE id = $1",
      [mappingId]
    );
    
    if (existingMapping.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Revenue mapping not found"
      });
    }
    
    if (existingMapping.rows[0].is_default) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete default revenue mapping"
      });
    }

    await client.query("BEGIN");
    
    // Check if mapping is in use
    const usageCheck = await client.query(
      "SELECT COUNT(*) as count FROM raw_revenues WHERE mapping_id = $1",
      [mappingId]
    );
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete mapping that is in use"
      });
    }

    await client.query("DELETE FROM revenue_mappings WHERE id = $1", [mappingId]);
    
    // Log the action
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'delete_mapping', 'revenue_mapping', $2)
    `, [req.user.id, JSON.stringify({
      mappingId
    })]);

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Revenue mapping deleted successfully"
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete revenue mapping error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to delete revenue mapping"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
