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
          description:
            "Phase cycle de vie GAIF : 1=Émergence, 4=Investissement/CEB, 6=Étude, 11=Maintenance lourde, 13=Conventionné, 14=En exploitation, 15=Déclassé. For opps_by_status.",
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
      "GAIF — Suggère les meilleurs experts GAIF pour intervenir sur un actif / une intervention / un projet d'investissement. Scoring multi-critères : adéquation rôle (30pts), chevauchement dates (25pts), disponibilité réelle (25pts), compétences (15pts), patrimoine (3pts), site (2pts). Tient compte du temps partiel et des transitions de rôle. Usage : « qui affecter au projet X ? », « quel expert pour cette intervention ? », « top candidats pour la mission Y ? ». Renvoie aussi la fragmentation et les pertes de transition.",
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
      "GAIF — Compare la charge réelle (SAP) vs la charge planifiée (MDS) par collaborateur GAIF. Écart en heures et en points TU, avec statut (surcharge / sous-charge / aligné). Usage : « qui dépasse la charge planifiée ? », « écart charge réelle vs plan ? », « variance d'affectation équipe GAIF ».",
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
      "GAIF — Crée un besoin d'expert/intervenant sur un actif ou un projet d'investissement. Usage : « il faut un expert signalisation sur TPSL Achères », « besoin d'un responsable mission pour la régénération caténaire ».",
    input_schema: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Asset ID (assets.id)" },
        profile: {
          type: "string",
          description:
            "Rôle cible GAIF : Apprenti, Junior, Chargé mission, Expert, Expert senior, Chef mission, Resp. pôle, Directeur",
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
      "GAIF — Crée une action/tâche sur un actif (VR à planifier, NC à résoudre, contrat à renouveler, doctrine à rédiger). Usage : « il faut planifier la VR Gx sur TN Paris-Est », « résoudre la NC signalisation Lyon ».",
    input_schema: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Asset ID" },
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
    description:
      "GAIF — Change la phase cycle de vie d'un actif (Émergence → Investissement → Étude → Maintenance → Exploitation → Déclassé).",
    input_schema: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Asset ID" },
        newStatus: {
          type: "number",
          description:
            "Phase GAIF : 1=Émergence, 4=Investissement/CEB, 6=Étude, 11=Maintenance lourde, 13=Conventionné, 14=En exploitation, 15=Déclassé",
        },
        comment: { type: "string", description: "Optional comment" },
        bookingDate: {
          type: "string",
          description: "Date effective du changement de phase (YYYY-MM-DD), requise pour Exploitation ou Déclassé",
        },
      },
      required: ["opportunityId", "newStatus"],
    },
  },
  // ── Opportunity management ──
  {
    name: "create_opportunity",
    description:
      "GAIF — Crée un actif manuel (installation fixe non remontée via Dynamics). Usage : « ajouter un nouveau poste signalisation », « référencer une sous-station qui n'est pas dans le SI ».",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nom de l'actif" },
        account: { type: "string", description: "Site / Technicentre de rattachement" },
        grossRevenue: { type: "number", description: "Valeur d'acquisition (€)" },
        netRevenue: { type: "number", description: "Valeur résiduelle (€, optionnel, défaut = valeur d'acquisition)" },
        status: {
          type: "number",
          description:
            "Phase GAIF : 1=Émergence, 4=Investissement, 6=Étude, 11=Maintenance, 14=Exploitation. Défaut : 1",
        },
        serviceLine: { type: "string", description: "Patrimoine principal (Ferroviaire, Immobilier, IO, etc.)" },
        winPct: { type: "number", description: "Probabilité d'engagement investissement (0-100). Défaut : 50" },
      },
      required: ["name", "account", "grossRevenue"],
    },
  },
  {
    name: "update_revenue_team",
    description:
      "GAIF — Met à jour l'équipe projet rattachée à un actif (expert référent, chef mission, responsable pôle). Remplace l'équipe complète.",
    input_schema: {
      type: "object",
      properties: {
        opportunityId: { type: "string", description: "Asset ID" },
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
          description: "Membres de l'équipe projet (rôle + % d'implication)",
        },
      },
      required: ["opportunityId", "members"],
    },
  },
  {
    name: "delete_opportunity",
    description:
      "GAIF — Supprime un actif manuel (stocké dans user_assets). Ne s'applique pas aux actifs remontés via Dynamics.",
    input_schema: {
      type: "object",
      properties: { opportunityId: { type: "string", description: "Asset ID à supprimer (manuel)" } },
      required: ["opportunityId"],
    },
  },
  // ── Analytics tools ──
  {
    name: "get_pipeline_kpis",
    description:
      "GAIF — Analyse globale du parc d'actifs : valeur pondérée par phase cycle de vie, forecast CAPEX mensuel, top actifs par valeur, concentration par site (top 3 sites), écart capacité (heures équipe GAIF vs besoins d'intervention). Usage : « état global du parc », « risque de concentration sur quels sites ? », « écart charge équipe vs besoins interventions ».",
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
      "GAIF — Recherche floue par nom sur experts GAIF, actifs et sites/technicentres. Renvoie les IDs. Usage : à appeler EN PREMIER quand l'utilisateur mentionne un actif ou un site par nom approximatif pour récupérer l'ID exact avant toute autre requête.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Terme de recherche (nom actif, site, expert, etc.)" },
        type: {
          type: "string",
          enum: ["all", "employee", "opportunity", "account"],
          description:
            "Type d'entité : all (tous), employee (expert), opportunity (actif), account (site). Défaut : all",
        },
      },
      required: ["query"],
    },
  },
  // ── Analysis & detection tools ──
  {
    name: "simulate_impact",
    description:
      "GAIF — Simule l'impact du retrait d'un actif, du départ d'un expert, ou de la perte d'un site entier. Calcule le delta de valeur du parc, les experts libérés, l'impact sur la charge équipe (avant/après). Usage : « que se passe-t-il si on ferme le TPSL Achères ? », « impact si l'expert signalisation part ? ».",
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
      "GAIF — Détecte tous les problèmes de staffing équipe GAIF : actifs engagés sans expert référent affecté, experts surchargés (>100%), interventions urgentes sans ressource (<30j), expert en sous-charge prolongée (>20j), compétences manquantes sur le patrimoine. Vision opérationnelle des risques équipe.",
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
      "GAIF — Tableau d'alertes opérationnelles : actions en retard, affectations se terminant, départs à venir, actifs stagnant en phase Étude (>60j), experts surchargés. Vision court-terme pour pilotage quotidien.",
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
      "Associates an HR candidate (nonconformities) with a staffing need (user_staffing_needs). Use when a recruitment candidate matches an identified need on an opportunity.",
    input_schema: {
      type: "object",
      properties: {
        candidateId: { type: "string", description: "Candidate ID (nonconformities.id)" },
        staffingNeedId: { type: "string", description: "Staffing need ID (user_staffing_needs.id)" },
        matchScore: { type: "number", description: "Match score (0-100). Optional." },
      },
      required: ["candidateId", "staffingNeedId"],
    },
  },
  {
    name: "get_comite_actions",
    description:
      "GAIF — Returns open actions associated with one of the 4 official GAIF committees (COPIL Réseau, COPIL Immo, COTECH IDFM, COPIL RSE). Use when user asks 'quelles actions sont en attente au COPIL Immo' or 'résumé du prochain COTECH IDFM'.",
    input_schema: {
      type: "object",
      properties: {
        comite: {
          type: "string",
          description: "Committee key: copil-reseau, copil-immo, cotech-idfm, copil-rse",
        },
      },
      required: ["comite"],
    },
  },
  {
    name: "get_compliance_gaps",
    description:
      "GAIF — Returns assets with conformity rate below a threshold (default 95%), optionally filtered by patrimoine and site. Use for 'actifs non conformes', 'écarts de conformité', 'où sont les NC ?'.",
    input_schema: {
      type: "object",
      properties: {
        patrimoine: {
          type: "string",
          description:
            "Optional patrimoine filter: Ferroviaire, Immobilier, IO, Courants Faibles, Propriete Intellectuelle, Gares Lignes, Foncier",
        },
        site: { type: "string", description: "Optional site filter (LIKE match on serviceLine1)" },
        threshold: { type: "number", description: "Conformity threshold % (default 95)" },
      },
    },
  },
  {
    name: "knowledge_base_lookup",
    description:
      "GAIF — Search the GAIF doctrinal corpus (PSGA, prescriptions, notes parties prenantes, présentation A2P). Use for 'que dit le PSGA sur X', 'quelle est la doctrine GAIF pour Y', or to retrieve the canonical definition of a concept.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords (min 3 chars). Examples: 'externalisation IO', 'comitologie', 'seuils PSGA'.",
        },
      },
      required: ["query"],
    },
  },
];
