/**
 * Agent evaluation suite — Automated testing of AI agent quality.
 *
 * 25 test cases covering all tool types and question patterns.
 * Run via: npx tsx api/src/services/agentEval.ts
 * Or via API: GET /api/chat/eval
 */

// Side-effect import MUST come first — loads .env before any module captures process.env.
// (ES modules evaluate depth-first, so this completes before agent.js → llm.js is imported.)
import "./loadEnv.js";

import { runAgent, type ScoringConfig } from "./agent.js";
import { log } from "../utils/logger.js";

// ── Test case definition ──

interface EvalCase {
  id: string;
  category: "lookup" | "kpi" | "staffing" | "pipeline" | "impact" | "alert" | "profile" | "multi-step";
  question: string;
  /** Strings that MUST appear in the answer (case-insensitive) */
  mustContain?: string[];
  /** Strings that MUST NOT appear in the answer */
  mustNotContain?: string[];
  /** Minimum number of tool calls expected */
  minToolCalls?: number;
  /** Maximum number of tool calls (efficiency check) */
  maxToolCalls?: number;
  /** Tool names that should have been called */
  expectedTools?: string[];
  /** Answer must be non-empty */
  requireAnswer?: boolean;
  /** Max acceptable latency in ms */
  maxLatencyMs?: number;
  scoringConfig?: ScoringConfig;
}

// ── Test cases ──

const EVAL_CASES: EvalCase[] = [
  // ── Lookups (simple SQL) ──
  {
    id: "L1",
    category: "lookup",
    question: "Combien d'opportunites sont en statut Won ?",
    mustContain: [],
    mustNotContain: ["erreur", "error"],
    maxToolCalls: 2,
    requireAnswer: true,
  },
  {
    id: "L2",
    category: "lookup",
    question: "Liste les 5 plus grosses opportunites par revenue",
    mustNotContain: ["erreur", "error"],
    maxToolCalls: 2,
    requireAnswer: true,
  },
  {
    id: "L3",
    category: "lookup",
    question: "Quels sont les consultants de l'equipe ?",
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },

  // ── KPIs ──
  {
    id: "K1",
    category: "kpi",
    question: "Quel est le TU de l'equipe ce mois ?",
    expectedTools: ["get_team_kpis"],
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },
  {
    id: "K2",
    category: "kpi",
    question: "Donne moi le bench% et le TO% du trimestre en cours",
    expectedTools: ["get_team_kpis"],
    mustContain: ["%"],
    requireAnswer: true,
  },

  // ── Staffing ──
  {
    id: "S1",
    category: "staffing",
    question: "Qui est disponible le mois prochain parmi les Senior Consultants ?",
    expectedTools: ["compute_availability"],
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },
  {
    id: "S2",
    category: "staffing",
    question: "Trouve les meilleurs candidats pour un besoin Consultant du 1er mai au 30 juin avec des competences SAP",
    expectedTools: ["find_staffing_candidates"],
    mustNotContain: ["erreur", "error"],
    minToolCalls: 1,
    requireAnswer: true,
  },

  // ── Pipeline ──
  {
    id: "P1",
    category: "pipeline",
    question: "Analyse le pipeline : weighted booking, concentration, deals stagnants",
    expectedTools: ["get_pipeline_kpis"],
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },
  {
    id: "P2",
    category: "pipeline",
    question: "Quel est le top 3 des comptes par revenue pipeline ?",
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },

  // ── Impact / What-if ──
  {
    id: "I1",
    category: "impact",
    question: "Que se passe-t-il si on perd le plus gros deal du pipeline ?",
    expectedTools: ["simulate_impact"],
    mustNotContain: ["erreur"],
    minToolCalls: 1,
    requireAnswer: true,
  },

  // ── Alerts ──
  {
    id: "A1",
    category: "alert",
    question: "Quelles sont les alertes en cours ?",
    expectedTools: ["get_alerts"],
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },
  {
    id: "A2",
    category: "alert",
    question: "Y a-t-il des problemes de staffing ? Gaps, suraffectation, bench ?",
    expectedTools: ["detect_staffing_gaps"],
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },

  // ── Multi-step ──
  {
    id: "M1",
    category: "multi-step",
    question: "Compare le TU Q1 2026 vs Q2 2026 par grade",
    minToolCalls: 2,
    expectedTools: ["get_team_kpis"],
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },
  {
    id: "M2",
    category: "multi-step",
    question: "Quels sont les deals Won sans staffing needs et combien de personnes sont en bench longue duree ?",
    minToolCalls: 1,
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },

  // ── Search entity ──
  {
    id: "SE1",
    category: "lookup",
    question: "Cherche toutes les opportunites liees a BNP",
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },

  // ── Variance ──
  {
    id: "V1",
    category: "kpi",
    question: "Montre la variance SAP vs MDS ce trimestre",
    expectedTools: ["get_sap_mds_variance"],
    mustNotContain: ["erreur", "error"],
    requireAnswer: true,
  },

  // ── Safe query pattern usage ──
  {
    id: "SQ1",
    category: "lookup",
    question: "Combien d'opportunites par statut ?",
    mustNotContain: ["erreur", "error"],
    maxToolCalls: 2,
    requireAnswer: true,
  },

  // ── Data integrity: no hallucinations ──
  // Intent: the agent must NOT fabricate a currency value for a non-existent opportunity.
  // It should say the ID doesn't exist. "revenue" (the word) can't be forbidden because
  // it appears in the question itself — forbid currency markers instead.
  {
    id: "DI1",
    category: "lookup",
    question: "Quel est le revenue exact de l'opportunite avec l'ID 'INEXISTANT-999' ?",
    mustNotContain: ["€", "EUR"],
    mustContain: ["INEXISTANT-999"],
    requireAnswer: true,
  },

  // ── Profile detection ──
  {
    id: "PR1",
    category: "profile",
    question: "Je suis Director de l'equipe FSI, mes comptes sont Societe Generale et BNP Paribas",
    expectedTools: ["update_user_profile"],
    requireAnswer: true,
  },

  // ── Edge cases ──
  {
    id: "E1",
    category: "lookup",
    question: "?",
    requireAnswer: true,
    maxToolCalls: 3,
  },
  {
    id: "E2",
    category: "lookup",
    question: "Bonjour",
    requireAnswer: true,
    maxToolCalls: 1,
  },

  // ── Efficiency: simple questions should use few tools ──
  {
    id: "EF1",
    category: "lookup",
    question: "Combien d'employes actifs ?",
    maxToolCalls: 2,
    requireAnswer: true,
  },
  {
    id: "EF2",
    category: "kpi",
    question: "TU equipe ce mois ?",
    maxToolCalls: 2,
    expectedTools: ["get_team_kpis"],
    requireAnswer: true,
  },

  // ── Correct enum usage ──
  {
    id: "EN1",
    category: "lookup",
    question: "Liste les deals en Proposal",
    mustNotContain: ["status = 'Proposal'", "status = 'proposal'"],
    requireAnswer: true,
  },
];

// ── Test runner ──

interface EvalResult {
  id: string;
  category: string;
  question: string;
  passed: boolean;
  failures: string[];
  answer: string;
  toolCalls: number;
  toolsUsed: string[];
  latencyMs: number;
  tokens: { input: number; output: number };
}

async function runEvalCase(testCase: EvalCase): Promise<EvalResult> {
  const start = Date.now();
  const failures: string[] = [];

  try {
    const result = await runAgent(testCase.question, [], undefined, testCase.scoringConfig);
    const latencyMs = Date.now() - start;
    const answer = result.answer || "";
    const answerLower = answer.toLowerCase();
    const toolCallSteps = result.steps.filter((s) => s.type === "tool_call");
    const toolsUsed = toolCallSteps.map((s) => s.content);
    const toolNamesUsed = new Set(toolCallSteps.map((s) => s.toolName).filter((n): n is string => !!n));

    // Check requireAnswer
    if (testCase.requireAnswer && !answer.trim()) {
      failures.push("Empty answer");
    }

    // Check mustContain
    for (const term of testCase.mustContain || []) {
      if (!answerLower.includes(term.toLowerCase())) {
        failures.push(`Missing required term: "${term}"`);
      }
    }

    // Check mustNotContain
    for (const term of testCase.mustNotContain || []) {
      if (answerLower.includes(term.toLowerCase())) {
        failures.push(`Contains forbidden term: "${term}"`);
      }
    }

    // Check tool call counts
    if (testCase.minToolCalls !== undefined && result.toolCalls < testCase.minToolCalls) {
      failures.push(`Too few tool calls: ${result.toolCalls} < ${testCase.minToolCalls}`);
    }
    if (testCase.maxToolCalls !== undefined && result.toolCalls > testCase.maxToolCalls) {
      failures.push(`Too many tool calls: ${result.toolCalls} > ${testCase.maxToolCalls}`);
    }

    // Check expected tools — match on the canonical tool name emitted by the agent.
    if (testCase.expectedTools) {
      for (const tool of testCase.expectedTools) {
        if (!toolNamesUsed.has(tool)) {
          failures.push(`Expected tool "${tool}" was not used`);
        }
      }
    }

    // Check latency
    if (testCase.maxLatencyMs && latencyMs > testCase.maxLatencyMs) {
      failures.push(`Too slow: ${latencyMs}ms > ${testCase.maxLatencyMs}ms`);
    }

    return {
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      passed: failures.length === 0,
      failures,
      answer: answer.slice(0, 200),
      toolCalls: result.toolCalls,
      toolsUsed,
      latencyMs,
      tokens: { input: result.totalInputTokens || 0, output: result.totalOutputTokens || 0 },
    };
  } catch (err) {
    return {
      id: testCase.id,
      category: testCase.category,
      question: testCase.question,
      passed: false,
      failures: [`Exception: ${(err as Error).message}`],
      answer: "",
      toolCalls: 0,
      toolsUsed: [],
      latencyMs: Date.now() - start,
      tokens: { input: 0, output: 0 },
    };
  }
}

// ── Public API ──

export async function runEvalSuite(caseIds?: string[]): Promise<{
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    totalLatencyMs: number;
    totalTokens: number;
  };
  results: EvalResult[];
}> {
  const cases = caseIds ? EVAL_CASES.filter((c) => caseIds.includes(c.id)) : EVAL_CASES;

  log("eval", `Running ${cases.length} eval cases...`);
  const results: EvalResult[] = [];

  for (const tc of cases) {
    log("eval", `  [${tc.id}] ${tc.question.slice(0, 60)}...`);
    const result = await runEvalCase(tc);
    results.push(result);
    log(
      "eval",
      `  [${tc.id}] ${result.passed ? "PASS" : "FAIL"} (${result.latencyMs}ms, ${result.toolCalls} tools)${result.failures.length > 0 ? " — " + result.failures.join(", ") : ""}`
    );
  }

  const passed = results.filter((r) => r.passed).length;
  const totalTokens = results.reduce((s, r) => s + r.tokens.input + r.tokens.output, 0);

  const summary = {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: Math.round((passed / results.length) * 100),
    totalLatencyMs: results.reduce((s, r) => s + r.latencyMs, 0),
    totalTokens,
  };

  log(
    "eval",
    `\nEval complete: ${summary.passed}/${summary.total} passed (${summary.passRate}%), ${totalTokens} tokens, ${summary.totalLatencyMs}ms total`
  );

  return { summary, results };
}

export { EVAL_CASES };
export type { EvalCase, EvalResult };

// ── CLI entry point: npx tsx api/src/services/agentEval.ts [caseIds...] ──

const isCLI = process.argv[1]?.endsWith("agentEval.ts") || process.argv[1]?.endsWith("agentEval.js");
if (isCLI) {
  const args = process.argv.slice(2);
  const caseIds = args.length > 0 ? args : undefined;

  console.log(`\n🔬 Agent Eval Suite — ${caseIds ? caseIds.join(", ") : "all 25 cases"}\n`);

  runEvalSuite(caseIds)
    .then(({ summary, results }) => {
      console.log("\n" + "=".repeat(70));
      for (const r of results) {
        const status = r.passed ? "✅ PASS" : "❌ FAIL";
        const tools = r.toolsUsed.length > 0 ? ` [${r.toolsUsed.map((t) => t.slice(0, 30)).join(", ")}]` : "";
        console.log(`  ${r.id.padEnd(5)} ${status}  ${r.latencyMs}ms  ${r.toolCalls} tools${tools}`);
        if (r.failures.length > 0) {
          for (const f of r.failures) console.log(`         ↳ ${f}`);
        }
      }
      console.log("=".repeat(70));
      console.log(`\n  ${summary.passed}/${summary.total} passed (${summary.passRate}%)`);
      console.log(`  ${summary.totalTokens.toLocaleString()} tokens total`);
      console.log(`  ${(summary.totalLatencyMs / 1000).toFixed(1)}s total\n`);
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error("Eval failed:", err);
      process.exit(2);
    });
}
