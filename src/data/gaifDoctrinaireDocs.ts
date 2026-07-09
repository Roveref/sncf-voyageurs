/**
 * Référentiel documentaire GAIF — documents de doctrine accessibles.
 *
 * Source : Inputs/ PSGA, Politique GA, Prescriptions, Note Parties Prenantes,
 *          Note Inventaire, Note Audit, Présentation A2P.
 */

export interface DoctrinaireDoc {
  key: string;
  title: string;
  category: "Stratégie" | "Prescription" | "Note" | "Présentation" | "Politique";
  version: string;
  lastUpdate: string;
  owner: string;
  /** Statut dans le cycle de vie doctrinaire. */
  status: "Publié" | "Validation" | "Work in progress";
  summary: string;
}

export const GAIF_DOCTRINAIRE_DOCS: DoctrinaireDoc[] = [
  {
    key: "PSGA-V2",
    title: "Plan Stratégique de Gestion d'Actifs (PSGA)",
    category: "Stratégie",
    version: "v2",
    lastUpdate: "2024-09-25",
    owner: "TN GAIF",
    status: "Publié",
    summary:
      "Traduit la Politique GA IF en objectifs mesurables. 3 indicateurs GA + 8 indicateurs pilotage. 6 patrimoines. Cohérence ISO 55001.",
  },
  {
    key: "POL-GA",
    title: "Politique de Gestion d'Actifs Installations Fixes",
    category: "Politique",
    version: "v2",
    lastUpdate: "2024-10-15",
    owner: "Direction Transilien",
    status: "Validation",
    summary: "Orientations stratégiques signées par Frank RENAULT. 3 axes : externalisation, RSE, digitalisation.",
  },
  {
    key: "PR-CRITIC",
    title: "Prescription — Définition de la criticité",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Publié",
    summary: "Matrice 4×4 (occurrence × impact) adaptée par patrimoine ferro/immo/IO.",
  },
  {
    key: "PR-INVEST",
    title: "Prescription — Cycle de vie : Investissement",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Emergence",
    status: "Publié",
    summary: "Émergence → EP → CEB. Processus Carnet de Santé, avis expert immobilier.",
  },
  {
    key: "PR-EXPL",
    title: "Prescription — Cycle de vie : Exploitation",
    category: "Prescription",
    version: "v0.9",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Work in progress",
    summary: "Contractualisation SNCF Réseau, doc technique Transilien, postes d'aiguillage.",
  },
  {
    key: "PR-MAINT",
    title: "Prescription — Cycle de vie : Maintenance",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Publié",
    summary: "Externalisation ferro (TSO, SFERIS), contrat E2MT immo, 3 schémas IO.",
  },
  {
    key: "PR-FIN",
    title: "Prescription — Cycle de vie : Fin de vie",
    category: "Prescription",
    version: "v0.9",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Work in progress",
    summary: "Économie circulaire, valorisation, RSE des investissements.",
  },
  {
    key: "PR-GOUV",
    title: "Prescription — Processus, Gouvernance & Comitologie",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Direction GAIF",
    status: "Publié",
    summary: "11 processus PSGA + RACI complet. Comitologie 4 comités TN.",
  },
  {
    key: "PR-PERF",
    title: "Prescription — Performance du SGA",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-10-01",
    owner: "Direction GAIF",
    status: "Publié",
    summary: "Seuils cibles par criticité : taux dispo, non-conformité, coût GA/rame.",
  },
  {
    key: "NOTE-PP",
    title: "Note — Parties prenantes GA IF",
    category: "Note",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Strat & Dev",
    status: "Publié",
    summary: "Cartographie parties prenantes + RACI 12 activités × 6 PP + RACI 55001.",
  },
  {
    key: "NOTE-INV",
    title: "Note — Inventaire du parc & outils",
    category: "Note",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Publié",
    summary: "53 UT · 539 bâtiments · 251k m² · 3057 équipements. Outils SI par patrimoine.",
  },
  {
    key: "NOTE-GRAN",
    title: "Note — Application de la granularité",
    category: "Note",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Publié",
    summary: "Granularité ferro (obj → composants), immo (UT/LOT/BAT/LOCAL), IO (ESM vs Hors ESM).",
  },
  {
    key: "NOTE-AUDIT",
    title: "Note — Audit interne 55001",
    category: "Note",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Work in progress",
    summary: "SWOT + état des lieux + plan d'amélioration ISO 55001.",
  },
  {
    key: "PRES-A2P",
    title: "Présentation entité A2P / GAIF",
    category: "Présentation",
    version: "v1",
    lastUpdate: "2026-04-03",
    owner: "Direction A2P",
    status: "Publié",
    summary: "Organigramme A2P, missions, catalogue services, comitologie, enjeux 2026.",
  },
];

export const STATUS_COLOR_DOC: Record<DoctrinaireDoc["status"], string> = {
  Publié: "#10B981",
  Validation: "#F59E0B",
  "Work in progress": "#94A3B8",
};
