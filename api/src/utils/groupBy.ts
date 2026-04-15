/**
 * Generic groupBy utility — replaces repeated manual grouping patterns.
 */

/**
 * Group array items by a key, collecting values into arrays.
 * Replaces the pattern: for (r of rows) { if (!map[r.key]) map[r.key] = []; map[r.key].push(r); }
 */
export const groupByKey = <T>(rows: T[], keyFn: (row: T) => string, mapFn?: (row: T) => any): Record<string, any[]> => {
  const result: Record<string, any[]> = {};
  for (const row of rows) {
    const key = keyFn(row);
    if (!result[key]) result[key] = [];
    result[key].push(mapFn ? mapFn(row) : row);
  }
  return result;
};

/**
 * Group array items by key, collecting unique values into sorted arrays.
 * Replaces the pattern: Map<key, Set<value>> → Record<key, sorted value[]>
 */
export const groupUniqueByKey = <T>(
  rows: T[],
  keyFn: (row: T) => string,
  valueFn: (row: T) => string | null
): Record<string, string[]> => {
  const map: Record<string, Set<string>> = {};
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!map[key]) map[key] = new Set();
    const val = valueFn(row);
    if (val) map[key].add(val);
  }
  const result: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(map)) {
    result[k] = Array.from(v).sort();
  }
  return result;
};

/**
 * Group array items into a nested key→value mapping.
 * Replaces: for (r of rows) { if (!map[r.cat]) map[r.cat] = {}; map[r.cat][r.key] = r.value; }
 */
export const groupToMap = <T>(
  rows: T[],
  groupFn: (row: T) => string,
  keyFn: (row: T) => string,
  valueFn: (row: T) => any
): Record<string, Record<string, any>> => {
  const result: Record<string, Record<string, any>> = {};
  for (const row of rows) {
    const group = groupFn(row);
    if (!result[group]) result[group] = {};
    result[group][keyFn(row)] = valueFn(row);
  }
  return result;
};
