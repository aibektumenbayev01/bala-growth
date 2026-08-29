# GrowthTrack KZ

A full-stack pediatric growth monitoring application for tracking children's height and weight and analyzing growth using WHO growth standards.

🔗 **Live Demo:** https://bala-growth.onrender.com  
Click **Try Demo** to explore the application without registration.

> Educational portfolio project. Not intended for medical diagnosis.

## Features

- Child profiles and measurement history
- WHO percentile and Z-score analysis
- Growth velocity tracking and status indicators
- Interactive WHO growth charts
- Growth Story timeline
- Growth Simulator
- PDF growth reports
- JWT authentication and protected user data
- Demo account

## Tech Stack

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts  
**Backend:** Node.js, Express, Prisma  
**Database:** PostgreSQL  
**Auth:** JWT, bcrypt  
**Tools:** Docker, pnpm, jsPDF  
**Deployment:** Render

## Architecture

```text
React + TypeScript
        ↓
    REST API
        ↓
Node.js + Express
        ↓
    Prisma ORM
        ↓
    PostgreSQL
```

Monorepo structure:

```text
apps/
├── web/        # React frontend
└── api/        # Express backend

packages/
└── shared/     # Shared TypeScript types
```

## Running Locally

```bash
git clone <YOUR_REPO_URL>
cd bala-growth
pnpm install
```

Create `apps/web/.env`:

```env
VITE_API_URL=http://localhost:3001
```

Create `apps/api/.env`:

```env
DATABASE_URL="your-postgresql-url"
JWT_SECRET="your-secret"
```

Then:

```bash
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate dev
```

Run the API and frontend:

```bash
cd apps/api
pnpm dev
```

```bash
cd apps/web
pnpm dev
```

## Testing

```bash
pnpm --filter api test
```

Backend tests cover authentication, validation, protected resources, and core API behavior.
