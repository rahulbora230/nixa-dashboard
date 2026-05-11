const crypto = require("crypto");
const fs = require("fs");
const XLSX = require("xlsx");
const pool = require("../../config/db");
const { ensureDailySchema } = require("./dailySchema");

const MAX_EXPORT_ROWS = 50000;
const DEFAULT_CURRENCY = "INR";
const DEFAULT_PAYOUT_RATE = 0.8;

const PLATFORM_ALIASES = new Map([
  ["spotify", "Spotify"],
  ["apple", "Apple Music"],
  ["apple music", "Apple Music"],
  ["itunes", "Apple Music"],
  ["youtube", "YouTube"],
  ["youtube music", "YouTube Music"],
  ["yt music", "YouTube Music"],
  ["meta", "Meta"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["amazon", "Amazon Music"],
  ["amazon music", "Amazon Music"],
  ["jiosaavn", "JioSaavn"],
  ["saavn", "JioSaavn"],
  ["wynk", "Wynk"],
  ["boomplay", "Boomplay"],
]);

const HEADER_MAP = {
  isrc: ["ISRC", "isrc", "isrc code", "track isrc"],
  upc: ["UPC", "upc", "barcode", "release upc"],
  trackTitle: ["Track Title", "Track", "Title", "Song Name", "track_title", "song_name", "track name"],
  artistName: ["Artist", "Artist Name", "Primary Artist", "artist_name", "primary_artist"],
  platform: ["Platform", "DSP", "Store", "Service", "platform"],
  country: ["Country", "Territory", "Country Code", "country"],
  city: ["City", "Region City", "city"],
  streams: ["Streams", "Stream", "Plays", "Play Count", "plays", "streams"],
  listeners: ["Listeners", "Unique Listeners", "listener", "listeners"],
  saves: ["Saves", "Saved", "Library Adds", "saves"],
  shares: ["Shares", "Share", "shares"],
  playlistAdds: ["Playlist Adds", "Playlist adds", "Playlist Adds Count", "playlist_adds", "playlist adds"],
  followers: ["Followers", "Follower Count", "followers"],
  reportDate: ["Report Date", "Date", "Activity Date", "Stream Date", "report_date", "date"],
  monthlyListeners: ["Monthly Listeners", "monthly_listeners"],
  profileViews: ["Profile Views", "profile_views"],
  playlistReach: ["Playlist Reach", "playlist_reach"],
};

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
};

const toInteger = (value) => Math.round(toNumber(value));

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};

const normalizeCountry = (value) => {
  const country = cleanText(value);
  if (!country) {
    return "GLOBAL";
  }

  return country.length <= 3 ? country.toUpperCase() : country;
};

const canonicalPlatform = (value) => {
  const platform = cleanText(value);
  if (!platform) {
    return "Others";
  }

  return PLATFORM_ALIASES.get(platform.toLowerCase()) || platform;
};

const safeUnlink = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const hashFile = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const parseDateValue = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }

  const text = cleanText(value);
  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{4}-\d{2}$/.test(text)) {
    return `${text}-01`;
  }

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
};

const getHeaderValue = (row, names) => {
  const entries = Object.entries(row || {});
  const lowerNames = names.map((name) => String(name).trim().toLowerCase());
  const exact = entries.find(([key]) => lowerNames.includes(String(key).trim().toLowerCase()));

  if (exact) {
    return exact[1];
  }

  const loose = entries.find(([key]) => {
    const normalized = String(key).trim().toLowerCase().replace(/[_-]+/g, " ");
    return lowerNames.includes(normalized);
  });

  return loose?.[1];
};

const readWorkbookRows = (filePath) => {
  const workbook = XLSX.readFile(filePath, { cellDates: true, dateNF: "yyyy-mm-dd" });
  const rows = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
      raw: false,
      dateNF: "yyyy-mm-dd",
    });

    sheetRows.forEach((row, index) => {
      rows.push({
        ...row,
        __sheet_name: sheetName,
        __row_number: index + 2,
      });
    });
  });

  return rows;
};

const normalizeDailyRows = (rows, { platform, reportDate }) =>
  rows.map((row, index) => {
    const rowReportDate = parseDateValue(getHeaderValue(row, HEADER_MAP.reportDate)) || reportDate;
    const rowPlatform = canonicalPlatform(getHeaderValue(row, HEADER_MAP.platform) || platform);

    return {
      rowNumber: Number(row.__row_number || index + 2),
      isrc: cleanText(getHeaderValue(row, HEADER_MAP.isrc)).replace(/-/g, "").toUpperCase(),
      upc: cleanText(getHeaderValue(row, HEADER_MAP.upc)),
      trackTitle: cleanText(getHeaderValue(row, HEADER_MAP.trackTitle)),
      artistName: cleanText(getHeaderValue(row, HEADER_MAP.artistName)),
      platform: rowPlatform,
      country: normalizeCountry(getHeaderValue(row, HEADER_MAP.country)),
      city: cleanText(getHeaderValue(row, HEADER_MAP.city)) || "Unknown",
      streams: toInteger(getHeaderValue(row, HEADER_MAP.streams)),
      listeners: toInteger(getHeaderValue(row, HEADER_MAP.listeners)),
      saves: toInteger(getHeaderValue(row, HEADER_MAP.saves)),
      shares: toInteger(getHeaderValue(row, HEADER_MAP.shares)),
      playlistAdds: toInteger(getHeaderValue(row, HEADER_MAP.playlistAdds)),
      followers: toInteger(getHeaderValue(row, HEADER_MAP.followers)),
      monthlyListeners: toInteger(getHeaderValue(row, HEADER_MAP.monthlyListeners)),
      profileViews: toInteger(getHeaderValue(row, HEADER_MAP.profileViews)),
      playlistReach: toInteger(getHeaderValue(row, HEADER_MAP.playlistReach)),
      reportDate: rowReportDate,
      rawData: row,
    };
  });

const hashDailyRow = (row) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        isrc: row.isrc,
        upc: row.upc,
        trackTitle: row.trackTitle,
        artistName: row.artistName,
        platform: row.platform,
        country: row.country,
        city: row.city,
        streams: row.streams,
        listeners: row.listeners,
        saves: row.saves,
        shares: row.shares,
        playlistAdds: row.playlistAdds,
        followers: row.followers,
        reportDate: row.reportDate,
      })
    )
    .digest("hex");

const getArtistIdsForUser = async (client, user) => {
  if (!isUuid(user?.id)) {
    return [];
  }

  const values = [user.id];
  const checks = ["user_id = $1"];

  if (user.name) {
    values.push(user.name);
    checks.push(`artist_name ILIKE $${values.length}`);
  }

  const result = await client.query(`SELECT id FROM artists WHERE ${checks.join(" OR ")}`, values);
  return result.rows.map((row) => row.id).filter(isUuid);
};

const getLabelIdsForUser = async (client, user) => {
  if (!isUuid(user?.id)) {
    return [];
  }

  const values = [user.id];
  const checks = ["user_id = $1"];

  if (user.name) {
    values.push(user.name);
    checks.push(`(label_name ILIKE $${values.length} OR name ILIKE $${values.length})`);
  }

  const result = await client.query(`SELECT id FROM labels WHERE ${checks.join(" OR ")}`, values);
  return result.rows.map((row) => row.id).filter(isUuid);
};

const getArtistIdsForLabels = async (client, labelIds) => {
  if (!labelIds.length) {
    return [];
  }

  const result = await client.query(
    `
    SELECT DISTINCT artist_id
    FROM artist_label_map
    WHERE label_id = ANY($1::uuid[])
      AND COALESCE(status, 'active') = 'active'
    UNION
    SELECT DISTINCT id AS artist_id
    FROM artists
    WHERE label_id = ANY($1::uuid[])
    `,
    [labelIds]
  );

  return result.rows.map((row) => row.artist_id).filter(isUuid);
};

const findArtistByName = async (client, artistName) => {
  if (!artistName) {
    return null;
  }

  const result = await client.query(
    `
    SELECT id
    FROM artists
    WHERE artist_name ILIKE $1
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
    `,
    [artistName]
  );

  return result.rows[0]?.id || null;
};

const findLabelByName = async (client, labelName) => {
  if (!labelName) {
    return null;
  }

  const result = await client.query(
    `
    SELECT id
    FROM labels
    WHERE label_name ILIKE $1 OR name ILIKE $1
    ORDER BY created_at DESC NULLS LAST
    LIMIT 1
    `,
    [labelName]
  );

  return result.rows[0]?.id || null;
};

const findLabelForArtist = async (client, artistId) => {
  if (!isUuid(artistId)) {
    return null;
  }

  const result = await client.query(
    `
    SELECT COALESCE(a.label_id, alm.label_id) AS label_id
    FROM artists a
    LEFT JOIN LATERAL (
      SELECT label_id
      FROM artist_label_map
      WHERE artist_id = a.id
        AND COALESCE(status, 'active') = 'active'
      ORDER BY assigned_at DESC NULLS LAST
      LIMIT 1
    ) alm ON true
    WHERE a.id = $1
    LIMIT 1
    `,
    [artistId]
  );

  return result.rows[0]?.label_id || null;
};

const resolveTrackMatch = async (client, row) => {
  if (!row.isrc && !(row.upc && row.trackTitle)) {
    return null;
  }

  const result = await client.query(
    `
    SELECT
      t.id,
      t.release_id,
      t.isrc,
      COALESCE(t.song_name, t.title) AS track_title,
      t.primary_artist AS track_primary_artist,
      t.owner_type,
      t.owner_id,
      r.artist_id AS release_artist_id,
      r.owner_id AS release_owner_id,
      r.label_name,
      r.primary_artist AS release_primary_artist,
      r.upc
    FROM tracks t
    LEFT JOIN releases r ON r.id = t.release_id
    WHERE ($1::text <> '' AND UPPER(t.isrc) = UPPER($1))
       OR (
        $2::text <> ''
        AND UPPER(COALESCE(r.upc, '')) = UPPER($2)
        AND COALESCE(t.song_name, t.title, '') ILIKE $3
       )
    ORDER BY t.created_at DESC NULLS LAST
    LIMIT 1
    `,
    [row.isrc || "", row.upc || "", row.trackTitle ? `%${row.trackTitle}%` : "%"]
  );

  const track = result.rows[0];
  if (!track) {
    return null;
  }

  let artistId = null;
  let labelId = null;

  if (track.owner_type === "artist" && isUuid(track.owner_id)) {
    artistId = track.owner_id;
  }

  if (track.owner_type === "label" && isUuid(track.owner_id)) {
    labelId = track.owner_id;
  }

  if (!artistId && isUuid(track.release_artist_id)) {
    artistId = track.release_artist_id;
  }

  if (!artistId) {
    artistId = await findArtistByName(
      client,
      row.artistName || track.track_primary_artist || track.release_primary_artist
    );
  }

  if (!labelId) {
    labelId = await findLabelByName(client, track.label_name);
  }

  if (!labelId && artistId) {
    labelId = await findLabelForArtist(client, artistId);
  }

  return {
    trackId: track.id,
    releaseId: track.release_id,
    artistId,
    labelId: isUuid(labelId) ? labelId : null,
    isrc: track.isrc || row.isrc || null,
    upc: track.upc || row.upc || null,
    trackTitle: track.track_title || row.trackTitle,
    artistName: row.artistName || track.track_primary_artist || track.release_primary_artist,
  };
};

const getEstimatedRpm = async (client, platform, country) => {
  const result = await client.query(
    `
    SELECT rpm, currency
    FROM estimated_rpm_settings
    WHERE LOWER(platform) = LOWER($1)
      AND UPPER(country) IN (UPPER($2), 'GLOBAL')
    ORDER BY CASE WHEN UPPER(country) = UPPER($2) THEN 0 ELSE 1 END
    LIMIT 1
    `,
    [platform || "Others", country || "GLOBAL"]
  );

  return {
    rpm: toNumber(result.rows[0]?.rpm || 1),
    currency: result.rows[0]?.currency || DEFAULT_CURRENCY,
  };
};

const insertActivityLog = async (client, user, action, entityType, entityId, metadata = {}) => {
  try {
    await client.query(
      `
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata_json)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [isUuid(user?.id) ? user.id : null, action, entityType, isUuid(entityId) ? entityId : null, metadata]
    );
  } catch (error) {
    console.warn("Daily activity log skipped:", error.message);
  }
};

const insertArtistAggregate = async (client, row, match, estimate) => {
  if (!isUuid(match.artistId)) {
    return;
  }

  await client.query(
    `
    INSERT INTO daily_artist_analytics (
      artist_id,
      label_id,
      platform,
      country,
      city,
      streams,
      listeners,
      saves,
      shares,
      playlist_adds,
      followers,
      monthly_listeners,
      profile_views,
      playlist_reach,
      report_date,
      raw_data_json,
      estimated_revenue,
      estimated_payout,
      currency
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
    ON CONFLICT (artist_id, report_date, platform, country, city)
    DO UPDATE SET
      label_id = COALESCE(daily_artist_analytics.label_id, EXCLUDED.label_id),
      streams = COALESCE(daily_artist_analytics.streams, 0) + EXCLUDED.streams,
      listeners = COALESCE(daily_artist_analytics.listeners, 0) + EXCLUDED.listeners,
      saves = COALESCE(daily_artist_analytics.saves, 0) + EXCLUDED.saves,
      shares = COALESCE(daily_artist_analytics.shares, 0) + EXCLUDED.shares,
      playlist_adds = COALESCE(daily_artist_analytics.playlist_adds, 0) + EXCLUDED.playlist_adds,
      followers = GREATEST(COALESCE(daily_artist_analytics.followers, 0), EXCLUDED.followers),
      monthly_listeners = GREATEST(COALESCE(daily_artist_analytics.monthly_listeners, 0), EXCLUDED.monthly_listeners),
      profile_views = COALESCE(daily_artist_analytics.profile_views, 0) + EXCLUDED.profile_views,
      playlist_reach = GREATEST(COALESCE(daily_artist_analytics.playlist_reach, 0), EXCLUDED.playlist_reach),
      estimated_revenue = COALESCE(daily_artist_analytics.estimated_revenue, 0) + EXCLUDED.estimated_revenue,
      estimated_payout = COALESCE(daily_artist_analytics.estimated_payout, 0) + EXCLUDED.estimated_payout,
      raw_data_json = EXCLUDED.raw_data_json
    `,
    [
      match.artistId,
      match.labelId,
      row.platform,
      row.country,
      row.city,
      row.streams,
      row.listeners,
      row.saves,
      row.shares,
      row.playlistAdds,
      row.followers,
      row.monthlyListeners,
      row.profileViews,
      row.playlistReach,
      row.reportDate,
      row.rawData,
      estimate.estimatedRevenue,
      estimate.estimatedPayout,
      estimate.currency,
    ]
  );
};

const processDailyReportFile = async ({ file, user, platform, reportDate }) => {
  await ensureDailySchema();

  const uploadPlatform = canonicalPlatform(platform);
  const uploadReportDate = parseDateValue(reportDate);

  if (!uploadReportDate) {
    safeUnlink(file.path);
    throw new Error("Report date is required.");
  }

  const fileHash = hashFile(file.path);
  const existingImport = await pool.query(
    `
    SELECT *
    FROM daily_report_imports
    WHERE file_hash = $1 AND platform = $2 AND report_date = $3
    LIMIT 1
    `,
    [fileHash, uploadPlatform, uploadReportDate]
  );

  if (existingImport.rows[0]) {
    safeUnlink(file.path);
    return {
      duplicateImport: true,
      import: mapDailyImport(existingImport.rows[0]),
      summary: {
        totalRows: 0,
        importedRows: 0,
        duplicateRows: 0,
        failedRows: 0,
        unmatchedRows: 0,
      },
    };
  }

  const rawRows = readWorkbookRows(file.path);
  const normalizedRows = normalizeDailyRows(rawRows, {
    platform: uploadPlatform,
    reportDate: uploadReportDate,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const importResult = await client.query(
      `
      INSERT INTO daily_report_imports (
        file_name,
        file_hash,
        platform,
        report_date,
        uploaded_by,
        total_rows,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,'processing')
      RETURNING *
      `,
      [
        file.originalname,
        fileHash,
        uploadPlatform,
        uploadReportDate,
        isUuid(user?.id) ? user.id : null,
        normalizedRows.length,
      ]
    );

    const importRow = importResult.rows[0];
    const errors = [];
    const touchedTrackIds = new Set();
    let importedRows = 0;
    let duplicateRows = 0;
    let failedRows = 0;
    let unmatchedRows = 0;

    for (const row of normalizedRows) {
      const rowErrors = [];

      if (!row.reportDate) rowErrors.push("Report date is missing.");
      if (!row.platform) rowErrors.push("Platform is missing.");
      if (!row.isrc && !(row.upc && row.trackTitle)) rowErrors.push("ISRC or UPC plus track title is required.");

      if (rowErrors.length) {
        failedRows += 1;
        errors.push({ rowNumber: row.rowNumber, errors: rowErrors });
        continue;
      }

      const sourceRowHash = hashDailyRow(row);
      const duplicateResult = await client.query(
        "SELECT id FROM daily_track_analytics WHERE source_row_hash = $1 LIMIT 1",
        [sourceRowHash]
      );

      if (duplicateResult.rows[0]) {
        duplicateRows += 1;
        continue;
      }

      const match = await resolveTrackMatch(client, row);
      const rpmSetting = await getEstimatedRpm(client, row.platform, row.country);
      const estimatedRevenue = Number(((row.streams / 1000) * rpmSetting.rpm).toFixed(6));
      const estimatedPayout = Number((estimatedRevenue * DEFAULT_PAYOUT_RATE).toFixed(6));
      const estimate = { estimatedRevenue, estimatedPayout, currency: rpmSetting.currency };
      const matchedPayload = match || {
        trackId: null,
        releaseId: null,
        artistId: null,
        labelId: null,
        isrc: row.isrc || null,
        upc: row.upc || null,
        trackTitle: row.trackTitle,
        artistName: row.artistName,
      };

      const insertResult = await client.query(
        `
        INSERT INTO daily_track_analytics (
          import_id,
          track_id,
          release_id,
          artist_id,
          label_id,
          isrc,
          upc,
          platform,
          country,
          city,
          streams,
          listeners,
          saves,
          shares,
          playlist_adds,
          followers,
          report_date,
          raw_data_json,
          track_title,
          artist_name,
          estimated_revenue,
          estimated_payout,
          currency,
          source_row_hash,
          row_number
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
        ON CONFLICT DO NOTHING
        RETURNING id
        `,
        [
          importRow.id,
          matchedPayload.trackId,
          matchedPayload.releaseId,
          matchedPayload.artistId,
          matchedPayload.labelId,
          matchedPayload.isrc,
          matchedPayload.upc,
          row.platform,
          row.country,
          row.city,
          row.streams,
          row.listeners,
          row.saves,
          row.shares,
          row.playlistAdds,
          row.followers,
          row.reportDate,
          row.rawData,
          matchedPayload.trackTitle,
          matchedPayload.artistName,
          estimatedRevenue,
          estimatedPayout,
          estimate.currency,
          sourceRowHash,
          row.rowNumber,
        ]
      );

      if (!insertResult.rowCount) {
        duplicateRows += 1;
        continue;
      }

      if (!match) {
        unmatchedRows += 1;
        continue;
      }

      importedRows += 1;
      touchedTrackIds.add(match.trackId);
      await insertArtistAggregate(client, row, match, estimate);
    }

    if (touchedTrackIds.size) {
      await generateTrendAlerts(client, {
        trackIds: Array.from(touchedTrackIds),
        reportDate: uploadReportDate,
      });
    }

    const status =
      importedRows === 0 && failedRows === normalizedRows.length
        ? "failed"
        : duplicateRows || failedRows || unmatchedRows
          ? "partial"
          : "imported";

    const updatedImport = await client.query(
      `
      UPDATE daily_report_imports
      SET imported_rows = $1,
          duplicate_rows = $2,
          failed_rows = $3,
          unmatched_rows = $4,
          status = $5,
          error_log = $6,
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
      `,
      [importedRows, duplicateRows, failedRows, unmatchedRows, status, JSON.stringify(errors.slice(0, 100)), importRow.id]
    );

    await insertActivityLog(client, user, "daily_report_imported", "daily_report_import", importRow.id, {
      fileName: file.originalname,
      platform: uploadPlatform,
      reportDate: uploadReportDate,
      importedRows,
      duplicateRows,
      failedRows,
      unmatchedRows,
    });

    await client.query("COMMIT");
    safeUnlink(file.path);

    return {
      duplicateImport: false,
      import: mapDailyImport(updatedImport.rows[0]),
      summary: {
        totalRows: normalizedRows.length,
        importedRows,
        duplicateRows,
        failedRows,
        unmatchedRows,
        errors: errors.slice(0, 25),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    safeUnlink(file.path);
    throw error;
  } finally {
    client.release();
  }
};

const metricGrowth = (current, previous) => {
  const currentValue = toNumber(current);
  const previousValue = toNumber(previous);

  if (previousValue <= 0) {
    return currentValue > 0 ? 100 : 0;
  }

  return Number((((currentValue - previousValue) / previousValue) * 100).toFixed(2));
};

const insertTrendAlert = async (client, alert) => {
  await client.query(
    `
    INSERT INTO trend_alerts (
      track_id,
      artist_id,
      alert_type,
      title,
      description,
      metric,
      old_value,
      new_value,
      growth_percentage
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,
    [
      alert.trackId,
      alert.artistId,
      alert.alertType,
      alert.title,
      alert.description,
      alert.metric,
      alert.oldValue,
      alert.newValue,
      alert.growthPercentage,
    ]
  );
};

const generateTrendAlerts = async (client, { trackIds, reportDate }) => {
  if (!trackIds.length || !reportDate) {
    return;
  }

  for (const trackId of trackIds) {
    const result = await client.query(
      `
      SELECT
        dta.track_id,
        dta.artist_id,
        COALESCE(dta.track_title, t.song_name, t.title, dta.isrc, 'Track') AS title,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date = $2::date), 0) AS today_streams,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date = $2::date - INTERVAL '1 day'), 0) AS yesterday_streams,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date BETWEEN $2::date - INTERVAL '6 days' AND $2::date), 0) AS current_7,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date BETWEEN $2::date - INTERVAL '13 days' AND $2::date - INTERVAL '7 days'), 0) AS previous_7,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date BETWEEN $2::date - INTERVAL '27 days' AND $2::date), 0) AS current_28,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date BETWEEN $2::date - INTERVAL '55 days' AND $2::date - INTERVAL '28 days'), 0) AS previous_28
      FROM daily_track_analytics dta
      LEFT JOIN tracks t ON t.id = dta.track_id
      WHERE dta.track_id = $1
      GROUP BY dta.track_id, dta.artist_id, COALESCE(dta.track_title, t.song_name, t.title, dta.isrc, 'Track')
      LIMIT 1
      `,
      [trackId, reportDate]
    );

    const row = result.rows[0];
    if (!row) {
      continue;
    }

    const today = toNumber(row.today_streams);
    const previous7 = toNumber(row.previous_7);
    const current7 = toNumber(row.current_7);
    const previous28 = toNumber(row.previous_28);
    const current28 = toNumber(row.current_28);
    const avgPrevious7 = previous7 / 7;
    const growth7 = metricGrowth(current7, previous7);
    const growth28 = metricGrowth(current28, previous28);
    const title = row.title;

    if (current7 >= 100 && growth7 >= 50) {
      await insertTrendAlert(client, {
        trackId,
        artistId: row.artist_id,
        alertType: "trending_track",
        title: `${title} is trending`,
        description: `${title} grew ${growth7}% over the previous 7-day window.`,
        metric: "streams_7d",
        oldValue: previous7,
        newValue: current7,
        growthPercentage: growth7,
      });
    }

    if (avgPrevious7 > 0 && today >= avgPrevious7 * 2 && today >= 50) {
      await insertTrendAlert(client, {
        trackId,
        artistId: row.artist_id,
        alertType: "stream_spike",
        title: `${title} stream spike`,
        description: `Daily streams are more than double the previous 7-day average.`,
        metric: "daily_streams",
        oldValue: avgPrevious7,
        newValue: today,
        growthPercentage: metricGrowth(today, avgPrevious7),
      });
    }

    if (avgPrevious7 >= 50 && today <= avgPrevious7 * 0.5) {
      await insertTrendAlert(client, {
        trackId,
        artistId: row.artist_id,
        alertType: "stream_drop",
        title: `${title} stream drop`,
        description: `Daily streams fell below half of the previous 7-day average.`,
        metric: "daily_streams",
        oldValue: avgPrevious7,
        newValue: today,
        growthPercentage: metricGrowth(today, avgPrevious7),
      });
    }

    if (previous7 > 0 && growth7 >= 30) {
      await insertTrendAlert(client, {
        trackId,
        artistId: row.artist_id,
        alertType: "growth_7d",
        title: `${title} 7-day growth`,
        description: `${title} increased ${growth7}% over the previous 7 days.`,
        metric: "streams_7d",
        oldValue: previous7,
        newValue: current7,
        growthPercentage: growth7,
      });
    }

    if (previous28 > 0 && growth28 >= 40) {
      await insertTrendAlert(client, {
        trackId,
        artistId: row.artist_id,
        alertType: "growth_28d",
        title: `${title} 28-day growth`,
        description: `${title} increased ${growth28}% over the previous 28 days.`,
        metric: "streams_28d",
        oldValue: previous28,
        newValue: current28,
        growthPercentage: growth28,
      });
    }

    const growthRows = await client.query(
      `
      WITH scoped AS (
        SELECT platform, country, streams, report_date
        FROM daily_track_analytics
        WHERE track_id = $1
      )
      SELECT
        'platform_growth' AS alert_type,
        COALESCE(platform, 'Others') AS dimension,
        COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $2::date - INTERVAL '6 days' AND $2::date), 0) AS current_value,
        COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $2::date - INTERVAL '13 days' AND $2::date - INTERVAL '7 days'), 0) AS previous_value
      FROM scoped
      GROUP BY COALESCE(platform, 'Others')
      UNION ALL
      SELECT
        'country_growth' AS alert_type,
        COALESCE(country, 'GLOBAL') AS dimension,
        COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $2::date - INTERVAL '6 days' AND $2::date), 0) AS current_value,
        COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $2::date - INTERVAL '13 days' AND $2::date - INTERVAL '7 days'), 0) AS previous_value
      FROM scoped
      GROUP BY COALESCE(country, 'GLOBAL')
      `,
      [trackId, reportDate]
    );

    for (const growthRow of growthRows.rows) {
      const growth = metricGrowth(growthRow.current_value, growthRow.previous_value);
      const currentValue = toNumber(growthRow.current_value);

      if (growth >= 50 && currentValue >= 100) {
        await insertTrendAlert(client, {
          trackId,
          artistId: row.artist_id,
          alertType: growthRow.alert_type,
          title: `${growthRow.dimension} growth for ${title}`,
          description: `${growthRow.dimension} streams grew ${growth}% over the previous 7-day window.`,
          metric: "streams_7d",
          oldValue: growthRow.previous_value,
          newValue: currentValue,
          growthPercentage: growth,
        });
      }
    }
  }
};

const applyRoleScope = async (client, { user, conditions, values, alias = "dta" }) => {
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (["admin", "accountant"].includes(user?.role)) {
    return;
  }

  if (user?.role === "artist") {
    const artistIds = await getArtistIdsForUser(client, user);
    conditions.push(artistIds.length ? `${alias}.artist_id = ANY(${add(artistIds)}::uuid[])` : "FALSE");
    return;
  }

  if (user?.role === "label") {
    const labelIds = await getLabelIdsForUser(client, user);
    const artistIds = await getArtistIdsForLabels(client, labelIds);
    const checks = [];

    if (labelIds.length) {
      checks.push(`${alias}.label_id = ANY(${add(labelIds)}::uuid[])`);
    }

    if (artistIds.length) {
      checks.push(`${alias}.artist_id = ANY(${add(artistIds)}::uuid[])`);
    }

    conditions.push(checks.length ? `(${checks.join(" OR ")})` : "FALSE");
    return;
  }

  conditions.push("FALSE");
};

const buildDailyFilters = async (
  client,
  { user, query = {}, forcedTrackId, forcedReleaseId, forcedArtistId, forcedLabelId, includeUnmatched = false }
) => {
  const conditions = [];
  const values = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (!includeUnmatched) {
    conditions.push("dta.track_id IS NOT NULL");
  }

  await applyRoleScope(client, { user, conditions, values, alias: "dta" });

  if (forcedTrackId) conditions.push(`dta.track_id = ${add(forcedTrackId)}`);
  if (forcedReleaseId) conditions.push(`dta.release_id = ${add(forcedReleaseId)}`);
  if (forcedArtistId) conditions.push(`dta.artist_id = ${add(forcedArtistId)}`);
  if (forcedLabelId) conditions.push(`dta.label_id = ${add(forcedLabelId)}`);

  if (query.importId && isUuid(query.importId)) {
    conditions.push(`dta.import_id = ${add(query.importId)}`);
  }

  if (query.platform) {
    conditions.push(`LOWER(dta.platform) = LOWER(${add(canonicalPlatform(query.platform))})`);
  }

  if (query.country) {
    conditions.push(`UPPER(dta.country) = UPPER(${add(query.country)})`);
  }

  const startDate = parseDateValue(query.startDate || query.from || query.dateFrom);
  const endDate = parseDateValue(query.endDate || query.to || query.dateTo);

  if (startDate) {
    conditions.push(`dta.report_date >= ${add(startDate)}::date`);
  }

  if (endDate) {
    conditions.push(`dta.report_date <= ${add(endDate)}::date`);
  }

  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    const placeholder = add(term);
    conditions.push(`
      (
        dta.isrc ILIKE ${placeholder}
        OR dta.upc ILIKE ${placeholder}
        OR COALESCE(dta.track_title, t.song_name, t.title) ILIKE ${placeholder}
        OR COALESCE(dta.artist_name, a.artist_name, r.primary_artist) ILIKE ${placeholder}
      )
    `);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const DAILY_FROM = `
  FROM daily_track_analytics dta
  LEFT JOIN tracks t ON t.id = dta.track_id
  LEFT JOIN releases r ON r.id = dta.release_id
  LEFT JOIN artists a ON a.id = dta.artist_id
  LEFT JOIN labels l ON l.id = dta.label_id
`;

const mapDailyImport = (row = {}) => ({
  id: row.id,
  fileName: row.file_name,
  platform: row.platform,
  reportDate: row.report_date,
  uploadedBy: row.uploaded_by,
  totalRows: toInteger(row.total_rows),
  importedRows: toInteger(row.imported_rows),
  duplicateRows: toInteger(row.duplicate_rows),
  failedRows: toInteger(row.failed_rows),
  unmatchedRows: toInteger(row.unmatched_rows),
  status: row.status,
  errorLog: row.error_log || [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapDailyRecord = (row = {}) => ({
  id: row.id,
  importId: row.import_id,
  trackId: row.track_id,
  releaseId: row.release_id,
  artistId: row.artist_id,
  labelId: row.label_id,
  isrc: row.isrc,
  upc: row.upc,
  trackTitle: row.track_title || row.catalog_track_title || "Unmatched track",
  artistName: row.artist_name || row.catalog_artist_name || "Unknown artist",
  releaseTitle: row.release_title,
  labelName: row.label_name,
  platform: row.platform || "Others",
  country: row.country || "GLOBAL",
  city: row.city || "Unknown",
  streams: toInteger(row.streams),
  listeners: toInteger(row.listeners),
  saves: toInteger(row.saves),
  shares: toInteger(row.shares),
  playlistAdds: toInteger(row.playlist_adds),
  followers: toInteger(row.followers),
  estimatedRevenue: toNumber(row.estimated_revenue),
  estimatedPayout: toNumber(row.estimated_payout),
  currency: row.currency || DEFAULT_CURRENCY,
  reportDate: row.report_date,
  createdAt: row.created_at,
  fileName: row.file_name,
});

const getDailyReportImports = async ({ query = {} }) => {
  await ensureDailySchema();

  const values = [];
  const conditions = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    conditions.push(`(file_name ILIKE ${add(term)} OR platform ILIKE $${values.length})`);
  }

  if (query.platform) {
    conditions.push(`LOWER(platform) = LOWER(${add(canonicalPlatform(query.platform))})`);
  }

  const reportDate = parseDateValue(query.reportDate);
  if (reportDate) {
    conditions.push(`report_date = ${add(reportDate)}::date`);
  }

  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || "12", 10), 1), 100);
  const offset = (page - 1) * limit;
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT *, COUNT(*) OVER() AS total_count
    FROM daily_report_imports
    ${where}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  const total = Number(result.rows[0]?.total_count || 0);

  return {
    imports: result.rows.map(mapDailyImport),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const listDailyRecords = async ({
  user,
  query = {},
  includeUnmatched = false,
  exportMode = false,
  forcedTrackId,
  forcedReleaseId,
  forcedArtistId,
  forcedLabelId,
}) => {
  await ensureDailySchema();
  const client = await pool.connect();

  try {
    const { where, values } = await buildDailyFilters(client, {
      user,
      query,
      includeUnmatched,
      forcedTrackId,
      forcedReleaseId,
      forcedArtistId,
      forcedLabelId,
    });
    const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
    const limit = exportMode
      ? MAX_EXPORT_ROWS
      : Math.min(Math.max(Number.parseInt(query.limit || "15", 10), 1), 100);
    const offset = (page - 1) * limit;
    const sortMap = {
      latest: "dta.report_date DESC, dta.created_at DESC",
      streams: "dta.streams DESC",
      listeners: "dta.listeners DESC",
      saves: "dta.saves DESC",
      estimated: "dta.estimated_revenue DESC",
    };
    const orderBy = sortMap[query.sort] || sortMap.latest;

    const result = await client.query(
      `
      SELECT
        dta.*,
        COALESCE(t.song_name, t.title) AS catalog_track_title,
        COALESCE(a.artist_name, r.primary_artist) AS catalog_artist_name,
        COALESCE(r.release_title, r.title) AS release_title,
        COALESCE(l.label_name, l.name, r.label_name) AS label_name,
        dri.file_name,
        COUNT(*) OVER() AS total_count
      ${DAILY_FROM}
      LEFT JOIN daily_report_imports dri ON dri.id = dta.import_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, limit, offset]
    );

    const total = Number(result.rows[0]?.total_count || 0);

    return {
      records: result.rows.map(mapDailyRecord),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    };
  } finally {
    client.release();
  }
};

const getUnmatchedRows = async ({ query = {} }) => {
  await ensureDailySchema();

  const values = [];
  const conditions = ["dta.track_id IS NULL"];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.platform) {
    conditions.push(`LOWER(dta.platform) = LOWER(${add(canonicalPlatform(query.platform))})`);
  }

  const reportDate = parseDateValue(query.reportDate);
  if (reportDate) {
    conditions.push(`dta.report_date = ${add(reportDate)}::date`);
  }

  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    const placeholder = add(term);
    conditions.push(`
      (
        dta.isrc ILIKE ${placeholder}
        OR dta.upc ILIKE ${placeholder}
        OR dta.track_title ILIKE ${placeholder}
        OR dta.artist_name ILIKE ${placeholder}
      )
    `);
  }

  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || "15", 10), 1), 100);
  const offset = (page - 1) * limit;

  const result = await pool.query(
    `
    SELECT dta.*, dri.file_name, COUNT(*) OVER() AS total_count
    FROM daily_track_analytics dta
    LEFT JOIN daily_report_imports dri ON dri.id = dta.import_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY dta.report_date DESC, dta.created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  const total = Number(result.rows[0]?.total_count || 0);

  return {
    records: result.rows.map(mapDailyRecord),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const getLatestDate = async (client, filters) => {
  const result = await client.query(
    `
    SELECT MAX(dta.report_date) AS latest_date
    ${DAILY_FROM}
    ${filters.where}
    `,
    filters.values
  );

  return result.rows[0]?.latest_date || null;
};

const mapBreakdown = (rows, key = "name") =>
  rows.map((row) => ({
    name: row[key] || row.name || "Unknown",
    streams: toInteger(row.streams),
    listeners: toInteger(row.listeners),
    saves: toInteger(row.saves),
    shares: toInteger(row.shares),
    playlistAdds: toInteger(row.playlist_adds),
    estimatedRevenue: toNumber(row.estimated_revenue),
    estimatedPayout: toNumber(row.estimated_payout),
  }));

const emptyOverview = () => ({
  latestReportDate: null,
  summary: {
    streams: 0,
    listeners: 0,
    saves: 0,
    shares: 0,
    playlistAdds: 0,
    followers: 0,
    estimatedRevenue: 0,
    estimatedPayout: 0,
    todayStreams: 0,
    yesterdayStreams: 0,
    last7Streams: 0,
    last28Streams: 0,
    growth7: 0,
    growth28: 0,
  },
  dailyTrend: [],
  platformBreakdown: [],
  countryBreakdown: [],
  cityBreakdown: [],
  topTracks: [],
  topArtists: [],
});

const getDailyAnalyticsOverview = async ({
  user,
  query = {},
  forcedTrackId,
  forcedReleaseId,
  forcedArtistId,
  forcedLabelId,
} = {}) => {
  await ensureDailySchema();
  const client = await pool.connect();

  try {
    const filters = await buildDailyFilters(client, {
      user,
      query,
      forcedTrackId,
      forcedReleaseId,
      forcedArtistId,
      forcedLabelId,
    });
    const latestDate = await getLatestDate(client, filters);

    if (!latestDate) {
      return emptyOverview();
    }

    const summaryResult = await client.query(
      `
      SELECT
        COALESCE(SUM(dta.streams), 0) AS streams,
        COALESCE(SUM(dta.listeners), 0) AS listeners,
        COALESCE(SUM(dta.saves), 0) AS saves,
        COALESCE(SUM(dta.shares), 0) AS shares,
        COALESCE(SUM(dta.playlist_adds), 0) AS playlist_adds,
        COALESCE(SUM(dta.followers), 0) AS followers,
        COALESCE(SUM(dta.estimated_revenue), 0) AS estimated_revenue,
        COALESCE(SUM(dta.estimated_payout), 0) AS estimated_payout,
        COUNT(DISTINCT dta.track_id) AS track_count,
        COUNT(DISTINCT dta.artist_id) AS artist_count
      ${DAILY_FROM}
      ${filters.where}
      `,
      filters.values
    );

    const periodResult = await client.query(
      `
      SELECT
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date = $${filters.values.length + 1}::date), 0) AS today_streams,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date = $${filters.values.length + 1}::date - INTERVAL '1 day'), 0) AS yesterday_streams,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '6 days' AND $${filters.values.length + 1}::date), 0) AS last_7_streams,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '13 days' AND $${filters.values.length + 1}::date - INTERVAL '7 days'), 0) AS previous_7_streams,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '27 days' AND $${filters.values.length + 1}::date), 0) AS last_28_streams,
        COALESCE(SUM(dta.streams) FILTER (WHERE dta.report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '55 days' AND $${filters.values.length + 1}::date - INTERVAL '28 days'), 0) AS previous_28_streams
      ${DAILY_FROM}
      ${filters.where}
      `,
      [...filters.values, latestDate]
    );

    const platformResult = await client.query(
      `
      SELECT
        COALESCE(dta.platform, 'Others') AS name,
        COALESCE(SUM(dta.streams), 0) AS streams,
        COALESCE(SUM(dta.listeners), 0) AS listeners,
        COALESCE(SUM(dta.saves), 0) AS saves,
        COALESCE(SUM(dta.shares), 0) AS shares,
        COALESCE(SUM(dta.playlist_adds), 0) AS playlist_adds,
        COALESCE(SUM(dta.estimated_revenue), 0) AS estimated_revenue,
        COALESCE(SUM(dta.estimated_payout), 0) AS estimated_payout
      ${DAILY_FROM}
      ${filters.where}
      GROUP BY COALESCE(dta.platform, 'Others')
      ORDER BY streams DESC
      LIMIT 12
      `,
      filters.values
    );

    const countryResult = await client.query(
      `
      SELECT
        COALESCE(dta.country, 'GLOBAL') AS name,
        COALESCE(SUM(dta.streams), 0) AS streams,
        COALESCE(SUM(dta.listeners), 0) AS listeners,
        COALESCE(SUM(dta.saves), 0) AS saves,
        COALESCE(SUM(dta.shares), 0) AS shares,
        COALESCE(SUM(dta.playlist_adds), 0) AS playlist_adds,
        COALESCE(SUM(dta.estimated_revenue), 0) AS estimated_revenue,
        COALESCE(SUM(dta.estimated_payout), 0) AS estimated_payout
      ${DAILY_FROM}
      ${filters.where}
      GROUP BY COALESCE(dta.country, 'GLOBAL')
      ORDER BY streams DESC
      LIMIT 12
      `,
      filters.values
    );

    const cityResult = await client.query(
      `
      SELECT
        COALESCE(dta.city, 'Unknown') AS name,
        COALESCE(SUM(dta.streams), 0) AS streams,
        COALESCE(SUM(dta.listeners), 0) AS listeners,
        COALESCE(SUM(dta.saves), 0) AS saves,
        COALESCE(SUM(dta.shares), 0) AS shares,
        COALESCE(SUM(dta.playlist_adds), 0) AS playlist_adds,
        COALESCE(SUM(dta.estimated_revenue), 0) AS estimated_revenue,
        COALESCE(SUM(dta.estimated_payout), 0) AS estimated_payout
      ${DAILY_FROM}
      ${filters.where}
      GROUP BY COALESCE(dta.city, 'Unknown')
      ORDER BY streams DESC
      LIMIT 12
      `,
      filters.values
    );

    const trendResult = await client.query(
      `
      SELECT
        dta.report_date AS date,
        COALESCE(SUM(dta.streams), 0) AS streams,
        COALESCE(SUM(dta.listeners), 0) AS listeners,
        COALESCE(SUM(dta.saves), 0) AS saves,
        COALESCE(SUM(dta.estimated_revenue), 0) AS estimated_revenue
      ${DAILY_FROM}
      ${filters.where}
      GROUP BY dta.report_date
      ORDER BY dta.report_date ASC
      LIMIT 60
      `,
      filters.values
    );

    const topTracksResult = await client.query(
      `
      SELECT
        dta.track_id,
        COALESCE(dta.track_title, t.song_name, t.title, dta.isrc, 'Track') AS title,
        COALESCE(dta.artist_name, a.artist_name, r.primary_artist, 'Unknown artist') AS artist,
        dta.isrc,
        COALESCE(SUM(dta.streams), 0) AS streams,
        COALESCE(SUM(dta.listeners), 0) AS listeners,
        COALESCE(SUM(dta.saves), 0) AS saves,
        COALESCE(SUM(dta.estimated_revenue), 0) AS estimated_revenue,
        COALESCE(SUM(dta.estimated_payout), 0) AS estimated_payout
      ${DAILY_FROM}
      ${filters.where}
        AND dta.report_date = $${filters.values.length + 1}::date
      GROUP BY dta.track_id, COALESCE(dta.track_title, t.song_name, t.title, dta.isrc, 'Track'), COALESCE(dta.artist_name, a.artist_name, r.primary_artist, 'Unknown artist'), dta.isrc
      ORDER BY streams DESC
      LIMIT 10
      `,
      [...filters.values, latestDate]
    );

    const topArtistsResult = await client.query(
      `
      SELECT
        dta.artist_id,
        COALESCE(a.artist_name, dta.artist_name, 'Unknown artist') AS name,
        COALESCE(SUM(dta.streams), 0) AS streams,
        COALESCE(SUM(dta.listeners), 0) AS listeners,
        COALESCE(SUM(dta.followers), 0) AS followers,
        COALESCE(SUM(dta.estimated_revenue), 0) AS estimated_revenue,
        COALESCE(SUM(dta.estimated_payout), 0) AS estimated_payout
      ${DAILY_FROM}
      ${filters.where}
        AND dta.report_date = $${filters.values.length + 1}::date
      GROUP BY dta.artist_id, COALESCE(a.artist_name, dta.artist_name, 'Unknown artist')
      ORDER BY streams DESC
      LIMIT 10
      `,
      [...filters.values, latestDate]
    );

    const summary = summaryResult.rows[0] || {};
    const periods = periodResult.rows[0] || {};
    const last7 = toNumber(periods.last_7_streams);
    const previous7 = toNumber(periods.previous_7_streams);
    const last28 = toNumber(periods.last_28_streams);
    const previous28 = toNumber(periods.previous_28_streams);

    return {
      latestReportDate: latestDate,
      summary: {
        streams: toInteger(summary.streams),
        listeners: toInteger(summary.listeners),
        saves: toInteger(summary.saves),
        shares: toInteger(summary.shares),
        playlistAdds: toInteger(summary.playlist_adds),
        followers: toInteger(summary.followers),
        estimatedRevenue: toNumber(summary.estimated_revenue),
        estimatedPayout: toNumber(summary.estimated_payout),
        trackCount: toInteger(summary.track_count),
        artistCount: toInteger(summary.artist_count),
        todayStreams: toInteger(periods.today_streams),
        yesterdayStreams: toInteger(periods.yesterday_streams),
        last7Streams: toInteger(last7),
        last28Streams: toInteger(last28),
        growth7: metricGrowth(last7, previous7),
        growth28: metricGrowth(last28, previous28),
      },
      dailyTrend: trendResult.rows.map((row) => ({
        date: row.date,
        streams: toInteger(row.streams),
        listeners: toInteger(row.listeners),
        saves: toInteger(row.saves),
        estimatedRevenue: toNumber(row.estimated_revenue),
      })),
      platformBreakdown: mapBreakdown(platformResult.rows),
      countryBreakdown: mapBreakdown(countryResult.rows),
      cityBreakdown: mapBreakdown(cityResult.rows),
      topTracks: topTracksResult.rows.map((row) => ({
        id: row.track_id,
        trackId: row.track_id,
        title: row.title,
        artist: row.artist,
        isrc: row.isrc,
        streams: toInteger(row.streams),
        listeners: toInteger(row.listeners),
        saves: toInteger(row.saves),
        estimatedRevenue: toNumber(row.estimated_revenue),
        estimatedPayout: toNumber(row.estimated_payout),
      })),
      topArtists: topArtistsResult.rows.map((row) => ({
        id: row.artist_id,
        artistId: row.artist_id,
        name: row.name,
        streams: toInteger(row.streams),
        listeners: toInteger(row.listeners),
        followers: toInteger(row.followers),
        estimatedRevenue: toNumber(row.estimated_revenue),
        estimatedPayout: toNumber(row.estimated_payout),
      })),
    };
  } finally {
    client.release();
  }
};

const getEntityMeta = async (client, entityType, entityId) => {
  if (entityType === "track") {
    const result = await client.query(
      `
      SELECT
        t.id,
        COALESCE(t.song_name, t.title) AS title,
        t.isrc,
        t.release_id,
        COALESCE(a.artist_name, t.primary_artist, r.primary_artist) AS artist_name,
        COALESCE(r.release_title, r.title) AS release_title
      FROM tracks t
      LEFT JOIN releases r ON r.id = t.release_id
      LEFT JOIN artists a ON a.id = r.artist_id
      WHERE t.id = $1
      LIMIT 1
      `,
      [entityId]
    );
    return result.rows[0] || null;
  }

  if (entityType === "release") {
    const result = await client.query(
      `
      SELECT id, COALESCE(release_title, title) AS title, primary_artist, upc, label_name
      FROM releases
      WHERE id = $1
      LIMIT 1
      `,
      [entityId]
    );
    return result.rows[0] || null;
  }

  if (entityType === "artist") {
    const result = await client.query("SELECT id, artist_name AS title, email, country FROM artists WHERE id = $1 LIMIT 1", [
      entityId,
    ]);
    return result.rows[0] || null;
  }

  if (entityType === "label") {
    const result = await client.query(
      "SELECT id, COALESCE(label_name, name) AS title, email, country FROM labels WHERE id = $1 LIMIT 1",
      [entityId]
    );
    return result.rows[0] || null;
  }

  return null;
};

const getOwnEntityId = async (client, user, entityType) => {
  if (!isUuid(user?.id)) {
    return null;
  }

  if (entityType === "artist") {
    const ids = await getArtistIdsForUser(client, user);
    return ids[0] || null;
  }

  if (entityType === "label") {
    const ids = await getLabelIdsForUser(client, user);
    return ids[0] || null;
  }

  return null;
};

const canAccessArtist = async (client, user, artistId) => {
  if (["admin", "accountant"].includes(user?.role)) return true;
  if (user?.role === "artist") return (await getArtistIdsForUser(client, user)).includes(artistId);
  if (user?.role === "label") {
    const labelIds = await getLabelIdsForUser(client, user);
    return (await getArtistIdsForLabels(client, labelIds)).includes(artistId);
  }
  return false;
};

const canAccessLabel = async (client, user, labelId) => {
  if (["admin", "accountant"].includes(user?.role)) return true;
  if (user?.role === "label") return (await getLabelIdsForUser(client, user)).includes(labelId);
  return false;
};

const getEntityAnalytics = async ({ user, entityType, entityId, query = {} }) => {
  await ensureDailySchema();
  const client = await pool.connect();

  try {
    let resolvedId = entityId === "me" ? await getOwnEntityId(client, user, entityType) : entityId;

    if (!isUuid(resolvedId)) {
      const error = new Error(`${entityType} not found.`);
      error.statusCode = 404;
      throw error;
    }

    if (entityType === "artist" && !(await canAccessArtist(client, user, resolvedId))) {
      const error = new Error("You do not have access to this artist analytics.");
      error.statusCode = 403;
      throw error;
    }

    if (entityType === "label" && !(await canAccessLabel(client, user, resolvedId))) {
      const error = new Error("You do not have access to this label analytics.");
      error.statusCode = 403;
      throw error;
    }

    const forced = {
      forcedTrackId: entityType === "track" ? resolvedId : undefined,
      forcedReleaseId: entityType === "release" ? resolvedId : undefined,
      forcedArtistId: entityType === "artist" ? resolvedId : undefined,
      forcedLabelId: entityType === "label" ? resolvedId : undefined,
    };
    const [analytics, list] = await Promise.all([
      getDailyAnalyticsOverview({ user, query, ...forced }),
      listDailyRecords({
        user,
        query: { ...query, limit: query.limit || 10 },
        exportMode: false,
        includeUnmatched: false,
        ...forced,
      }),
    ]);
    const canRevealMeta =
      ["admin", "accountant"].includes(user?.role) ||
      entityType === "artist" ||
      entityType === "label" ||
      analytics.summary.streams > 0 ||
      list.records.length > 0;
    const meta = canRevealMeta ? await getEntityMeta(client, entityType, resolvedId) : null;

    return {
      entity: {
        type: entityType,
        id: resolvedId,
        ...meta,
      },
      analytics,
      recentRecords: list.records,
    };
  } finally {
    client.release();
  }
};

const getTrendingAnalytics = async ({ user, query = {} }) => {
  await ensureDailySchema();
  const client = await pool.connect();

  try {
    const filters = await buildDailyFilters(client, { user, query });
    const latestDate = await getLatestDate(client, filters);

    if (!latestDate) {
      return { latestReportDate: null, tracks: [], alerts: [] };
    }

    const trendingResult = await client.query(
      `
      WITH scoped AS (
        SELECT dta.*, COALESCE(dta.track_title, t.song_name, t.title, dta.isrc, 'Track') AS title,
               COALESCE(dta.artist_name, a.artist_name, r.primary_artist, 'Unknown artist') AS artist
        ${DAILY_FROM}
        ${filters.where}
      )
      SELECT
        track_id,
        title,
        artist,
        isrc,
        COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '6 days' AND $${filters.values.length + 1}::date), 0) AS current_7,
        COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '13 days' AND $${filters.values.length + 1}::date - INTERVAL '7 days'), 0) AS previous_7,
        COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '27 days' AND $${filters.values.length + 1}::date), 0) AS current_28,
        COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '55 days' AND $${filters.values.length + 1}::date - INTERVAL '28 days'), 0) AS previous_28,
        COALESCE(SUM(estimated_revenue) FILTER (WHERE report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '6 days' AND $${filters.values.length + 1}::date), 0) AS estimated_revenue
      FROM scoped
      WHERE track_id IS NOT NULL
      GROUP BY track_id, title, artist, isrc
      HAVING COALESCE(SUM(streams) FILTER (WHERE report_date BETWEEN $${filters.values.length + 1}::date - INTERVAL '6 days' AND $${filters.values.length + 1}::date), 0) > 0
      ORDER BY current_7 DESC
      LIMIT 25
      `,
      [...filters.values, latestDate]
    );

    const alertConditions = ["ta.created_at >= NOW() - INTERVAL '30 days'"];
    const alertValues = [];
    const addAlertValue = (value) => {
      alertValues.push(value);
      return `$${alertValues.length}`;
    };

    if (user?.role === "artist") {
      const artistIds = await getArtistIdsForUser(client, user);
      alertConditions.push(artistIds.length ? `ta.artist_id = ANY(${addAlertValue(artistIds)}::uuid[])` : "FALSE");
    }

    if (user?.role === "label") {
      const labelIds = await getLabelIdsForUser(client, user);
      const artistIds = await getArtistIdsForLabels(client, labelIds);
      alertConditions.push(artistIds.length ? `ta.artist_id = ANY(${addAlertValue(artistIds)}::uuid[])` : "FALSE");
    }

    if (!["admin", "accountant", "artist", "label"].includes(user?.role)) {
      alertConditions.push("FALSE");
    }

    const alertsResult = await client.query(
      `
      SELECT ta.*, COALESCE(t.song_name, t.title) AS track_title, a.artist_name
      FROM trend_alerts ta
      LEFT JOIN tracks t ON t.id = ta.track_id
      LEFT JOIN artists a ON a.id = ta.artist_id
      WHERE ${alertConditions.join(" AND ")}
      ORDER BY ta.created_at DESC
      LIMIT 40
      `,
      alertValues
    );

    return {
      latestReportDate: latestDate,
      tracks: trendingResult.rows.map((row) => ({
        trackId: row.track_id,
        title: row.title,
        artist: row.artist,
        isrc: row.isrc,
        current7: toInteger(row.current_7),
        previous7: toInteger(row.previous_7),
        current28: toInteger(row.current_28),
        previous28: toInteger(row.previous_28),
        growth7: metricGrowth(row.current_7, row.previous_7),
        growth28: metricGrowth(row.current_28, row.previous_28),
        estimatedRevenue: toNumber(row.estimated_revenue),
      })),
      alerts: alertsResult.rows.map((row) => ({
        id: row.id,
        trackId: row.track_id,
        artistId: row.artist_id,
        alertType: row.alert_type,
        title: row.title,
        description: row.description,
        metric: row.metric,
        oldValue: toNumber(row.old_value),
        newValue: toNumber(row.new_value),
        growthPercentage: toNumber(row.growth_percentage),
        createdAt: row.created_at,
        trackTitle: row.track_title,
        artistName: row.artist_name,
      })),
    };
  } finally {
    client.release();
  }
};

const rowsToCsv = (rows) => {
  const headers = Object.keys(rows[0] || { Status: "" });
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
};

const buildExport = (rows, sheetName, format) => {
  if (format === "csv") {
    return {
      contentType: "text/csv",
      extension: "csv",
      buffer: Buffer.from(rowsToCsv(rows)),
    };
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
};

const exportDailyAnalytics = async ({ user, query = {}, format = "xlsx" }) => {
  await ensureDailySchema();
  const type = query.type || "daily";
  let rows = [];
  let sheetName = "Daily Report";

  if (type === "unmatched") {
    const unmatched = await getUnmatchedRows({ query: { ...query, limit: MAX_EXPORT_ROWS } });
    rows = unmatched.records.map(recordToExportRow);
    sheetName = "Unmatched ISRC";
  } else if (type === "trending") {
    const trending = await getTrendingAnalytics({ user, query });
    rows = trending.tracks.map((track) => ({
      Track: track.title,
      Artist: track.artist,
      ISRC: track.isrc,
      "Current 7 Days": track.current7,
      "Previous 7 Days": track.previous7,
      "7 Day Growth %": track.growth7,
      "Current 28 Days": track.current28,
      "28 Day Growth %": track.growth28,
      "Estimated Revenue": track.estimatedRevenue,
      Note: "Estimated only",
    }));
    sheetName = "Trending";
  } else {
    const list = await listDailyRecords({ user, query, exportMode: true });
    rows = list.records.map(recordToExportRow);
    sheetName = type === "artist" ? "Artist Daily Report" : type === "label" ? "Label Daily Report" : "Daily Report";
  }

  return buildExport(rows, sheetName, format);
};

const recordToExportRow = (record) => ({
  ISRC: record.isrc,
  UPC: record.upc,
  Track: record.trackTitle,
  Artist: record.artistName,
  Platform: record.platform,
  Country: record.country,
  City: record.city,
  Streams: record.streams,
  Listeners: record.listeners,
  Saves: record.saves,
  Shares: record.shares,
  "Playlist Adds": record.playlistAdds,
  Followers: record.followers,
  "Report Date": record.reportDate,
  "Estimated Revenue": record.estimatedRevenue,
  "Estimated Payout": record.estimatedPayout,
  Currency: record.currency,
  Note: "Estimated only",
});

const getCatalogDailyPerformance = async ({ releaseId, trackId }) => {
  const forced = {
    forcedReleaseId: releaseId,
    forcedTrackId: trackId,
  };

  const analytics = await getDailyAnalyticsOverview({
    user: { role: "admin" },
    query: {},
    ...forced,
  });

  return analytics;
};

module.exports = {
  exportDailyAnalytics,
  getCatalogDailyPerformance,
  getDailyAnalyticsOverview,
  getDailyReportImports,
  getEntityAnalytics,
  getTrendingAnalytics,
  getUnmatchedRows,
  listDailyRecords,
  processDailyReportFile,
};
