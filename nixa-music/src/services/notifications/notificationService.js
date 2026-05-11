const pool = require("../../config/db");
const { ensureNotificationSchema } = require("./notificationSchema");

const isUuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);

const mapNotification = (row) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  message: row.message,
  type: row.type,
  isRead: row.is_read,
  metadata: row.metadata_json || {},
  createdAt: row.created_at,
});

const createNotification = async ({ userId = null, title, message, type = "info", metadata = {}, client = pool }) => {
  await ensureNotificationSchema();

  if (!title || !message) {
    return null;
  }

  const result = await client.query(
    `
    INSERT INTO notifications (user_id, title, message, type, metadata_json)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
    `,
    [isUuid(userId) ? userId : null, title, message, type, metadata]
  );

  return mapNotification(result.rows[0]);
};

const listNotifications = async ({ user, query = {} }) => {
  await ensureNotificationSchema();

  const values = [];
  const conditions = [];
  const add = (value) => {
    values.push(value);
    return `$${values.length}`;
  };

  if (user.role !== "admin") {
    conditions.push(`(user_id = ${add(user.id)} OR user_id IS NULL)`);
  } else if (query.mine === "true") {
    conditions.push(`(user_id = ${add(user.id)} OR user_id IS NULL)`);
  }

  if (query.unread === "true") {
    conditions.push("is_read = false");
  }

  if (query.type) {
    conditions.push(`type = ${add(query.type)}`);
  }

  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit || "20", 10), 1), 100);
  const offset = (page - 1) * limit;
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const result = await pool.query(
    `
    SELECT *
    FROM notifications
    ${where}
    ORDER BY created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
    `,
    [...values, limit, offset]
  );

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM notifications ${where}`, values);
  const unreadResult = await pool.query(
    `
    SELECT COUNT(*)::int AS unread
    FROM notifications
    ${where ? `${where} AND` : "WHERE"} is_read = false
    `,
    values
  );

  const total = Number(countResult.rows[0]?.total || 0);

  return {
    notifications: result.rows.map(mapNotification),
    unreadCount: Number(unreadResult.rows[0]?.unread || 0),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
};

const markNotificationRead = async ({ id, user }) => {
  await ensureNotificationSchema();

  const values = [id];
  let scope = "";

  if (user.role !== "admin") {
    values.push(user.id);
    scope = "AND (user_id = $2 OR user_id IS NULL)";
  }

  const result = await pool.query(
    `
    UPDATE notifications
    SET is_read = true
    WHERE id = $1 ${scope}
    RETURNING *
    `,
    values
  );

  return result.rows[0] ? mapNotification(result.rows[0]) : null;
};

const markAllNotificationsRead = async ({ user }) => {
  await ensureNotificationSchema();

  if (user.role === "admin") {
    await pool.query("UPDATE notifications SET is_read = true");
    return { updated: true };
  }

  await pool.query("UPDATE notifications SET is_read = true WHERE user_id = $1 OR user_id IS NULL", [user.id]);
  return { updated: true };
};

module.exports = {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
};
