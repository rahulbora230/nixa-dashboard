const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const { ensureAuthSchema } = require("./authSchema");
const { sendEmail, templates } = require("../email/emailService");
const { createNotification } = require("../notifications/notificationService");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const validatePasswordStrength = (password) => {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("Password must include uppercase, lowercase and number characters.");
  }
};

const createPasswordReset = async ({ email }) => {
  await ensureAuthSchema();

  const userResult = await pool.query("SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
  const user = userResult.rows[0];

  if (!user) {
    return { accepted: true };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await pool.query(
    `
    INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    `,
    [user.id, tokenHash, expiresAt]
  );

  const resetUrl = `${process.env.FRONTEND_URL || "http://127.0.0.1:5173"}/reset-password?token=${token}`;
  await sendEmail({ to: user.email, ...templates.passwordReset({ resetUrl }) });
  await createNotification({
    userId: user.id,
    title: "Password reset requested",
    message: "A password reset link was generated for your account.",
    type: "security",
  });

  return { accepted: true, resetUrl: process.env.NODE_ENV === "production" ? undefined : resetUrl };
};

const resetPassword = async ({ token, password }) => {
  await ensureAuthSchema();
  validatePasswordStrength(password);

  const tokenHash = hashToken(token || "");
  const tokenResult = await pool.query(
    `
    SELECT prt.*, u.email
    FROM password_reset_tokens prt
    JOIN users u ON u.id = prt.user_id
    WHERE prt.token_hash = $1
      AND prt.used_at IS NULL
      AND prt.expires_at > NOW()
    ORDER BY prt.created_at DESC
    LIMIT 1
    `,
    [tokenHash]
  );

  const resetToken = tokenResult.rows[0];

  if (!resetToken) {
    const error = new Error("Reset token is invalid or expired.");
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2", [passwordHash, resetToken.user_id]);
    await client.query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [resetToken.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await createNotification({
    userId: resetToken.user_id,
    title: "Password updated",
    message: "Your Nixa Music password was changed successfully.",
    type: "security",
  });

  return { updated: true };
};

module.exports = {
  createPasswordReset,
  resetPassword,
  validatePasswordStrength,
};
