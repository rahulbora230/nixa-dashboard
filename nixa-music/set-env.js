const fs = require('fs');
const path = require('path');

// Create .env file with JWT_SECRET
const envContent = `# Nixa Music Environment Variables
NODE_ENV=development
PORT=5000

# JWT Secret (change this to a strong random string in production)
JWT_SECRET=nixa_music_jwt_secret_key_2024_development_super_secure_change_me_in_production

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nixa_music
DB_USER=postgres
DB_PASSWORD=your_password_here

# File Upload
JSON_BODY_LIMIT=2mb

# Security
CORS_ORIGIN=http://localhost:5173
`;

const envPath = path.join(__dirname, '.env');

try {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully');
  console.log('🔄 Please restart your server: node server.js');
} catch (error) {
  console.error('❌ Error creating .env file:', error.message);
}
