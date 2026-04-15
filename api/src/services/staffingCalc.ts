/**
 * Moteur de calcul staffing côté serveur.
 *
 * Réplique la logique frontend (buildDailyGrid, computeDailyMetrics, autoAssign)
 * pour que Claude puisse calculer la disponibilité réelle et matcher les profils.
 *
 * This barrel file re-exports all sub-modules so existing importers don't break.
 */

// ── Shared types and helpers ──
export type { AvailabilityResult, CandidateMatch, TeamKPIs, ImpactResult } from "./staffing/shared.js";

// ── Availability (computeAvailability, getSapActuals, getSapMdsVariance) ──
export { computeAvailability, getSapActuals, getSapMdsVariance } from "./staffing/availability.js";

// ── Candidates (findStaffingCandidates, searchSkills) ──
export { findStaffingCandidates, searchSkills } from "./staffing/candidates.js";

// ── KPIs (getTeamKPIs, getTrend, compareScenarios) ──
export { getTeamKPIs, getTrend, compareScenarios } from "./staffing/kpis.js";

// ── Opportunities (getAccountOverview, getPipelineForecast, detectStaffingGaps, getAlerts) ──
export { getAccountOverview, getPipelineForecast, detectStaffingGaps, getAlerts } from "./staffing/opportunities.js";

// ── Impact (simulateImpact) ──
export { simulateImpact } from "./staffing/impact.js";
