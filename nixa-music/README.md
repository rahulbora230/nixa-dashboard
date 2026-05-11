# Nixa Music SaaS

Nixa Music is a premium music distribution and royalty operations platform for admins, artists, labels and accountants.

## Modules

- Auth and role-based dashboards
- Catalog and release submission
- CSV revenue upload and calculated royalty engine
- Analytics dashboards
- Split and finance management
- Payout and invoice system
- User, artist and label management
- Notifications, settings and password reset

## Quick Start

```powershell
cd "C:\Users\rahul\Documents\New project\nixa-music"
npm install
copy .env.example .env
node createAdmin.js
npm run dev
```

```powershell
cd "C:\Users\rahul\Documents\New project\nixa-music\nixa-dashboard"
npm install
npm run dev
```

Backend: `http://localhost:5000`
Frontend: `http://127.0.0.1:5173`

## Optional Production Packages

Phase 8 supports these packages when installed:

```powershell
npm install helmet express-rate-limit morgan nodemailer
```

The backend falls back to safe built-in middleware when they are not installed.
