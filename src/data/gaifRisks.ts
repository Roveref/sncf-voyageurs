/**
 * Registre de risques & opportunités du système de gestion d'actifs GAIF.
 *
 * Source : norme ISO 55001 chapitre 6.1 (« Actions pour traiter les risques et
 * les opportunités ») + audit interne Transilien.
 */

export type RiskSeverity = "critique" | "majeur" | "modere" | "mineur";
export type RiskStage = "identifie" | "evalue" | "plan_mitigation" | "cloture";
export type RiskKind = "risque" | "opportunite";

export interface RiskEntry {
  id: string;
  title: string;
  description: string;
  kind: RiskKind;
  severity: RiskSeverity;
  stage: RiskStage;
  owner: string;
  processus: string;
  patrimoine: string | null;
  dueDate: string;
}

export const GAIF_RISKS: RiskEntry[] = [
  {
    id: "RISK-001",
    title: "Perte savoir-faire expertise foncière",
    description: "Seul expert foncier senior (GAIF009) — bus-factor critique sur CGI / désimbrication.",
    kind: "risque",
    severity: "critique",
    stage: "plan_mitigation",
    owner: "GAIF001",
    processus: "Support — Ressources (§7.1)",
    patrimoine: "Foncier",
    dueDate: "2026-06-30",
  },
  {
    id: "RISK-002",
    title: "Retard migration Maximo v9 national",
    description: "Charge équipe IO sous-dimensionnée pour tenir 2026. Risque de coexistence v8/v9 prolongée.",
    kind: "risque",
    severity: "majeur",
    stage: "evalue",
    owner: "GAIF010",
    processus: "Fonctionnement — Produits & technologies (§8.3)",
    patrimoine: "IO",
    dueDate: "2026-09-30",
  },
  {
    id: "RISK-003",
    title: "Non-conformité décret BACS 2027",
    description: "Puissance cumulée > 70 kW sur 12 sites non équipés GTB — pénalités financières risquées.",
    kind: "risque",
    severity: "majeur",
    stage: "plan_mitigation",
    owner: "GAIF008",
    processus: "Planification — Risques & opportunités (§6.1)",
    patrimoine: "Immobilier",
    dueDate: "2027-01-01",
  },
  {
    id: "RISK-004",
    title: "Injonctions contradictoires DI IDF / TM",
    description: "Priorisation divergente sur investissements immobilier → retards et démotivation TM.",
    kind: "risque",
    severity: "modere",
    stage: "evalue",
    owner: "GAIF008",
    processus: "Fonctionnement — Contrôle du changement (§8.2)",
    patrimoine: "Immobilier",
    dueDate: "2026-04-30",
  },
  {
    id: "RISK-005",
    title: "Substitution technologies propriétaires SNCF Réseau",
    description: "PIVOS / CTFU / clés S / SYPRAI bloquent l'externalisation complète de la maintenance ferro.",
    kind: "risque",
    severity: "majeur",
    stage: "identifie",
    owner: "GAIF006",
    processus: "Fonctionnement — Planification (§8.1)",
    patrimoine: "Ferroviaire",
    dueDate: "2026-12-31",
  },
  {
    id: "OPP-001",
    title: "Certification ISO 55001 SVCO — vitrine RAO",
    description: "Premier site certifié → levier de différenciation sur les futurs AO IDFM.",
    kind: "opportunite",
    severity: "majeur",
    stage: "plan_mitigation",
    owner: "GAIF003",
    processus: "Amélioration — Amélioration continue (§10.1)",
    patrimoine: null,
    dueDate: "2026-12-31",
  },
  {
    id: "OPP-002",
    title: "Animation correspondants patrimoine TM",
    description: "Maillage existant et apprécié → démarche standardisée transposable au national.",
    kind: "opportunite",
    severity: "modere",
    stage: "evalue",
    owner: "GAIF008",
    processus: "Support — Communication (§7.4)",
    patrimoine: "Immobilier",
    dueDate: "2026-06-30",
  },
  {
    id: "RISK-006",
    title: "Qualité données GMAO hétérogène",
    description: "Établissements ne tiennent pas GAIA/ARMEN à jour → dégradation KPIs disponibilité.",
    kind: "risque",
    severity: "modere",
    stage: "identifie",
    owner: "GAIF010",
    processus: "Support — Données & informations (§7.6)",
    patrimoine: "IO",
    dueDate: "2026-09-30",
  },
  {
    id: "RISK-007",
    title: "Surcharge équipe GAIF",
    description: "Plan de charge 2026 déborde malgré +4 arrivants — risque burnout.",
    kind: "risque",
    severity: "modere",
    stage: "evalue",
    owner: "GAIF016",
    processus: "Support — Ressources (§7.1)",
    patrimoine: null,
    dueDate: "2026-03-31",
  },
  {
    id: "OPP-003",
    title: "Maintenance ferro sans SNCF Réseau — extension TER",
    description: "Extension TSO/SFERIS au périmètre TER → économies d'échelle et autonomie.",
    kind: "opportunite",
    severity: "majeur",
    stage: "plan_mitigation",
    owner: "GAIF006",
    processus: "Fonctionnement — Externalisation (§8.3)",
    patrimoine: "Ferroviaire",
    dueDate: "2027-06-30",
  },
];

export const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  critique: "#B91C1C",
  majeur: "#EF4444",
  modere: "#F59E0B",
  mineur: "#10B981",
};

export const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  critique: "Critique",
  majeur: "Majeur",
  modere: "Modéré",
  mineur: "Mineur",
};

export const STAGE_LABEL: Record<RiskStage, string> = {
  identifie: "Identifié",
  evalue: "Évalué",
  plan_mitigation: "Plan d'action",
  cloture: "Clôturé",
};

export interface AuditEvent {
  id: string;
  kind: "audit_interne" | "revue_direction" | "pre_audit" | "certification";
  label: string;
  scope: string;
  date: string;
  auditeur: string;
  status: "planifie" | "en_cours" | "realise";
}

export const GAIF_AUDITS: AuditEvent[] = [
  {
    id: "AUD-001",
    kind: "pre_audit",
    label: "Pré-audit ISO 55001 SVCO",
    scope: "Patrimoine ferroviaire + immobilier SVCO",
    date: "2026-06-15",
    auditeur: "Pôle Excellence Patrimoine (GAIF004)",
    status: "planifie",
  },
  {
    id: "AUD-002",
    kind: "certification",
    label: "Audit certification ISO 55001 SVCO",
    scope: "Certification externe (tiers indépendant)",
    date: "2026-11-20",
    auditeur: "Organisme de certification",
    status: "planifie",
  },
  {
    id: "AUD-003",
    kind: "audit_interne",
    label: "Audit SGA annuel TN",
    scope: "Tous patrimoines — grille 55001",
    date: "2026-09-30",
    auditeur: "Pôle Excellence Patrimoine + PMO",
    status: "planifie",
  },
  {
    id: "AUD-004",
    kind: "revue_direction",
    label: "Revue de direction GAIF 2026",
    scope: "Bilan objectifs PSGA + ajustement stratégie",
    date: "2026-12-15",
    auditeur: "Directeur GAIF + CODIR",
    status: "planifie",
  },
  {
    id: "AUD-005",
    kind: "audit_interne",
    label: "Audit qualité données GMAO",
    scope: "Maximo v8/v9, IMMOSIS, GAIA",
    date: "2026-04-18",
    auditeur: "Pôle IO + PMO",
    status: "en_cours",
  },
  {
    id: "AUD-006",
    kind: "pre_audit",
    label: "Pré-audit conformité décret BACS",
    scope: "12 sites immo > 70 kW",
    date: "2026-10-01",
    auditeur: "Expert immobilier + SNCF Immo",
    status: "planifie",
  },
];
