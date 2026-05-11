const pool = require("../../config/db");
const { ensureSettingsSchema } = require("./settingsSchema");

const smtpStatus = () => ({
  configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS),
  host: process.env.SMTP_HOST || null,
  from: process.env.SMTP_FROM || null,
});

const mapSetting = (row) => ({
  id: row.id,
  key: row.key,
  value: row.value,
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
});

const listSettings = async () => {
  await ensureSettingsSchema();

  const result = await pool.query("SELECT * FROM settings ORDER BY key ASC");
  const settings = result.rows.map(mapSetting);

  return {
    settings,
    smtp: smtpStatus(),
  };
};

const updateSettings = async ({ payload = {}, user }) => {
  await ensureSettingsSchema();

  const entries = Object.entries(payload).filter(([key]) => key !== "smtp");

  for (const [key, value] of entries) {
    await pool.query(
      `
      INSERT INTO settings (key, value, updated_by, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()
      `,
      [key, JSON.stringify(value), user?.id || null]
    );
  }

  return listSettings();
};

module.exports = {
  listSettings,
  updateSettings,
};
