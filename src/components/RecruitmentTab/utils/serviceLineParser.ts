/**
 * Parse job postings string to extract clean service line names.
 */

const GRADE_PREFIX =
  /^(Consultant\s+(stagiaire|junior|expérimenté\s*\/?\s*(?:manager|Manager))|Consultant Junior à Manager)\s*/i;
const SUFFIX = /\s*\(H\/F\)\s*$/i;

export function extractServiceLine(jobPosting: string): string {
  return jobPosting.replace(GRADE_PREFIX, "").replace(SUFFIX, "").trim();
}

export function parseJobPostings(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => extractServiceLine(s.trim()))
    .filter(Boolean);
}

/**
 * Parse candidate status field (comma-separated) to extract unique channels.
 */
export function parseChannels(candidateStatus: string): string[] {
  if (!candidateStatus) return [];
  return [
    ...new Set(
      candidateStatus
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}
