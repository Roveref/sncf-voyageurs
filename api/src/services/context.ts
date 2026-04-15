/**
 * RAG with Function Calling
 *
 * Instead of matching keywords, we give the LLM a list of
 * available functions. The LLM decides which to call and with
 * what parameters. The backend executes the SQL queries and returns
 * the results.
 *
 * Flow:
 *   1. LLM receives the question + the tool list
 *   2. LLM responds with a JSON describing which tools to call
 *   3. Backend executes the corresponding SQL queries
 *   4. Results injected into the prompt for the final answer
 */

import db from "../db/database.js";

// ── Available tool definitions ──

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; enum?: string[] }>;
}

export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: "search_employees",
    description:
      "Search employees by grade, team, segment, availability, or name. Useful for finding who is available, who is over-utilized, or filtering by criteria.",
    parameters: {
      grade: { type: "string", description: "Filter by grade (e.g. 'Manager', 'Senior Consultant', 'Analyst')" },
      team: { type: "string", description: "Filter by team / Sub Segment Code" },
      search: { type: "string", description: "Search by name (partial)" },
      max_utilization: { type: "number", description: "Maximum TU (e.g. 50 for under-utilized)" },
      min_utilization: { type: "number", description: "Minimum TU (e.g. 90 for over-utilized)" },
      limit: { type: "number", description: "Max number of results (default: 20)" },
    },
  },
  {
    name: "search_opportunities",
    description:
      "Search opportunities in the pipeline by status, segment, account, revenue, or win rate. Useful for analyzing the pipeline, bookings, or losses.",
    parameters: {
      status: {
        type: "string",
        description: "Filter by status (comma-separated)",
        enum: ["1", "4", "6", "11", "14", "15"],
      },
      segment: { type: "string", description: "Filter by Sub Segment Code" },
      account: { type: "string", description: "Filter by client account (partial)" },
      search: { type: "string", description: "Search by opportunity name (partial)" },
      min_revenue: { type: "number", description: "Minimum revenue" },
      min_winPct: { type: "number", description: "Minimum win %" },
      limit: { type: "number", description: "Max number of results (default: 15)" },
    },
  },
  {
    name: "search_skills",
    description:
      "Search skills by skill name, minimum level, or employee. Useful for finding who masters a technology or identifying gaps.",
    parameters: {
      skill: { type: "string", description: "Skill name to search (e.g. 'Python', 'SAP', 'Cloud')" },
      min_level: { type: "number", description: "Minimum level (1-4)" },
      grade: { type: "string", description: "Filter employees by grade" },
      limit: { type: "number", description: "Max number of results (default: 20)" },
    },
  },
  {
    name: "get_ending_missions",
    description: "Lists missions ending soon. Useful for anticipating bench, risks, and planning restaffing.",
    parameters: {
      days: { type: "number", description: "Number of days to look ahead (default: 30)" },
      grade: { type: "string", description: "Filter by grade" },
      limit: { type: "number", description: "Max number of results (default: 20)" },
    },
  },
  {
    name: "get_bench",
    description:
      "Lists employees without an active assignment (on bench). Useful for identifying immediately available resources.",
    parameters: {
      grade: { type: "string", description: "Filter by grade" },
    },
  },
  {
    name: "get_grade_pyramid",
    description: "Returns the grade distribution (pyramid). Useful for analyzing team composition.",
    parameters: {
      team: { type: "string", description: "Filter by team (optional)" },
    },
  },
  {
    name: "get_global_stats",
    description: "Returns global KPIs: headcount, pipeline, bookings, revenue. Useful for a general summary.",
    parameters: {},
  },
  {
    name: "get_top_accounts",
    description: "Returns client accounts ranked by revenue. Useful for identifying strategic clients.",
    parameters: {
      limit: { type: "number", description: "Number of accounts (default: 10)" },
      status: { type: "string", description: "Filter by opportunity status" },
    },
  },
  {
    name: "get_sap_hours",
    description:
      "Retrieves actual SAP hours logged by an employee over a period. Useful for analyzing time spent, comparing with forecast, verifying timesheets.",
    parameters: {
      employee: { type: "string", description: "Employee name or ID" },
      startDate: { type: "string", description: "Start date YYYY-MM-DD (optional)" },
      endDate: { type: "string", description: "End date YYYY-MM-DD (optional)" },
      category: {
        type: "string",
        description: "Filter by category (chargeable, vacation, rtt, training, admin, etc.)",
      },
    },
  },
  {
    name: "get_sap_summary",
    description: "SAP hours summary by category and month. Useful for getting an overview of time distribution.",
    parameters: {
      employee: { type: "string", description: "Employee name or ID (optional — if omitted, aggregates for all)" },
      month: { type: "string", description: "Month in YYYY-MM format (optional)" },
    },
  },
];

// ── Prompt for the tool selection step ──

export const TOOL_SELECTION_PROMPT = `You are an assistant that analyzes user questions and decides which tools to call to retrieve the necessary data.

Here are the available tools:
${AVAILABLE_TOOLS.map(
  (t) =>
    `- **${t.name}**: ${t.description}
  Parameters: ${Object.entries(t.parameters)
    .map(([k, v]) => `${k} (${v.type}): ${v.description}`)
    .join(", ")}`
).join("\n\n")}

IMPORTANT:
- Respond ONLY with valid JSON, no text before or after, no markdown.
- The JSON must be an array of tool calls: [{"tool": "name", "args": {...}}, ...]
- Choose 1 to 3 tools maximum, the most relevant ones.
- If the question is a simple hello or off-topic, respond: []
- Do NOT invent tools that are not in the list.
- Use parameters to filter precisely according to the question.

Examples:
- "Who is available in June?" → [{"tool": "search_employees", "args": {"max_utilization": 50}}]
- "How many SC on Banking?" → [{"tool": "search_employees", "args": {"grade": "Senior Consultant", "team": "Banking"}}]
- "Summarize the pipeline" → [{"tool": "search_opportunities", "args": {}}, {"tool": "get_global_stats", "args": {}}]
- "Python skills level 3+" → [{"tool": "search_skills", "args": {"skill": "Python", "min_level": 3}}]
- "Hello" → []`;

// ── Tool execution ──

interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  tool: string;
  label: string;
  data: unknown[];
  count: number;
}

/**
 * Parse the LLM response to extract tool calls.
 */
export function parseToolCalls(llmResponse: string): ToolCall[] {
  try {
    // Clean: remove markdown code block if present
    let cleaned = llmResponse.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    // Remove text before the first [ and after the last ]
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) return [];
    cleaned = cleaned.substring(start, end + 1);

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    // Validate that tools exist
    return parsed.filter(
      (call: unknown) =>
        typeof call === "object" &&
        call !== null &&
        "tool" in call &&
        AVAILABLE_TOOLS.some((t) => t.name === (call as ToolCall).tool)
    ) as ToolCall[];
  } catch {
    return [];
  }
}

/**
 * Execute a tool call and return the results.
 */
export function executeToolCall(call: ToolCall): ToolResult {
  const { tool, args } = call;

  switch (tool) {
    case "search_employees":
      return executeSearchEmployees(args);
    case "search_opportunities":
      return executeSearchOpportunities(args);
    case "search_skills":
      return executeSearchSkills(args);
    case "get_ending_missions":
      return executeGetEndingMissions(args);
    case "get_bench":
      return executeGetBench(args);
    case "get_grade_pyramid":
      return executeGetGradePyramid(args);
    case "get_global_stats":
      return executeGetGlobalStats();
    case "get_top_accounts":
      return executeGetTopAccounts(args);
    case "get_sap_hours":
      return executeGetSapHours(args);
    case "get_sap_summary":
      return executeGetSapSummary(args);
    default:
      return { tool, label: "Unknown tool", data: [], count: 0 };
  }
}

// ── Tool implementations ──

function executeSearchEmployees(args: Record<string, unknown>): ToolResult {
  let sql = `
    SELECT e.name, e.grade, e.subTeam, e.serviceLine,
           COUNT(a.id) as assignmentCount,
           ROUND(AVG(a.utilization), 1) as avgUtil
    FROM employees e
    LEFT JOIN mds_assignments a ON e.empId = a.empId
      AND a.endDate >= date('now')
      AND a.startDate <= date('now', '+90 days')
    WHERE (e.departureDate IS NULL OR e.departureDate > date('now'))
  `;
  const params: unknown[] = [];

  if (args.grade) {
    sql += " AND LOWER(e.grade) LIKE ?";
    params.push(`%${String(args.grade).toLowerCase()}%`);
  }
  if (args.team) {
    sql += " AND (LOWER(e.subTeam) LIKE ? OR LOWER(e.serviceLine) LIKE ?)";
    params.push(`%${String(args.team).toLowerCase()}%`, `%${String(args.team).toLowerCase()}%`);
  }
  if (args.search) {
    sql += " AND LOWER(e.name) LIKE ?";
    params.push(`%${String(args.search).toLowerCase()}%`);
  }

  sql += " GROUP BY e.empId";

  if (args.max_utilization !== undefined) {
    sql += ` HAVING avgUtil < ? OR avgUtil IS NULL`;
    params.push(Number(args.max_utilization));
  } else if (args.min_utilization !== undefined) {
    sql += ` HAVING avgUtil >= ?`;
    params.push(Number(args.min_utilization));
  }

  sql += " ORDER BY avgUtil ASC NULLS FIRST";
  sql += ` LIMIT ?`;
  params.push(Number(args.limit) || 20);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "search_employees", label: "Employee search", data: rows, count: rows.length };
}

function executeSearchOpportunities(args: Record<string, unknown>): ToolResult {
  let sql =
    "SELECT opportunity, account, status, grossRevenue, netRevenue, winPct, segment, manager FROM crm_opportunities WHERE 1=1";
  const params: unknown[] = [];

  if (args.status) {
    const statuses = String(args.status).split(",").map(Number);
    sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }
  if (args.segment) {
    sql += " AND LOWER(subSegmentCode) LIKE ?";
    params.push(`%${String(args.segment).toLowerCase()}%`);
  }
  if (args.account) {
    sql += " AND LOWER(account) LIKE ?";
    params.push(`%${String(args.account).toLowerCase()}%`);
  }
  if (args.search) {
    sql += " AND LOWER(name) LIKE ?";
    params.push(`%${String(args.search).toLowerCase()}%`);
  }
  if (args.min_revenue) {
    sql += " AND grossRevenue >= ?";
    params.push(Number(args.min_revenue));
  }
  if (args.min_winPct) {
    sql += " AND winPct >= ?";
    params.push(Number(args.min_winPct));
  }

  sql += " ORDER BY grossRevenue DESC";
  sql += ` LIMIT ?`;
  params.push(Number(args.limit) || 15);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "search_opportunities", label: "Opportunity search", data: rows, count: rows.length };
}

function executeSearchSkills(args: Record<string, unknown>): ToolResult {
  let sql = `
    SELECT e.name, e.grade, s.name as skill, s.level, s.category
    FROM hr_skills s
    JOIN employees e ON s.empId = e.empId
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (args.skill) {
    sql += " AND LOWER(s.name) LIKE ?";
    params.push(`%${String(args.skill).toLowerCase()}%`);
  }
  if (args.min_level) {
    sql += " AND s.level >= ?";
    params.push(Number(args.min_level));
  }
  if (args.grade) {
    sql += " AND LOWER(e.grade) LIKE ?";
    params.push(`%${String(args.grade).toLowerCase()}%`);
  }

  sql += " ORDER BY s.level DESC, e.name ASC";
  sql += ` LIMIT ?`;
  params.push(Number(args.limit) || 20);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "search_skills", label: "Skills search", data: rows, count: rows.length };
}

function executeGetEndingMissions(args: Record<string, unknown>): ToolResult {
  const days = Number(args.days) || 30;
  let sql = `
    SELECT e.name, e.grade, a.jobName, a.endDate, a.utilization
    FROM mds_assignments a
    JOIN employees e ON a.empId = e.empId
    WHERE a.endDate BETWEEN date('now') AND date('now', '+${days} days')
  `;
  const params: unknown[] = [];

  if (args.grade) {
    sql += " AND LOWER(e.grade) LIKE ?";
    params.push(`%${String(args.grade).toLowerCase()}%`);
  }

  sql += " ORDER BY a.endDate ASC";
  sql += ` LIMIT ?`;
  params.push(Number(args.limit) || 20);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "get_ending_missions", label: `Missions ending within ${days} days`, data: rows, count: rows.length };
}

function executeGetBench(args: Record<string, unknown>): ToolResult {
  let sql = `
    SELECT e.name, e.grade, e.subTeam
    FROM employees e
    WHERE (e.departureDate IS NULL OR e.departureDate > date('now'))
    AND NOT EXISTS (
      SELECT 1 FROM mds_assignments a
      WHERE a.empId = e.empId
      AND a.endDate >= date('now')
      AND a.startDate <= date('now')
    )
  `;
  const params: unknown[] = [];

  if (args.grade) {
    sql += " AND LOWER(e.grade) LIKE ?";
    params.push(`%${String(args.grade).toLowerCase()}%`);
  }

  sql += " ORDER BY e.grade, e.name";

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "get_bench", label: "Bench employees", data: rows, count: rows.length };
}

function executeGetGradePyramid(args: Record<string, unknown>): ToolResult {
  let sql = `
    SELECT grade, COUNT(*) as count
    FROM employees
    WHERE (departure IS NULL OR departure > date('now'))
  `;
  const params: unknown[] = [];

  if (args.team) {
    sql += " AND (LOWER(subTeam) LIKE ? OR LOWER(serviceLine) LIKE ?)";
    params.push(`%${String(args.team).toLowerCase()}%`, `%${String(args.team).toLowerCase()}%`);
  }

  sql += " GROUP BY grade ORDER BY count DESC";

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "get_grade_pyramid", label: "Grade pyramid", data: rows, count: rows.length };
}

function executeGetGlobalStats(): ToolResult {
  const empCount =
    (
      db.prepare("SELECT COUNT(*) as c FROM employees WHERE departure IS NULL OR departure > date('now')").get() as {
        c: number;
      }
    )?.c || 0;
  const oppCount =
    (db.prepare("SELECT COUNT(*) as c FROM crm_opportunities WHERE status NOT IN (14, 15)").get() as { c: number })
      ?.c || 0;
  const bookedCount =
    (db.prepare("SELECT COUNT(*) as c FROM crm_opportunities WHERE status = 14").get() as { c: number })?.c || 0;
  const totalRevenue =
    (
      db
        .prepare("SELECT COALESCE(SUM(grossRevenue), 0) as s FROM crm_opportunities WHERE status NOT IN (15)")
        .get() as { s: number }
    )?.s || 0;
  const avgWinPct =
    (
      db
        .prepare("SELECT ROUND(AVG(winPct), 1) as a FROM crm_opportunities WHERE status NOT IN (14, 15) AND winPct > 0")
        .get() as { a: number }
    )?.a || 0;

  const stats = {
    active_headcount: empCount,
    open_pipeline: oppCount,
    bookings: bookedCount,
    total_revenue: Math.round(totalRevenue),
    avg_winPct: avgWinPct,
  };

  return { tool: "get_global_stats", label: "Global statistics", data: [stats], count: 1 };
}

function executeGetTopAccounts(args: Record<string, unknown>): ToolResult {
  let sql = `
    SELECT account, COUNT(*) as oppCount,
           ROUND(SUM(grossRevenue), 0) as totalRevenue,
           ROUND(AVG(winPct), 1) as avgWinPct
    FROM crm_opportunities
    WHERE account IS NOT NULL AND account != ''
  `;
  const params: unknown[] = [];

  if (args.status) {
    const statuses = String(args.status).split(",").map(Number);
    sql += ` AND status IN (${statuses.map(() => "?").join(",")})`;
    params.push(...statuses);
  }

  sql += " GROUP BY account ORDER BY totalRevenue DESC";
  sql += ` LIMIT ?`;
  params.push(Number(args.limit) || 10);

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "get_top_accounts", label: "Top accounts", data: rows, count: rows.length };
}

function executeGetSapHours(args: Record<string, unknown>): ToolResult {
  let sql = `
    SELECT s.empId, e.name, s.date, s.hours, s.category, s.salesOrder, s.text
    FROM sap_records s
    LEFT JOIN employees e ON s.empId = e.empId
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (args.employee) {
    const search = String(args.employee).toLowerCase();
    sql += " AND (LOWER(e.name) LIKE ? OR s.empId = ?)";
    params.push(`%${search}%`, search);
  }
  if (args.startDate) {
    sql += " AND s.date >= ?";
    params.push(String(args.startDate));
  }
  if (args.endDate) {
    sql += " AND s.date <= ?";
    params.push(String(args.endDate));
  }
  if (args.category) {
    sql += " AND LOWER(s.category) LIKE ?";
    params.push(`%${String(args.category).toLowerCase()}%`);
  }

  sql += " ORDER BY s.date DESC LIMIT 50";

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "get_sap_hours", label: "SAP hours", data: rows, count: rows.length };
}

function executeGetSapSummary(args: Record<string, unknown>): ToolResult {
  let sql = `
    SELECT SUBSTR(s.date, 1, 7) as month, s.category,
           COUNT(*) as days, ROUND(SUM(s.hours), 1) as totalHours,
           COUNT(DISTINCT s.empId) as employees
    FROM sap_records s
    LEFT JOIN employees e ON s.empId = e.empId
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (args.employee) {
    const search = String(args.employee).toLowerCase();
    sql += " AND (LOWER(e.name) LIKE ? OR s.empId = ?)";
    params.push(`%${search}%`, search);
  }
  if (args.month) {
    sql += " AND SUBSTR(s.date, 1, 7) = ?";
    params.push(String(args.month));
  }

  sql += " GROUP BY month, s.category ORDER BY month DESC, totalHours DESC";

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
  return { tool: "get_sap_summary", label: "SAP summary", data: rows, count: rows.length };
}

// ── System prompt for the final answer ──

export const BASE_SYSTEM_PROMPT = `You are the AI assistant for the BearingPoint Dashboard.
You help managers manage staffing, the opportunity pipeline, and bookings for their team.

Rules:
- Respond in English, concisely and actionably.
- Use the data provided in the context. Do not fabricate data.
- If you don't have enough information, say so clearly.
- Format your responses with bullet points when relevant.

Opportunity statuses:
- 1 = Lead Identified, 4 = Go Approved, 6 = Proposal Submitted
- 11 = Client Won, 14 = Booked, 15 = Lost
`;
