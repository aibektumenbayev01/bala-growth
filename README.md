# Bala Growth
 
Pet-project для портфолио Junior Software Engineer.  
Приложение для мониторинга роста детей: профили, измерения (рост/вес), графики WHO и базовая аналитика.
 
---
 
## Project Goal
 
Показать практические full-stack навыки:
 
- монорепо на `pnpm workspaces`
- frontend на React + TypeScript + Vite
- backend API на Express + Prisma
- работа с SQLite и миграциями Prisma
- реальный процесс настройки и отладки окружения
 
---
 
## Features
 
- Создание и просмотр профилей детей
- Добавление измерений роста и веса
- Удаление измерений
- Удаление профиля ребёнка
- График роста относительно WHO-кривых
- Базовые вычисления динамики роста
 
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
Useful scripts (from repo root)

## API Endpoints

- GET /health
- GET /children
- POST /children
- GET /children/:id/measurements
- POST /children/:id/measurements
- DELETE /measurements/:id
- DELETE /children/:id

## Troubleshooting

1) Cannot find module ```@bala/shared / vite/client / lucide-react / recharts```

Обычно зависимости установлены некорректно:

```
rm -rf node_modules apps/web/node_modules apps/api/node_modules
pnpm install
```
2) Prisma error: Cannot find module '.prisma/client/default'

Сгенерируй Prisma client:


```pnpm --filter api exec prisma generate```
3) Vite не открывается на 5173

Проверь, что порт слушается:

```
lsof -nP -iTCP:5173 -sTCP:LISTEN
curl -i http://127.0.0.1:5173
```
4) VS Code Debug Terminal мешает запуску

Используй обычный Terminal и отключи: ```Debug: Toggle Auto Attach -> Off```

Roadmap

- Authentication / users
- Unit and integration tests
- Docker setup
- CI (GitHub Actions: lint + build + test)
- Улучшение аналитики и алертов

