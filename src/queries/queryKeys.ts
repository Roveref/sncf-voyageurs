/**
 * React Query key factory — single source of truth for all cache keys.
 */

export interface CrmFilter {
  region?: string;
  country?: string;
  since?: string;
}

export const queryKeys = {
  health: ["health"] as const,
  ready: ["hydrate", "ready"] as const,
  regions: ["hydrate", "regions"] as const,
  crm: (filter: CrmFilter = {}) => ["hydrate", "crm", filter] as const,
  staffing: ["hydrate", "staffing"] as const,
  sap: ["hydrate", "sap"] as const,
  metadata: ["hydrate", "metadata"] as const,
  skills: ["hydrate", "skills"] as const,
  changes: ["hydrate", "changes"] as const,
  recruitment: ["hydrate", "recruitment"] as const,
  skillsCatalog: ["staffing", "skills", "catalog"] as const,
  employees: ["hydrate", "employees"] as const,
  grid: ["hydrate", "grid"] as const,
  gaif: ["hydrate", "gaif"] as const,
} as const;
