# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
For setup, scripts, and environment variables, see `README.md`.

## Project

**GAIF Pilot** — plateforme EAM React de pilotage des installations fixes pour la Direction GAIF (Gestion d'Actifs Installations Fixes) SNCF Voyageurs. Couvre 7 patrimoines (ferroviaire, immobilier, IO, courants faibles, propriété intellectuelle, gares & lignes, foncier) sur 18 sites opérationnels (11 TN + 5 TER + 2 IC).

**Origine** : forké depuis un dashboard consulting BearingPoint (CRM + staffing). Refonte v2 terminée : rename SQL dur (crm_opportunities → assets, crm_accounts → sites, hr_candidates → nonconformities), 34 widgets GAIF natifs, agent IA adapté PSGA/ISO 55001. Voir `/Users/francoisrovere/.claude/plans/fais-une-analyse-de-snazzy-pearl.md` pour le plan refonte.

## Architecture

```
src/
├── App.tsx                          # Orchestration des tabs (routing via useTabRouting)
├── stores/
│   ├── useAppStore.ts               # UI state, loading, notifications, syncStatus (auto-save)
│   ├── useDataStore.ts              # Runtime staffing state (EditorState, dailyGrid, staffingEmployees — no hydrated data)
│   ├── useUIStore.ts                # Modals, expansions, sidebar collapse state
│   ├── useScenarioStore.ts          # Scénarios what-if avec héritage + overrides (decoupled — no cross-store calls)
│   ├── useManualDataStore.ts        # User modifications (cascading deletes via OPP_DATA_FIELDS helper)
│   ├── useCrmStore.ts               # CRM data (opportunities, accounts, contacts)
│   ├── useFilterStore.ts            # Filter state (decoupled — maps passed as params, not read from other stores)
│   ├── useAuthStore.ts              # JWT token + user (login/logout)
│   └── useUndoStore.ts              # Global undo stack (Ctrl+Z, max 20 actions)
├── queries/
│   ├── queryKeys.ts                 # Cache key factory (single source of truth)
│   ├── queryFns.ts                  # Query functions wrapping api.ts
│   ├── QueryProvider.tsx            # QueryClient (staleTime: Infinity, gcTime: 30min) + DevTools
│   ├── use*Query.ts                 # 11 individual query hooks (health, ready, crm, staffing, sap, etc.)
│   ├── useCrmData.ts               # Facade: read assets from cache (nom legacy, lit la table `assets` depuis v2)
│   ├── useGaifData.ts              # Facade: GAIF bundle (contracts, projects, comites, risks, audits, docs, VR)
│   ├── useStaffingData.ts           # Facade: read staffing records from cache (replaces useDataStore.hydratedStaffingRecords)
│   ├── useSapData.ts                # Facade: read SAP data from cache with Set conversion (replaces useDataStore.hydratedSapData)
│   ├── useSkillsData.ts             # Facade: read skills from cache with Map/Set conversions (replaces useDataStore.hydratedSkillsData)
│   ├── useRecruitmentData.ts        # Facade: read recruitment from cache (replaces useRecruitmentStore)
│   ├── useStaffingStatus.ts         # Facade: hasStaffingData boolean from cache
│   ├── useSaveChangesMutation.ts    # Mutation with retry 3x exponential backoff
│   └── index.ts                     # Barrel exports
├── hooks/
│   ├── useHydration.ts              # Orchestrates queries + CRM config side-effects (bridges mostly removed — see queries/use*Data.ts)
│   ├── useAutoSave.ts               # JSON-based dirty-detection + mutation (debounce 2s, baseline after 8s)
│   ├── useServerEventsV2.ts         # SSE → queryClient.invalidateQueries (replaces useServerEvents)
│   └── useTabRouting.ts             # Sync URL ↔ tabs + filter serialization in query params
├── services/api.ts                  # apiFetch wrapper (injects JWT), all API calls
├── components/
│   ├── StaffingTab/                 # Feature principale (~200 fichiers)
│   │   ├── hooks/                   # 47 hooks (16 useStaffing* extracted from god component)
│   │   ├── utils/                   # Pure computation modules (all typed — StaffingRecord[], ScoringEmployee[])
│   │   │   ├── dataProcessing.ts    # buildEmployeeStructures(StaffingRecord[]) → Employee[]
│   │   │   ├── autoAssign.ts        # buildScoringMatrix(ScoringEmployee[]) — runs in Web Worker
│   │   │   ├── varianceEngine.ts    # Single source of truth: computeSapChH, computeMdsChargeableHours, computeVarianceDelta
│   │   │   ├── calcPrimitives.ts    # accumulateSegmentsByCategory, capUtilizations, computeTuRate, computeToRate
│   │   │   ├── bucketing.ts         # Pure bucketing logic extracted from HeatmapStrip (850 lines)
│   │   │   └── dailyGridBuilder.ts  # Grid computation — runs in Web Worker for cold cache
│   │   └── workers/
│   │       ├── scoringWorker.ts     # Web Worker for buildScoringMatrix + generateProposals
│   │       └── gridWorker.ts        # Web Worker for buildDailyGrid (initial load only)
│   ├── PipelineTab/                 # « Parc d'actifs » — inventaire + insights
│   ├── BookingsTab/                 # « Maintenance » — coûts + VR Calendar
│   ├── JobcodeTimelineTab/          # « Cycle de vie » — 4 phases PSGA + file d'attente investissements
│   ├── RecruitmentTab/              # « Conformité » — non-conformités ISO 55001
│   ├── CustomDashboard/             # « Vue d'ensemble » — 34 widgets GAIF
│   ├── OpportunityList/             # Table actifs (partagée Parc/Maintenance)
│   ├── GaifSitesMap/                # Carte France avec les 18 sites (Landing)
│   ├── ChatPanel/                   # AI assistant (Claude/Ollama) adapté vocabulaire GAIF
│   ├── common/
│   │   ├── ErrorBoundary.tsx        # Wraps all lazy components
│   │   ├── OnboardingOverlay.tsx    # 5-step spotlight tour on first visit
│   │   ├── EmptyStates.tsx          # NoData, NoResults, Error empty states
│   │   └── SkeletonLoaders.tsx      # Shimmer loading placeholders
│   ├── AuthGate.tsx                 # JWT auth gate (wraps App in index.tsx)
│   └── LoginPage.tsx                # Login form
├── data/                            # Référentiels GAIF (patrimoines, sites, raci, comites, projects, docs, risks)
└── theme.ts                         # MUI theme SNCF Voyageurs (#EB0070 magenta)

api/
├── src/
│   ├── db/database.ts               # Dual DB Proxy (dashboard.db ↔ dashboard-demo.db)
│   ├── routes/
│   │   ├── auth.ts                  # POST /login, GET /me (JWT)
│   │   ├── chat.ts                  # POST /api/chat/stream (SSE), crypto.randomUUID sessions, userId ownership
│   │   ├── hydrate/
│   │   │   ├── crm.ts              # Paginated (limit/offset/hasMore), ETag caching
│   │   │   ├── changes.ts          # ROW_NUMBER() CTE for status overrides (optimized)
│   │   │   └── ...                  # staffing, metadata, recruitment
│   │   └── ...                      # data, scenarios, config, refresh, demo, pptx, events
│   └── services/
│       ├── agent.ts                 # AI agent loop (Ollama JSON / Claude tool_use)
│       ├── agentDispatch.ts         # Tool dispatch — executeSafeSQL uses stmt.reader for read-only enforcement
│       ├── llm.ts                   # LLM abstraction (Ollama + Claude API)
│       └── staffingCalc.ts          # Server-side staffing calculations
├── schema.sql                       # Single source of truth (CASCADE, NOT NULL, UNIQUE constraints)
└── templates/                       # PPTX export template

shared/
├── staffingConstants.ts             # Pure constants shared between frontend and backend (categories, grades, holidays)
├── calcPrimitives.ts                # Pure calculation functions (segment accumulation, capping, TU/TO)
└── varianceEngine.ts                # Variance computation (SAP vs MDS delta)
```

## Conventions

- Prettier: 120 chars, 2 spaces, double quotes, semicolons, trailing commas ES5
- ESLint: `no-console` warning (except warn/error), unused vars OK if prefixed `_`
- husky + lint-staged: Prettier runs on pre-commit
- `memo()` systématique, `displayName` assigné après
- Barrel exports via `index.ts` dans chaque dossier composants
- PascalCase fichiers composants, camelCase utilitaires
- Zustand with typed interfaces — stores are **decoupled** (no cross-store `getState()` in actions)
- `useDeferredValue` pour les updates non-urgentes
- `apiFetch()` wrapper dans `src/services/api.ts` pour injecter le JWT sur toutes les requêtes
- All user-facing strings in **English** (unified from mixed FR/EN)

## Store Architecture — Key Patterns

**Decoupled stores** — No store action calls another store's `getState()`. Side effects (notifications, editor state clearing) are the caller's responsibility.

**useManualDataStore** — User modifications (synced to SQLite via useBackendSync):
- `statusOverrides`, `manualOpportunities`, `manualAccounts`
- `opportunityActions`, `staffingNeeds`, `revenueTeam`
- Cascade delete via `OPP_DATA_FIELDS` helper — adding a field = 1 line change

**useDataStore** — Runtime staffing state only (no hydrated data):
- `editorStates: Record<string, EditorState | null>` — user edit state
- `staffingEmployees`, `dailyGrid`, `calendarIndex` — computed grid data
- Hydrated fields removed: SAP/Skills/Staffing data now read directly from React Query cache via facade hooks (`useSapData`, `useSkillsData`, `useStaffingData`)

**useScenarioStore** — Scenario inheritance:
- `resolveAssignmentOverrides(id)` walks the chain and merges (parent first, child wins)

**useFilterStore** — Decoupled from CrmStore:
- `handleFilterChange(newFilters, segmentMap, serviceMap)` — maps passed as params by caller

**useUndoStore** — Global undo (Ctrl+Z):
- Stack of `{ label, undo: () => void }`, max 20 items
- Wired on: bulk delete, clear all manual data

## Data Pipeline (StaffingTab)

Pipeline linéaire orchestré par `useStaffingPipeline` + `useDataPipeline`:

```
data (StaffingRecord[])
  → [scenarioData] applyAssignmentOverrides() si scénario actif
  → buildEmployeeStructures(StaffingRecord[]) → Employee[]
  → enrichedGanttData (skills, metadata, grades, DM hierarchy)
  → filteredEmployees (search, category, grade, team filters + searchTags multi-select)
  → expandWithSubordinates() (DM hierarchy: recursive subordinate inclusion)
  → mergedDisplayEmployees + effectiveDailyGrid (grade merge: display-only)
  → buildDailyGrid() → dailyGrid (via Web Worker if cache cold, else synchronous)
  → useTeamStats() → teamTuStats (KPI agrégés, mode-adaptive)
```

**Web Workers:**
- `scoringWorker.ts` — `buildScoringMatrix` + `generateProposals` (offloads ~3s computation)
- `gridWorker.ts` — `buildDailyGrid` for cold cache (offloads ~500ms), main thread for cached panning

## Variance Engine — Single Source of Truth

`varianceEngine.ts` owns ALL variance computation (replaces 3 duplicated implementations):
- `computeSapChH(segments, chScale, empHPD, chargeableCombined)` — SAP pipeline
- `computeMdsChargeableHours(forecastSegments, empHPD, chargeableCombined)` — MDS pipeline
- `computeVarianceDelta(sapChH, mdsChH)` — delta hours
- `computeVarianceRate(sapEmpDays, sapChU, sapAbsU, forecastChU, forecastAbsU)` — delta TU%

`calcPrimitives.ts` owns rate formulas (used everywhere via import):
- `computeTuRate(chU, netU)` and `computeToRate(chU, goU, trU, netU)` — no inline math anywhere

## Heatmap Display Modes

`heatmapMode` contrôle le calcul et l'affichage:
- `'tu'` (défaut) : TU = chH / netH × 100
- `'to'` : TO = (chH + trH) / netH × 100
- `'availability'` : 100 - TU
- `'variance_hours'` : delta heures SAP - Forecast
- `'variance_hours_pct'` : delta TU en points de %

Heatmap legend component updates dynamically per mode.

## Data Persistence — SQLite Single Source of Truth

- **Schema**: `api/schema.sql` — CASCADE, NOT NULL on critical columns, UNIQUE contacts, ROW_NUMBER CTE
- **Setup** → `python3 scripts/init_db.py` (creates real + demo databases)
- **Source data CRM** → `python scripts/refresh_crm.py --all --push` (Dynamics 365 → SQLite)
- **Source data Excel** → `python scripts/import_files.py` (parse Excel in `data/` → SQLite)
- **File watcher** → watches `data/` continuously (`ignoreInitial: true`)
- **User changes** → auto-saved via `useAutoSave` (JSON value comparison, baseline after 8s) + `useSaveChangesMutation` (debounce 2s, React Query retry 3x) to `user_*` tables
- **Hydration** → `useHydration` orchestrates 11 independent React Query hooks (`use*Query`). Components read data via facade hooks (`useCrmData`, `useStaffingData`, `useSapData`, `useSkillsData`). Remaining bridges: CRM config side-effects, metadata, changes.
- **SSE invalidation** → `useServerEventsV2` calls `queryClient.invalidateQueries()` on CRM/staffing/changes events. `user-data-saved` SSE disabled to prevent save loop.
- **CRM hydration** → paginated (limit/offset/hasMore), React Query cache key includes region/country filter
- **Gzip compression** → all API responses compressed via `compression` middleware (~91% reduction)
- **F5 = no data loss**

## Security

- **JWT auth** — Global middleware on `/api/*` when `JWT_SECRET` set. Dev mode = all public.
- **SQL agent** — `stmt.reader` enforced by SQLite itself (impossible to bypass with SQL tricks)
- **CSP** — Content Security Policy enabled via Helmet
- **Rate limiting** — Per-user (JWT-based) on mutation + chat, per-IP on reads, 5/15min on login
- **Chat sessions** — `crypto.randomUUID()`, userId stored, ownership validated on /history
- **Body limit** — 10MB (was 50MB)
- **Audit trail** — `modifiedBy` (username from JWT) on all mutation routes
- **xlsx** — Version 0.20.3 from SheetJS CDN (0 vulnerabilities)
- **Gzip** — `compression` middleware on all API responses

## AI Assistant — Claude Integration

### Demo Mode
Dual-database: `dashboard.db` (real, Ollama) ↔ `dashboard-demo.db` (dummy data, Claude API).
DB Proxy transparent in `database.ts`, runtime switch via `setDemoMode()`.

### Agent (agent.ts)
Dual-mode: Ollama (JSON parsing) / Claude (tool_use natif). Tools include:
`execute_sql`, `compute_availability`, `find_staffing_candidates`, `get_team_kpis`,
`create_staffing_need`, `create_action`, `update_opportunity_status`, `create_opportunity`,
`get_sap_mds_variance`, `get_pipeline_kpis`, `search_entity`, `match_candidate_to_need`

## UX Features

- **Onboarding** — 5-step spotlight tour on first visit (localStorage persistence)
- **Collapsible sidebars** — Toggle buttons, animated, localStorage persistence
- **Heatmap legend** — Dynamic color scale per mode
- **Drag affordance** — DragIndicator icon on hover, first-drag tooltip, drop zone highlight
- **Confirmation dialogs** — Bulk delete, clear all, apply proposal
- **Inline validation** — onBlur errors on opportunity/staffing need forms
- **URL filters** — Filters serialized in query params (bookmarkable/shareable)
- **Breadcrumb drill-down** — PipelineTab segment/account/service line navigation
- **Global undo** — Ctrl+Z for destructive actions
- **Mobile** — SwipeableDrawer bottom sheet for filters, stacked chat below 1200px

## Testing

- **1058 tests**, 57 suites, 100% pass rate
- **Vitest** + jsdom + @testing-library/react
- **18 component test files** (ErrorBoundary, EmptyStates, SkeletonLoaders, TabRouter, AppBarActions, FilterPanel, ChatPanel, OpportunityRow, EmployeeRow, ScenarioSelector, BulkEditToolbar, NeedsList, TUTrendChart, DemoToggle, NotificationBell, CreateStaffingNeedModal, StatusOverrideManager, LoginPage)
- **Hook/utility tests** — teamStatsCalc, useDailyGrid, bucketing, pipelineUtils, opportunityUtils, useBackendSync
- **E2E** — 4 Playwright specs (smoke, staffing, responsive, accessibility)

## Entités Clés

- **Employee** : empId, name, grade, subTeam, directManager, assignments[], skills[]
- **Assignment** : jobNo, jobName, category, startDate, endDate, utilization, hoursPerDay
- **StaffingRecord** : raw data from hydration (typed, replaces `any[]`)
- **ScoringEmployee** : minimal shape for autoAssign (typed, replaces `any[]`)
- **EditorState** : baseline, actionLog, redoStack, current (typed in store)
- **DailyCell** : segments[], scale factors, isSap, forecastSegments, effectiveChU
- **ConsolidatedAssignment** : merged assignment periods (typed, replaces `any[]`)

## Constantes

- `GANTT_LEFT_COL_WIDTH = 440`, `DM_INDENT_PX = 24`
- Catégories : `CHARGEABLE_CATS`, `GO_CATS`, `TRAINING_CATS`, `ABSENCE_CATS` (camelCase values: `"otherAbsence"`, `"generalOppty"`, `"travelWe"`, `"businessDev"`, `"nonChargeable"`)
- **All naming is camelCase** — DB category values, var_config keys, JS/TS/Python code. Never use `+= 86400000` to iterate days (use `setDate(d+1)` + `setHours(0,0,0,0)` for DST safety).
- `HOURS_PER_DAY = 8`, `getHoursPerDay(grade)` (Intern=7, others=8)
- `MDS_EXTRACT_START = '2025-09-01'`
- Grade TU targets: Partner 25%, Director 50%, SM/SE 65%, Manager 75%, BC/BA/TC/SBC 90%, Intern 95%
- Assignment override key format: `${empId}::${jobNo}::${startDate}`

## Cross-Module Communication

**React Query + Zustand** — Server data fetched via React Query (`src/queries/`). Components read server data via facade hooks (`useCrmData`, `useStaffingData`, `useSapData`, `useSkillsData`) that read directly from React Query cache — no Zustand bridge. Zustand stores hold only **user-authored mutable state** (editor states, manual overrides, scenarios, UI state). Stores are decoupled (no cross-store `getState()` in actions).

**React Query cache** — `staleTime: Infinity` (data only changes via SSE invalidation). `gcTime: 30min`. Query keys in `queryKeys.ts`. DevTools available in dev.

**localStorage** — `darkMode`, `staffing_employee_index`, `pip_needs_panel_pos/size`, `jwt`, `leftSidebarOpen`, `rightSidebarOpen`, `onboardingComplete`, `hasSeenDragHint`

**Persistence** — SQLite source of truth. `useAutoSave` dirty-detects 10 store sections via JSON comparison (debounce 2s, baseline snapshot after 8s hydration), saves via `useSaveChangesMutation` (React Query retry 3x exponential). `useHydration` restores user changes on load via `restoreUserChanges`.

**SSE** — `useServerEventsV2` handles `crm-updated` (delta merge to store), `files-imported`, `agent-data-changed`, `notification`. All use `queryClient.invalidateQueries()` which triggers refetch → facade hooks return fresh data. `user-data-saved` broadcast disabled (caused infinite save loop).
