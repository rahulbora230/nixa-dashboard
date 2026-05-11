const bcrypt = require("bcryptjs");
const pool = require("./src/config/db");

const createAdmin = async () => {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const result = await pool.query(
    `
    INSERT INTO users (name, email, password, role, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email)
    DO UPDATE SET
      name = EXCLUDED.name,
      password = EXCLUDED.password,
      role = EXCLUDED.role,
      status = EXCLUDED.status
    RETURNING id, email, role, status
    `,
    ["Admin", "admin@nixamusic.com", hashedPassword, "admin", "active"]
  );

  console.log("Admin ready:", result.rows[0]);
  process.exit();
};

createAdmin();
