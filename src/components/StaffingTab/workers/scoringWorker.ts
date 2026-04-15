/**
 * scoringWorker.ts — Scoring matrix computation off the main thread.
 *
 * Receives a ScoreRequest via postMessage, runs buildScoringMatrix +
 * generateProposals, and posts back the result.  Proposals are serialised
 * (Map → plain object) because the structured-clone algorithm used by
 * postMessage does not transfer Maps reliably across all runtimes.
 */

import { buildScoringMatrix, generateProposals } from "../utils/autoAssign";
import type { Slot, ScoringTolerances, Proposal } from "../utils/autoAssign";

// ── Message types ─────────────────────────────────────────────────────────────

interface ScoreRequest {
  type: "score";
  employees: SerializedEmployee[];
  slots: Slot[];
  holidays: string[];
  tolerances?: ScoringTolerances;
  teamStats: {
    currentTeamTU: number;
    currentTeamNetH: number;
    currentTeamChH: number;
  };
}

export interface SerializedEmployee {
  empId: string;
  name: string;
  grade: string;
  availableCapacityHours: number;
  netAvailableHours: number;
  _displayNetH: number;
  trueUtilizationRate: number;
  skills: Array<{ skillShort?: string; skillFull?: string }>;
  serviceLine?: string;
  assignments?: Array<{
    startDate: string;
    endDate: string;
    utilization: number;
    category: string;
    jobName: string;
  }>;
}

export interface SerializedProposal extends Omit<Proposal, "selectionMap"> {
  selectionMap: Record<string, number>;
}

interface ScoreResult {
  type: "result";
  matrix: ReturnType<typeof buildScoringMatrix>;
  proposals: SerializedProposal[];
}

interface ScoreError {
  type: "error";
  message: string;
}

// ── Handler ───────────────────────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<ScoreRequest>) => {
  try {
    const { employees, slots, holidays, tolerances, teamStats } = e.data;
    const holidaySet = new Set(holidays);

    const matrix = buildScoringMatrix(employees, slots, holidaySet, tolerances);
    const proposals = generateProposals(
      matrix,
      slots,
      employees,
      teamStats.currentTeamTU,
      teamStats.currentTeamNetH,
      teamStats.currentTeamChH
    );

    // Serialise Map<number, number> → plain object (string keys) so postMessage
    // can clone it without issues.
    const serializedProposals: SerializedProposal[] = proposals.map((p) => ({
      ...p,
      selectionMap: Object.fromEntries(p.selectionMap),
    }));

    const result: ScoreResult = { type: "result", matrix, proposals: serializedProposals };
    self.postMessage(result);
  } catch (err) {
    const error: ScoreError = { type: "error", message: String(err) };
    self.postMessage(error);
  }
};
