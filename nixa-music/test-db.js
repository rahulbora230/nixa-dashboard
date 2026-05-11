const pool = require('./src/config/db');

async function testDatabase() {
  try {
    // Check if users table exists
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      ) as users_exists
    `);
    
    console.log('Users table exists:', tableExists.rows[0].users_exists);
    
    if (!tableExists.rows[0].users_exists) {
      console.log('Creating users table...');
      await pool.query(`
        CREATE TABLE users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'artist',
          status TEXT NOT NULL DEFAULT 'active',
          phone TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          last_login TIMESTAMP
        );
      `);
      console.log('Users table created');
    }
    
    // Check existing users
    const users = await pool.query('SELECT id, name, email, role, status FROM users LIMIT 10');
    console.log('Existing users:', users.rows);
    
    // Create test admin user if not exists
    const adminExists = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@nixa.com']);
    
    if (adminExists.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await pool.query(`
        INSERT INTO users (name, email, password, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, status
      `, ['Admin User', 'admin@nixa.com', hashedPassword, 'admin', 'active']);
      
      console.log('Test admin user created: admin@nixa.com / admin123');
    }
    
    // Create test artist user if not exists
    const artistExists = await pool.query('SELECT id FROM users WHERE email = $1', ['artist@nixa.com']);
    
    if (artistExists.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('artist123', 10);
      
      await pool.query(`
        INSERT INTO users (name, email, password, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, status
      `, ['Artist User', 'artist@nixa.com', hashedPassword, 'artist', 'active']);
      
      console.log('Test artist user created: artist@nixa.com / artist123');
    }
    
    // Create test label user if not exists
    const labelExists = await pool.query('SELECT id FROM users WHERE email = $1', ['label@nixa.com']);
    
    if (labelExists.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('label123', 10);
      
      await pool.query(`
        INSERT INTO users (name, email, password, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, email, role, status
      `, ['Label User', 'label@nixa.com', hashedPassword, 'label', 'active']);
      
      console.log('Test label user created: label@nixa.com / label123');
    }
    
    // Check finance tables
    const financeTables = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'calculated_revenues'
      ) as calculated_revenues_exists,
      EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'raw_revenues'
      ) as raw_revenues_exists
    `);
    
    console.log('Finance tables exist:', financeTables.rows[0]);
    
  } catch (error) {
    console.error('Database test error:', error);
  } finally {
    await pool.end();
  }
}

testDatabase();
