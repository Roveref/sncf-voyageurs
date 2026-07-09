# Dashboard API Reference

Base URL: `http://localhost:3001`

---

## Endpoints Overview

### Health & Infrastructure
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/events` | SSE stream for push notifications |
| GET | `/api/backup` | Trigger user data backup |
| POST | `/api/backup/restore` | Restore user data from backup |
| GET | `/api/download/:filename` | Download a generated file (PPTX, etc.) |

### Chat (AI Agent)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send message, get JSON response |
| POST | `/api/chat/stream` | Send message, get SSE streamed response |
| GET | `/api/chat/history` | Get chat session history |
| GET | `/api/chat/sessions` | List recent chat sessions |
| GET | `/api/chat/health` | LLM provider health check |

### Summarize (AI Reports)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/summarize` | Generate an AI-powered summary report |

### Data (CRUD)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/data/employees` | List employees (filterable) |
| GET | `/api/data/employees/:empId` | Get employee detail + assignments + skills |
| GET | `/api/data/opportunities` | List opportunities (filterable) |
| GET | `/api/data/opportunities/:id` | Get opportunity detail + actions + needs |
| POST | `/api/data/opportunities` | Create a manual opportunity |
| PUT | `/api/data/opportunities/:id` | Update an opportunity |
| DELETE | `/api/data/opportunities/:id` | Delete opportunity (cascade: actions, needs) |
| GET | `/api/data/assignments` | List MDS assignments (filterable) |
| GET | `/api/data/stats` | Aggregated stats (employees, pipeline, bookings, alerts) |
| GET | `/api/data/alerts` | Active alerts (ending missions, bench employees) |

### Hydrate (Frontend Data Loading)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/hydrate/ready` | Check if DB has data, return table counts |
| GET | `/api/hydrate/crm` | CRM opportunities + accounts + filters + optionsets + config |
| GET | `/api/hydrate/contacts` | Per-account CRM contacts (on-demand) |
| GET | `/api/hydrate/staffing` | MDS staffing records (employee x assignment) |
| GET | `/api/hydrate/sap` | SAP daily records with lookup structure |
| GET | `/api/hydrate/metadata` | Employee metadata (grade history, arrival/departure) |
| GET | `/api/hydrate/skills` | Skills profiles + catalog + index |
| GET | `/api/hydrate/regions` | Country-to-region mapping |
| GET | `/api/hydrate/changes` | All user modifications (overrides, actions, scenarios, etc.) |
| POST | `/api/hydrate/changes` | Save all user modifications (full replace) |

### Scenarios
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scenarios` | List all scenarios |
| GET | `/api/scenarios/:id` | Get a single scenario |
| POST | `/api/scenarios` | Create a scenario |
| PUT | `/api/scenarios/:id` | Update a scenario |
| DELETE | `/api/scenarios/:id` | Delete a scenario |

### Config (var_config CRUD)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | All config entries grouped by category |
| POST | `/api/config/:category` | Create a config entry |
| PUT | `/api/config/:category/:key` | Update a config entry |
| DELETE | `/api/config/:category/:key` | Delete a config entry |

### Demo Mode
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/demo/status` | Current demo state + LLM provider |
| POST | `/api/demo/activate` | Switch to demo DB + Claude LLM |
| POST | `/api/demo/deactivate` | Switch back to real DB + Ollama |
| POST | `/api/demo/seed` | Regenerate dummy data |

### CRM Refresh
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/refresh/crm` | Trigger CRM refresh (spawns `refresh_crm.py`) |
| GET | `/api/refresh/status` | Get current refresh state |

### PPTX Export
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/pptx/generate` | Generate a BearingPoint PPTX file |

---

## Endpoint Details

### Chat

#### `POST /api/chat`
- **Body**: `{ message, sessionId?, scoringConfig?, dashboardContext? }`
- **Response**: `{ reply, sessionId, model, provider, toolsUsed, thinking, steps }`
- **Rate limit**: 30 req/min per IP

#### `POST /api/chat/stream`
- **Body**: Same as `POST /api/chat`
- **Response**: SSE stream with events: `session`, `step`, `text_delta`, `done`, `error`
- **Notes**: Uses `Content-Type: text/event-stream`. Final `done` event contains `{ reply, model, provider, steps }`.

#### `GET /api/chat/history`
- **Query**: `sessionId` (required)
- **Response**: `{ messages: [{ role, message, created_at }] }`

#### `GET /api/chat/sessions`
- **Response**: `{ sessions: [{ session, started_at, last_message, message_count }] }` (last 50)

#### `GET /api/chat/health`
- **Response**: LLM provider health status. Returns 503 if unhealthy.

### Summarize

#### `POST /api/summarize`
- **Body**: `{ type: "executive"|"pipeline"|"staffing"|"alerts", dateRange?: { start, end } }`
- **Response**: `{ type, summary, model, generatedAt }`
- **Notes**: Gathers live data from DB, sends to LLM for synthesis.

### Data

#### `GET /api/data/employees`
- **Query**: `grade?`, `team?`, `search?`, `limit?` (default 100), `offset?`
- **Response**: `{ employees: [...] }` with `assignment_count` per employee

#### `GET /api/data/employees/:empId`
- **Response**: `{ employee, assignments, skills }`

#### `GET /api/data/opportunities`
- **Query**: `status?` (comma-separated ints), `search?`, `segment?`, `limit?`, `offset?`
- **Response**: `{ opportunities: [...] }` sorted by gross_revenue DESC

#### `GET /api/data/opportunities/:id`
- **Response**: `{ opportunity, actions, staffingNeeds }`

#### `POST /api/data/opportunities`
- **Body**: `{ id, name, account?, status?, grossRevenue?, netRevenue?, winPct?, segment?, manager?, partner? }`
- **Response**: `201 { success, id }`. Inserts into `user_assets` table.

#### `GET /api/data/assignments`
- **Query**: `empId?`, `active?` ("true" for current assignments only)
- **Response**: `{ assignments: [...] }` (max 500)

#### `GET /api/data/stats`
- **Response**: `{ employees: { count, gradeDistribution }, pipeline, bookings, alerts: { missionsEndingSoon } }`

#### `GET /api/data/alerts`
- **Response**: `{ alerts: [{ type, severity, message, data }], count }`
- **Notes**: Types: `end_mission` (14-day horizon), `bench` (no active assignment).

### Hydrate

#### `GET /api/hydrate/ready`
- **Response**: `{ ready: bool, counts: { opportunities, employees, assignments, sapRecords, skills, crmAccounts } }`

#### `GET /api/hydrate/crm`
- **Query**: `region?`, `country?`, `since?`
- **Response**: `{ available, opportunities, crmAccounts, filterOptions, segmentToSubSegmentMap, serviceToOfferingMap, optionsets, config }`
- **Notes**: Supports ETag-based conditional requests (304).

#### `GET /api/hydrate/contacts`
- **Query**: `accountId?` or `account?` (at least one required)
- **Response**: `{ contacts: [...] }`

#### `GET /api/hydrate/staffing`
- **Response**: `{ available, records: [...] }` — MDS assignments in frontend record format.
- **Notes**: Supports ETag (304).

#### `GET /api/hydrate/sap`
- **Response**: `{ available, sapData: { records, lookup, minDate, maxDate, totalRecords, totalEmployees, totalDays, employeeIds } }`

#### `GET /api/hydrate/metadata`
- **Response**: `{ available, employeeMetadata: Record<empId, { gradeHistory, arrivalDate, departureDate }>, stats }`

#### `GET /api/hydrate/skills`
- **Response**: `{ available, skillsData: { profiles, catalog: { allSkills, categories, skillIndex }, totalEmployees, totalSkills } }`

#### `GET /api/hydrate/regions`
- **Response**: `{ available, regions: [{ name, countries }] }`

#### `GET /api/hydrate/changes`
- **Response**: `{ statusOverrides, manualOpportunities, manualAccounts, opportunityActions, staffingNeeds, revenueTeam, editorStates, scenarios, employeeMetadata, manualEmployees }`

#### `POST /api/hydrate/changes`
- **Body**: Object with any combination of the keys returned by `GET /api/hydrate/changes`. Each key triggers a full-replace (DELETE + INSERT) of its table.
- **Response**: `{ success, updatedAt }`
- **Notes**: Called by `useBackendSync` (debounce 2s). Triggers backup after save.

### Scenarios

#### `POST /api/scenarios`
- **Body**: `{ id, name, baseId?, overrides?, empOverrides? }`
- **Response**: `201 { success, id }`

#### `PUT /api/scenarios/:id`
- **Body**: `{ name?, overrides?, empOverrides? }` — partial update
- **Response**: `{ success }`

### Config

#### `GET /api/config`
- **Response**: `{ categories: Record<category, [{ key, value }]> }`

#### `PUT /api/config/:category/:key`
- **Body**: `{ value }`
- **Response**: `{ success, category, key, value }`

#### `POST /api/config/:category`
- **Body**: `{ key, value }`
- **Response**: `{ success, category, key, value }`. Returns 409 if entry already exists.

### Demo

#### `GET /api/demo/status`
- **Response**: `{ demo: bool, hasData: bool, provider: "ollama"|"claude" }`

#### `POST /api/demo/activate`
- **Response**: `{ demo: true, hasData: true, provider: "claude" }`
- **Notes**: Copies `var_*` tables to demo DB, switches DB + LLM, auto-seeds if empty.

#### `POST /api/demo/deactivate`
- **Response**: `{ demo: false, provider: "ollama" }`

#### `POST /api/demo/seed`
- **Response**: `{ success, ...seedStats }`
- **Notes**: Clears and regenerates all dummy data.

### CRM Refresh

#### `POST /api/refresh/crm`
- **Response**: `{ status: "started" }` or `409 { status: "already_running" }`
- **Notes**: Spawns `scripts/refresh_crm.py --all --push` as detached process. Optional daily auto-refresh at 6:00 AM when `CRM_REFRESH_CRON=1`.

#### `GET /api/refresh/status`
- **Response**: `{ running, lastRun, lastStatus, lastError }`

### PPTX Export

#### `POST /api/pptx/generate`
- **Body**: `{ slides: PptxSlide[], title? }`
- **Response**: Binary `.pptx` file (`Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`)

### Events (SSE)

#### `GET /api/events`
- **Response**: SSE stream. Events: `crm-updated`, `files-imported`.
- **Notes**: Heartbeat every 30s. Used by frontend for live-reload after CRM refresh or file import.

### File Download

#### `GET /api/download/:filename`
- **Response**: File download from `uploads/` directory. Returns 404 if not found.
