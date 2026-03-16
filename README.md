# Bala Growth

Monorepo with:

- `apps/web` - React + TypeScript + Vite frontend
- `apps/api` - Express + Prisma backend
- `packages/shared` - shared types (`@bala/shared`)

## Requirements

- Node.js 20+
- `pnpm` (the repo is configured for pnpm workspaces)

## Quick start

Run all commands from repository root:

```bash
pnpm install
pnpm dev:web
```

For API (in another terminal):

```bash
pnpm dev:api
```

## Common clone/setup issue (module not found)

If you see errors like:

- `Cannot find module '@bala/shared'`
- `Cannot find module 'lucide-react'`
- `Cannot find module 'recharts'`
- `Cannot find type definition file for 'vite/client'`

it usually means dependencies were not installed with `pnpm` from the repo root.

### Fix

```bash
rm -rf node_modules apps/web/node_modules apps/api/node_modules
pnpm install
```

If you previously ran `npm install`, delete generated npm artifacts and reinstall with pnpm:

```bash
rm -f package-lock.json apps/web/package-lock.json apps/api/package-lock.json
pnpm install
```
