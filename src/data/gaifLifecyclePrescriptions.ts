/**
 * Prescriptions PSGA sur le cycle de vie d'un actif installation fixe.
 *
 * Source : PSGA v2 chapitre 3 (Stratégies cycle de vie) +
 *          Prescriptions cycle de vie (Investissement, Exploitation, Maintenance, Fin de vie).
 */

export type LifecyclePhase = "emergence" | "strategie" | "exploitation" | "fin_de_vie";

export interface LifecyclePhaseDef {
  key: LifecyclePhase;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  /** Codes status CRM utilisés par le mapping sémantique GAIF. */
  statusCodes: number[];
  /** Rôle RACI leader (R — Responsable) — référentiel Note Parties Prenantes. */
  raciLead: string;
  /** Directives stratégiques extraites du PSGA + prescriptions. */
  directives: string[];
  /** Jalons formels qui ponctuent la phase. */
  jalons: string[];
}

export const GAIF_LIFECYCLE_PHASES: LifecyclePhaseDef[] = [
  {
    key: "emergence",
    label: "Collecter & analyser le besoin",
    shortLabel: "Émergence",
    description:
      "Identification du besoin via schéma directeur, FEB ou demande technicentre. Cadrage et évaluation du coût d'acquisition avant CEB.",
    color: "#7C3AED",
    statusCodes: [1, 4],
    raciLead: "GAIF — Pôle Emergence",
    directives: [
      "Schéma directeur étendu à toutes politiques d'équipement (régénération voies de service incluse)",
      "Demandes immobilières pilotées au niveau GAIF via Carnet de Santé + avis expert Immobilier",
      "Avis expert immobilier (favorable / reporté / défavorable) avant arbitrage",
      "Document d'expression de besoin (FEB) + analyse rentabilité (cas IO) avant acquisition",
    ],
    jalons: ["Identification besoin", "Avis expert", "Validation programme fonctionnel", "EP validée"],
  },
  {
    key: "strategie",
    label: "Mettre à jour la stratégie cycle de vie",
    shortLabel: "Stratégie",
    description:
      "Cadrage MOA après CEB (ou équivalent), conception projet sur la base du design book, intégration à l'inventaire.",
    color: "#0EA5E9",
    statusCodes: [6],
    raciLead: "GAIF — Pôle Emergence + MOA A2IF",
    directives: [
      "Design book voies de service = référentiel de conception des projets d'installations fixes",
      "Substitution progressive des technologies propriétaires SNCF Réseau (PIVOS, CTFU, clés S, SYPRAI)",
      "CEB : co-construction dossier + définition responsabilités + comitologie projet",
      "Intégration à l'inventaire à l'issue du PV de réception + PV mise en service",
    ],
    jalons: ["CEB", "CFI partagée AO", "Offre validée", "Lancement travaux"],
  },
  {
    key: "exploitation",
    label: "Exploiter opérationnellement l'actif",
    shortLabel: "Exploitation",
    description:
      "Phase la plus longue du cycle. Externalisation maintenance + pilotage contrats prestataires + suivi KPIs PSGA.",
    color: "#10B981",
    statusCodes: [11, 14],
    raciLead: "GAIF — Excellence Patrimoine + Technicentre",
    directives: [
      "Externalisation maintenance généralisée (ferroviaire + immobilier + IO non critiques)",
      "Internalisation maintenance IO criticité « forte » pour réactivité terrain",
      "Mutualisation stocks de pièces de rechange IO (Prescription Maintenance)",
      "Documentation technique Transilien en substitution progressive aux référentiels SNCF Réseau",
      "Suivi KPIs PSGA : taux disponibilité résiduelle, taux non-conformité, coût GA/rame",
    ],
    jalons: ["PV mise en service", "VR annuelle", "Revue contrat", "Revue performance trimestrielle"],
  },
  {
    key: "fin_de_vie",
    label: "Cesser l'exploitation de l'actif",
    shortLabel: "Fin de vie",
    description: "Dépose de l'actif, valorisation via économie circulaire, capitalisation REX dans le design book.",
    color: "#EF4444",
    statusCodes: [15],
    raciLead: "GAIF — Excellence Patrimoine",
    directives: [
      "Économie circulaire privilégiée (Prescription Fin de vie — document RSE)",
      "Maximisation de la réutilisation / recyclage / valorisation des matériaux",
      "Valorisation financière de l'actif déposé",
      "Formalisation REX alimentant le design book pour amélioration continue",
    ],
    jalons: ["Décision fin exploitation", "Dépose", "Valorisation", "REX & capitalisation"],
  },
];

/** Retourne la phase cycle de vie correspondant à un status CRM. */
export function phaseForStatus(status: number | null | undefined): LifecyclePhase | null {
  if (status === null || status === undefined) return null;
  for (const phase of GAIF_LIFECYCLE_PHASES) {
    if (phase.statusCodes.includes(status)) return phase.key;
  }
  return null;
}
