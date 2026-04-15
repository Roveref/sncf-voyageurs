# BearingPoint Dashboard

Team staffing and management dashboard — Gantt timeline, utilization heatmaps, opportunity pipeline, bookings, and AI assistant.

## Prerequisites

- **Node.js** >= 18
- **Python 3** (for data import and CRM refresh scripts; requires `openpyxl`)
- **SQLite 3** (used via `better-sqlite3`, no separate server needed)

## Quick Start

```bash
# 1. Install dependencies (frontend + backend)
npm install --legacy-peer-deps
cd api && npm install && cd ..

# 2. Configure the backend
cp api/.env.example api/.env
# Edit api/.env — set ANTHROPIC_API_KEY if using Claude, adjust LLM_PROVIDER as needed

# 3. Initialize the database
python3 scripts/init_db.py

# 4. Import data (place Excel files in data/, then run)
python3 scripts/import_files.py

# 5. Start both servers
npm run dev:all
```

Frontend runs on http://localhost:3000, API on http://localhost:3001.

## Scripts

### Frontend

| Command               | Description                              |
|-----------------------|------------------------------------------|
| `npm run dev`         | Dev server (Vite, port 3000)             |
| `npm run dev:all`     | Frontend + API concurrently              |
| `npm run build`       | Production build (./build/)              |
| `npm run test`        | Run tests — 1058 tests, 57 suites       |
| `npm run test:watch`  | Watch mode                               |
| `npm run test:ui`     | Vitest UI dashboard                      |
| `npm run test:coverage` | Coverage report (V8)                   |
| `npm run lint`        | ESLint                                   |
| `npm run format`      | Prettier format                          |
| `npm run test:e2e`    | Playwright end-to-end tests              |
| `npm run analyze`     | Bundle analysis (ANALYZE=true)           |

### Backend (api/)

| Command                    | Description                              |
|----------------------------|------------------------------------------|
| `cd api && npm run dev`    | API dev server (tsx watch, port 3001)    |
| `cd api && npm test`       | Backend tests (Vitest, TZ=UTC)           |
| `cd api && npm run build`  | Compile TypeScript                       |

### Data Scripts (scripts/)

| Script               | Purpose                                        |
|----------------------|------------------------------------------------|
| `init_db.py`         | Create SQLite databases (real + demo)          |
| `import_files.py`    | Parse Excel files from `data/` into SQLite     |
| `refresh_crm.py`     | Fetch CRM data from Dynamics 365               |

## Tech Stack

- **React 19** + TypeScript 5.9 (strict mode)
- **MUI 6** (Material UI)
- **Zustand 5** for state management (13 stores, fully typed, decoupled)
- **Vite 7** + SWC
- **Recharts** for charts
- **Express** + better-sqlite3 (API)
- **date-fns v4** for date handling
- **Vitest** + @testing-library/react + Playwright for testing
- **Web Workers** for heavy computations (scoring matrix, daily grid)
- **husky** + lint-staged (pre-commit formatting)

## Features

309 features across 25 categories. See **[FEATURES.md](FEATURES.md)** for the exhaustive inventory.

## Project Structure

```
src/                    React SPA (115K lines)
  components/           Feature tabs (StaffingTab, PipelineTab, BookingsTab, etc.)
  stores/               13 Zustand stores (fully typed, decoupled)
  hooks/                Hydration, sync, routing, URL filter serialization
  utils/                Data processing, filters, formatters
api/                    Express backend (13K lines)
  src/routes/           REST endpoints (paginated CRM, ROW_NUMBER CTE overrides)
  src/services/         AI agent, LLM providers, staffing calculations
  src/db/               SQLite database layer (dual DB proxy for demo mode)
scripts/                Python scripts for data import and CRM sync
data/                   Excel source files (gitignored, watched by backend)
```

## Environment Variables

Copy `api/.env.example` to `api/.env`. Key variables:

| Variable            | Description                              | Default      |
|---------------------|------------------------------------------|--------------|
| `LLM_PROVIDER`      | `ollama` (local) or `claude` (cloud)    | `ollama`     |
| `ANTHROPIC_API_KEY`  | Claude API key (if using Claude)        | --           |
| `PORT`               | API server port                         | `3001`       |
| `JWT_SECRET`         | Enable auth (leave empty to disable)    | --           |
| `DATA_DIR`           | Watched directory for Excel files       | `../data`    |
| `CORS_ORIGINS`       | Allowed origins (comma-separated)       | `localhost`  |

## Security

- **JWT authentication** (opt-in via `JWT_SECRET`)
- **CSP** enabled via Helmet
- **SQL agent sandboxed** — `stmt.reader` enforced by SQLite (read-only queries only)
- **Per-user rate limiting** on mutation/chat endpoints (JWT-based)
- **Audit trail** — `modifiedBy` (username) on all mutations
- **0 npm vulnerabilities** (xlsx 0.20.3 from SheetJS CDN)

## Authentication

Authentication is opt-in. To enable:

```bash
# 1. Generate a secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Add to api/.env
JWT_SECRET=<the-generated-secret>

# 3. Create a user
cd api && npx tsx src/scripts/seedUser.ts <username> <password> [displayName]
```

Without `JWT_SECRET`, all endpoints are public (development mode).

## Testing

```bash
npm test                    # 1088 tests, 59 suites
npm run test:coverage       # Coverage report
npm run test:e2e            # Playwright E2E (4 specs)
```

Test types: component render tests (@testing-library/react), hook/utility pure function tests, Zustand store mutation tests, E2E smoke/staffing/responsive/accessibility.

## API Reference

See `api/API.md` for full endpoint documentation.
