# Install Guide

## Requirements

- Node.js 18 or newer
- PostgreSQL 14 or newer
- npm

## Database

Create the database:

```sql
CREATE DATABASE nixa_music;
```

Configure `.env`:

```powershell
copy .env.example .env
```

Update:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`

## Backend

```powershell
cd "C:\Users\rahul\Documents\New project\nixa-music"
npm install
npm install helmet express-rate-limit morgan nodemailer
node createAdmin.js
npm run dev
```

## Frontend

```powershell
cd "C:\Users\rahul\Documents\New project\nixa-music\nixa-dashboard"
npm install
npm run dev
```

## Migrations

Run migration SQL files in order:

1. `migrations/phase3_revenue.sql`
2. `migrations/phase5_finance.sql`
3. `migrations/phase6_payouts_invoices.sql`
4. `migrations/phase7_user_artist_label_management.sql`
5. `migrations/phase8_production_polish.sql`

The app also runs idempotent schema checks from services.
