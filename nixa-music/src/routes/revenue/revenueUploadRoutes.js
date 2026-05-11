const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("../../config/db");
const { verifyToken, onlyAdmin } = require("../../middleware/authMiddleware");
const { ensureFinanceSchema } = require("../../services/finance/financeSchema");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/csv",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel and CSV files are allowed"), false);
    }
  },
});

// Revenue upload engine with header mapping
const platformMappings = {
  'spotify': 'Spotify',
  'apple_music': 'Apple Music',
  'youtube_music': 'YouTube Music',
  'jiosaavn': 'JioSaavn',
  'wynk': 'Wynk',
  'amazon': 'Amazon Music',
  'instagram': 'Instagram',
  'facebook': 'Facebook',
  'boomplay': 'Boomplay'
};

const normalizeRevenueData = (row, mapping) => {
  const normalized = {};
  
  // Apply header mapping
  Object.keys(mapping).forEach(targetField => {
    const sourceFields = mapping[targetField];
    if (Array.isArray(sourceFields)) {
      // Try each possible header
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

  // Normalize numeric fields
  if (normalized.streams) {
    normalized.streams = parseFloat(String(normalized.streams).replace(/,/g, '')) || 0;
  }
  if (normalized.revenue) {
    normalized.revenue = parseFloat(String(normalized.revenue).replace(/,/g, '')) || 0;
  }

  return normalized;
};

// POST /api/revenue/upload - Upload revenue report
router.post("/upload", verifyToken, onlyAdmin, upload.single("file"), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureFinanceSchema();
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const { reportMonth, platform, mappingId } = req.body;
    
    if (!reportMonth) {
      return res.status(400).json({
        success: false,
        message: "Report month is required"
      });
    }

    // Get mapping if provided
    let mapping = {};
    if (mappingId) {
      const mappingResult = await client.query(
        "SELECT * FROM revenue_mappings WHERE id = $1",
        [mappingId]
      );
      
      if (mappingResult.rows.length > 0) {
        mapping = mappingResult.rows[0].mapping;
      }
    }

    // Default mapping if no custom mapping
    if (Object.keys(mapping).length === 0) {
      mapping = {
        isrc: ['ISRC', 'ISRC Code', 'ISRC'],
        upc: ['UPC', 'UPC Code', 'UPC'],
        track_title: ['Track Title', 'Song Title', 'Track Name', 'Song Name'],
        release_title: ['Release Title', 'Album Title', 'Release Name', 'Album Name'],
        artist_name: ['Artist', 'Primary Artist', 'Artist Name', 'Main Artist'],
        label_name: ['Label', 'Label Name', 'Record Label'],
        platform: ['Platform', 'Store', 'Service'],
        country: ['Country', 'Territory', 'Region'],
        streams: ['Streams', 'Plays', 'Count'],
        revenue: ['Revenue', 'Earnings', 'Amount', 'Sales'],
        currency: ['Currency', 'Amount'],
        report_month: ['Report Month', 'Month', 'Period'],
        report_date: ['Report Date', 'Date']
      };
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const processedRows = [];
    const errors = [];
    const warnings = [];

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel row numbers start from 2
      
      try {
        const normalized = normalizeRevenueData(row, mapping);
        
        // Validate required fields
        const validationErrors = [];
        
        if (!normalized.report_month) {
          validationErrors.push("Report month is required");
        }
        
        if (!normalized.platform) {
          validationErrors.push("Platform is required");
        }
        
        if (!normalized.revenue && normalized.revenue <= 0) {
          validationErrors.push("Revenue must be greater than 0");
        }
        
        if (normalized.streams && normalized.streams < 0) {
          validationErrors.push("Streams cannot be negative");
        }

        if (validationErrors.length > 0) {
          errors.push({
            row: rowNumber,
            errors: validationErrors,
            data: row
          });
        } else {
          processedRows.push({
            rowNumber,
            data: normalized,
            isValid: true
          });
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          errors: [`Processing error: ${error.message}`],
          data: row
        });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed. Please fix errors and re-upload.",
        errors,
        warnings,
        processedRows: processedRows.length
      });
    }

    // Save valid rows to raw_revenues table
    await client.query("BEGIN");
    const savedRows = [];

    for (const row of processedRows) {
      if (!row.isValid) continue;

      const revenueData = {
        ...row.data,
        report_month,
        platform: platformMappings[row.data.platform?.toLowerCase()] || row.data.platform,
        mapping_id: mappingId || null,
        created_by: req.user.id,
        source_file: req.file.originalname,
        created_at: new Date().toISOString().split('T')[0]
      };

      const result = await client.query(`
        INSERT INTO raw_revenues (
          isrc, upc, track_title, release_title, artist_name, label_name,
          platform, country, streams, revenue, currency, report_month, report_date,
          mapping_id, created_by, source_file, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING id
      `, [
        revenueData.isrc || null,
        revenueData.upc || null,
        revenueData.track_title,
        revenueData.release_title,
        revenueData.artist_name,
        revenueData.label_name,
        revenueData.platform,
        revenueData.country || null,
        revenueData.streams || 0,
        revenueData.revenue || 0,
        revenueData.currency || 'USD',
        revenueData.report_month,
        revenueData.report_date || new Date().toISOString().split('T')[0],
        revenueData.mapping_id,
        revenueData.created_by,
        revenueData.source_file
      ]);

      savedRows.push({
        id: result.rows[0].id,
        rowNumber: row.rowNumber,
        isrc: revenueData.isrc,
        trackTitle: revenueData.track_title
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Processed ${data.length} rows. Saved ${savedRows.length} revenue records.`,
      data: {
        totalRows: data.length,
        validRows: processedRows.length,
        savedRows: savedRows.length,
        errors,
        warnings,
        mapping: mapping
      }
    });

    // Log upload
    await client.query(`
      INSERT INTO finance_audit_logs (user_id, action, entity_type, metadata)
      VALUES ($1, 'revenue_upload', 'raw_revenue', $2)
    `, [req.user.id, JSON.stringify({
      filename: req.file.originalname,
      reportMonth,
      platform,
      totalRows: data.length,
      validRows: processedRows.length,
      savedRows: savedRows.length,
      errors: errors.length,
      mappingId: mappingId || null
    })]);

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Revenue upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process revenue upload"
    });
  } finally {
    client.release();
  }
});

module.exports = router;
