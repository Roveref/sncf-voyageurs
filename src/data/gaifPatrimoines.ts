/**
 * Référentiel des 7 patrimoines d'installations fixes GAIF.
 * Source : PSGA (Plan Stratégique de Gestion d'Actifs) Transilien + slide 9 Présentation A2P.
 */

export interface Patrimoine {
  key: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  volumeLabel: string;
  primaryKpi: string;
}

export const GAIF_PATRIMOINES: Patrimoine[] = [
  {
    key: "Ferroviaire",
    label: "Ferroviaire",
    color: "#C8102E",
    icon: "Train",
    description: "Voies, appareils de voie, signalisation, caténaires, postes d'aiguillage",
    volumeLabel: "573 ADV · 130 km de voies",
    primaryKpi: "Disponibilité résiduelle",
  },
  {
    key: "Immobilier",
    label: "Immobilier",
    color: "#1E4E8C",
    icon: "HomeWork",
    description: "Bâtiments, CVC, monte-charges, portes ferroviaires, charpente/couverture",
    volumeLabel: "435 bâtiments · 251 k m²",
    primaryKpi: "Conformité réglementaire",
  },
  {
    key: "IO",
    label: "Installations & Outillages",
    color: "#00A3A1",
    icon: "Build",
    description: "Tours en fosse, vérins, bancs essieux, ponts roulants, production air",
    volumeLabel: "3 057 équipements",
    primaryKpi: "MTBF / MTTR",
  },
  {
    key: "Courants Faibles",
    label: "Courants faibles",
    color: "#F59E0B",
    icon: "Cable",
    description: "SSI, détection incendie, contrôle d'accès, télécom et réseau",
    volumeLabel: "3 catégories couvertes",
    primaryKpi: "Conformité sécurité",
  },
  {
    key: "Propriete Intellectuelle",
    label: "Propriété intellectuelle",
    color: "#7C3AED",
    icon: "MenuBook",
    description: "Logiciels métier, licences, brevets, référentiels techniques",
    volumeLabel: "15 actifs immatériels",
    primaryKpi: "Couverture contractuelle",
  },
  {
    key: "Gares Lignes",
    label: "Gares & lignes",
    color: "#0EA5E9",
    icon: "Storefront",
    description: "Escabelles, estacades, éclairage voies et équipements fixes",
    volumeLabel: "35 équipements en ligne",
    primaryKpi: "État général",
  },
  {
    key: "Foncier",
    label: "Foncier",
    color: "#14B8A6",
    icon: "Terrain",
    description: "Dossiers fonciers : acquisitions, cessions, désimbrications, transferts AO",
    volumeLabel: "423 terrains · 3,9 M m²",
    primaryKpi: "Avancement dossiers",
  },
];

/**
 * Seuils PSGA (Prescription Performance 2024-10-01) pour les 3 indicateurs de gestion d'actifs,
 * différenciés par niveau de criticité.
 *
 * Source : Prescription_Performance.docx — tableaux « Performance cible » par indicateur.
 */
export interface PsgaThreshold {
  optimal: number; // upper bound du niveau optimal (%, pour taux résiduel et non-conformité)
  acceptable: number; // upper bound du niveau acceptable
  // Au-delà de acceptable → faible (rouge)
}

export const PSGA_THRESHOLDS = {
  disponibiliteResiduelle: {
    // Taux résiduel = 1 - (disponibilité × utilisation) → plus bas = meilleur
    critique: { optimal: 15, acceptable: 30 } as PsgaThreshold,
    autre: { optimal: 40, acceptable: 70 } as PsgaThreshold,
  },
  nonConformite: {
    // Nb actifs non conformes / total → plus bas = meilleur
    critique: { optimal: 1, acceptable: 5 } as PsgaThreshold,
    autre: { optimal: 5, acceptable: 8 } as PsgaThreshold,
  },
  coutGaEvolution: {
    // Évolution sur 5 ans → plus bas = meilleur (diminution)
    critique: { optimal: -5, acceptable: 0 } as PsgaThreshold,
    autre: { optimal: -5, acceptable: 0 } as PsgaThreshold,
  },
} as const;

export type CriticityLevel = "critique" | "moderee" | "non_critique";

/** Retourne la teinte associée au niveau de performance PSGA. */
export function psgaZoneColor(level: "optimal" | "acceptable" | "faible"): string {
  switch (level) {
    case "optimal":
      return "#10B981";
    case "acceptable":
      return "#F59E0B";
    case "faible":
      return "#EF4444";
  }
}

/** Évalue un taux résiduel face aux seuils PSGA. */
export function evalResiduelLevel(valuePct: number, critique: boolean): "optimal" | "acceptable" | "faible" {
  const t = critique ? PSGA_THRESHOLDS.disponibiliteResiduelle.critique : PSGA_THRESHOLDS.disponibiliteResiduelle.autre;
  if (valuePct <= t.optimal) return "optimal";
  if (valuePct <= t.acceptable) return "acceptable";
  return "faible";
}

/** Évalue un taux de non-conformité face aux seuils PSGA. */
export function evalNonConfLevel(valuePct: number, critique: boolean): "optimal" | "acceptable" | "faible" {
  const t = critique ? PSGA_THRESHOLDS.nonConformite.critique : PSGA_THRESHOLDS.nonConformite.autre;
  if (valuePct <= t.optimal) return "optimal";
  if (valuePct <= t.acceptable) return "acceptable";
  return "faible";
}
