/**
 * Référentiel des comités officiels GAIF — cadences, participants, objet.
 *
 * Source : Prescription Gouvernance et Comitologie + slide 16 Présentation A2P
 *          (« UNE COMITOLOGIE FONCTIONELLE sur le périmètre TN »).
 */

export type ComiteCadence = "mensuel" | "bimestriel" | "trimestriel" | "semestriel";

export interface ComiteDef {
  key: string;
  label: string;
  shortLabel: string;
  cadence: ComiteCadence;
  color: string;
  /** Partie prenante principale co-animatrice. */
  coAnimateur: string;
  /** Thématiques principales portées par le comité. */
  themes: string[];
  /** Livrables / décisions attendues. */
  livrables: string[];
  /** Prochaine occurrence (ISO date). */
  nextOccurrence: string;
  /** Pôle GAIF responsable. */
  raciLead: string;
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date().toISOString().slice(0, 10);

export const GAIF_COMITES: ComiteDef[] = [
  {
    key: "COPIL-RESEAU",
    label: "COPIL Interfaces SNCF Réseau",
    shortLabel: "COPIL Réseau",
    cadence: "trimestriel",
    color: "#C8102E",
    coAnimateur: "SNCF Réseau IDF",
    themes: [
      "Contrats de prestation ferro (voies, caténaires, signalisation)",
      "Technologies propriétaires à substituer (PIVOS, CTFU, clés S, SYPRAI)",
      "Interfaces opérationnelles MOA projets",
    ],
    livrables: [
      "Revue contractuelle SNCF Réseau",
      "Plan de substitution technologies propriétaires",
      "Feuille de route commune projets ferro",
    ],
    nextOccurrence: addMonths(TODAY, 1),
    raciLead: "Pôle Excellence Patrimoine — GAIF006",
  },
  {
    key: "COPIL-IMMO",
    label: "COPIL Immo trajectoires d'investissement",
    shortLabel: "COPIL Immo",
    cadence: "bimestriel",
    color: "#1E4E8C",
    coAnimateur: "SNCF Immobilier / DI IDF",
    themes: [
      "Trajectoire CAPEX Immo PPI 2026-2030",
      "Décret BACS / Tertiaire / CEPIA — conformité technicentres",
      "Avis experts sur Carnet de Santé (favorable / reporté / défavorable)",
      "Animation correspondants patrimoine technicentres",
    ],
    livrables: [
      "Trajectoire investissement validée",
      "Décisions sur demandes Carnet de Santé",
      "Plan déploiement GTB (décret BACS)",
    ],
    nextOccurrence: addMonths(TODAY, 0),
    raciLead: "Pôle Excellence Patrimoine — GAIF008",
  },
  {
    key: "COTECH-IDFM",
    label: "COTECH GAIF avec IDFM",
    shortLabel: "COTECH IDFM",
    cadence: "bimestriel",
    color: "#7C3AED",
    coAnimateur: "IDFM",
    themes: [
      "Analyse imbrication / transfert actifs AO",
      "Sollicitations expertises IDFM",
      "Accompagnement POC et DI sur transferts",
      "Dossiers de désimbrication",
    ],
    livrables: [
      "Bilan d'avancement dossiers transferts",
      "Positions actifs stratégiques",
      "Validation interventions expertises",
    ],
    nextOccurrence: addMonths(TODAY, 1),
    raciLead: "Direction — GAIF001",
  },
  {
    key: "COPIL-RSE",
    label: "COPIL RSE avec SG TN",
    shortLabel: "COPIL RSE",
    cadence: "mensuel",
    color: "#10B981",
    coAnimateur: "Secrétariat Général TN",
    themes: [
      "Consommations eau / élec / gaz par site",
      "Conformité décrets BACS / Tertiaire / CEPIA / ACC",
      "Politique RSE des actifs installations fixes",
      "Économie circulaire en fin de vie",
    ],
    livrables: [
      "Indicateurs RSE consolidés",
      "Plan d'actions conformité réglementaire",
      "REX fin de vie et valorisation",
    ],
    nextOccurrence: addMonths(TODAY, 0),
    raciLead: "Direction — GAIF001",
  },
];

/** Compte les comités par cadence (pour KPIs synthétiques). */
export function countByCadence(): Record<ComiteCadence, number> {
  const counts: Record<ComiteCadence, number> = {
    mensuel: 0,
    bimestriel: 0,
    trimestriel: 0,
    semestriel: 0,
  };
  for (const c of GAIF_COMITES) counts[c.cadence]++;
  return counts;
}
