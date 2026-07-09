/**
 * Catalogue de services GAIF — 4 volets × 2 modes tarifaires (FIXE / FREE).
 *
 * Source : slides 9 et 10 Présentation A2P (« UNE OFFRE DE SERVICES EN 4 VOLETS »,
 *          « En 2026, des missions assurées en FIXE et d'autres en FREE »).
 */

export type TarifMode = "FIXE" | "FREE";

export interface CatalogueService {
  key: string;
  label: string;
  tarif: TarifMode;
  /** Description courte (affichage dans le widget). */
  description: string;
  /** Bénéficiaires typiques. */
  beneficiaires: string[];
  /** Demandes ouvertes à date (mock). */
  demandesOuvertes: number;
}

export interface CatalogueVolet {
  key: string;
  label: string;
  shortLabel: string;
  context: string;
  color: string;
  services: CatalogueService[];
}

export const GAIF_CATALOGUE_SERVICES: CatalogueVolet[] = [
  {
    key: "rao",
    label: "Lors de la réponse à un appel d'offre",
    shortLabel: "AO · RAO",
    context: "Accompagner la DRAO et les BU dans les réponses aux appels d'offres IDFM.",
    color: "#0EA5E9",
    services: [
      {
        key: "connaissance_ao",
        label: "Connaissance actifs IFT des lots ouverts à la concurrence",
        tarif: "FIXE",
        description: "Inventaires, état, criticité, coûts — dossier AO.",
        beneficiaires: ["DRAO", "BU TER/IC", "BU Transilien"],
        demandesOuvertes: 3,
      },
      {
        key: "demonstration_rao",
        label: "Démonstration performance maintenance IFT (RAO)",
        tarif: "FIXE",
        description: "Argumentaire perf maintenance + référentiels.",
        beneficiaires: ["DRAO"],
        demandesOuvertes: 2,
      },
      {
        key: "partenariats_maintenance",
        label: "Identification partenariats maintenance ferro & bâtiment",
        tarif: "FREE",
        description: "Scouting prestataires + négociation term-sheet.",
        beneficiaires: ["BU", "DRAO"],
        demandesOuvertes: 1,
      },
    ],
  },
  {
    key: "sd_support",
    label: "En support à une société dédiée",
    shortLabel: "Support SD",
    context: "Accompagnement du transfert d'actifs et protection des cœurs de savoir-faire.",
    color: "#7C3AED",
    services: [
      {
        key: "transfert_actifs",
        label: "Accompagnement transfert d'actifs vers société dédiée",
        tarif: "FREE",
        description: "Identification cœurs de savoir-faire + protection.",
        beneficiaires: ["BU dédiée", "POC/DI"],
        demandesOuvertes: 4,
      },
      {
        key: "desimbrication",
        label: "Désimbrication foncière et opérationnelle",
        tarif: "FIXE",
        description: "Partage foncier SA Voyageurs / SA Réseau, CGI.",
        beneficiaires: ["BU dédiée", "SNCF Réseau"],
        demandesOuvertes: 2,
      },
      {
        key: "expertise_pontuelle",
        label: "Expertises ponctuelles (prescriptions, diagnostics)",
        tarif: "FREE",
        description: "Mobilisation experts immo / ferro / IO selon besoin.",
        beneficiaires: ["BU", "Technicentres"],
        demandesOuvertes: 5,
      },
    ],
  },
  {
    key: "contrat_actuel",
    label: "Dans le cadre du contrat actuel",
    shortLabel: "Contrat actuel",
    context: "Optimisation du programme de maintenance sur la durée du contrat IDFM (7-11 ans).",
    color: "#EB0070",
    services: [
      {
        key: "optim_maintenance",
        label: "Optimisation programme de maintenance au juste nécessaire",
        tarif: "FIXE",
        description: "Plan pluriannuel maintenance, arbitrages CAPEX/OPEX.",
        beneficiaires: ["BU Transilien"],
        demandesOuvertes: 2,
      },
      {
        key: "copil_immo",
        label: "Animation COPIL Immo trajectoires investissement",
        tarif: "FIXE",
        description: "Priorisation demandes TM + avis expert immobilier.",
        beneficiaires: ["TM", "DI IDF"],
        demandesOuvertes: 0,
      },
      {
        key: "maint_sans_reseau",
        label: "Maintenance ferro sans SNCF Réseau",
        tarif: "FREE",
        description: "Contractualisation directe TSO / SFERIS.",
        beneficiaires: ["BU TN", "BU TER"],
        demandesOuvertes: 3,
      },
      {
        key: "pilotage_e2mt",
        label: "Pilotage contrat E2MT (maintenance multi-techniques)",
        tarif: "FIXE",
        description: "Relation E2MT Equans / Engie / Dalkia.",
        beneficiaires: ["TM"],
        demandesOuvertes: 1,
      },
      {
        key: "deploiement_maximo",
        label: "Déploiement Maximo v9 sur technicentres",
        tarif: "FIXE",
        description: "Migration bases + mise en qualité données IO.",
        beneficiaires: ["TM", "Services IO"],
        demandesOuvertes: 6,
      },
    ],
  },
  {
    key: "post_idfm",
    label: "Actifs récupérés par IDFM au-delà du contrat",
    shortLabel: "Post-IDFM",
    context: "Expertise long terme sur les actifs IDFM, contre rémunération.",
    color: "#10B981",
    services: [
      {
        key: "gestion_lt_actifs_idfm",
        label: "Gestion long terme actifs IDFM",
        tarif: "FREE",
        description: "Pilotage KPIs + priorisation régénération.",
        beneficiaires: ["IDFM"],
        demandesOuvertes: 0,
      },
      {
        key: "expertise_idfm",
        label: "Expertise continue (foncier, doctrine, audits)",
        tarif: "FREE",
        description: "Mobilisation experts GAIF post transfert.",
        beneficiaires: ["IDFM"],
        demandesOuvertes: 1,
      },
    ],
  },
];

export function totalDemandes(): number {
  let total = 0;
  for (const volet of GAIF_CATALOGUE_SERVICES) {
    for (const svc of volet.services) total += svc.demandesOuvertes;
  }
  return total;
}

export function demandesParMode(): Record<TarifMode, number> {
  const out: Record<TarifMode, number> = { FIXE: 0, FREE: 0 };
  for (const volet of GAIF_CATALOGUE_SERVICES) {
    for (const svc of volet.services) out[svc.tarif] += svc.demandesOuvertes;
  }
  return out;
}
