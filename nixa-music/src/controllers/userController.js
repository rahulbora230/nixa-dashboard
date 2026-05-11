const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { ensureManagementSchema } = require("../services/management/managementSchema");
const { logActivity } = require("../services/management/managementService");
const { createPasswordReset, resetPassword } = require("../services/auth/passwordResetService");

const JWT_SECRET = process.env.JWT_SECRET || "nixa_secret_key";

exports.createUser = async (req, res) => {
  try {
    await ensureManagementSchema();
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Only admin can create users
    if (req.user && req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can create users" });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role, status, created_at`,
      [name, email, hashedPassword, role, "active"]
    );

    res.status(201).json({
      message: "User created successfully",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Create User Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.loginUser = async (req, res) => {
  try {
    await ensureManagementSchema();
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];

    if (user.status !== "active") {
      return res.status(403).json({ message: "Account is inactive" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    await pool.query("UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1", [user.id]);
    await logActivity({
      userId: user.id,
      action: "login",
      entityType: "user",
      entityId: user.id,
      metadata: { email: user.email },
    });

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required.", errors: [] });
    }

    const result = await createPasswordReset({ email });

    res.json({
      success: true,
      message: "If an account exists, a reset link has been sent.",
      data: result,
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to start password reset.",
      errors: [],
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Token and password are required.", errors: [] });
    }

    const result = await resetPassword({ token, password });

    res.json({
      success: true,
      message: "Password updated successfully.",
      data: result,
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Unable to reset password.",
      errors: [],
    });
  }
};

exports.getUsers = async (req, res) => {
  try {
    await ensureManagementSchema();
    // Admin sees all users
    if (req.user?.role === "admin") {
      const result = await pool.query(
        `SELECT id, name, email, phone, role, status, last_login, created_at, updated_at 
         FROM users 
         ORDER BY created_at DESC`
      );

      return res.json(result.rows);
    }

    // Non-admin sees only own profile
    const result = await pool.query(
      `SELECT id, name, email, phone, role, status, last_login, created_at, updated_at 
       FROM users 
       WHERE id = $1`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
