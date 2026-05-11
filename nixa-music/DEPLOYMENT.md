# Deployment Guide

## Backend

Set production environment variables:

```powershell
$env:NODE_ENV="production"
$env:PORT="5000"
$env:JWT_SECRET="use-a-long-random-secret"
$env:CORS_ORIGIN="https://your-frontend-domain.com"
$env:FRONTEND_URL="https://your-frontend-domain.com"
```

Start:

```powershell
npm install --omit=dev
npm start
```

## Frontend

Create a frontend environment file:

```text
VITE_API_BASE_URL=https://your-api-domain.com/api
```

Build:

```powershell
cd nixa-dashboard
npm install
npm run build
```

Deploy `nixa-dashboard/dist` to your static host.

## Backup

Create a PostgreSQL backup:

```powershell
pg_dump -h localhost -U postgres -d nixa_music -F c -f nixa_music.backup
```

Restore:

```powershell
pg_restore -h localhost -U postgres -d nixa_music --clean --if-exists nixa_music.backup
```

## Data Safety

- Prefer `status = disabled` or `deleted_at` over permanent deletes.
- Keep revenue import rows and payout logs immutable.
- Back up before split recalculation or bulk payout processing.
