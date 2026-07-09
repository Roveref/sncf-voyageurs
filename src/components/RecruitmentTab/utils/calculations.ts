/**
 * Recruitment KPI calculations.
 */

import type { RecruitmentCandidate } from "../../../types/recruitment";
import { parseJobPostings, parseChannels } from "./serviceLineParser";

// ── Funnel ──

export interface FunnelData {
  total: number;
  evaluated: number;
  interviewed: number;
  hired: number;
}

export function computeFunnel(candidates: RecruitmentCandidate[]): FunnelData {
  // GAIF: NC funnel — detectee → en_analyse → plan_action → en_traitement → resolue
  // "evaluated" = analysées (passées au-delà de "detectee")
  // "interviewed" = plan d'action en cours ou plus avancé
  // "hired" = résolues (fermées)
  const NC_ANALYSED = new Set(["en_analyse", "plan_action", "en_traitement", "resolue", "fermee"]);
  const NC_PLAN_ACTION = new Set(["plan_action", "en_traitement", "resolue", "fermee"]);
  const NC_RESOLVED = new Set(["resolue", "fermee"]);
  return {
    total: candidates.length,
    evaluated: candidates.filter((c) => NC_ANALYSED.has(c.status || "")).length,
    interviewed: candidates.filter((c) => NC_PLAN_ACTION.has(c.status || "")).length,
    hired: candidates.filter((c) => NC_RESOLVED.has(c.status || "")).length,
  };
}

// ── Process duration ──

export function computeProcessDurationDays(c: RecruitmentCandidate): number | null {
  if (!c.creationDate || !c.lastActivity) return null;
  const start = new Date(c.creationDate);
  const end = new Date(c.lastActivity);
  const diff = end.getTime() - start.getTime();
  return diff > 0 ? Math.round(diff / 86400000) : null;
}

// ── Conversion by poste x year ──

export interface ConversionEntry {
  year: string;
  poste: string;
  total: number;
  hired: number;
  rate: number;
}

export function computeConversionByPosteYear(candidates: RecruitmentCandidate[]): ConversionEntry[] {
  const map = new Map<string, { total: number; hired: number }>();
  for (const c of candidates) {
    if (!c.creationDate) continue;
    const year = c.creationDate.slice(0, 4);
    const key = `${year}::${c.poste}`;
    const entry = map.get(key) || { total: 0, hired: 0 };
    entry.total++;
    if (c.status === "resolue" || c.status === "fermee") entry.hired++;
    map.set(key, entry);
  }
  const result: ConversionEntry[] = [];
  for (const [key, { total, hired }] of map) {
    const [year, poste] = key.split("::");
    result.push({ year, poste, total, hired, rate: total > 0 ? (hired / total) * 100 : 0 });
  }
  return result.sort((a, b) => a.year.localeCompare(b.year) || a.poste.localeCompare(b.poste));
}

// ── Service line counts ──

export interface ServiceLineEntry {
  name: string;
  count: number;
}

export function computeServiceLineCounts(candidates: RecruitmentCandidate[]): ServiceLineEntry[] {
  const map = new Map<string, number>();
  for (const c of candidates) {
    for (const sl of parseJobPostings(c.jobPostings)) {
      map.set(sl, (map.get(sl) || 0) + 1);
    }
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

// ── Channel counts ──

export interface ChannelEntry {
  channel: string;
  total: number;
  hired: number;
}

export function computeChannelCounts(candidates: RecruitmentCandidate[]): ChannelEntry[] {
  const map = new Map<string, { total: number; hired: number }>();
  for (const c of candidates) {
    const channels = parseChannels(c.candidateStatus);
    if (channels.length === 0) channels.push("direct");
    for (const ch of channels) {
      const entry = map.get(ch) || { total: 0, hired: 0 };
      entry.total++;
      if (c.status === "resolue" || c.status === "fermee") entry.hired++;
      map.set(ch, entry);
    }
  }
  return [...map.entries()]
    .map(([channel, { total, hired }]) => ({ channel, total, hired }))
    .sort((a, b) => b.total - a.total);
}

// ── Monthly volume ──

export interface MonthlyEntry {
  month: string;
  rejected: number;
  active: number;
  hired: number;
  total: number;
  cumulative: number;
}

export function computeMonthlyVolume(candidates: RecruitmentCandidate[]): MonthlyEntry[] {
  const map = new Map<string, { rejected: number; active: number; hired: number }>();
  for (const c of candidates) {
    if (!c.creationDate) continue;
    const month = c.creationDate.slice(0, 7);
    const entry = map.get(month) || { rejected: 0, active: 0, hired: 0 };
    if (c.status === "detectee") entry.rejected++;
    else if (c.status === "en_analyse" || c.status === "plan_action" || c.status === "en_traitement") entry.active++;
    else if (c.status === "resolue" || c.status === "fermee") entry.hired++;
    map.set(month, entry);
  }
  const sorted = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let cumulative = 0;
  return sorted.map(([month, { rejected, active, hired }]) => {
    const total = rejected + active + hired;
    cumulative += total;
    return { month, rejected, active, hired, total, cumulative };
  });
}

// ── Duration by status ──

export interface DurationByStatus {
  status: string;
  avgDays: number;
  count: number;
}

export function computeDurationByStatus(candidates: RecruitmentCandidate[]): DurationByStatus[] {
  const map = new Map<string, number[]>();
  for (const c of candidates) {
    const days = computeProcessDurationDays(c);
    if (days == null) continue;
    const arr = map.get(c.status) || [];
    arr.push(days);
    map.set(c.status, arr);
  }
  return [...map.entries()].map(([status, durations]) => ({
    status,
    avgDays: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    count: durations.length,
  }));
}

// ── Recruiter counts ──

export interface RecruiterEntry {
  name: string;
  count: number;
}

export function computeRecruiterCounts(candidates: RecruitmentCandidate[]): RecruiterEntry[] {
  const map = new Map<string, number>();
  for (const c of candidates) {
    for (const r of [c.recruiter1, c.recruiter2, c.recruiter3]) {
      if (!r) continue;
      // Extract name (format: "Name - DD/MM/YYYY")
      const name = r.replace(/\s*-\s*\d{2}\/\d{2}\/\d{4}$/, "").trim();
      if (name) map.set(name, (map.get(name) || 0) + 1);
    }
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

// ── Grade distribution ──

export interface GradeDistEntry {
  gradeBucket: string;
  rejected: number;
  active: number;
  hired: number;
  total: number;
}

export function computeGradeDistribution(candidates: RecruitmentCandidate[]): GradeDistEntry[] {
  const map = new Map<string, { rejected: number; active: number; hired: number }>();
  for (const c of candidates) {
    const bucket = c.gradeBucket || "Unknown";
    const entry = map.get(bucket) || { rejected: 0, active: 0, hired: 0 };
    if (c.status === "detectee") entry.rejected++;
    else if (c.status === "en_analyse" || c.status === "plan_action" || c.status === "en_traitement") entry.active++;
    else if (c.status === "resolue" || c.status === "fermee") entry.hired++;
    map.set(bucket, entry);
  }
  const order = ["Intern", "Analyst", "Consultant+"];
  return order
    .filter((g) => map.has(g))
    .map((gradeBucket) => {
      const { rejected, active, hired } = map.get(gradeBucket)!;
      return { gradeBucket, rejected, active, hired, total: rejected + active + hired };
    });
}
