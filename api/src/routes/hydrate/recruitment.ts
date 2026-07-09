/**
 * Route: GET /recruitment
 * Hydrates recruitment candidates data for the frontend RecruitmentTab.
 * Also provides hired candidates for StaffingTab injection.
 */

import { Router, Request, Response } from "express";
import db from "../../db/database.js";
import { error } from "../../utils/logger.js";

const GRADE_BUCKET_TO_GRADE: Record<string, string> = {
  Intern: "Intern",
  Analyst: "Analyst",
  "Consultant+": "Consultant",
};

/** Normalize name to Title Case */
function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Find the latest GO date among all recruiter rounds + HR interview */
function findGoFinalDate(c: Record<string, string>): string {
  const dates: string[] = [];
  for (const key of ["recruiter1Date", "recruiter2Date", "recruiter3Date", "hrInterviewDate"]) {
    const d = c[key];
    if (d && d.length >= 10) dates.push(d.slice(0, 10));
  }
  if (dates.length === 0) return "";
  return dates.sort().pop() || "";
}

const router = Router();

router.get("/recruitment", (_req: Request, res: Response) => {
  try {
    const rows = db
      .prepare(
        `SELECT id, firstName, lastName, email, phone, status, poste, gradeBucket,
                jobPostings, creationDate, lastActivity, grade, candidateStatus,
                tags, note, evaluatedBy, hrInterview, linkedinUrl,
                recruiter1, recruiter1Date, recruiter1Decision, recruiter1EmpId,
                recruiter2, recruiter2Date, recruiter2Decision, recruiter2EmpId,
                recruiter3, recruiter3Date, recruiter3Decision, recruiter3EmpId,
                hrInterviewerName, hrInterviewDate, hrInterviewDecision, matchedEmpId
         FROM nonconformities ORDER BY creationDate DESC`
      )
      .all() as Record<string, unknown>[];

    if (rows.length === 0) {
      res.json({ available: false });
      return;
    }

    // Fetch all applications and group by candidateId
    const appRows = db
      .prepare("SELECT candidateId, jobPosting, segment, offering FROM nc_scopes ORDER BY candidateId")
      .all() as { candidateId: string; jobPosting: string; segment: string | null; offering: string | null }[];

    const appsByCandidate = new Map<
      string,
      { jobPosting: string; segment: string | null; offering: string | null }[]
    >();
    for (const row of appRows) {
      const list = appsByCandidate.get(row.candidateId) || [];
      list.push({ jobPosting: row.jobPosting, segment: row.segment, offering: row.offering });
      appsByCandidate.set(row.candidateId, list);
    }

    const candidates = rows.map((row) => ({
      id: String(row.id || ""),
      firstName: String(row.firstName || ""),
      lastName: String(row.lastName || ""),
      email: String(row.email || ""),
      phone: String(row.phone || ""),
      status: String(row.status || ""),
      poste: String(row.poste || ""),
      gradeBucket: String(row.gradeBucket || ""),
      jobPostings: String(row.jobPostings || ""),
      creationDate: String(row.creationDate || ""),
      lastActivity: String(row.lastActivity || ""),
      grade: String(row.grade || ""),
      candidateStatus: String(row.candidateStatus || ""),
      tags: String(row.tags || ""),
      note: row.note != null ? Number(row.note) : null,
      evaluatedBy: String(row.evaluatedBy || ""),
      hrInterview: String(row.hrInterview || ""),
      linkedinUrl: String(row.linkedinUrl || ""),
      recruiter1: String(row.recruiter1 || ""),
      recruiter1Date: String(row.recruiter1Date || ""),
      recruiter1Decision: String(row.recruiter1Decision || ""),
      recruiter1EmpId: String(row.recruiter1EmpId || ""),
      recruiter2: String(row.recruiter2 || ""),
      recruiter2Date: String(row.recruiter2Date || ""),
      recruiter2Decision: String(row.recruiter2Decision || ""),
      recruiter2EmpId: String(row.recruiter2EmpId || ""),
      recruiter3: String(row.recruiter3 || ""),
      recruiter3Date: String(row.recruiter3Date || ""),
      recruiter3Decision: String(row.recruiter3Decision || ""),
      recruiter3EmpId: String(row.recruiter3EmpId || ""),
      hrInterviewerName: String(row.hrInterviewerName || ""),
      hrInterviewDate: String(row.hrInterviewDate || ""),
      hrInterviewDecision: String(row.hrInterviewDecision || ""),
      matchedEmpId: String(row.matchedEmpId || ""),
      applications: appsByCandidate.get(String(row.id)) || [],
    }));

    // Pre-computed aggregates for charts
    const statusCounts = db.prepare("SELECT status, COUNT(*) as count FROM nonconformities GROUP BY status").all() as {
      status: string;
      count: number;
    }[];

    const gradeBucketCounts = db
      .prepare("SELECT gradeBucket, status, COUNT(*) as count FROM nonconformities GROUP BY gradeBucket, status")
      .all() as { gradeBucket: string; status: string; count: number }[];

    const monthlyVolume = db
      .prepare(
        `SELECT substr(creationDate, 1, 7) as month, status, COUNT(*) as count
         FROM nonconformities
         WHERE creationDate IS NOT NULL
         GROUP BY month, status
         ORDER BY month`
      )
      .all() as { month: string; status: string; count: number }[];

    const segmentCounts = db
      .prepare(
        "SELECT segment, COUNT(DISTINCT candidateId) as count FROM nc_scopes WHERE segment IS NOT NULL GROUP BY segment ORDER BY count DESC"
      )
      .all() as { segment: string; count: number }[];

    const offeringCounts = db
      .prepare(
        "SELECT offering, COUNT(DISTINCT candidateId) as count FROM nc_scopes WHERE offering IS NOT NULL GROUP BY offering ORDER BY count DESC"
      )
      .all() as { offering: string; count: number }[];

    res.json({
      available: true,
      candidates,
      aggregates: { statusCounts, gradeBucketCounts, monthlyVolume, segmentCounts, offeringCounts },
    });
  } catch (err) {
    error("hydrate/recruitment", "Error:", err);
    res.status(500).json({ error: "Error loading recruitment data." });
  }
});

export default router;
