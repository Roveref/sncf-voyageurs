/**
 * Organisation cible A2P / GAIF à 3 ans.
 *
 * Source : slides 5, 6 et 7 Présentation A2P.
 */

export interface OrgaNode {
  key: string;
  label: string;
  role: string;
  /** Effectif actuel + mouvements prévus. */
  headcount: { current: number; target: number; note?: string };
  /** Branche dans l'arbre : direction → pôles → sous-équipes. */
  parent: string | null;
  color: string;
}

export const GAIF_ORGANISATION_CIBLE: OrgaNode[] = [
  {
    key: "a2p",
    label: "Direction A2P",
    role: "Directeur · BL DSP",
    headcount: { current: 1, target: 1, note: "Stéphane LEPRINCE (projet)" },
    parent: null,
    color: "#0F172A",
  },
  {
    key: "gaif",
    label: "Direction GAIF",
    role: "Gestion d'actifs installations fixes",
    headcount: { current: 3, target: 4 },
    parent: "a2p",
    color: "#EB0070",
  },
  {
    key: "moa_op",
    label: "Direction MOA Opérationnelle",
    role: "Plaques MOA IDF / Sud-Est / Nord-Est / Atlantique",
    headcount: { current: 0, target: 0, note: "Périmètre existant" },
    parent: "a2p",
    color: "#1E4E8C",
  },
  {
    key: "projets",
    label: "Pôle Projets",
    role: "EOLE · NExTEO · Agence Grand Villeneuve",
    headcount: { current: 0, target: 0, note: "Périmètre existant" },
    parent: "a2p",
    color: "#0EA5E9",
  },
  // Sous-pôles GAIF
  {
    key: "pole_emg",
    label: "Pôle Emergence (EMG)",
    role: "Prospection, cadrage, EP, RAO",
    headcount: { current: 5, target: 7, note: "+2 arrivants dont 1 remplacement S. REMOUE" },
    parent: "gaif",
    color: "#7C3AED",
  },
  {
    key: "pole_expat",
    label: "Pôle Excellence Patrimoine",
    role: "Stratégie cycle de vie, contrats prestataires, expertises",
    headcount: { current: 9, target: 11, note: "+2 arrivants (ferro + immo)" },
    parent: "gaif",
    color: "#10B981",
  },
  {
    key: "pmo_sectech",
    label: "Secrétariat Technique + PMO",
    role: "PMO, secrétariat, audit interne",
    headcount: { current: 2, target: 2, note: "Départ S. HASSOUN T3 2026" },
    parent: "gaif",
    color: "#F59E0B",
  },
  // Sous-groupes Excellence Patrimoine
  {
    key: "exp_foncier",
    label: "Expertise foncière & transferts",
    role: "CGI · désimbrication · transferts AO",
    headcount: { current: 1, target: 2 },
    parent: "pole_expat",
    color: "#14B8A6",
  },
  {
    key: "exp_immo",
    label: "Expertise immobilière",
    role: "GTB · BACS · CEPIA · E2MT",
    headcount: { current: 1, target: 2 },
    parent: "pole_expat",
    color: "#1E4E8C",
  },
  {
    key: "exp_ferro",
    label: "Expertise ferroviaire",
    role: "Voies · ADV · caténaires · postes",
    headcount: { current: 1, target: 2 },
    parent: "pole_expat",
    color: "#C8102E",
  },
  {
    key: "exp_io",
    label: "Expertise IO & outillages",
    role: "Maximo · GMAO · tours/vérins",
    headcount: { current: 2, target: 3 },
    parent: "pole_expat",
    color: "#00A3A1",
  },
  {
    key: "pilotage_transverse",
    label: "Pilotage transverse & gestion d'actifs",
    role: "ISO 55001 · PSGA · relation TM",
    headcount: { current: 3, target: 3 },
    parent: "pole_expat",
    color: "#6B7280",
  },
];

export function getHeadcountTotals(): { current: number; target: number; delta: number } {
  let current = 0;
  let target = 0;
  for (const n of GAIF_ORGANISATION_CIBLE) {
    // Ne comptabiliser que les nœuds GAIF (pas MOA/Projets qui sont périmètre existant)
    const isGaif =
      n.key === "gaif" ||
      n.parent === "gaif" ||
      GAIF_ORGANISATION_CIBLE.some((p) => p.key === n.parent && p.key?.startsWith("pole_"));
    if (!isGaif) continue;
    current += n.headcount.current;
    target += n.headcount.target;
  }
  return { current, target, delta: target - current };
}
