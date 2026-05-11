const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const path = require("path");
const fs = require("fs");
const pool = require("../../config/db");
const { verifyToken } = require("../../middleware/authMiddleware");
const { ensureReleaseSchema } = require("../../services/releaseSchema");
const {
  buildTemplateRows,
  defaultMetadataFormats,
  detectMetadataFormat,
} = require("../../services/catalog/metadataFormats");

// Import controller functions
const {
  mapReleasePayload,
  mapTrackPayload,
  mapTrackPayloads,
  normalizeText,
  normalizeBoolean,
  isUuid,
  getLegacyUserId
} = require("./release.controller");

// Import service functions
const {
  getReleaseScope,
  formatReleaseResponse
} = require("./release.service");

const router = express.Router();

const uploadRoot = path.resolve(process.cwd(), "uploads", "releases");
const artworkDir = path.join(uploadRoot, "artwork");
const audioDir = path.join(uploadRoot, "audio");
const artworkTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const audioTypes = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"]);

const metadataUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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

// Template download endpoints
router.get("/templates/v1", verifyToken, async (req, res) => {
  try {
    const templateData = [
      {
        "Release Title": "Example Release",
        "Track Title": "Example Song",
        "Primary Artist": "Artist Name",
        "Featuring Artist": "",
        "Label": "Nixa Music",
        "Genre": "Pop",
        "Language": "Hindi",
        "Release Date": "2026-06-01",
        "UPC": "",
        "ISRC": "INN892600001",
        "Composer": "",
        "Lyricist": "",
        "Producer": "",
        "Explicit": "false",
        "Copyright": " 2026 Nixa Music",
        "Publishing": "Nixa Music Publishing"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metadata V1 Template");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=metadata_v1_template.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("Download V1 template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download V1 template"
    });
  }
});

router.get("/templates/v2", verifyToken, async (req, res) => {
  try {
    const templateData = [
      {
        "Release Title": "Example Release",
        "Track Title": "Example Song",
        "Primary Artist": "Artist Name",
        "Featuring Artist": "",
        "Remixer": "",
        "Label": "Nixa Music",
        "Genre": "Pop",
        "Language": "Hindi",
        "Release Date": "2026-06-01",
        "UPC": "",
        "ISRC": "INN892600001",
        "ISWC": "",
        "Composer": "",
        "Lyricist": "",
        "Producer": "",
        "Director": "",
        "Star Cast": "",
        "Description": "",
        "Explicit": "false",
        "Instrumental": "false",
        "Copyright": " 2026 Nixa Music",
        "Publishing": "Nixa Music Publishing"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Metadata V2 Template");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=metadata_v2_template.xlsx");
    res.send(buffer);
  } catch (error) {
    console.error("Download V2 template error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download V2 template"
    });
  }
});

// Dedicated V1/V2 bulk upload endpoints
router.post("/v1", verifyToken, metadataUpload.single("file"), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureReleaseSchema();
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded." 
      });
    }

    const { saveAsDraft = true } = req.body;
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const processedRows = [];
    const errors = [];
    const warnings = [];

    // V1 specific field mapping
    const v1FieldMap = {
      "Release Title": "release_title",
      "Track Title": "track_title",
      "Primary Artist": "primary_artist",
      "Featuring Artist": "featuring_artist",
      "Label": "label_name",
      "Genre": "genre",
      "Language": "language",
      "Release Date": "release_date",
      "UPC": "upc",
      "ISRC": "isrc",
      "Composer": "composer",
      "Lyricist": "lyricist",
      "Producer": "producer",
      "Explicit": "explicit",
      "Copyright": "copyright",
      "Publishing": "publishing"
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel row numbers start from 2
      
      try {
        const mappedRow = {};
        Object.keys(v1FieldMap).forEach(excelField => {
          const value = row[excelField];
          if (value !== undefined && value !== null) {
            mappedRow[v1FieldMap[excelField]] = String(value).trim();
          }
        });

        const validation = validateReleasePayload(mappedRow);
        if (!validation.valid) {
          errors.push({
            row: rowNumber,
            errors: validation.errors
          });
        } else {
          processedRows.push({
            rowNumber,
            data: mappedRow,
            isValid: true
          });
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          errors: [`Row processing error: ${error.message}`]
        });
      }
    }

    if (errors.length > 0 && !saveAsDraft) {
      return res.status(400).json({
        success: false,
        message: "Validation failed. Fix errors or save as draft.",
        errors,
        warnings,
        processedRows
      });
    }

    // Save valid rows as draft releases
    await client.query("BEGIN");
    const createdReleases = [];

    for (const row of processedRows) {
      if (!row.isValid) continue;

      const releaseData = {
        ...row.data,
        status: saveAsDraft ? "draft" : "submitted",
        created_by: req.user.id,
        current_owner: String(req.user.id),
        metadata_format_version: "v1"
      };

      const releaseResult = await client.query(
        `INSERT INTO releases (
          release_type, release_title, primary_artist, featuring_artist, label_name,
          genre, language, release_date, upc, isrc, composer, lyricist,
          producer, explicit, copyright, publishing, status, created_by,
          created_at, updated_at, metadata_format_version
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, NOW(), NOW(), $18
        ) RETURNING id`,
        [
          releaseData.release_type || "single",
          releaseData.release_title,
          releaseData.primary_artist,
          releaseData.featuring_artist,
          releaseData.label_name,
          releaseData.genre,
          releaseData.language,
          releaseData.release_date,
          releaseData.upc,
          releaseData.isrc,
          releaseData.composer,
          releaseData.lyricist,
          releaseData.producer,
          releaseData.explicit || false,
          releaseData.copyright,
          releaseData.publishing,
          releaseData.status,
          releaseData.created_by,
          releaseData.metadata_format_version
        ]
      );

      createdReleases.push({
        id: releaseResult.rows[0].id,
        rowNumber: row.rowNumber,
        title: releaseData.release_title
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Processed ${data.length} rows. Created ${createdReleases.length} releases.`,
      data: {
        totalRows: data.length,
        validRows: processedRows.length,
        createdReleases,
        errors,
        warnings
      }
    });

    // Log bulk upload
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, metadata)
       VALUES ($1, 'bulk_upload_v1', 'release', $2)`,
      [req.user.id, JSON.stringify({
        format: "v1",
        trackCount: data.length,
        saveAsDraft,
        source: "bulk_metadata_upload_v1"
      })]
    );

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk V1 upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process V1 bulk upload"
    });
  } finally {
    client.release();
  }
});

router.post("/v2", verifyToken, metadataUpload.single("file"), async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureReleaseSchema();
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded." 
      });
    }

    const { saveAsDraft = true } = req.body;
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const processedRows = [];
    const errors = [];
    const warnings = [];

    // V2 specific field mapping
    const v2FieldMap = {
      "Release Title": "release_title",
      "Track Title": "track_title",
      "Primary Artist": "primary_artist",
      "Featuring Artist": "featuring_artist",
      "Remixer": "remixer",
      "Label": "label_name",
      "Genre": "genre",
      "Language": "language",
      "Release Date": "release_date",
      "UPC": "upc",
      "ISRC": "isrc",
      "ISWC": "iswc",
      "Composer": "composer",
      "Lyricist": "lyricist",
      "Producer": "producer",
      "Director": "director",
      "Star Cast": "star_cast",
      "Description": "description",
      "Explicit": "explicit",
      "Instrumental": "instrumental",
      "Copyright": "copyright",
      "Publishing": "publishing"
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel row numbers start from 2
      
      try {
        const mappedRow = {};
        Object.keys(v2FieldMap).forEach(excelField => {
          const value = row[excelField];
          if (value !== undefined && value !== null) {
            mappedRow[v2FieldMap[excelField]] = String(value).trim();
          }
        });

        const validation = validateReleasePayload(mappedRow);
        if (!validation.valid) {
          errors.push({
            row: rowNumber,
            errors: validation.errors
          });
        } else {
          processedRows.push({
            rowNumber,
            data: mappedRow,
            isValid: true
          });
        }
      } catch (error) {
        errors.push({
          row: rowNumber,
          errors: [`Row processing error: ${error.message}`]
        });
      }
    }

    if (errors.length > 0 && !saveAsDraft) {
      return res.status(400).json({
        success: false,
        message: "Validation failed. Fix errors or save as draft.",
        errors,
        warnings,
        processedRows
      });
    }

    // Save valid rows as draft releases
    await client.query("BEGIN");
    const createdReleases = [];

    for (const row of processedRows) {
      if (!row.isValid) continue;

      const releaseData = {
        ...row.data,
        status: saveAsDraft ? "draft" : "submitted",
        created_by: req.user.id,
        current_owner: String(req.user.id),
        metadata_format_version: "v2"
      };

      const releaseResult = await client.query(
        `INSERT INTO releases (
          release_type, release_title, primary_artist, featuring_artist, remixer, label_name,
          genre, language, release_date, upc, isrc, iswc, composer, lyricist,
          producer, director, star_cast, description, explicit, instrumental, copyright,
          publishing, status, created_by, created_at, updated_at, metadata_format_version
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW(), $23
        ) RETURNING id`,
        [
          releaseData.release_type || "single",
          releaseData.release_title,
          releaseData.primary_artist,
          releaseData.featuring_artist,
          releaseData.remixer,
          releaseData.label_name,
          releaseData.genre,
          releaseData.language,
          releaseData.release_date,
          releaseData.upc,
          releaseData.isrc,
          releaseData.iswc,
          releaseData.composer,
          releaseData.lyricist,
          releaseData.producer,
          releaseData.director,
          releaseData.star_cast,
          releaseData.description,
          releaseData.explicit || false,
          releaseData.instrumental || false,
          releaseData.copyright,
          releaseData.publishing,
          releaseData.status,
          releaseData.created_by,
          releaseData.metadata_format_version
        ]
      );

      createdReleases.push({
        id: releaseResult.rows[0].id,
        rowNumber: row.rowNumber,
        title: releaseData.release_title
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Processed ${data.length} rows. Created ${createdReleases.length} releases.`,
      data: {
        totalRows: data.length,
        validRows: processedRows.length,
        createdReleases,
        errors,
        warnings
      }
    });

    // Log bulk upload
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, metadata)
       VALUES ($1, 'bulk_upload_v2', 'release', $2)`,
      [req.user.id, JSON.stringify({
        format: "v2",
        trackCount: data.length,
        saveAsDraft,
        source: "bulk_metadata_upload_v2"
      })]
    );

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk V2 upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to process V2 bulk upload"
    });
  } finally {
    client.release();
  }
});

// POST /api/releases/bulk/metadata - Upload bulk metadata from Excel/CSV
router.post("/bulk/metadata", metadataUpload.single("file"), async (req, res) => {
  const client = await pool.connect();

  try {
    await ensureReleaseSchema();

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const { format = "auto", saveAsDraft = true } = req.body;
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    if (!rows.length) {
      return res.status(400).json({ message: "Uploaded file is empty." });
    }

    const detectedFormat = detectMetadataFormat(rows, format);
    const validationContext = { seenIsrcs: new Set(), seenUpcs: new Set() };
    const processedRows = [];
    const errors = [];
    const warnings = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row numbers start from 2 (1 is header)
      
      try {
        const mapped = mapMetadataRow(row, detectedFormat);
        const validation = validateMetadataRow(mapped, detectedFormat, defaultMetadataFormats, validationContext);
        
        processedRows.push({
          rowNumber: rowNum,
          data: mapped.normalized,
          validation: {
            errors: validation.errors,
            warnings: validation.warnings,
            unknownHeaders: validation.unknownHeaders
          }
        });

        if (validation.errors.length > 0) {
          errors.push(`Row ${rowNum}: ${validation.errors.join(", ")}`);
        }
        if (validation.warnings.length > 0) {
          warnings.push(`Row ${rowNum}: ${validation.warnings.join(", ")}`);
        }
      } catch (error) {
        errors.push(`Row ${rowNum}: ${error.message}`);
      }
    }

    if (errors.length > 0 && !saveAsDraft) {
      return res.status(400).json({
        message: "Validation failed. Fix errors or save as draft.",
        errors,
        warnings,
        processedRows
      });
    }

    await client.query("BEGIN");

    // Group rows by release to create releases with multiple tracks
    const releaseGroups = new Map();
    processedRows.forEach(row => {
      const releaseKey = `${row.data.release_title}_${row.data.primary_artist}_${row.data.label_name}`;
      if (!releaseGroups.has(releaseKey)) {
        releaseGroups.set(releaseKey, []);
      }
      releaseGroups.get(releaseKey).push(row);
    });

    const createdReleases = [];
    let releaseCounter = 1;

    for (const [releaseKey, tracks] of releaseGroups) {
      const firstTrack = tracks[0].data;
      const releasePayload = {
        release_type: tracks.length > 1 ? "album" : "single",
        title: firstTrack.release_title,
        primary_artist: firstTrack.primary_artist,
        label_name: firstTrack.label_name,
        genre: firstTrack.genre,
        language: firstTrack.language,
        status: saveAsDraft ? "draft" : "submitted",
        created_by: req.user.id,
        current_owner: String(req.user.id),
        metadata_format_version: detectedFormat
      };

      // Create release
      const releaseResult = await client.query(
        `
        INSERT INTO releases (title, release_title, primary_artist, label_name, genre, language, 
                           release_type, status, created_by, current_owner, metadata_format_version, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
        RETURNING id
        `,
        [
          releasePayload.title,
          releasePayload.title,
          releasePayload.primary_artist,
          releasePayload.label_name,
          releasePayload.genre,
          releasePayload.language,
          releasePayload.release_type,
          releasePayload.status,
          releasePayload.created_by,
          releasePayload.current_owner,
          releasePayload.metadata_format_version
        ]
      );

      const releaseId = releaseResult.rows[0].id;

      // Create tracks
      for (const trackData of tracks) {
        const trackPayload = {
          release_id: releaseId,
          title: trackData.data.track_title,
          song_name: trackData.data.track_title,
          primary_artist: trackData.data.primary_artist,
          featuring_artist: trackData.data.featuring_artist,
          remixer: trackData.data.remixer,
          isrc: trackData.data.isrc,
          iswc: trackData.data.iswc,
          genre: trackData.data.genre,
          language: trackData.data.language,
          composer: trackData.data.composer,
          lyricist: trackData.data.lyricist,
          producer: trackData.data.producer,
          director: trackData.data.director,
          star_cast: trackData.data.star_cast,
          description: trackData.data.description,
          explicit: trackData.data.explicit,
          instrumental: trackData.data.instrumental,
          preview_start_time: trackData.data.preview_start_time,
          crbt_title: trackData.data.crbt_title,
          crbt_start_time_1: trackData.data.crbt_start_time_1,
          crbt_start_time_2: trackData.data.crbt_start_time_2,
          dolby_atmos: trackData.data.dolby_atmos,
          track_number: trackData.data.track_number || (tracks.indexOf(trackData) + 1)
        };

        await client.query(
          `
          INSERT INTO tracks (release_id, title, song_name, primary_artist, featuring_artist, remixer,
                           isrc, iswc, genre, language, composer, lyricist, producer, director,
                           star_cast, description, explicit, instrumental, preview_start_time,
                           crbt_title, crbt_start_time_1, crbt_start_time_2, dolby_atmos, track_number, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
                  $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), NOW())
          `,
          [
            trackPayload.release_id, trackPayload.title, trackPayload.song_name, trackPayload.primary_artist,
            trackPayload.featuring_artist, trackPayload.remixer, trackPayload.isrc, trackPayload.iswc,
            trackPayload.genre, trackPayload.language, trackPayload.composer, trackPayload.lyricist,
            trackPayload.producer, trackPayload.director, trackPayload.star_cast, trackPayload.description,
            trackPayload.explicit, trackPayload.instrumental, trackPayload.preview_start_time,
            trackPayload.crbt_title, trackPayload.crbt_start_time_1, trackPayload.crbt_start_time_2,
            trackPayload.dolby_atmos, trackPayload.track_number
          ]
        );
      }

      // Log bulk import
      await client.query(
        `
        INSERT INTO audit_logs (user_id, action, entity_type, entity_id, metadata)
        VALUES ($1, 'release.bulk_import', 'release', $2, $3)
        `,
        [
          req.user.id,
          releaseId,
          JSON.stringify({
            format: detectedFormat,
            trackCount: tracks.length,
            saveAsDraft,
            source: "bulk_metadata_upload"
          })
        ]
      );

      createdReleases.push({
        id: releaseId,
        title: releasePayload.title,
        trackCount: tracks.length,
        status: releasePayload.status
      });

      releaseCounter++;
    }

    await client.query("COMMIT");

    res.json({
      message: `Successfully created ${createdReleases.length} releases with ${processedRows.length} tracks.`,
      format: detectedFormat,
      releases: createdReleases,
      processedRows: processedRows.length,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Bulk metadata upload error:", error);
    res.status(500).json({ message: error.message || "Failed to process bulk metadata upload." });
  } finally {
    client.release();
  }
});

module.exports = router;
