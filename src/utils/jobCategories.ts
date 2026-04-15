/** Special job code to category mapping. Populated at hydration from var_config.category.*.jobCodes */
export const SPECIAL_JOB_CODES: Record<string, string> = {};

/** Full replacement of SPECIAL_JOB_CODES from consolidated category config */
export function updateJobCategoriesFromConfig(mapping: Record<string, string>): void {
  for (const k of Object.keys(SPECIAL_JOB_CODES)) delete SPECIAL_JOB_CODES[k];
  Object.assign(SPECIAL_JOB_CODES, mapping);
}

/**
 * Categorize a job based on its job number.
 *
 * Rules (in order):
 *   Special codes      -> looked up in SPECIAL_JOB_CODES
 *   6-digit numeric    -> generalOppty
 *   7-digit numeric    -> chargeable
 *   everything else    -> unknown
 */
export function categorizeJob(jobNo: string | number): string {
  if (!jobNo) return "unknown";
  const j = String(jobNo).trim();
  if (!j) return "unknown";
  const special = SPECIAL_JOB_CODES[j];
  if (special) return special;
  if (j.length === 6 && /^\d{6}$/.test(j)) return "generalOppty";
  if (j.length === 7 && /^\d{7}$/.test(j)) return "chargeable";
  return "unknown";
}
