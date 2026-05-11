const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const { ensureManagementSchema } = require("./managementSchema");
const { sendEmail, templates } = require("../email/emailService");
const { createNotification } = require("../notifications/notificationService");

const allowedRoles = new Set(["admin", "artist", "label", "accountant"]);
const allowedStatuses = new Set(["active", "disabled", "inactive", "pending"]);

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);

const cleanText = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text || null;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getValue = (payload, ...keys) => {
  for (const key of keys) {
    if (payload[key] !== undefined) {
      return payload[key];
    }
  }

  return undefined;
};

const paginationFromQuery = (query = {}, defaultLimit = 12) => {
  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || String(defaultLimit), 10), 1), 100);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
};

const createTemporaryPassword = () => `Nixa@${Math.random().toString(36).slice(2, 8)}${Date.now().toString().slice(-3)}`;

const logActivity = async ({ userId, action, entityType, entityId, metadata = {}, client = pool }) => {
  await ensureManagementSchema();

  await client.query(
    `
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, metadata_json)
    VALUES ($1, $2, $3, $4, $5)
    `,
    [isUuid(userId) ? userId : null, action, entityType, isUuid(entityId) ? entityId : null, metadata]
  );
};

const mapUser = (row = {}) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  role: row.role,
  status: row.status,
  lastLogin: row.last_login,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  artistId: row.artist_id,
  artistName: row.artist_name,
  labelId: row.label_id,
  labelName: row.label_name,
});

const mapArtist = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  userEmail: row.user_email,
  labelId: row.label_id,
  labelName: row.label_name,
  artistName: row.artist_name,
  legalName: row.legal_name,
  email: row.email,
  phone: row.phone,
  country: row.country,
  address: row.address,
  pan: row.pan,
  gstNumber: row.gst_number,
  bankName: row.bank_name,
  accountNumber: row.account_number,
  ifsc: row.ifsc,
  upiId: row.upi_id,
  paymentMethod: row.payment_method,
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  grossRevenue: toNumber(row.gross_revenue),
  payableBalance: toNumber(row.payable_balance),
  paidAmount: toNumber(row.paid_amount),
  pendingAmount: toNumber(row.pending_amount),
  totalStreams: toNumber(row.total_streams),
  releaseCount: toNumber(row.release_count),
  payoutCount: toNumber(row.payout_count),
});

const mapLabel = (row = {}) => ({
  id: row.id,
  userId: row.user_id,
  userName: row.user_name,
  userEmail: row.user_email,
  labelName: row.label_name || row.name,
  name: row.name || row.label_name,
  legalBusinessName: row.legal_business_name,
  email: row.email,
  phone: row.phone,
  country: row.country,
  address: row.address,
  gstNumber: row.gst_number,
  pan: row.pan,
  bankName: row.bank_name,
  accountNumber: row.account_number,
  ifsc: row.ifsc,
  upiId: row.upi_id,
  paymentMethod: row.payment_method,
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  artistCount: toNumber(row.artist_count),
  grossRevenue: toNumber(row.gross_revenue),
  payableBalance: toNumber(row.payable_balance),
  paidAmount: toNumber(row.paid_amount),
  pendingAmount: toNumber(row.pending_amount),
  totalStreams: toNumber(row.total_streams),
  payoutCount: toNumber(row.payout_count),
});

const buildUserWhere = (query = {}) => {
  const conditions = [];
  const values = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.role) {
    conditions.push(`u.role = ${add(String(query.role).toLowerCase())}`);
  }

  if (query.status) {
    conditions.push(`u.status = ${add(String(query.status).toLowerCase())}`);
  }

  if (query.search) {
    const placeholder = add(`%${String(query.search).trim()}%`);
    conditions.push(`(u.name ILIKE ${placeholder} OR u.email ILIKE ${placeholder} OR u.phone ILIKE ${placeholder})`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const listUsers = async ({ query = {} }) => {
  await ensureManagementSchema();

  const { page, limit, offset } = paginationFromQuery(query);
  const filters = buildUserWhere(query);
  const sortMap = {
    name: "u.name ASC NULLS LAST",
    role: "u.role ASC, u.name ASC NULLS LAST",
    status: "u.status ASC, u.name ASC NULLS LAST",
    lastLogin: "u.last_login DESC NULLS LAST",
    created: "u.created_at DESC",
  };
  const orderBy = sortMap[query.sort] || "u.created_at DESC";

  const result = await pool.query(
    `
    SELECT
      u.id, u.name, u.email, u.phone, u.role, u.status, u.last_login, u.created_at, u.updated_at,
      a.id AS artist_id,
      a.artist_name,
      l.id AS label_id,
      l.label_name
    FROM users u
    LEFT JOIN artists a ON a.user_id = u.id
    LEFT JOIN labels l ON l.user_id = u.id
    ${filters.where}
    ORDER BY ${orderBy}
    LIMIT $${filters.values.length + 1}
    OFFSET $${filters.values.length + 2}
    `,
    [...filters.values, limit, offset]
  );

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM users u
    ${filters.where}
    `,
    filters.values
  );

  const total = Number(countResult.rows[0]?.total || 0);

  return {
    users: result.rows.map(mapUser),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const getUserById = async (id) => {
  await ensureManagementSchema();

  const result = await pool.query(
    `
    SELECT
      u.id, u.name, u.email, u.phone, u.role, u.status, u.last_login, u.created_at, u.updated_at,
      a.id AS artist_id,
      a.artist_name,
      l.id AS label_id,
      l.label_name
    FROM users u
    LEFT JOIN artists a ON a.user_id = u.id
    LEFT JOIN labels l ON l.user_id = u.id
    WHERE u.id = $1
    LIMIT 1
    `,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  const activity = await pool.query(
    `
    SELECT id, action, entity_type, entity_id, metadata_json, created_at
    FROM activity_logs
    WHERE user_id = $1 OR metadata_json->>'targetUserId' = $1::text
    ORDER BY created_at DESC
    LIMIT 30
    `,
    [id]
  );

  return {
    ...mapUser(result.rows[0]),
    activity: activity.rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata_json || {},
      createdAt: row.created_at,
    })),
  };
};

const normalizeUserPayload = (payload = {}, { requirePassword = false } = {}) => {
  const role = cleanText(payload.role)?.toLowerCase() || "artist";
  const status = cleanText(payload.status)?.toLowerCase() || "active";

  if (!allowedRoles.has(role)) {
    throw new Error("Invalid user role.");
  }

  if (!allowedStatuses.has(status)) {
    throw new Error("Invalid user status.");
  }

  const password = cleanText(payload.password);

  if (requirePassword && !password) {
    throw new Error("Password is required.");
  }

  return {
    name: cleanText(payload.name),
    email: cleanText(payload.email)?.toLowerCase(),
    phone: cleanText(payload.phone),
    role,
    status,
    password,
  };
};

const createUser = async ({ payload, user }) => {
  await ensureManagementSchema();

  const input = normalizeUserPayload(payload, { requirePassword: false });

  if (!input.name || !input.email) {
    throw new Error("Name and email are required.");
  }

  const existing = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [input.email]);

  if (existing.rows.length) {
    const error = new Error("User already exists.");
    error.statusCode = 409;
    throw error;
  }

  const temporaryPassword = input.password || createTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const result = await pool.query(
    `
    INSERT INTO users (name, email, phone, password, role, status, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING id, name, email, phone, role, status, last_login, created_at, updated_at
    `,
    [input.name, input.email, input.phone, passwordHash, input.role, input.status]
  );

  await logActivity({
    userId: user?.id,
    action: "user_created",
    entityType: "user",
    entityId: result.rows[0].id,
    metadata: { role: input.role, targetUserId: result.rows[0].id },
  });
  await createNotification({
    userId: result.rows[0].id,
    title: "Welcome to Nixa Music",
    message: "Your account has been created. Sign in to complete onboarding.",
    type: "user_created",
    metadata: { role: input.role },
  });
  await sendEmail({ to: input.email, ...templates.welcome({ name: input.name, password: temporaryPassword }) });

  return {
    user: mapUser(result.rows[0]),
    temporaryPassword,
  };
};

const updateUser = async ({ id, payload, user }) => {
  await ensureManagementSchema();

  const current = await getUserById(id);

  if (!current) {
    return null;
  }

  const input = normalizeUserPayload({ ...current, ...payload }, { requirePassword: false });
  const email = input.email || current.email;

  if (!input.name || !email) {
    throw new Error("Name and email are required.");
  }

  const duplicate = await pool.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2", [email, id]);

  if (duplicate.rows.length) {
    const error = new Error("Another user already uses this email.");
    error.statusCode = 409;
    throw error;
  }

  const result = await pool.query(
    `
    UPDATE users
    SET name = $1, email = $2, phone = $3, role = $4, status = $5, updated_at = NOW()
    WHERE id = $6
    RETURNING id, name, email, phone, role, status, last_login, created_at, updated_at
    `,
    [input.name, email, input.phone, input.role, input.status, id]
  );

  await logActivity({
    userId: user?.id,
    action: "user_updated",
    entityType: "user",
    entityId: id,
    metadata: { targetUserId: id, changes: payload },
  });

  return mapUser(result.rows[0]);
};

const updateUserStatus = async ({ id, status, user }) => {
  await ensureManagementSchema();
  const normalized = cleanText(status)?.toLowerCase();

  if (!allowedStatuses.has(normalized)) {
    throw new Error("Invalid user status.");
  }

  const result = await pool.query(
    `
    UPDATE users
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, name, email, phone, role, status, last_login, created_at, updated_at
    `,
    [normalized, id]
  );

  if (!result.rows[0]) {
    return null;
  }

  await logActivity({
    userId: user?.id,
    action: normalized === "active" ? "user_enabled" : "user_disabled",
    entityType: "user",
    entityId: id,
    metadata: { status: normalized, targetUserId: id },
  });

  return mapUser(result.rows[0]);
};

const resetUserPassword = async ({ id, payload = {}, user }) => {
  await ensureManagementSchema();

  const password = cleanText(payload.password) || createTemporaryPassword();
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
    UPDATE users
    SET password = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id, name, email, phone, role, status, last_login, created_at, updated_at
    `,
    [passwordHash, id]
  );

  if (!result.rows[0]) {
    return null;
  }

  await logActivity({
    userId: user?.id,
    action: "password_reset",
    entityType: "user",
    entityId: id,
    metadata: { targetUserId: id },
  });
  await createNotification({
    userId: id,
    title: "Password reset",
    message: "A temporary password was generated for your account.",
    type: "security",
  });

  return {
    user: mapUser(result.rows[0]),
    temporaryPassword: password,
  };
};

const deleteUser = async ({ id, user }) => updateUserStatus({ id, status: "disabled", user });

const buildArtistWhere = (query = {}, prefix = "a") => {
  const conditions = [];
  const values = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.status) {
    conditions.push(`${prefix}.status = ${add(String(query.status).toLowerCase())}`);
  }

  if (isUuid(query.userId || query.user_id)) {
    conditions.push(`${prefix}.user_id = ${add(query.userId || query.user_id)}`);
  }

  if (isUuid(query.labelId || query.label_id)) {
    const labelPlaceholder = add(query.labelId || query.label_id);
    conditions.push(`(
      ${prefix}.label_id = ${labelPlaceholder}
      OR EXISTS (
        SELECT 1 FROM artist_label_map alm
        WHERE alm.artist_id = ${prefix}.id
          AND alm.label_id = ${labelPlaceholder}
          AND alm.status = 'active'
      )
    )`);
  }

  if (query.search) {
    const placeholder = add(`%${String(query.search).trim()}%`);
    conditions.push(`(
      ${prefix}.artist_name ILIKE ${placeholder}
      OR ${prefix}.legal_name ILIKE ${placeholder}
      OR ${prefix}.email ILIKE ${placeholder}
      OR ${prefix}.phone ILIKE ${placeholder}
      OR ${prefix}.country ILIKE ${placeholder}
    )`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const artistSelect = `
  SELECT
    a.*,
    u.name AS user_name,
    u.email AS user_email,
    l.label_name,
    COALESCE(fin.gross_revenue, 0) AS gross_revenue,
    COALESCE(fin.payable_balance, 0) AS payable_balance,
    COALESCE(fin.paid_amount, 0) AS paid_amount,
    COALESCE(fin.pending_amount, 0) AS pending_amount,
    COALESCE(fin.total_streams, 0) AS total_streams,
    COALESCE(rel.release_count, 0) AS release_count,
    COALESCE(pay.payout_count, 0) AS payout_count
  FROM artists a
  LEFT JOIN users u ON u.id = a.user_id
  LEFT JOIN labels l ON l.id = a.label_id
  LEFT JOIN LATERAL (
    SELECT
      SUM(COALESCE(cr.gross_revenue, 0)) AS gross_revenue,
      SUM(COALESCE(cr.payable_amount, 0)) AS payable_balance,
      SUM(COALESCE(cr.paid_amount, 0)) AS paid_amount,
      SUM(COALESCE(cr.pending_amount, 0)) AS pending_amount,
      SUM(COALESCE(rr.streams, 0)) AS total_streams
    FROM calculated_revenues cr
    LEFT JOIN raw_revenues rr ON rr.id = cr.raw_revenue_id
    WHERE cr.artist_id = a.id
  ) fin ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS release_count
    FROM releases r
    WHERE r.artist_id = a.id OR r.primary_artist ILIKE a.artist_name
  ) rel ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS payout_count
    FROM payouts p
    WHERE p.artist_id = a.id
  ) pay ON true
`;

const listArtists = async ({ query = {}, user }) => {
  await ensureManagementSchema();

  const scopedQuery = { ...query };

  if (user?.role === "artist") {
    scopedQuery.userId = user.id;
  }

  if (user?.role === "label" && !scopedQuery.labelId) {
    const labelResult = await pool.query("SELECT id FROM labels WHERE user_id = $1 LIMIT 1", [user.id]);
    if (!labelResult.rows[0]?.id) {
      return {
        artists: [],
        pagination: {
          page: Math.max(Number.parseInt(query.page || "1", 10), 1),
          limit: Math.min(Math.max(Number.parseInt(query.limit || "12", 10), 1), 100),
          total: 0,
          totalPages: 1,
        },
      };
    }

    scopedQuery.labelId = labelResult.rows[0].id;
  }

  const { page, limit, offset } = paginationFromQuery(query);
  const filters = buildArtistWhere(scopedQuery);
  const sortMap = {
    name: "a.artist_name ASC NULLS LAST",
    status: "a.status ASC, a.artist_name ASC NULLS LAST",
    revenue: "gross_revenue DESC NULLS LAST",
    payable: "pending_amount DESC NULLS LAST",
    created: "a.created_at DESC",
  };
  const orderBy = sortMap[query.sort] || "a.created_at DESC";

  const result = await pool.query(
    `
    ${artistSelect}
    ${filters.where}
    ORDER BY ${orderBy}
    LIMIT $${filters.values.length + 1}
    OFFSET $${filters.values.length + 2}
    `,
    [...filters.values, limit, offset]
  );

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM artists a
    ${filters.where}
    `,
    filters.values
  );

  const total = Number(countResult.rows[0]?.total || 0);

  return {
    artists: result.rows.map(mapArtist),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const getArtistById = async (id, { user } = {}) => {
  await ensureManagementSchema();

  const result = await pool.query(
    `
    ${artistSelect}
    WHERE a.id = $1
    LIMIT 1
    `,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  const artist = mapArtist(result.rows[0]);

  if (user?.role === "artist" && artist.userId !== user.id) {
    const error = new Error("You can only view your own artist profile.");
    error.statusCode = 403;
    throw error;
  }

  if (user?.role === "label") {
    const allowed = await pool.query(
      `
      SELECT 1
      FROM labels l
      LEFT JOIN artists a ON a.id = $2
      LEFT JOIN artist_label_map alm ON alm.label_id = l.id AND alm.artist_id = $2 AND alm.status = 'active'
      WHERE l.user_id = $1 AND (a.label_id = l.id OR alm.id IS NOT NULL)
      LIMIT 1
      `,
      [user.id, id]
    );

    if (!allowed.rows.length) {
      const error = new Error("You can only view artists assigned to your label.");
      error.statusCode = 403;
      throw error;
    }
  }

  const catalog = await pool.query(
    `
    SELECT id, title, release_type, status, release_date, upc, created_at
    FROM releases
    WHERE artist_id = $1 OR primary_artist ILIKE $2
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [id, artist.artistName || ""]
  );

  const payouts = await pool.query(
    `
    SELECT id, gross_amount, gst_deduction, tds_deduction, net_amount, status, payment_method, payout_date, created_at
    FROM payouts
    WHERE artist_id = $1
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [id]
  );

  const labels = await pool.query(
    `
    SELECT alm.id, alm.status, alm.assigned_at, alm.removed_at, l.id AS label_id, l.label_name
    FROM artist_label_map alm
    JOIN labels l ON l.id = alm.label_id
    WHERE alm.artist_id = $1
    ORDER BY alm.assigned_at DESC
    `,
    [id]
  );

  return {
    ...artist,
    catalog: catalog.rows,
    payouts: payouts.rows,
    labelAssignments: labels.rows.map((row) => ({
      id: row.id,
      labelId: row.label_id,
      labelName: row.label_name,
      status: row.status,
      assignedAt: row.assigned_at,
      removedAt: row.removed_at,
    })),
  };
};

const normalizeArtistPayload = (payload = {}) => ({
  userId: isUuid(getValue(payload, "user_id", "userId")) ? getValue(payload, "user_id", "userId") : null,
  labelId: isUuid(getValue(payload, "label_id", "labelId")) ? getValue(payload, "label_id", "labelId") : null,
  artistName: cleanText(getValue(payload, "artist_name", "artistName")),
  legalName: cleanText(getValue(payload, "legal_name", "legalName")),
  email: cleanText(payload.email),
  phone: cleanText(payload.phone),
  country: cleanText(payload.country),
  address: cleanText(payload.address),
  pan: cleanText(payload.pan)?.toUpperCase(),
  gstNumber: cleanText(getValue(payload, "gst_number", "gstNumber"))?.toUpperCase(),
  bankName: cleanText(getValue(payload, "bank_name", "bankName")),
  accountNumber: cleanText(getValue(payload, "account_number", "accountNumber")),
  ifsc: cleanText(payload.ifsc)?.toUpperCase(),
  upiId: cleanText(getValue(payload, "upi_id", "upiId")),
  paymentMethod: cleanText(getValue(payload, "payment_method", "paymentMethod")),
  status: cleanText(payload.status)?.toLowerCase() || "active",
  notes: cleanText(payload.notes),
});

const upsertArtistLabelAssignment = async ({ artistId, labelId, assignedBy, client = pool }) => {
  if (!isUuid(artistId) || !isUuid(labelId)) {
    return null;
  }

  const result = await client.query(
    `
    INSERT INTO artist_label_map (artist_id, label_id, assigned_by, status, assigned_at)
    VALUES ($1, $2, $3, 'active', NOW())
    ON CONFLICT (artist_id, label_id)
      WHERE status = 'active'
    DO UPDATE SET removed_at = NULL, status = 'active'
    RETURNING *
    `,
    [artistId, labelId, isUuid(assignedBy) ? assignedBy : null]
  );

  return result.rows[0] || null;
};

const createArtist = async ({ payload, user }) => {
  await ensureManagementSchema();
  const input = normalizeArtistPayload(payload);

  if (!input.artistName) {
    throw new Error("Artist name is required.");
  }

  if (!allowedStatuses.has(input.status)) {
    throw new Error("Invalid artist status.");
  }

  const result = await pool.query(
    `
    INSERT INTO artists (
      user_id, label_id, artist_name, legal_name, email, phone, country, address, pan,
      gst_number, bank_name, account_number, ifsc, upi_id, payment_method, status, notes,
      created_by, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,NOW())
    RETURNING *
    `,
    [
      input.userId,
      input.labelId,
      input.artistName,
      input.legalName,
      input.email,
      input.phone,
      input.country,
      input.address,
      input.pan,
      input.gstNumber,
      input.bankName,
      input.accountNumber,
      input.ifsc,
      input.upiId,
      input.paymentMethod,
      input.status,
      input.notes,
      isUuid(user?.id) ? user.id : null,
    ]
  );

  if (input.labelId) {
    await upsertArtistLabelAssignment({ artistId: result.rows[0].id, labelId: input.labelId, assignedBy: user?.id });
  }

  await logActivity({
    userId: user?.id,
    action: "artist_created",
    entityType: "artist",
    entityId: result.rows[0].id,
    metadata: { artistName: input.artistName, labelId: input.labelId },
  });

  return getArtistById(result.rows[0].id, { user: { role: "admin" } });
};

const updateArtist = async ({ id, payload, user }) => {
  await ensureManagementSchema();
  const current = await getArtistById(id, { user: { role: "admin" } });

  if (!current) {
    return null;
  }

  const input = normalizeArtistPayload({ ...current, ...payload });

  if (!input.artistName) {
    throw new Error("Artist name is required.");
  }

  if (!allowedStatuses.has(input.status)) {
    throw new Error("Invalid artist status.");
  }

  const result = await pool.query(
    `
    UPDATE artists
    SET
      user_id = $1,
      label_id = $2,
      artist_name = $3,
      legal_name = $4,
      email = $5,
      phone = $6,
      country = $7,
      address = $8,
      pan = $9,
      gst_number = $10,
      bank_name = $11,
      account_number = $12,
      ifsc = $13,
      upi_id = $14,
      payment_method = $15,
      status = $16,
      notes = $17,
      updated_at = NOW()
    WHERE id = $18
    RETURNING id
    `,
    [
      input.userId,
      input.labelId,
      input.artistName,
      input.legalName,
      input.email,
      input.phone,
      input.country,
      input.address,
      input.pan,
      input.gstNumber,
      input.bankName,
      input.accountNumber,
      input.ifsc,
      input.upiId,
      input.paymentMethod,
      input.status,
      input.notes,
      id,
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  if (input.labelId) {
    await upsertArtistLabelAssignment({ artistId: id, labelId: input.labelId, assignedBy: user?.id });
  }

  await logActivity({
    userId: user?.id,
    action: "artist_updated",
    entityType: "artist",
    entityId: id,
    metadata: { changes: payload },
  });

  return getArtistById(id, { user: { role: "admin" } });
};

const updateArtistStatus = async ({ id, status, user }) => {
  await ensureManagementSchema();
  const normalized = cleanText(status)?.toLowerCase();

  if (!allowedStatuses.has(normalized)) {
    throw new Error("Invalid artist status.");
  }

  const result = await pool.query(
    `
    UPDATE artists
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id
    `,
    [normalized, id]
  );

  if (!result.rows[0]) {
    return null;
  }

  await logActivity({
    userId: user?.id,
    action: normalized === "active" ? "artist_enabled" : "artist_disabled",
    entityType: "artist",
    entityId: id,
    metadata: { status: normalized },
  });

  return getArtistById(id, { user: { role: "admin" } });
};

const deleteArtist = async ({ id, user }) => updateArtistStatus({ id, status: "disabled", user });

const buildLabelWhere = (query = {}, prefix = "l") => {
  const conditions = [];
  const values = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.status) {
    conditions.push(`${prefix}.status = ${add(String(query.status).toLowerCase())}`);
  }

  if (isUuid(query.userId || query.user_id)) {
    conditions.push(`${prefix}.user_id = ${add(query.userId || query.user_id)}`);
  }

  if (query.search) {
    const placeholder = add(`%${String(query.search).trim()}%`);
    conditions.push(`(
      ${prefix}.label_name ILIKE ${placeholder}
      OR ${prefix}.legal_business_name ILIKE ${placeholder}
      OR ${prefix}.email ILIKE ${placeholder}
      OR ${prefix}.phone ILIKE ${placeholder}
      OR ${prefix}.country ILIKE ${placeholder}
    )`);
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
};

const labelSelect = `
  SELECT
    l.*,
    u.name AS user_name,
    u.email AS user_email,
    COALESCE(artists.artist_count, 0) AS artist_count,
    COALESCE(fin.gross_revenue, 0) AS gross_revenue,
    COALESCE(fin.payable_balance, 0) AS payable_balance,
    COALESCE(fin.paid_amount, 0) AS paid_amount,
    COALESCE(fin.pending_amount, 0) AS pending_amount,
    COALESCE(fin.total_streams, 0) AS total_streams,
    COALESCE(pay.payout_count, 0) AS payout_count
  FROM labels l
  LEFT JOIN users u ON u.id = l.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT alm.artist_id)::int AS artist_count
    FROM artist_label_map alm
    WHERE alm.label_id = l.id AND alm.status = 'active'
  ) artists ON true
  LEFT JOIN LATERAL (
    SELECT
      SUM(COALESCE(cr.gross_revenue, 0)) AS gross_revenue,
      SUM(COALESCE(cr.label_share, 0) + COALESCE(cr.artist_share, 0)) AS payable_balance,
      SUM(COALESCE(cr.paid_amount, 0)) AS paid_amount,
      SUM(COALESCE(cr.pending_amount, 0)) AS pending_amount,
      SUM(COALESCE(rr.streams, 0)) AS total_streams
    FROM calculated_revenues cr
    LEFT JOIN raw_revenues rr ON rr.id = cr.raw_revenue_id
    WHERE cr.label_id = l.id
       OR cr.artist_id IN (
         SELECT artist_id
         FROM artist_label_map
         WHERE label_id = l.id AND status = 'active'
       )
  ) fin ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS payout_count
    FROM payouts p
    WHERE p.label_id = l.id
  ) pay ON true
`;

const listLabels = async ({ query = {}, user }) => {
  await ensureManagementSchema();

  const scopedQuery = { ...query };

  if (user?.role === "label") {
    scopedQuery.userId = user.id;
  }

  const { page, limit, offset } = paginationFromQuery(query);
  const filters = buildLabelWhere(scopedQuery);
  const sortMap = {
    name: "l.label_name ASC NULLS LAST",
    status: "l.status ASC, l.label_name ASC NULLS LAST",
    revenue: "gross_revenue DESC NULLS LAST",
    payable: "pending_amount DESC NULLS LAST",
    artists: "artist_count DESC NULLS LAST",
    created: "l.created_at DESC",
  };
  const orderBy = sortMap[query.sort] || "l.created_at DESC";

  const result = await pool.query(
    `
    ${labelSelect}
    ${filters.where}
    ORDER BY ${orderBy}
    LIMIT $${filters.values.length + 1}
    OFFSET $${filters.values.length + 2}
    `,
    [...filters.values, limit, offset]
  );

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM labels l
    ${filters.where}
    `,
    filters.values
  );

  const total = Number(countResult.rows[0]?.total || 0);

  return {
    labels: result.rows.map(mapLabel),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const getLabelById = async (id, { user } = {}) => {
  await ensureManagementSchema();

  const result = await pool.query(
    `
    ${labelSelect}
    WHERE l.id = $1
    LIMIT 1
    `,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  const label = mapLabel(result.rows[0]);

  if (user?.role === "label" && label.userId !== user.id) {
    const error = new Error("You can only view your own label profile.");
    error.statusCode = 403;
    throw error;
  }

  const artists = await getLabelArtists(id);
  const payouts = await pool.query(
    `
    SELECT id, gross_amount, gst_deduction, tds_deduction, net_amount, status, payment_method, payout_date, created_at
    FROM payouts
    WHERE label_id = $1
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [id]
  );

  const catalog = await pool.query(
    `
    SELECT id, title, release_type, status, release_date, upc, created_at
    FROM releases
    WHERE label_name ILIKE $1
    ORDER BY created_at DESC
    LIMIT 20
    `,
    [label.labelName || ""]
  );

  return {
    ...label,
    artists: artists.artists,
    payouts: payouts.rows,
    catalog: catalog.rows,
  };
};

const normalizeLabelPayload = (payload = {}) => {
  const labelName = cleanText(getValue(payload, "label_name", "labelName", "name"));

  return {
    userId: isUuid(getValue(payload, "user_id", "userId")) ? getValue(payload, "user_id", "userId") : null,
    labelName,
    legalBusinessName: cleanText(getValue(payload, "legal_business_name", "legalBusinessName")),
    email: cleanText(payload.email),
    phone: cleanText(payload.phone),
    country: cleanText(payload.country),
    address: cleanText(payload.address),
    gstNumber: cleanText(getValue(payload, "gst_number", "gstNumber"))?.toUpperCase(),
    pan: cleanText(payload.pan)?.toUpperCase(),
    bankName: cleanText(getValue(payload, "bank_name", "bankName")),
    accountNumber: cleanText(getValue(payload, "account_number", "accountNumber")),
    ifsc: cleanText(payload.ifsc)?.toUpperCase(),
    upiId: cleanText(getValue(payload, "upi_id", "upiId")),
    paymentMethod: cleanText(getValue(payload, "payment_method", "paymentMethod")),
    status: cleanText(payload.status)?.toLowerCase() || "active",
    notes: cleanText(payload.notes),
  };
};

const createLabel = async ({ payload, user }) => {
  await ensureManagementSchema();
  const input = normalizeLabelPayload(payload);

  if (!input.labelName) {
    throw new Error("Label name is required.");
  }

  if (!allowedStatuses.has(input.status)) {
    throw new Error("Invalid label status.");
  }

  const result = await pool.query(
    `
    INSERT INTO labels (
      user_id, label_name, name, legal_business_name, email, phone, country, address,
      gst_number, pan, bank_name, account_number, ifsc, upi_id, payment_method, status,
      notes, created_by, updated_at
    )
    VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
    RETURNING id
    `,
    [
      input.userId,
      input.labelName,
      input.legalBusinessName,
      input.email,
      input.phone,
      input.country,
      input.address,
      input.gstNumber,
      input.pan,
      input.bankName,
      input.accountNumber,
      input.ifsc,
      input.upiId,
      input.paymentMethod,
      input.status,
      input.notes,
      isUuid(user?.id) ? user.id : null,
    ]
  );

  await logActivity({
    userId: user?.id,
    action: "label_created",
    entityType: "label",
    entityId: result.rows[0].id,
    metadata: { labelName: input.labelName },
  });

  return getLabelById(result.rows[0].id, { user: { role: "admin" } });
};

const updateLabel = async ({ id, payload, user }) => {
  await ensureManagementSchema();
  const current = await getLabelById(id, { user: { role: "admin" } });

  if (!current) {
    return null;
  }

  const input = normalizeLabelPayload({ ...current, ...payload });

  if (!input.labelName) {
    throw new Error("Label name is required.");
  }

  if (!allowedStatuses.has(input.status)) {
    throw new Error("Invalid label status.");
  }

  const result = await pool.query(
    `
    UPDATE labels
    SET
      user_id = $1,
      label_name = $2,
      name = $2,
      legal_business_name = $3,
      email = $4,
      phone = $5,
      country = $6,
      address = $7,
      gst_number = $8,
      pan = $9,
      bank_name = $10,
      account_number = $11,
      ifsc = $12,
      upi_id = $13,
      payment_method = $14,
      status = $15,
      notes = $16,
      updated_at = NOW()
    WHERE id = $17
    RETURNING id
    `,
    [
      input.userId,
      input.labelName,
      input.legalBusinessName,
      input.email,
      input.phone,
      input.country,
      input.address,
      input.gstNumber,
      input.pan,
      input.bankName,
      input.accountNumber,
      input.ifsc,
      input.upiId,
      input.paymentMethod,
      input.status,
      input.notes,
      id,
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  await logActivity({
    userId: user?.id,
    action: "label_updated",
    entityType: "label",
    entityId: id,
    metadata: { changes: payload },
  });

  return getLabelById(id, { user: { role: "admin" } });
};

const updateLabelStatus = async ({ id, status, user }) => {
  await ensureManagementSchema();
  const normalized = cleanText(status)?.toLowerCase();

  if (!allowedStatuses.has(normalized)) {
    throw new Error("Invalid label status.");
  }

  const result = await pool.query(
    `
    UPDATE labels
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING id
    `,
    [normalized, id]
  );

  if (!result.rows[0]) {
    return null;
  }

  await logActivity({
    userId: user?.id,
    action: normalized === "active" ? "label_enabled" : "label_disabled",
    entityType: "label",
    entityId: id,
    metadata: { status: normalized },
  });

  return getLabelById(id, { user: { role: "admin" } });
};

const deleteLabel = async ({ id, user }) => updateLabelStatus({ id, status: "disabled", user });

const assignArtistToLabel = async ({ labelId, artistId, user }) => {
  await ensureManagementSchema();

  const label = await getLabelById(labelId, { user: { role: "admin" } });
  const artist = await getArtistById(artistId, { user: { role: "admin" } });

  if (!label || !artist) {
    return null;
  }

  await upsertArtistLabelAssignment({ artistId, labelId, assignedBy: user?.id });
  await pool.query("UPDATE artists SET label_id = $1, updated_at = NOW() WHERE id = $2", [labelId, artistId]);

  await logActivity({
    userId: user?.id,
    action: "artist_assigned_to_label",
    entityType: "artist_label_map",
    entityId: artistId,
    metadata: { artistId, labelId, labelName: label.labelName, artistName: artist.artistName },
  });

  return getLabelArtists(labelId);
};

const removeArtistFromLabel = async ({ labelId, artistId, user }) => {
  await ensureManagementSchema();

  const result = await pool.query(
    `
    UPDATE artist_label_map
    SET status = 'removed', removed_at = NOW()
    WHERE label_id = $1 AND artist_id = $2 AND status = 'active'
    RETURNING *
    `,
    [labelId, artistId]
  );

  await pool.query("UPDATE artists SET label_id = NULL, updated_at = NOW() WHERE id = $1 AND label_id = $2", [artistId, labelId]);

  if (!result.rows[0]) {
    return null;
  }

  await logActivity({
    userId: user?.id,
    action: "artist_removed_from_label",
    entityType: "artist_label_map",
    entityId: artistId,
    metadata: { artistId, labelId },
  });

  return getLabelArtists(labelId);
};

const getLabelArtists = async (labelId) => {
  await ensureManagementSchema();

  const result = await pool.query(
    `
    SELECT
      alm.id AS assignment_id,
      alm.assigned_at,
      alm.removed_at,
      alm.status AS assignment_status,
      a.*,
      u.name AS user_name,
      u.email AS user_email,
      l.label_name,
      0 AS gross_revenue,
      0 AS payable_balance,
      0 AS paid_amount,
      0 AS pending_amount,
      0 AS total_streams,
      0 AS release_count,
      0 AS payout_count
    FROM artist_label_map alm
    JOIN artists a ON a.id = alm.artist_id
    LEFT JOIN users u ON u.id = a.user_id
    LEFT JOIN labels l ON l.id = alm.label_id
    WHERE alm.label_id = $1
    ORDER BY alm.status ASC, alm.assigned_at DESC
    `,
    [labelId]
  );

  return {
    artists: result.rows.map((row) => ({
      ...mapArtist(row),
      assignmentId: row.assignment_id,
      assignmentStatus: row.assignment_status,
      assignedAt: row.assigned_at,
      removedAt: row.removed_at,
    })),
  };
};

const getMyProfile = async (user) => {
  await ensureManagementSchema();

  const profile = await getUserById(user.id);
  const response = { user: profile };

  if (user.role === "artist") {
    const artists = await listArtists({ query: { userId: user.id, limit: 1 }, user: { role: "admin" } });
    response.artist = artists.artists[0] || null;
  }

  if (user.role === "label") {
    const labels = await listLabels({ query: { userId: user.id, limit: 1 }, user: { role: "admin" } });
    response.label = labels.labels[0] || null;

    if (response.label?.id) {
      response.assignedArtists = (await getLabelArtists(response.label.id)).artists.filter((artist) => artist.assignmentStatus === "active");
    }
  }

  return response;
};

const updateMyProfile = async ({ payload, user }) => {
  await ensureManagementSchema();

  const allowedUserPayload = {
    name: payload.name,
    email: user.email || payload.email,
    phone: payload.phone,
    role: user.role,
    status: "active",
  };

  const updatedUser = await updateUser({ id: user.id, payload: allowedUserPayload, user });

  if (user.role === "artist") {
    const artists = await listArtists({ query: { userId: user.id, limit: 1 }, user: { role: "admin" } });
    if (artists.artists[0]?.id) {
      await updateArtist({
        id: artists.artists[0].id,
        payload: {
          ...artists.artists[0],
          email: payload.email,
          phone: payload.phone,
          country: payload.country,
          address: payload.address,
          pan: payload.pan,
          gstNumber: payload.gstNumber,
          bankName: payload.bankName,
          accountNumber: payload.accountNumber,
          ifsc: payload.ifsc,
          upiId: payload.upiId,
          paymentMethod: payload.paymentMethod,
          notes: payload.notes,
        },
        user,
      });
    }
  }

  if (user.role === "label") {
    const labels = await listLabels({ query: { userId: user.id, limit: 1 }, user: { role: "admin" } });
    if (labels.labels[0]?.id) {
      await updateLabel({
        id: labels.labels[0].id,
        payload: {
          ...labels.labels[0],
          email: payload.email,
          phone: payload.phone,
          country: payload.country,
          address: payload.address,
          gstNumber: payload.gstNumber,
          pan: payload.pan,
          bankName: payload.bankName,
          accountNumber: payload.accountNumber,
          ifsc: payload.ifsc,
          upiId: payload.upiId,
          paymentMethod: payload.paymentMethod,
          notes: payload.notes,
        },
        user,
      });
    }
  }

  await logActivity({
    userId: user.id,
    action: "profile_updated",
    entityType: "user",
    entityId: user.id,
    metadata: { role: user.role },
  });
  await createNotification({
    userId: user.id,
    title: "Profile updated",
    message: "Your profile update was saved.",
    type: "profile_update",
  });

  return {
    user: updatedUser,
    profile: await getMyProfile(user),
  };
};

const listActivityLogs = async ({ query = {} }) => {
  await ensureManagementSchema();

  const { page, limit, offset } = paginationFromQuery(query, 20);
  const conditions = [];
  const values = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (query.action) {
    conditions.push(`al.action = ${add(query.action)}`);
  }

  if (query.entityType || query.entity_type) {
    conditions.push(`al.entity_type = ${add(query.entityType || query.entity_type)}`);
  }

  if (query.search) {
    const placeholder = add(`%${String(query.search).trim()}%`);
    conditions.push(`(
      al.action ILIKE ${placeholder}
      OR al.entity_type ILIKE ${placeholder}
      OR u.name ILIKE ${placeholder}
      OR u.email ILIKE ${placeholder}
      OR al.metadata_json::text ILIKE ${placeholder}
    )`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query(
    `
    SELECT
      al.id, al.user_id, al.action, al.entity_type, al.entity_id, al.metadata_json, al.created_at,
      u.name AS user_name,
      u.email AS user_email
    FROM activity_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ${where}
    ORDER BY al.created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  const countResult = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM activity_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ${where}
    `,
    values
  );

  const total = Number(countResult.rows[0]?.total || 0);

  return {
    logs: result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata_json || {},
      createdAt: row.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

module.exports = {
  assignArtistToLabel,
  createArtist,
  createLabel,
  createTemporaryPassword,
  createUser,
  deleteArtist,
  deleteLabel,
  deleteUser,
  getArtistById,
  getLabelArtists,
  getLabelById,
  getMyProfile,
  getUserById,
  listActivityLogs,
  listArtists,
  listLabels,
  listUsers,
  logActivity,
  removeArtistFromLabel,
  resetUserPassword,
  updateArtist,
  updateArtistStatus,
  updateLabel,
  updateLabelStatus,
  updateMyProfile,
  updateUser,
  updateUserStatus,
};
