/**
 * Agent IA — Tool definitions for Claude tool_use
 *
 * All 14 tool schemas that Claude can invoke.
 */

import type { ToolDefinition } from "./llm.js";

export const TOOLS: ToolDefinition[] = [
  {
    name: "safe_query",
    description:
      "Executes a secure parameterized query. PREFER this tool over execute_sql for the 10 common patterns: opps_by_status, opps_by_account, employees_by_grade, opp_count_by_status, employees_by_name, needs_for_opp, employee_skills, pipeline_by_segment, actions_for_opp, revenue_team. Faster, safer, no SQL risk.",
    input_schema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          enum: [
            "opps_by_status",
            "opps_by_account",
            "employees_by_grade",
            "opp_count_by_status",
            "employees_by_name",
            "needs_for_opp",
            "employee_skills",
            "pipeline_by_segment",
            "actions_for_opp",
            "revenue_team",
          ],
          description: "The query pattern to use",
        },
        status: {
          type: "number",
          description: "Status code (1=Lead, 4=Go, 6=Proposal, 11=Won, 14=Booked, 15=Lost). For opps_by_status.",
        },
        account: { type: "string", description: "Account name (partial match). For opps_by_account." },
        grade: { type: "string", description: "Exact grade (e.g. Consultant). For employees_by_grade." },
        name: { type: "string", description: "Name (partial match). For employees_by_name." },
        opportunityId: {
          type: "string",
          description: "Opportunity ID. For needs_for_opp, actions_for_opp, revenue_team.",
        },
        empId: { type: "string", description: "Employee ID. For employee_skills." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "execute_sql",
    description:
      "Executes a free-form SQL SELECT query on the SQLite database. Use this tool ONLY when no safe_query pattern matches (complex JOINs, custom aggregations, UNION ALL). Prefer safe_query when possible.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The SQL SELECT query to execute" },
      },
      required: ["query"],
    },
  },
  {
    name: "compute_availability",
    description:
      "Computes the actual availability of one or more employees over a period, accounting for all their assignments (MDS assignments), absences, leave, part-time (FTE), and grade transitions. Returns net hours, chargeable hours, available hours, TU%, active assignments, fragmentation and transition loss. Use this tool when asked about availability, employee workload, or utilization rate over a period.",
    input_schema: {
      type: "object",
      properties: {
        empId: { type: "string", description: "Filter on a specific employee (empId). Optional." },
        grade: { type: "string", description: "Filter by grade (e.g. 'Consultant', 'Manager'). Optional." },
        minAvailablePct: {
          type: "number",
          description: "Only return employees with at least X% availability. Optional.",
        },
        periodStart: { type: "string", description: "Period start date (YYYY-MM-DD)" },
        periodEnd: { type: "string", description: "Period end date (YYYY-MM-DD)" },
      },
      required: ["periodStart", "periodEnd"],
    },
  },
  {
    name: "find_staffing_candidates",
    description:
      "Finds and ranks the best candidates for a staffing need. Multi-criteria scoring: grade fit (30pts), date overlap (25pts), actual availability (25pts), skills (15pts), tech partner (3pts), service line (2pts). Accounts for part-time (FTE) and grade transitions. Also returns fragmentation and transition loss. Use this tool when asked who to assign to a project, which profile for a need, or the best candidates for an assignment.",
    input_schema: {
      type: "object",
      properties: {
        needId: {
          type: "string",
          description:
            "Staffing need ID (user_staffing_needs.id). If provided, automatically retrieves grade/skills/dates from the need.",
        },
        opportunityId: {
          type: "string",
          description: "Opportunity ID (to automatically load technology partners). Optional.",
        },
        grade: { type: "string", description: "Target grade (e.g. 'Senior Consultant'). Ignored if needId provided." },
        skills: {
          type: "array",
          items: { type: "string" },
          description: "Required skills (e.g. ['SAP', 'Azure']). Optional.",
        },
        periodStart: { type: "string", description: "Start date (YYYY-MM-DD)" },
        periodEnd: { type: "string", description: "End date (YYYY-MM-DD)" },
        minScore: { type: "number", description: "Minimum score (0-100) to filter. Default: no filter." },
        minAvailablePct: {
          type: "number",
          description:
            "Availability tolerance (0=strict, 100=flexible). 0 means availability must cover 100% of the need. Auto-provided.",
        },
        minSkillsMatchPct: {
          type: "number",
          description:
            "Skills tolerance (0=strict, 100=flexible). 0 means all required skills must match. Auto-provided.",
        },
        maxGradeDistance: {
          type: "number",
          description: "Max grade distance accepted (0=exact, 1=±1, 2=±2). Auto-provided.",
        },
        periodTolerance: {
          type: "number",
          description: "Period tolerance (0=exact, 1=±1 month, 2=±3 months). Widens the search window. Auto-provided.",
        },
      },
      required: ["periodStart", "periodEnd"],
    },
  },
  {
    name: "get_team_kpis",
    description:
      "Computes team KPIs: TU% (utilization rate), TO% (occupation rate), bench%, net/chargeable/absence/training hours, breakdown by grade with target comparison. Use this tool for questions about team performance, utilization rates, or comparisons between grades/teams.",
    input_schema: {
      type: "object",
      properties: {
        periodStart: { type: "string", description: "Start date (YYYY-MM-DD)" },
        periodEnd: { type: "string", description: "End date (YYYY-MM-DD)" },
        grade: { type: "string", description: "Filter by grade. Optional." },
        subTeam: { type: "string", description: "Filter by sub-team. Optional." },
      },
      required: ["periodStart", "periodEnd"],
    },
  },
  {
    name: "get_sap_mds_variance",
    description:
      "Compares actual SAP hours to planned MDS hours (forecast) per employee. Shows the delta in hours and TU percentage points, with a status (overperformance / underperformance / aligned). Use for questions like 'who exceeds the forecast?', 'actual vs planned gap?', 'staffing variance'.",
    input_schema: {
      type: "object",
      properties: {
        empId: { type: "string", description: "Filter on an employee. Optional." },
        grade: { type: "string", description: "Filter by grade. Optional." },
        periodStart: { type: "string", description: "Period start (YYYY-MM-DD)" },
        periodEnd: { type: "string", description: "Period end (YYYY-MM-DD)" },
      },
      required: ["periodStart", "periodEnd"],
    },
  },
  // ── Write tools ──
  {
    name: "create_staffing_need",
    description:
      "Creates a staffing need for an opportunity. Use this tool when the user asks to create a staffing need, add a required profile, etc.",
    input_schema: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Opportunity ID (crm_opportunities.id)" },
        profile: {
          type: "string",
          description:
            "Target grade/profile: Intern, Analyst, Consultant, Senior Consultant, Manager, Senior Manager, Director, Partner",
        },
        quantity: { type: "number", description: "Number of people. Default: 1" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        skills: { type: "array", items: { type: "string" }, description: "Required skills (optional)" },
        utilization: {
          type: "number",
          description: "Target utilization percentage (0-100, e.g. 50 = 50%). Default: 100",
        },
        probability: { type: "number", description: "Need probability (0-1, e.g. 0.5 = 50%). Default: 1 (= 100%)" },
      },
      required: ["opportunityId", "profile", "startDate", "endDate"],
    },
  },
  {
    name: "create_action",
    description:
      "Creates an action/task on an opportunity. Use this tool when the user asks to add an action, reminder, or to-do on an opportunity.",
    input_schema: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Opportunity ID" },
        description: { type: "string", description: "Action description" },
        owner: { type: "string", description: "Action owner" },
        dueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
        priority: { type: "string", enum: ["high", "medium", "low"], description: "Priority. Default: medium" },
      },
      required: ["opportunityId", "description", "owner"],
    },
  },
  {
    name: "update_opportunity_status",
    description: "Changes an opportunity's status. Use when the user asks to move an opp to booked, lost, won, etc.",
    input_schema: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Opportunity ID" },
        newStatus: {
          type: "number",
          description: "New status: 1=Lead, 4=Go Approved, 6=Proposal, 11=Won, 14=Booked, 15=Lost",
        },
        comment: { type: "string", description: "Optional comment" },
        bookingDate: { type: "string", description: "Booking/loss date (YYYY-MM-DD), required for Booked or Lost" },
      },
      required: ["opportunityId", "newStatus"],
    },
  },
  // ── Opportunity management ──
  {
    name: "create_opportunity",
    description: "Creates a manual opportunity. Use when the user wants to add an opp that doesn't exist in the CRM.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Opportunity name" },
        account: { type: "string", description: "Client account name" },
        grossRevenue: { type: "number", description: "Gross revenue in euros" },
        netRevenue: { type: "number", description: "Net revenue in euros (optional, default = gross)" },
        status: { type: "number", description: "Status: 1=Lead, 4=Go, 6=Proposal, 11=Won, 14=Booked. Default: 1" },
        serviceLine: { type: "string", description: "Main service line" },
        winPct: { type: "number", description: "Win probability (0-100). Default: 50" },
      },
      required: ["name", "account", "grossRevenue"],
    },
  },
  {
    name: "update_revenue_team",
    description:
      "Updates an opportunity's revenue team. Replaces the entire team. Each member has a name, a grade bucket (M/SM, Director, Partner) and a percentage.",
    input_schema: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Opportunity ID" },
        members: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              gradeBucket: { type: "string", enum: ["M/SM", "Director", "Partner"] },
              percentage: { type: "number" },
            },
            required: ["name", "gradeBucket", "percentage"],
          },
          description: "List of members",
        },
      },
      required: ["opportunityId", "members"],
    },
  },
  {
    name: "delete_opportunity",
    description: "Deletes a manual opportunity (stored in user_opportunities). Does not work for CRM opportunities.",
    input_schema: {
      type: "object",
      properties: { opportunityId: { type: "string", description: "Manual opportunity ID to delete" } },
      required: ["opportunityId"],
    },
  },
  // ── Analytics tools ──
  {
    name: "get_pipeline_kpis",
    description:
      "Complete pipeline analysis: weighted booking by status, monthly forecast, top deals, client concentration (top 3 accounts), capacity gap (available hours vs needs). Use for any complex question about the pipeline, forecast, risk concentration, or capacity/needs alignment.",
    input_schema: {
      type: "object",
      properties: {
        periodStart: { type: "string", description: "Start date (YYYY-MM-DD)" },
        periodEnd: { type: "string", description: "End date (YYYY-MM-DD)" },
      },
      required: ["periodStart", "periodEnd"],
    },
  },
  {
    name: "search_entity",
    description:
      "Fuzzy search by name across employees, opportunities and accounts. Returns matching entities with their IDs. Use this tool FIRST when the user mentions an entity by approximate name to find the exact ID before calling other tools or SQL.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search term (name, partial name, etc.)" },
        type: {
          type: "string",
          enum: ["all", "employee", "opportunity", "account"],
          description: "Entity type to search. Default: all",
        },
      },
      required: ["query"],
    },
  },
  // ── Analysis & detection tools ──
  {
    name: "simulate_impact",
    description:
      "Simulates the impact of losing an opportunity, an employee, or an entire account. Computes the pipeline revenue delta, freed employees, and team TU impact (before/after). Use for what-if questions ('what happens if we lose this deal?', 'impact of X leaving?').",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["lose_opportunity", "lose_employee", "lose_account"],
          description: "Scenario type",
        },
        targetId: {
          type: "string",
          description: "Entity ID (opportunityId or empId). Optional if targetName provided.",
        },
        targetName: {
          type: "string",
          description: "Entity name (account name, employee name). Optional if targetId provided.",
        },
        periodStart: { type: "string", description: "Analysis period start (YYYY-MM-DD)" },
        periodEnd: { type: "string", description: "Analysis period end (YYYY-MM-DD)" },
      },
      required: ["type", "periodStart", "periodEnd"],
    },
  },
  {
    name: "detect_staffing_gaps",
    description:
      "Detects all staffing issues over a period: Won/Go opportunities without staffing needs, over-allocated employees (>100%), urgent assignments without resources (<30d), long bench (>20d without chargeable), skill gaps. Operational risk overview.",
    input_schema: {
      type: "object",
      properties: {
        periodStart: { type: "string", description: "Period start (YYYY-MM-DD)" },
        periodEnd: { type: "string", description: "Period end (YYYY-MM-DD)" },
      },
      required: ["periodStart", "periodEnd"],
    },
  },
  {
    name: "get_alerts",
    description:
      "Retrieves active alerts: overdue actions, assignments ending soon, upcoming departures, stagnant proposals (>60d), over-allocated employees. Operational alert dashboard.",
    input_schema: {
      type: "object",
      properties: {
        lookaheadDays: { type: "number", description: "Number of days to look ahead. Default: 30" },
      },
    },
  },
  {
    name: "update_user_profile",
    description:
      "Updates the persistent user profile. Use AUTOMATICALLY when the user mentions their team, accounts, role, or preferences. The profile is remembered across sessions to personalize future responses.",
    input_schema: {
      type: "object",
      properties: {
        team: { type: "string", description: "User's team/sub-team (e.g. 'FSI', 'ERT Digital')" },
        accounts: { type: "array", items: { type: "string" }, description: "Client accounts tracked by the user" },
        role: { type: "string", description: "User's role (e.g. 'Manager FSI', 'Director ERT')" },
        grade: { type: "string", description: "User's grade" },
        preferences: { type: "string", description: "Preferences and areas of interest (free text)" },
      },
    },
  },
  // ── Employee & Scenario management ──
  {
    name: "create_scenario",
    description: "Creates a what-if staffing scenario. Allows testing assignments without impacting real data.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Scenario name" },
        description: { type: "string", description: "Optional description" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_employee",
    description:
      "Updates an employee's metadata: direct manager, arrival/departure date, grade. Use for team changes, departures, etc.",
    input_schema: {
      type: "object",
      properties: {
        empId: { type: "string", description: "Employee ID (empId)" },
        dm: { type: "string", description: "New direct manager (name). Optional." },
        departureDate: { type: "string", description: "Departure date (YYYY-MM-DD). Optional." },
        arrivalDate: { type: "string", description: "Arrival date (YYYY-MM-DD). Optional." },
        grade: { type: "string", description: "New grade. Optional." },
        gradeStartDate: {
          type: "string",
          description: "New grade start date (YYYY-MM-DD). Required if grade provided.",
        },
      },
      required: ["empId"],
    },
  },
  {
    name: "match_candidate_to_need",
    description:
      "Associates an HR candidate (hr_candidates) with a staffing need (user_staffing_needs). Use when a recruitment candidate matches an identified need on an opportunity.",
    input_schema: {
      type: "object",
      properties: {
        candidateId: { type: "string", description: "Candidate ID (hr_candidates.id)" },
        staffingNeedId: { type: "string", description: "Staffing need ID (user_staffing_needs.id)" },
        matchScore: { type: "number", description: "Match score (0-100). Optional." },
      },
      required: ["candidateId", "staffingNeedId"],
    },
  },
];
