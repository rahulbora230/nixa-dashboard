const optionalRequire = (packageName) => {
  try {
    return require(packageName);
  } catch {
    return null;
  }
};

const getTransporter = () => {
  const nodemailer = optionalRequire("nodemailer");

  if (!nodemailer || !process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) {
    return { sent: false, reason: "No recipient." };
  }

  const transporter = getTransporter();

  if (!transporter) {
    console.log(`Email skipped: ${subject} -> ${to}`);
    return { sent: false, reason: "SMTP not configured or nodemailer missing." };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || "Nixa Music <no-reply@nixamusic.com>",
    to,
    subject,
    html,
    text,
  });

  return { sent: true };
};

const templates = {
  welcome: ({ name, password }) => ({
    subject: "Welcome to Nixa Music",
    text: `Welcome ${name || "to Nixa Music"}. Your temporary password is ${password}.`,
    html: `<p>Welcome ${name || "to Nixa Music"}.</p><p>Your temporary password is <strong>${password}</strong>.</p>`,
  }),
  passwordReset: ({ resetUrl }) => ({
    subject: "Reset your Nixa Music password",
    text: `Use this link to reset your password: ${resetUrl}`,
    html: `<p>Use this secure link to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  }),
};

module.exports = {
  sendEmail,
  templates,
};
