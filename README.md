# Bala Growth

Full-stack web application for monitoring children's growth using WHO growth charts.

Users can create child profiles, record height and weight measurements, and visualize growth trends compared with WHO percentile curves.

This project was built as a portfolio pet-project to demonstrate full-stack development skills.

---

# Demo

### Application Interface

![Dashboard](docs:dashboard.png)
![Profile1](docs:profile1.png)
![chart1](docs:chart1.png)
![Profile2](docs:profile2.png)
![chart2](docs:chart2.png)

![Child Profile](docs/profile.png)

![Growth Chart](docs/chart.png)

## About This Project

This project was created as a portfolio application to demonstrate:

- full-stack TypeScript development
- monorepo architecture
- REST API design
- database modeling with Prisma
- data visualization in React

It simulates a simplified pediatric growth monitoring system.

 
## Features


- Create and manage child profiles
- Record height and weight measurements
- Visualize growth trends using WHO percentile curves
- Calculate growth metrics and Z-score indicators
- Delete measurements and profiles
  
---
 
## Tech Stack
 
### Frontend
- React
- TypeScript
- Vite
- Recharts
- Lucide React
 
### Backend
- Node.js
- Express
- Prisma ORM
 
### Database
- SQLite
 
### Monorepo
- pnpm workspaces
 
---

## Architecture

Monorepo structure using pnpm workspaces.

Frontend communicates with Express API via REST endpoints.
Shared TypeScript types are stored in `@bala/shared` package.

React (Vite)
    ↓
Express API
    ↓
Prisma ORM
    ↓
SQLite Database
 
## Project Structure
 
```text
bala-growth/
├─ apps/
│  ├─ web/              # React + Vite frontend
│  └─ api/              # Express + Prisma backend
├─ packages/
│  └─ shared/           # shared types (@bala/shared)
├─ pnpm-workspace.yaml
└─ package.json
Requirements
```


## Все команды ниже выполняй из корня репозитория:

```git clone <YOUR_REPO_URL>
cd bala-growth
 
corepack enable
corepack prepare pnpm@10.29.3 --activate
 
pnpm install
```
## 1) Environment variables

Создай ```.env``` в корне проекта:
```VITE_API_URL=http://localhost:3001```

Создай ```apps/api/.env```:

```DATABASE_URL="file:./dev.db"```

## 2) Prisma setup

```
pnpm --filter api exec prisma generate
pnpm --filter api exec prisma migrate dev
```
## Run project
Запуск в двух терминалах:

Terminal 1 — Web
```
cd apps/web
pnpm dev --host 127.0.0.1 --port 5173 --strictPort
```
Terminal 2 — API
```
cd apps/api
pnpm dev
```
Открой:

Frontend: ```http://127.0.0.1:5173```
API healthcheck: ```http://127.0.0.1:3001/health```

## API Endpoints

- GET /health
- GET /children
- POST /children
- GET /children/:id/measurements
- POST /children/:id/measurements
- DELETE /measurements/:id
- DELETE /children/:id


## Future Improvements

- Authentication and multi-user support
- Unit and integration tests
- Docker setup
- CI pipeline (GitHub Actions)
- Improved growth analytics
