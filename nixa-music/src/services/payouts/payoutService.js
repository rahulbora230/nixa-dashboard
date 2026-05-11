const XLSX = require("xlsx");
const pool = require("../../config/db");
const {
  canAccessArtist,
  canAccessLabel,
  resolveOwnArtistId,
  resolveOwnLabelId,
} = require("../finance/financeService");
const { ensurePayoutSchema } = require("./payoutSchema");

const MAX_EXPORT_ROWS = 50000;
const payoutStatuses = new Set(["pending", "processing", "completed", "failed", "cancelled"]);
const paymentMethods = new Set(["bank_transfer", "upi", "paypal", "wise", "razorpay", "other"]);

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundMoney = (value) => Number(toNumber(value).toFixed(6));

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
};

const normalizeDate = (value) => {
  const text = cleanText(value);

  if (!text) {
    return null;
  }

  return /^\d{4}-\d{2}$/.test(text) ? `${text}-01` : text;
};

const normalizePaymentMethod = (value) => {
  const normalized = cleanText(value)?.toLowerCase().replace(/\s+/g, "_") || "bank_transfer";
  return paymentMethods.has(normalized) ? normalized : "other";
};

const mapPayoutRow = (row) => ({
  id: row.id,
  queueId: row.queue_id,
  recipientType: row.recipient_type || (row.artist_id ? "artist" : "label"),
  artistId: row.artist_id,
  labelId: row.label_id,
  recipientName: row.recipient_name || row.artist_name || row.label_name || "Unknown recipient",
  amount: toNumber(row.amount ?? row.net_amount),
  grossAmount: toNumber(row.gross_amount),
  gstDeduction: toNumber(row.gst_deduction),
  tdsDeduction: toNumber(row.tds_deduction),
  deductions: toNumber(row.deductions ?? row.gst_deduction) + toNumber(row.tds_deduction),
  netAmount: toNumber(row.net_amount ?? row.amount),
  pendingAmount: toNumber(row.pending_amount),
  paidAmount: toNumber(row.paid_amount),
  status: row.status || "pending",
  paymentMethod: row.payment_method,
  transactionReference: row.transaction_reference,
  payoutDate: row.payout_date,
  periodStart: row.period_start,
  periodEnd: row.period_end,
  notes: row.notes,
  processedBy: row.processed_by,
  appliedAt: row.applied_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const payoutSelect = `
  SELECT
    p.*,
    CASE WHEN p.artist_id IS NOT NULL THEN 'artist' ELSE 'label' END AS recipient_type,
    COALESCE(a.artist_name, l.label_name, 'Unknown recipient') AS recipient_name
  FROM payouts p
  LEFT JOIN artists a ON a.id = p.artist_id
  LEFT JOIN labels l ON l.id = p.label_id
`;

const addDateFilters = (conditions, values, query = {}, column = "rr.report_month") => {
  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.reportMonth || query.report_month) {
    conditions.push(`${column} = ${addValue(normalizeDate(query.reportMonth || query.report_month))}`);
  }

  if (query.from || query.fromMonth || query.from_month) {
    conditions.push(`${column} >= ${addValue(normalizeDate(query.from || query.fromMonth || query.from_month))}`);
  }

  if (query.to || query.toMonth || query.to_month) {
    conditions.push(`${column} <= ${addValue(normalizeDate(query.to || query.toMonth || query.to_month))}`);
  }
};

const getRoleScope = async (client, user) => {
  if (["admin", "accountant"].includes(user.role)) {
    return {};
  }

  if (user.role === "artist") {
    return { artistId: await resolveOwnArtistId(client, user) };
  }

  if (user.role === "label") {
    return { labelId: await resolveOwnLabelId(client, user) };
  }

  return { deny: true };
};

const getRecipientBalances = async ({ client, user, query = {}, forcedArtistId, forcedLabelId }) => {
  const roleScope = await getRoleScope(client, user);

  if (roleScope.deny) {
    return [];
  }

  const artistValues = [];
  const artistConditions = ["cr.artist_id IS NOT NULL"];
  const labelValues = [];
  const labelConditions = ["cr.label_id IS NOT NULL"];

  addDateFilters(artistConditions, artistValues, query);
  addDateFilters(labelConditions, labelValues, query);

  if (query.platform) {
    artistValues.push(query.platform);
    artistConditions.push(`rr.platform = $${artistValues.length}`);
    labelValues.push(query.platform);
    labelConditions.push(`rr.platform = $${labelValues.length}`);
  }

  if (query.country) {
    artistValues.push(String(query.country).toUpperCase());
    artistConditions.push(`rr.country = $${artistValues.length}`);
    labelValues.push(String(query.country).toUpperCase());
    labelConditions.push(`rr.country = $${labelValues.length}`);
  }

  const scopedArtistId = forcedArtistId || roleScope.artistId || query.artistId || query.artist_id;
  const scopedLabelId = forcedLabelId || roleScope.labelId || query.labelId || query.label_id;

  if (isUuid(scopedArtistId)) {
    artistValues.push(scopedArtistId);
    artistConditions.push(`cr.artist_id = $${artistValues.length}`);
    labelConditions.push("FALSE");
  }

  if (isUuid(scopedLabelId)) {
    labelValues.push(scopedLabelId);
    labelConditions.push(`cr.label_id = $${labelValues.length}`);
    artistConditions.push("FALSE");
  }

  const artistResult = await client.query(
    `
    WITH base AS (
      SELECT
        cr.artist_id,
        COALESCE(a.artist_name, rr.artist_name, 'Unknown artist') AS recipient_name,
        COALESCE(SUM(COALESCE(cr.gross_revenue, rr.revenue)), 0) AS gross_amount,
        COALESCE(SUM(cr.artist_share), 0) AS share_amount,
        COALESCE(SUM(
          (cr.gst_deduction + cr.tds_deduction)
          * (cr.artist_share / NULLIF(cr.artist_share + cr.label_share, 0))
        ), 0) AS deductions,
        MIN(rr.report_month) AS period_start,
        MAX(rr.report_month) AS period_end
      FROM raw_revenues rr
      JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      LEFT JOIN artists a ON a.id = cr.artist_id
      WHERE ${artistConditions.join(" AND ")}
      GROUP BY cr.artist_id, COALESCE(a.artist_name, rr.artist_name, 'Unknown artist')
    ),
    paid AS (
      SELECT artist_id, COALESCE(SUM(net_amount), 0) AS paid_amount
      FROM payouts
      WHERE status = 'completed' AND artist_id IS NOT NULL
      GROUP BY artist_id
    )
    SELECT
      CONCAT('queue-artist-', base.artist_id) AS queue_id,
      'artist' AS recipient_type,
      base.artist_id,
      NULL::uuid AS label_id,
      base.recipient_name,
      base.gross_amount,
      base.deductions,
      GREATEST(base.share_amount - base.deductions, 0) AS net_amount,
      COALESCE(paid.paid_amount, 0) AS paid_amount,
      GREATEST(base.share_amount - base.deductions - COALESCE(paid.paid_amount, 0), 0) AS pending_amount,
      'pending' AS status,
      base.period_start,
      base.period_end
    FROM base
    LEFT JOIN paid ON paid.artist_id = base.artist_id
    WHERE GREATEST(base.share_amount - base.deductions - COALESCE(paid.paid_amount, 0), 0) > 0
    `,
    artistValues
  );

  const labelResult = await client.query(
    `
    WITH base AS (
      SELECT
        cr.label_id,
        COALESCE(l.label_name, 'Unassigned label') AS recipient_name,
        COALESCE(SUM(COALESCE(cr.gross_revenue, rr.revenue)), 0) AS gross_amount,
        COALESCE(SUM(cr.label_share), 0) AS share_amount,
        COALESCE(SUM(
          (cr.gst_deduction + cr.tds_deduction)
          * (cr.label_share / NULLIF(cr.artist_share + cr.label_share, 0))
        ), 0) AS deductions,
        MIN(rr.report_month) AS period_start,
        MAX(rr.report_month) AS period_end
      FROM raw_revenues rr
      JOIN calculated_revenues cr ON cr.raw_revenue_id = rr.id
      LEFT JOIN labels l ON l.id = cr.label_id
      WHERE ${labelConditions.join(" AND ")}
      GROUP BY cr.label_id, COALESCE(l.label_name, 'Unassigned label')
    ),
    paid AS (
      SELECT label_id, COALESCE(SUM(net_amount), 0) AS paid_amount
      FROM payouts
      WHERE status = 'completed' AND label_id IS NOT NULL
      GROUP BY label_id
    )
    SELECT
      CONCAT('queue-label-', base.label_id) AS queue_id,
      'label' AS recipient_type,
      NULL::uuid AS artist_id,
      base.label_id,
      base.recipient_name,
      base.gross_amount,
      base.deductions,
      GREATEST(base.share_amount - base.deductions, 0) AS net_amount,
      COALESCE(paid.paid_amount, 0) AS paid_amount,
      GREATEST(base.share_amount - base.deductions - COALESCE(paid.paid_amount, 0), 0) AS pending_amount,
      'pending' AS status,
      base.period_start,
      base.period_end
    FROM base
    LEFT JOIN paid ON paid.label_id = base.label_id
    WHERE GREATEST(base.share_amount - base.deductions - COALESCE(paid.paid_amount, 0), 0) > 0
    `,
    labelValues
  );

  return [...artistResult.rows, ...labelResult.rows].map(mapPayoutRow);
};

const buildPayoutListFilters = async (client, { user, query = {}, forcedArtistId, forcedLabelId }) => {
  const values = [];
  const conditions = [];
  const addValue = (value) => {
    values.push(value);
    return `$${values.length}`;
  };
  const roleScope = await getRoleScope(client, user);

  if (roleScope.deny) {
    conditions.push("FALSE");
  }

  const artistId = forcedArtistId || roleScope.artistId || query.artistId || query.artist_id;
  const labelId = forcedLabelId || roleScope.labelId || query.labelId || query.label_id;

  if (isUuid(artistId)) {
    conditions.push(`p.artist_id = ${addValue(artistId)}`);
  }

  if (isUuid(labelId)) {
    conditions.push(`p.label_id = ${addValue(labelId)}`);
  }

  if (query.status && query.status !== "pending") {
    conditions.push(`p.status = ${addValue(query.status)}`);
  }

  if (query.paymentMethod || query.payment_method) {
    conditions.push(`p.payment_method = ${addValue(normalizePaymentMethod(query.paymentMethod || query.payment_method))}`);
  }

  if (query.search) {
    const term = `%${String(query.search).trim()}%`;
    const placeholder = addValue(term);
    conditions.push(`
      (
        p.transaction_reference ILIKE ${placeholder}
        OR p.notes ILIKE ${placeholder}
        OR a.artist_name ILIKE ${placeholder}
        OR l.label_name ILIKE ${placeholder}
      )
    `);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const listPayouts = async ({ user, query = {}, forcedArtistId, forcedLabelId, exportMode = false }) => {
  await ensurePayoutSchema();
  const client = await pool.connect();

  try {
    const includePending = !query.status || query.status === "pending";
    const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
    const limit = exportMode ? MAX_EXPORT_ROWS : Math.min(Math.max(Number.parseInt(query.limit || "12", 10), 1), 100);
    const { where, values } = await buildPayoutListFilters(client, { user, query, forcedArtistId, forcedLabelId });

    const payoutsResult = await client.query(
      `
      ${payoutSelect}
      ${where}
      ORDER BY p.created_at DESC
      LIMIT ${MAX_EXPORT_ROWS}
      `,
      values
    );

    let rows = payoutsResult.rows.map(mapPayoutRow);

    if (includePending) {
      const queueRows = await getRecipientBalances({ client, user, query, forcedArtistId, forcedLabelId });
      rows = [...queueRows, ...rows];
    }

    if (query.status === "pending") {
      rows = rows.filter((row) => row.status === "pending");
    }

    if (query.search) {
      const term = String(query.search).toLowerCase();
      rows = rows.filter((row) =>
        [row.recipientName, row.transactionReference, row.notes].some((value) => String(value || "").toLowerCase().includes(term))
      );
    }

    const sortKey = query.sort || "pending";
    rows.sort((a, b) => {
      if (sortKey === "amount") return b.netAmount - a.netAmount;
      if (sortKey === "gross") return b.grossAmount - a.grossAmount;
      if (sortKey === "name") return a.recipientName.localeCompare(b.recipientName);
      return b.pendingAmount - a.pendingAmount;
    });

    const total = rows.length;
    const pagedRows = exportMode ? rows : rows.slice((page - 1) * limit, page * limit);

    return {
      payouts: pagedRows,
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

const getPayoutById = async ({ user, id }) => {
  await ensurePayoutSchema();
  const client = await pool.connect();

  try {
    if (id.startsWith("queue-artist-")) {
      const artistId = id.replace("queue-artist-", "");
      const rows = await getRecipientBalances({ client, user, forcedArtistId: artistId });
      return rows[0] || null;
    }

    if (id.startsWith("queue-label-")) {
      const labelId = id.replace("queue-label-", "");
      const rows = await getRecipientBalances({ client, user, forcedLabelId: labelId });
      return rows[0] || null;
    }

    const result = await client.query(`${payoutSelect} WHERE p.id = $1 LIMIT 1`, [id]);
    const payout = result.rows[0] ? mapPayoutRow(result.rows[0]) : null;

    if (!payout) {
      return null;
    }

    if (payout.artistId && !(await canAccessArtist(client, user, payout.artistId))) {
      const error = new Error("You can only view payouts assigned to your artist profile.");
      error.statusCode = 403;
      throw error;
    }

    if (payout.labelId && !(await canAccessLabel(client, user, payout.labelId))) {
      const error = new Error("You can only view payouts assigned to your label profile.");
      error.statusCode = 403;
      throw error;
    }

    const logs = await client.query(
      `
      SELECT pl.*, u.name AS performed_by_name
      FROM payout_logs pl
      LEFT JOIN users u ON u.id = pl.performed_by
      WHERE pl.payout_id = $1
      ORDER BY pl.created_at DESC
      `,
      [id]
    );

    return {
      ...payout,
      logs: logs.rows.map((log) => ({
        id: log.id,
        action: log.action,
        performedBy: log.performed_by,
        performedByName: log.performed_by_name,
        oldStatus: log.old_status,
        newStatus: log.new_status,
        notes: log.notes,
        createdAt: log.created_at,
      })),
    };
  } finally {
    client.release();
  }
};

const insertPayoutLog = async (client, { payoutId, action, user, oldStatus, newStatus, notes }) => {
  await client.query(
    `
    INSERT INTO payout_logs (payout_id, action, performed_by, old_status, new_status, notes)
    VALUES ($1,$2,$3,$4,$5,$6)
    `,
    [payoutId, action, isUuid(user?.id) ? user.id : null, oldStatus || null, newStatus || null, notes || null]
  );
};

const applyCompletedPayout = async (client, payout) => {
  if (payout.applied_at || payout.status !== "completed") {
    return;
  }

  let remaining = roundMoney(payout.net_amount || payout.amount);
  const values = [];
  const conditions = ["COALESCE(cr.pending_amount, 0) > 0"];

  if (payout.artist_id) {
    values.push(payout.artist_id);
    conditions.push(`cr.artist_id = $${values.length}`);
  }

  if (payout.label_id) {
    values.push(payout.label_id);
    conditions.push(`cr.label_id = $${values.length}`);
  }

  const rows = await client.query(
    `
    SELECT cr.id, cr.pending_amount, cr.payable_amount, cr.paid_amount
    FROM calculated_revenues cr
    JOIN raw_revenues rr ON rr.id = cr.raw_revenue_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY rr.report_month ASC, rr.created_at ASC
    `,
    values
  );

  for (const row of rows.rows) {
    if (remaining <= 0) {
      break;
    }

    const allocation = Math.min(remaining, toNumber(row.pending_amount));
    remaining = roundMoney(remaining - allocation);

    await client.query(
      `
      UPDATE calculated_revenues
      SET paid_amount = COALESCE(paid_amount, 0) + $1,
          pending_amount = GREATEST(COALESCE(payable_amount, 0) - (COALESCE(paid_amount, 0) + $1), 0),
          finance_status = CASE
            WHEN COALESCE(paid_amount, 0) + $1 >= COALESCE(payable_amount, 0) THEN 'paid'
            WHEN COALESCE(paid_amount, 0) + $1 > 0 THEN 'partial'
            ELSE 'unpaid'
          END,
          payout_status = CASE
            WHEN COALESCE(paid_amount, 0) + $1 >= COALESCE(payable_amount, 0) THEN 'paid'
            WHEN COALESCE(paid_amount, 0) + $1 > 0 THEN 'partial'
            ELSE 'unpaid'
          END,
          updated_at = NOW()
      WHERE id = $2
      `,
      [allocation, row.id]
    );
  }

  await client.query("UPDATE payouts SET applied_at = NOW(), updated_at = NOW() WHERE id = $1", [payout.id]);
};

const processPayout = async ({ user, payload = {} }) => {
  await ensurePayoutSchema();

  if (!["admin", "accountant"].includes(user.role)) {
    const error = new Error("Only admin and accountant roles can process payouts.");
    error.statusCode = 403;
    throw error;
  }

  const artistId = isUuid(payload.artistId || payload.artist_id) ? payload.artistId || payload.artist_id : null;
  const labelId = isUuid(payload.labelId || payload.label_id) ? payload.labelId || payload.label_id : null;

  if (!artistId && !labelId) {
    throw new Error("Select an artist or label for payout.");
  }

  if (artistId && labelId) {
    throw new Error("Process either an artist payout or a label payout, not both.");
  }

  const status = cleanText(payload.status) || "processing";

  if (!payoutStatuses.has(status)) {
    throw new Error("Invalid payout status.");
  }

  const client = await pool.connect();

  try {
    const balances = await getRecipientBalances({ client, user, forcedArtistId: artistId, forcedLabelId: labelId });
    const balance = balances[0];

    if (!balance) {
      throw new Error("No payable balance found for this recipient.");
    }

    const requestedAmount = roundMoney(payload.amount ?? payload.net_amount ?? balance.pendingAmount);

    if (requestedAmount <= 0) {
      throw new Error("Payout amount must be greater than zero.");
    }

    if (requestedAmount - balance.pendingAmount > 0.01) {
      throw new Error("Payout amount cannot exceed the pending payable balance.");
    }

    const transactionReference = cleanText(payload.transactionReference || payload.transaction_reference);

    if (transactionReference) {
      const duplicate = await client.query("SELECT id FROM payouts WHERE transaction_reference = $1 LIMIT 1", [
        transactionReference,
      ]);

      if (duplicate.rows[0]) {
        throw new Error("A payout with this transaction reference already exists.");
      }
    }

    const ratio = balance.pendingAmount > 0 ? requestedAmount / balance.pendingAmount : 1;
    const grossAmount = roundMoney(payload.grossAmount ?? payload.gross_amount ?? balance.grossAmount * ratio);
    const gstDeduction = roundMoney(payload.gstDeduction ?? payload.gst_deduction ?? 0);
    const tdsDeduction = roundMoney(payload.tdsDeduction ?? payload.tds_deduction ?? balance.deductions * ratio);
    const netAmount = roundMoney(payload.netAmount ?? payload.net_amount ?? requestedAmount);
    const payoutDate = normalizeDate(payload.payoutDate || payload.payout_date) || new Date().toISOString().slice(0, 10);

    await client.query("BEGIN");

    const result = await client.query(
      `
      INSERT INTO payouts (
        artist_id,
        label_id,
        amount,
        gross_amount,
        gst_deduction,
        tds_deduction,
        net_amount,
        status,
        payment_method,
        transaction_reference,
        payout_date,
        notes,
        processed_by,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      RETURNING *
      `,
      [
        artistId,
        labelId,
        requestedAmount,
        grossAmount,
        gstDeduction,
        tdsDeduction,
        netAmount,
        status,
        normalizePaymentMethod(payload.paymentMethod || payload.payment_method),
        transactionReference,
        payoutDate,
        cleanText(payload.notes),
        isUuid(user.id) ? user.id : null,
      ]
    );

    await insertPayoutLog(client, {
      payoutId: result.rows[0].id,
      action: "created",
      user,
      oldStatus: null,
      newStatus: status,
      notes: cleanText(payload.notes),
    });

    if (status === "completed") {
      await applyCompletedPayout(client, result.rows[0]);
      result.rows[0].applied_at = new Date();
    }

    await client.query("COMMIT");
    return mapPayoutRow({ ...result.rows[0], recipient_name: balance.recipientName, recipient_type: balance.recipientType });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updatePayoutStatus = async ({ user, id, status, notes }) => {
  await ensurePayoutSchema();

  if (!["admin", "accountant"].includes(user.role)) {
    const error = new Error("Only admin and accountant roles can change payout status.");
    error.statusCode = 403;
    throw error;
  }

  if (!payoutStatuses.has(status)) {
    throw new Error("Invalid payout status.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT * FROM payouts WHERE id = $1 FOR UPDATE", [id]);
    const payout = existing.rows[0];

    if (!payout) {
      await client.query("ROLLBACK");
      return null;
    }

    const result = await client.query(
      `
      UPDATE payouts
      SET status = $1,
          failed_reason = CASE WHEN $1 = 'failed' THEN $3 ELSE failed_reason END,
          cancelled_at = CASE WHEN $1 = 'cancelled' THEN NOW() ELSE cancelled_at END,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
      `,
      [status, id, cleanText(notes)]
    );

    await insertPayoutLog(client, {
      payoutId: id,
      action: "status_changed",
      user,
      oldStatus: payout.status,
      newStatus: status,
      notes: cleanText(notes),
    });

    if (status === "completed") {
      await applyCompletedPayout(client, result.rows[0]);
    }

    await client.query("COMMIT");
    return getPayoutById({ user, id });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const getPayoutDashboard = async ({ user, query = {} }) => {
  await ensurePayoutSchema();
  const client = await pool.connect();

  try {
    const balances = await getRecipientBalances({ client, user, query });
    const list = await listPayouts({ user, query: { ...query, limit: 8 } });
    const roleScope = await getRoleScope(client, user);
    const values = [];
    const conditions = [];
    const addValue = (value) => {
      values.push(value);
      return `$${values.length}`;
    };

    if (roleScope.deny) {
      conditions.push("FALSE");
    }

    if (isUuid(roleScope.artistId)) {
      conditions.push(`artist_id = ${addValue(roleScope.artistId)}`);
    }

    if (isUuid(roleScope.labelId)) {
      conditions.push(`label_id = ${addValue(roleScope.labelId)}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const payoutSummary = await client.query(
      `
      SELECT
        COALESCE(SUM(net_amount) FILTER (WHERE status = 'completed'), 0) AS paid_amount,
        COALESCE(SUM(net_amount) FILTER (
          WHERE status = 'completed'
            AND DATE_TRUNC('month', COALESCE(payout_date, created_at::date)) = DATE_TRUNC('month', CURRENT_DATE)
        ), 0) AS this_month_payouts,
        COUNT(*) FILTER (WHERE status IN ('pending','processing')) AS upcoming_payouts
      FROM payouts
      ${where}
      `,
      values
    );
    const monthly = await client.query(
      `
      SELECT
        TO_CHAR(DATE_TRUNC('month', COALESCE(payout_date, created_at::date)), 'YYYY-MM') AS month,
        COALESCE(SUM(net_amount) FILTER (WHERE status = 'completed'), 0) AS paid_amount,
        COALESCE(SUM(net_amount) FILTER (WHERE status IN ('pending','processing')), 0) AS pending_amount
      FROM payouts
      ${where}
      GROUP BY DATE_TRUNC('month', COALESCE(payout_date, created_at::date))
      ORDER BY DATE_TRUNC('month', COALESCE(payout_date, created_at::date)) ASC
      LIMIT 18
      `,
      values
    );

    const pendingPayouts = balances.reduce((sum, item) => sum + item.pendingAmount, 0);
    const payableBalance = balances.reduce((sum, item) => sum + item.netAmount, 0);
    const paidAmount = toNumber(payoutSummary.rows[0]?.paid_amount);

    return {
      summary: {
        totalPayableBalance: payableBalance,
        totalPaidAmount: paidAmount,
        pendingPayouts,
        thisMonthPayouts: toNumber(payoutSummary.rows[0]?.this_month_payouts),
        upcomingPayouts: toNumber(payoutSummary.rows[0]?.upcoming_payouts) + balances.length,
      },
      artistSummary: balances.filter((item) => item.recipientType === "artist"),
      labelSummary: balances.filter((item) => item.recipientType === "label"),
      recentActivity: list.payouts.slice(0, 8),
      monthlyTrend: monthly.rows.map((row) => ({
        month: row.month,
        paidAmount: toNumber(row.paid_amount),
        pendingAmount: toNumber(row.pending_amount),
      })),
      paidVsPending: [
        { name: "Paid", value: paidAmount },
        { name: "Pending", value: pendingPayouts },
      ],
      artistRanking: balances
        .filter((item) => item.recipientType === "artist")
        .sort((a, b) => b.pendingAmount - a.pendingAmount)
        .slice(0, 10),
    };
  } finally {
    client.release();
  }
};

const exportPayouts = async ({ user, query = {}, format = "xlsx", type = "all" }) => {
  const result = await listPayouts({
    user,
    query: {
      ...query,
      status: type === "pending" ? "pending" : query.status,
    },
    exportMode: true,
  });
  const rows = result.payouts.map((payout) => ({
    Recipient: payout.recipientName,
    Type: payout.recipientType,
    "Gross Revenue": payout.grossAmount,
    Deductions: payout.deductions,
    "Net Payable": payout.netAmount || payout.pendingAmount,
    Status: payout.status,
    "Payment Method": payout.paymentMethod,
    "Reference Number": payout.transactionReference,
    "Payout Date": payout.payoutDate,
    Notes: payout.notes,
  }));

  if (format === "csv") {
    const headers = Object.keys(rows[0] || { Recipient: "" });
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");

    return {
      contentType: "text/csv",
      extension: "csv",
      buffer: Buffer.from(csv),
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Payouts");

  return {
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extension: "xlsx",
    buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
  };
};

module.exports = {
  exportPayouts,
  getPayoutById,
  getPayoutDashboard,
  listPayouts,
  processPayout,
  updatePayoutStatus,
};
