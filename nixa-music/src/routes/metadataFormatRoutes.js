const express = require("express");
const pool = require("../config/db");
const { verifyToken, onlyAdmin } = require("../middleware/authMiddleware");
const { ensureManagementSchema } = require("../services/management/managementSchema");

const router = express.Router();

const normalizeText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const normalizeBoolean = (value) => value === true || value === "true" || value === "1" || value === "on";

// GET /api/metadata-formats - Get all metadata formats
router.get("/", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureManagementSchema();
    
    const result = await client.query(`
      SELECT 
        mf.*,
        array_agg(
          json_build_object(
            'id', mff.id,
            'field_key', mff.field_key,
            'field_label', mff.field_label,
            'field_type', mff.field_type,
            'is_required', mff.is_required,
            'field_order', mff.field_order,
            'validation_rules', mff.validation_rules,
            'options', mff.options
          ) ORDER BY mff.field_order
        ) as fields
      FROM metadata_formats mf
      LEFT JOIN metadata_format_fields mff ON mf.id = mff.format_id
      WHERE mf.enabled = true
      GROUP BY mf.id, mf.key, mf.label, mf.description, mf.enabled, mf.is_default, mf.created_by, mf.created_at, mf.updated_at
      ORDER BY mf.is_default DESC, mf.created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Get metadata formats error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch metadata formats"
    });
  } finally {
    client.release();
  }
});

// GET /api/metadata-formats/:id - Get specific metadata format
router.get("/:id", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const formatResult = await pool.query(
      `
      SELECT * FROM metadata_formats 
      WHERE id = $1 OR key = $2
      `,
      [req.params.id, req.params.id]
    );

    if (formatResult.rows.length === 0) {
      return res.status(404).json({ message: "Metadata format not found." });
    }

    const format = formatResult.rows[0];
    const fieldsResult = await pool.query(
      `
      SELECT * FROM metadata_format_fields 
      WHERE format_id = $1 
      ORDER BY field_order ASC, field_name ASC
      `,
      [format.id]
    );

    res.json({
      ...format,
      fields: fieldsResult.rows
    });
  } catch (error) {
    console.error("Get metadata format error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch metadata format." });
  }
});

// POST /api/metadata-formats - Create new metadata format (Admin only)
router.post("/", verifyToken, onlyAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureManagementSchema();
    
    const { key, label, description, enabled = true, is_default = false, fields = [] } = req.body;
    
    // Validate required fields
    if (!key || !label) {
      return res.status(400).json({
        success: false,
        message: "Key and label are required"
      });
    }

    await client.query("BEGIN");
    
    // Create metadata format
    const formatResult = await client.query(`
      INSERT INTO metadata_formats (key, label, description, enabled, is_default, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, key, label, description, enabled, is_default, created_at
    `, [key, label, description, enabled, is_default, req.user.id]);

    const formatId = formatResult.rows[0].id;
    
    // Create fields
    for (const field of fields) {
      const { field_key, field_label, field_type, is_required = false, field_order = 0, validation_rules = {}, options = {} } = field;
      
      await client.query(`
        INSERT INTO metadata_format_fields 
        (format_id, field_key, field_label, field_type, is_required, field_order, validation_rules, options, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      `, [
        formatId, field_key, field_label, field_type, is_required, field_order, 
        JSON.stringify(validation_rules), JSON.stringify(options)
      ]);
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Metadata format created successfully",
      data: formatResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create metadata format error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create metadata format"
    });
  } finally {
    client.release();
  }
});

// PUT /api/metadata-formats/:id - Update metadata format (Admin only)
router.put("/:id", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can update metadata formats." });
    }

    const { name, description, enabled, is_default, fields = [] } = req.body;

    // Check if format exists
    const existingFormat = await client.query(
      "SELECT * FROM metadata_formats WHERE id = $1 OR key = $2",
      [req.params.id, req.params.id]
    );

    if (existingFormat.rows.length === 0) {
      return res.status(404).json({ message: "Metadata format not found." });
    }

    await client.query("BEGIN");

    // If setting as default, unset other defaults
    if (is_default && !existingFormat.rows[0].is_default) {
      await client.query("UPDATE metadata_formats SET is_default = false");
    }

    // Update format
    const updateResult = await client.query(
      `
      UPDATE metadata_formats 
      SET name = COALESCE($1, name),
          description = $2,
          enabled = COALESCE($3, enabled),
          is_default = COALESCE($4, is_default),
          updated_by = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [name, normalizeText(description), enabled, is_default, req.user.id, existingFormat.rows[0].id]
    );

    const format = updateResult.rows[0];

    // Update fields if provided
    if (fields.length > 0) {
      // Delete existing fields
      await client.query("DELETE FROM metadata_format_fields WHERE format_id = $1", [format.id]);

      // Create new fields
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        await client.query(
          `
          INSERT INTO metadata_format_fields (
            format_id, field_name, field_key, field_type, is_required, 
            field_order, options, description, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          `,
          [
            format.id,
            normalizeText(field.field_name),
            field.field_key || field.field_name?.toLowerCase().replace(/\s+/g, "_"),
            field.field_type || "text",
            field.is_required || false,
            i + 1,
            field.options ? JSON.stringify(field.options) : null,
            normalizeText(field.description)
          ]
        );
      }
    }

    await client.query("COMMIT");

    res.json({
      message: "Metadata format updated successfully.",
      format: {
        ...format,
        fields
      }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update metadata format error:", error);
    res.status(500).json({ message: error.message || "Failed to update metadata format." });
  } finally {
    client.release();
  }
});

// DELETE /api/metadata-formats/:id - Delete metadata format (Admin only)
router.delete("/:id", verifyToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can delete metadata formats." });
    }

    // Check if format exists and is not default
    const existingFormat = await client.query(
      "SELECT * FROM metadata_formats WHERE id = $1 OR key = $2",
      [req.params.id, req.params.id]
    );

    if (existingFormat.rows.length === 0) {
      return res.status(404).json({ message: "Metadata format not found." });
    }

    if (existingFormat.rows[0].is_default) {
      return res.status(400).json({ message: "Cannot delete default metadata format." });
    }

    await client.query("BEGIN");

    // Delete fields first (foreign key constraint)
    await client.query("DELETE FROM metadata_format_fields WHERE format_id = $1", [existingFormat.rows[0].id]);

    // Delete format
    await client.query("DELETE FROM metadata_formats WHERE id = $1", [existingFormat.rows[0].id]);

    await client.query("COMMIT");

    res.json({ message: "Metadata format deleted successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete metadata format error:", error);
    res.status(500).json({ message: error.message || "Failed to delete metadata format." });
  } finally {
    client.release();
  }
});

// GET /api/metadata-formats/active - Get active/default format for uploads
router.get("/active", async (req, res) => {
  try {
    await ensureReleaseSchema();

    // Try to get default format first
    const defaultResult = await pool.query(
      `
      SELECT 
        mf.*,
        COUNT(mff.id) as field_count
      FROM metadata_formats mf
      LEFT JOIN metadata_format_fields mff ON mf.id = mff.format_id
      WHERE mf.is_default = true AND mf.enabled = true
      GROUP BY mf.id, mf.name, mf.key, mf.description, mf.enabled, mf.is_default, mf.created_at, mf.updated_at
      LIMIT 1
      `
    );

    if (defaultResult.rows.length > 0) {
      const format = defaultResult.rows[0];
      const fieldsResult = await pool.query(
        `
        SELECT * FROM metadata_format_fields 
        WHERE format_id = $1 
        ORDER BY field_order ASC, field_name ASC
        `,
        [format.id]
      );

      return res.json({
        ...format,
        fields: fieldsResult.rows,
        field_count: parseInt(format.field_count)
      });
    }

    // Fallback to first enabled format
    const fallbackResult = await pool.query(
      `
      SELECT 
        mf.*,
        COUNT(mff.id) as field_count
      FROM metadata_formats mf
      LEFT JOIN metadata_format_fields mff ON mf.id = mff.format_id
      WHERE mf.enabled = true
      GROUP BY mf.id, mf.name, mf.key, mf.description, mf.enabled, mf.is_default, mf.created_at, mf.updated_at
      ORDER BY mf.name ASC
      LIMIT 1
      `
    );

    if (fallbackResult.rows.length > 0) {
      const format = fallbackResult.rows[0];
      const fieldsResult = await pool.query(
        `
        SELECT * FROM metadata_format_fields 
        WHERE format_id = $1 
        ORDER BY field_order ASC, field_name ASC
        `,
        [format.id]
      );

      return res.json({
        ...format,
        fields: fieldsResult.rows,
        field_count: parseInt(format.field_count)
      });
    }

    // Final fallback to default hardcoded format
    res.json({
      id: null,
      name: "Default V2",
      key: "v2",
      description: "Default metadata format V2",
      enabled: true,
      is_default: true,
      fields: defaultMetadataFormats.formats.v2.required_fields.concat(defaultMetadataFormats.formats.v2.optional_fields).map((field, index) => ({
        field_name: field,
        field_key: field,
        field_type: "text",
        is_required: defaultMetadataFormats.formats.v2.required_fields.includes(field),
        field_order: index + 1,
        options: null,
        description: null
      })),
      field_count: defaultMetadataFormats.formats.v2.required_fields.length + defaultMetadataFormats.formats.v2.optional_fields.length
    });
  } catch (error) {
    console.error("Get active metadata format error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch active metadata format." });
  }
});

module.exports = router;
