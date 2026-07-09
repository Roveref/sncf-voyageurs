/**
 * Initiatives d'industrialisation / projets d'investissement majeurs GAIF.
 * Miroir frontend des projets définis côté seed back-end (gaifSeedData.ts).
 *
 * Utilisé par les widgets CustomDashboard pour éviter de dupliquer la logique
 * métier ou de forcer un aller-retour SQL.
 */

export interface GaifProjectLite {
  id: string;
  name: string;
  patrimoine: string;
  site: string | null;
  phase: number; // status CRM 1..15
  marqueur: "Clients" | "Agilite" | "JusteBesoin" | "Innovation";
  lead: string; // empId
  startDate: string;
  endDate: string;
  budget: number; // €
}

export const GAIF_PROJECTS_LITE: GaifProjectLite[] = [
  {
    id: "PROJ-PIVOS-ARDOINES",
    name: "PIVOS Les Ardoines — reprise exploitation",
    patrimoine: "Ferroviaire",
    site: "SITE-TNC-LAD",
    phase: 11,
    marqueur: "Innovation",
    lead: "GAIF006",
    startDate: "2025-03-01",
    endDate: "2026-12-31",
    budget: 4_800_000,
  },
  {
    id: "PROJ-MAXIMO-NOISY",
    name: "Maximo v9 pilote Noisy",
    patrimoine: "IO",
    site: "SITE-SMR-NSY",
    phase: 6,
    marqueur: "Innovation",
    lead: "GAIF010",
    startDate: "2025-06-15",
    endDate: "2026-06-30",
    budget: 1_200_000,
  },
  {
    id: "PROJ-MAXIMO-NAT",
    name: "Maximo v9 national",
    patrimoine: "IO",
    site: null,
    phase: 4,
    marqueur: "Innovation",
    lead: "GAIF010",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    budget: 3_500_000,
  },
  {
    id: "PROJ-GTB-BACS",
    name: "GTB / Décret BACS — déploiement SMR",
    patrimoine: "Immobilier",
    site: "SITE-SMR-MSY",
    phase: 6,
    marqueur: "Innovation",
    lead: "GAIF008",
    startDate: "2025-04-01",
    endDate: "2027-01-31",
    budget: 5_200_000,
  },
  {
    id: "PROJ-ISO-SVCO",
    name: "Certification ISO 55001 — SVCO",
    patrimoine: "Ferroviaire",
    site: null,
    phase: 6,
    marqueur: "Innovation",
    lead: "GAIF003",
    startDate: "2025-09-01",
    endDate: "2026-12-31",
    budget: 650_000,
  },
  {
    id: "PROJ-FONCIER-LANDY",
    name: "Transfert foncier Le Landy",
    patrimoine: "Foncier",
    site: null,
    phase: 11,
    marqueur: "JusteBesoin",
    lead: "GAIF009",
    startDate: "2025-01-15",
    endDate: "2026-06-30",
    budget: 380_000,
  },
  {
    id: "PROJ-DESIMBR-BLANC",
    name: "Désimbrication Blancarde — PACA",
    patrimoine: "Foncier",
    site: null,
    phase: 4,
    marqueur: "JusteBesoin",
    lead: "GAIF009",
    startDate: "2025-11-01",
    endDate: "2027-03-31",
    budget: 1_100_000,
  },
  {
    id: "PROJ-RAO-TER",
    name: "Appui RAO TER (Aura/Occitanie/BFC/Sud PACA)",
    patrimoine: "Ferroviaire",
    site: null,
    phase: 4,
    marqueur: "Clients",
    lead: "GAIF012",
    startDate: "2025-10-01",
    endDate: "2026-09-30",
    budget: 780_000,
  },
  {
    id: "PROJ-MAINT-SR",
    name: "Maintenance ferro sans SNCF Réseau — TER",
    patrimoine: "Ferroviaire",
    site: null,
    phase: 4,
    marqueur: "JusteBesoin",
    lead: "GAIF006",
    startDate: "2026-01-15",
    endDate: "2027-06-30",
    budget: 950_000,
  },
  {
    id: "PROJ-CATA-TPSL",
    name: "Régénération caténaire TPSL Achères",
    patrimoine: "Ferroviaire",
    site: "SITE-TPSL-ACH",
    phase: 1,
    marqueur: "Agilite",
    lead: "GAIF006",
    startDate: "2026-05-01",
    endDate: "2027-12-31",
    budget: 2_300_000,
  },
  {
    id: "PROJ-PSGA-MAJ",
    name: "PSGA v2 + processus cycle de vie",
    patrimoine: "Transverse",
    site: null,
    phase: 6,
    marqueur: "Innovation",
    lead: "GAIF003",
    startDate: "2025-10-01",
    endDate: "2026-05-31",
    budget: 220_000,
  },
  {
    id: "PROJ-CATALOG-DET",
    name: "Catalogue services DET TER/IC",
    patrimoine: "Transverse",
    site: null,
    phase: 4,
    marqueur: "Clients",
    lead: "GAIF012",
    startDate: "2026-01-15",
    endDate: "2026-03-31",
    budget: 85_000,
  },
  // Complément PPI 2026-2030 — projets à venir (émergence)
  {
    id: "PROJ-GTB-BACS-2",
    name: "GTB / Décret BACS — vague 2 (SMGL)",
    patrimoine: "Immobilier",
    site: null,
    phase: 1,
    marqueur: "Innovation",
    lead: "GAIF008",
    startDate: "2027-02-01",
    endDate: "2029-06-30",
    budget: 4_500_000,
  },
  {
    id: "PROJ-DECRET-TER",
    name: "Décret Tertiaire — mise en conformité",
    patrimoine: "Immobilier",
    site: null,
    phase: 1,
    marqueur: "Innovation",
    lead: "GAIF008",
    startDate: "2027-09-01",
    endDate: "2030-06-30",
    budget: 6_800_000,
  },
  {
    id: "PROJ-VOIES-FUT",
    name: "Régénération voies faisceaux restants",
    patrimoine: "Ferroviaire",
    site: null,
    phase: 1,
    marqueur: "JusteBesoin",
    lead: "GAIF006",
    startDate: "2028-01-01",
    endDate: "2030-12-31",
    budget: 8_500_000,
  },
];

/**
 * Distribue linéairement le budget d'un projet sur toutes les années couvertes
 * par sa période [startDate, endDate].
 */
export function distributeBudgetByYear(proj: GaifProjectLite): Record<number, number> {
  const start = new Date(proj.startDate);
  const end = new Date(proj.endDate);
  const days: Record<number, number> = {};
  const d = new Date(start);
  while (d <= end) {
    const y = d.getFullYear();
    days[y] = (days[y] ?? 0) + 1;
    d.setDate(d.getDate() + 1);
  }
  const totalDays = Object.values(days).reduce((acc, v) => acc + v, 0);
  const perYear: Record<number, number> = {};
  for (const [y, n] of Object.entries(days)) {
    perYear[Number(y)] = (n / totalDays) * proj.budget;
  }
  return perYear;
}
