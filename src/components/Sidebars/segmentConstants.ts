/**
 * Groupe de patrimoines GAIF — sidebar gauche (macro-catégorie).
 * Un seul groupe qui regroupe les 6 patrimoines, affichés comme chips expandables
 * vers leurs familles (niveau -1). La hiérarchie est construite par buildSegmentMap
 * qui lit subSegmentCode → subSegment.
 */

import { brand } from "../../config/brandConfig";

// Aucun wrapper "Patrimoines" : les 6 patrimoines doivent apparaître directement
// comme des chips individuelles de niveau N (top level), chacune expandable vers
// ses familles (niveau N-1). On garde AMD défini mais vide pour ne pas casser les
// composants qui y font référence (AmdGroupSection / LeftSidebar).
export const SEGMENT_CODE_GROUPS = {
  AMD: {
    name: "AMD",
    color: brand.primary,
    include: [] as string[],
  },
};

export const SEGMENT_CODE_COLORS: Record<string, string> = {
  Ferroviaire: "#C8102E",
  Immobilier: "#1E4E8C",
  IO: "#00A3A1",
  "Courants Faibles": "#F59E0B",
  "Propriete Intellectuelle": "#7C3AED",
  "Gares Lignes": "#0EA5E9",
};

export const getSegmentColor = (code: string): string => {
  return SEGMENT_CODE_COLORS[code] || brand.secondaryLightest;
};
