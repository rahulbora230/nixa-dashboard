const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const XLSX = require("xlsx");
const pool = require("../../config/db");
const { verifyToken } = require("../../middleware/authMiddleware");
const { ensureReleaseSchema } = require("../../services/releaseSchema");
const {
  buildQcReport,
  calculateReleaseCompletion,
  calculateTrackCompletion,
  generateIsrc,
  normalizeMetadataStatus,
  slugify,
  toArray,
} = require("../../services/catalog/catalogEngine");
const {
  buildTemplateRows,
  defaultMetadataFormats,
  detectMetadataFormat,
  mapMetadataRow,
  parseDateValue,
  validateMetadataRow,
} = require("../../services/catalog/metadataFormats");
const { knownPlatforms, runAdvancedQc } = require("../../services/catalog/qcEngine");
const { createNotification } = require("../../services/notifications/notificationService");
const { getCatalogDailyPerformance } = require("../../services/daily/dailyService");

// Import controller functions
const {
  mapReleasePayload,
  mapTrackPayload,
  mapTrackPayloads,
  normalizeText,
  normalizeBoolean,
  normalizeStatus,
  normalizeReleaseType,
  isUuid,
  getLegacyUserId,
  isIntegerId
} = require("./release.controller");

// Import service functions
const {
  getReleaseById,
  getTracksByReleaseId,
  getReleaseScope,
  canReadRelease,
  canEditRelease,
  canEditMetadata,
  formatReleaseResponse,
  getReleasePlatformLinks,
  getReleaseFiles
} = require("./release.service");

// Import validation functions
const {
  allowedReleaseTypes,
  allowedDeliveryStatuses,
  allowedTakedownStatuses,
  allowedPlatforms,
  validateReleaseId,
  validateTrackPayload,
  validatePlatformLink,
  validateBulkStatusPayload,
  validatePlatformStatusPayload,
  validateMetadataUpload,
  phase9Statuses
} = require("./release.validation");

const router = express.Router();

const uploadRoot = path.resolve(process.cwd(), "uploads", "releases");
const artworkDir = path.join(uploadRoot, "artwork");
const audioDir = path.join(uploadRoot, "audio");
const artworkTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const audioTypes = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave"]);

fs.mkdirSync(artworkDir, { recursive: true });
fs.mkdirSync(audioDir, { recursive: true });

const normalizeStoredPath = (filePath) => path.relative(process.cwd(), filePath).replace(/\\/g, "/");

const getSafeFilePath = (storedPath) => {
  if (!storedPath) {
    return null;
  }

  const resolvedPath = path.resolve(process.cwd(), storedPath);
  const safeUploadRoot = path.resolve(process.cwd(), "uploads");

  if (!resolvedPath.startsWith(safeUploadRoot)) {
    return null;
  }

  return resolvedPath;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, file.fieldname === "artwork" ? artworkDir : audioDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();

    cb(null, `${Date.now()}-${base || file.fieldname}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (file.fieldname === "artwork") {
    const valid = artworkTypes.has(file.mimetype) && [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
    return cb(valid ? null : new Error("Artwork must be JPG, PNG, or WebP."), valid);
  }

  if (file.fieldname === "audio") {
    const valid = audioTypes.has(file.mimetype) && [".mp3", ".wav"].includes(ext);
    return cb(valid ? null : new Error("Audio must be MP3 or WAV."), valid);
  }

  return cb(new Error(`Unsupported upload field: ${file.fieldname}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    files: 51,
    fileSize: 100 * 1024 * 1024,
  },
}).fields([
  { name: "artwork", maxCount: 1 },
  { name: "audio", maxCount: 50 },
]);

const runUpload = (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) {
      return next();
    }

    const message =
      error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "Files must be smaller than 100 MB."
        : error.message;

    return res.status(400).json({ message });
  });
};

const metadataUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 20 * 1024 * 1024,
  },
});

// Apply authentication to all routes
router.use(verifyToken);

// GET /api/releases - List releases
router.get("/", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const scope = await getReleaseScope(req.user);
    const values = [...scope.values];
    const conditions = [];

    if (scope.clause) {
      conditions.push(scope.clause);
    }

    if (req.query.search) {
      values.push(`%${req.query.search.trim()}%`);
      const index = values.length;
      conditions.push(`
        (
          r.title ILIKE $${index}
          OR r.release_title ILIKE $${index}
          OR r.primary_artist ILIKE $${index}
          OR r.label_name ILIKE $${index}
          OR r.upc ILIKE $${index}
          OR EXISTS (
            SELECT 1 FROM tracks t
            WHERE t.release_id = r.id
              AND (t.isrc ILIKE $${index} OR t.title ILIKE $${index} OR t.song_name ILIKE $${index})
          )
        )
      `);
    }

    if (req.query.status) {
      values.push(req.query.status.toLowerCase());
      conditions.push(`r.status = $${values.length}`);
    }

    if (req.query.releaseType) {
      values.push(req.query.releaseType.toLowerCase());
      conditions.push(`r.release_type = $${values.length}`);
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const [releasesResult, countResult] = await Promise.all([
      pool.query(
        `
        SELECT 
          r.*,
          u.name as created_by_name
        FROM releases r
        LEFT JOIN users u ON r.created_by = u.id
        ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      ),
      pool.query(
        `
        SELECT COUNT(*) as total
        FROM releases r
        ${whereClause}
        `
      )
    ]);

    const releases = await Promise.all(
      releasesResult.rows.map(async (release) => {
        const tracks = await getTracksByReleaseId(release.id);
        return formatReleaseResponse(release, tracks);
      })
    );

    res.json({
      success: true,
      data: {
        releases,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit),
        },
        filters: {
          search,
          status,
          artist,
          label,
          genre,
          dateFrom,
          dateTo,
          sortBy,
          sortOrder
        }
      }
    });
  } catch (error) {
    console.error("List releases error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch releases."
    });
  }
});

// GET /api/releases/:id - Get single release
router.get("/:id", async (req, res) => {
  try {
    await ensureReleaseSchema();

    const validation = validateReleaseId(req.params.id);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.errors.join(", ") });
    }

    const release = await getReleaseById(req.params.id);
    if (!release) {
      return res.status(404).json({ message: "Release not found." });
    }

    if (!(await canReadRelease(req.user, release))) {
      return res.status(403).json({ message: "You do not have access to this release." });
    }

    const [tracks, platformLinks, files] = await Promise.all([
      getTracksByReleaseId(release.id),
      getReleasePlatformLinks(release.id),
      getReleaseFiles(release.id),
    ]);

    res.json({
      release: formatReleaseResponse(release, tracks),
      platform_links: platformLinks,
      files,
    });
  } catch (error) {
    console.error("Get release error:", error);
    res.status(500).json({ message: error.message || "Failed to fetch release." });
  }
});

// Draft management endpoints
router.post("/draft", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureReleaseSchema();
    
    const { tracks = [], ...releaseData } = req.body;
    const mappedRelease = mapReleasePayload({ ...releaseData, status: "draft" });
    const mappedTracks = mapTrackPayloads(tracks);
    
    const validation = validateReleasePayload(mappedRelease, mappedTracks);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors
      });
    }

    await client.query("BEGIN");
    
    const releaseResult = await client.query(
      `INSERT INTO releases (
        release_type, release_title, primary_artist, label_name, genre, language,
        release_date, status, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, created_at`,
      [
        mappedRelease.release_type,
        mappedRelease.release_title,
        mappedRelease.primary_artist,
        mappedRelease.label_name,
        mappedRelease.genre,
        mappedRelease.language,
        mappedRelease.release_date,
        mappedRelease.status,
        req.user.id
      ]
    );

    const releaseId = releaseResult.rows[0].id;
    
    // Insert tracks
    for (const track of mappedTracks) {
      const trackValidation = validateTrackPayload(track);
      if (!trackValidation.valid) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Track validation failed: ${trackValidation.errors.join(", ")}`
        });
      }

      await client.query(
        `INSERT INTO tracks (
          release_id, track_title, primary_artist, isrc, track_number,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [releaseId, track.track_title, track.primary_artist, track.isrc, track.track_number || 1]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Draft saved successfully",
      data: { id: releaseId, status: "draft" }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Save draft error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to save draft"
    });
  } finally {
    client.release();
  }
});

router.patch("/:id/draft", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureReleaseSchema();
    
    const releaseId = req.params.id;
    const { tracks = [], ...updateData } = req.body;
    
    // Check if release exists and is a draft
    const existingRelease = await client.query(
      "SELECT id, status, created_by FROM releases WHERE id = $1",
      [releaseId]
    );
    
    if (existingRelease.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Release not found"
      });
    }
    
    const release = existingRelease.rows[0];
    
    // Check permissions
    if (release.created_by !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own drafts"
      });
    }
    
    if (release.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Only drafts can be edited"
      });
    }

    const mappedRelease = mapReleasePayload({ ...updateData, status: "draft" });
    const mappedTracks = mapTrackPayloads(tracks);
    
    const validation = validateReleasePayload(mappedRelease, mappedTracks);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors
      });
    }

    await client.query("BEGIN");
    
    // Update release
    await client.query(
      `UPDATE releases SET 
        release_type = $1, release_title = $2, primary_artist = $3, label_name = $4,
        genre = $5, language = $6, release_date = $7, updated_at = NOW()
      WHERE id = $8`,
      [
        mappedRelease.release_type,
        mappedRelease.release_title,
        mappedRelease.primary_artist,
        mappedRelease.label_name,
        mappedRelease.genre,
        mappedRelease.language,
        mappedRelease.release_date,
        releaseId
      ]
    );

    // Update tracks (replace existing)
    await client.query("DELETE FROM tracks WHERE release_id = $1", [releaseId]);
    
    for (const track of mappedTracks) {
      const trackValidation = validateTrackPayload(track);
      if (!trackValidation.valid) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Track validation failed: ${trackValidation.errors.join(", ")}`
        });
      }

      await client.query(
        `INSERT INTO tracks (
          release_id, track_title, primary_artist, isrc, track_number,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [releaseId, track.track_title, track.primary_artist, track.isrc, track.track_number || 1]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Draft updated successfully",
      data: { id: releaseId, status: "draft" }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update draft error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to update draft"
    });
  } finally {
    client.release();
  }
});

router.post("/:id/submit", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureReleaseSchema();
    
    const releaseId = req.params.id;
    
    // Check if release exists and is a draft
    const existingRelease = await client.query(
      "SELECT id, status, created_by FROM releases WHERE id = $1",
      [releaseId]
    );
    
    if (existingRelease.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Release not found"
      });
    }
    
    const release = existingRelease.rows[0];
    
    // Check permissions
    if (release.created_by !== req.user.id && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only submit your own drafts"
      });
    }
    
    if (release.status !== "draft") {
      return res.status(400).json({
        success: false,
        message: "Only drafts can be submitted"
      });
    }

    // Validate complete release before submission
    const fullRelease = await getReleaseById(releaseId);
    const validation = validateReleasePayload(fullRelease, fullRelease.tracks);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: "Please fix validation errors before submitting",
        errors: validation.errors
      });
    }

    await client.query("BEGIN");
    
    await client.query(
      "UPDATE releases SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() WHERE id = $1",
      [releaseId]
    );

    // Log submission
    await client.query(
      `INSERT INTO release_status_logs (release_id, from_status, to_status, notes, changed_by, created_at)
       VALUES ($1, 'draft', 'submitted', 'Submitted for review', $2, NOW())`,
      [releaseId, req.user.id]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "Release submitted for review",
      data: { id: releaseId, status: "submitted" }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Submit release error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to submit release"
    });
  } finally {
    client.release();
  }
});

// GET /api/releases/export - Export metadata
router.get("/export", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await ensureReleaseSchema();
    
    // Extract export parameters
    const { format = "xlsx", search = '', status = '', artist = '', label = '', genre = '', dateFrom = '', dateTo = '' } = req.query;
    
    // Build WHERE conditions
    const conditions = [];
    const values = [];
    let paramCount = 1;

    // Add release scope
    conditions.push(getReleaseScope(req.user));

    // Add search condition
    if (search) {
      conditions.push(`(
        r.release_title ILIKE $${paramCount} OR 
        r.primary_artist ILIKE $${paramCount + 1} OR 
        r.label_name ILIKE $${paramCount + 2} OR
        r.upc ILIKE $${paramCount + 3}
      )`);
      values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      paramCount += 3;
    }

    // Add filters
    if (status) {
      conditions.push(`r.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (artist) {
      conditions.push(`r.primary_artist ILIKE $${paramCount}`);
      values.push(`%${artist}%`);
      paramCount++;
    }

    if (label) {
      conditions.push(`r.label_name ILIKE $${paramCount}`);
      values.push(`%${label}%`);
      paramCount++;
    }

    if (genre) {
      conditions.push(`r.genre ILIKE $${paramCount}`);
      values.push(`%${genre}%`);
      paramCount++;
    }

    if (dateFrom) {
      conditions.push(`r.release_date >= $${paramCount}`);
      values.push(dateFrom);
      paramCount++;
    }

    if (dateTo) {
      conditions.push(`r.release_date <= $${paramCount}`);
      values.push(dateTo);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query releases with tracks
    const releasesResult = await client.query(`
      SELECT 
        r.*,
        u.name as created_by_name,
        array_agg(
          json_build_object(
            'id', t.id,
            'track_title', t.track_title,
            'primary_artist', t.primary_artist,
            'featuring_artist', t.featuring_artist,
            'isrc', t.isrc,
            'iswc', t.iswc,
            'composer', t.composer,
            'lyricist', t.lyricist,
            'producer', t.producer,
            'explicit', t.explicit,
            'instrumental', t.instrumental,
            'track_number', t.track_number,
            'duration', t.duration,
            'preview_start_time', t.preview_start_time
          ) ORDER BY t.track_number
        ) as tracks
      FROM releases r
      LEFT JOIN users u ON r.created_by = u.id
      LEFT JOIN tracks t ON r.id = t.release_id
      ${whereClause}
      GROUP BY r.id, u.name
      ORDER BY r.created_at DESC
    `, values);

    // Format data for export
    const exportData = [];
    for (const release of releasesResult.rows) {
      const releaseData = {
        'Release ID': release.id,
        'Release Title': release.release_title,
        'Primary Artist': release.primary_artist,
        'Featuring Artist': release.featuring_artist || '',
        'Label': release.label_name,
        'Genre': release.genre,
        'Language': release.language,
        'Release Date': release.release_date,
        'UPC': release.upc || '',
        'Status': release.status,
        'Created By': release.created_by_name,
        'Created At': release.created_at,
        'Updated At': release.updated_at
      };

      // Add track data
      if (release.tracks) {
        for (let i = 0; i < release.tracks.length; i++) {
          const track = release.tracks[i];
          releaseData[`Track ${i + 1} - Title`] = track.track_title;
          releaseData[`Track ${i + 1} - Artist`] = track.primary_artist;
          releaseData[`Track ${i + 1} - Featuring Artist`] = track.featuring_artist || '';
          releaseData[`Track ${i + 1} - ISRC`] = track.isrc || '';
          releaseData[`Track ${i + 1} - Composer`] = track.composer || '';
          releaseData[`Track ${i + 1} - Lyricist`] = track.lyricist || '';
          releaseData[`Track ${i + 1} - Producer`] = track.producer || '';
          releaseData[`Track ${i + 1} - Explicit`] = track.explicit ? 'Yes' : 'No';
          releaseData[`Track ${i + 1} - Duration`] = track.duration || '';
        }
      }

      exportData.push(releaseData);
    }

    // Generate and send file
    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Release Metadata Export");

      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=release_metadata_export.xlsx");
      res.send(buffer);
    } else if (format === 'csv') {
      const csv = convertToCSV(exportData);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=release_metadata_export.csv");
      res.send(csv);
    } else {
      res.status(400).json({
        success: false,
        message: "Invalid export format. Use 'xlsx' or 'csv'."
      });
    }
  } catch (error) {
    console.error("Export releases error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export releases"
    });
  } finally {
    client.release();
  }
});

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = data.map(row => 
    headers.map(header => `"${String(row[header] || '').replace(/"/g, '""')}"`).join(',')
  );
  
  return [headers.join(','), ...csvRows].join('\n');
};

module.exports = router;
