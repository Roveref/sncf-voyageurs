/**
 * Grille d'auto-évaluation de maturité ISO 55001 — GAIF Transilien.
 *
 * Source : Note d'Audit Interne Transilien (chapitres de la norme).
 * Les niveaux de maturité suivent l'échelle usuelle :
 *   0 = Absent
 *   1 = Initié / ponctuel
 *   2 = Défini / documenté
 *   3 = Maîtrisé / mesuré
 *   4 = Optimisé / amélioré
 */

export interface IsoChapter {
  id: string;
  clause: string;
  label: string;
  description: string;
  /** Maturité actuelle (0-4). */
  maturity: number;
  /** Cible 2026 (0-4). */
  target: number;
  /** Jalon associé dans la feuille de route. */
  roadmap?: string;
}

export const GAIF_ISO55001_GRID: IsoChapter[] = [
  {
    id: "4-1",
    clause: "4.1",
    label: "Contexte de l'organisme — enjeux",
    description: "Compréhension de l'environnement externe et interne.",
    maturity: 3,
    target: 4,
    roadmap: "Mise à jour PSGA v2",
  },
  {
    id: "4-2",
    clause: "4.2",
    label: "Compréhension des besoins des parties prenantes",
    description: "Cartographie IDFM / BU / prestataires.",
    maturity: 3,
    target: 4,
  },
  {
    id: "4-3",
    clause: "4.3",
    label: "Périmètre du SGA",
    description: "Délimitation du système de gestion d'actifs.",
    maturity: 2,
    target: 3,
    roadmap: "Périmètre étendu TN+TER+IC",
  },
  {
    id: "5-1",
    clause: "5.1",
    label: "Leadership & engagement",
    description: "Politique GA signée + engagement direction.",
    maturity: 3,
    target: 4,
  },
  {
    id: "5-2",
    clause: "5.2",
    label: "Politique",
    description: "Politique de Gestion d'Actifs Installations Fixes v2.",
    maturity: 3,
    target: 4,
  },
  {
    id: "5-3",
    clause: "5.3",
    label: "Rôles, responsabilités & autorités",
    description: "RACI formalisé pour tous les processus PSGA.",
    maturity: 2,
    target: 4,
    roadmap: "RACI dynamique dashboard",
  },
  {
    id: "6-1",
    clause: "6.1",
    label: "Actions pour risques & opportunités",
    description: "Registre des risques SGA.",
    maturity: 1,
    target: 3,
    roadmap: "Registre dashboard 2026",
  },
  {
    id: "6-2",
    clause: "6.2",
    label: "Objectifs GA & plans (PSGA)",
    description: "PSGA publié avec objectifs mesurables.",
    maturity: 3,
    target: 4,
  },
  {
    id: "7-1",
    clause: "7.1",
    label: "Ressources",
    description: "Adéquation ressources / compétences équipe GAIF.",
    maturity: 2,
    target: 4,
    roadmap: "+4 arrivants 2026",
  },
  {
    id: "7-2",
    clause: "7.2",
    label: "Compétences",
    description: "Cartographie talents (F. Montereau).",
    maturity: 2,
    target: 3,
  },
  {
    id: "7-3",
    clause: "7.3",
    label: "Sensibilisation",
    description: "Communication doctrine GA vers BU/TM.",
    maturity: 2,
    target: 3,
  },
  {
    id: "7-4",
    clause: "7.4",
    label: "Communication",
    description: "COPIL Réseau, Immo, RSE + COTECH IDFM.",
    maturity: 3,
    target: 4,
  },
  {
    id: "7-5",
    clause: "7.5",
    label: "Informations documentées",
    description: "Référentiel processus + prescriptions.",
    maturity: 2,
    target: 4,
    roadmap: "Design book étendu",
  },
  {
    id: "7-6",
    clause: "7.6",
    label: "Données & informations",
    description: "Qualité bases IMMOSIS, Maximo, GAIA/ARMEN.",
    maturity: 1,
    target: 3,
    roadmap: "Maximo v9 + mise en qualité Immo",
  },
  {
    id: "8-1",
    clause: "8.1",
    label: "Planification & maîtrise opérationnelle",
    description: "Cycle de vie piloté par prescriptions.",
    maturity: 2,
    target: 3,
  },
  {
    id: "8-2",
    clause: "8.2",
    label: "Contrôle du changement",
    description: "Processus mise à jour actifs.",
    maturity: 1,
    target: 3,
  },
  {
    id: "8-3",
    clause: "8.3",
    label: "Processus, produits & prestataires",
    description: "Pilotage contrats TSO, SFERIS, E2MT, SPIE.",
    maturity: 3,
    target: 4,
  },
  {
    id: "9-1",
    clause: "9.1",
    label: "Surveillance, mesure, analyse",
    description: "KPIs PSGA (disponibilité, conformité, coût).",
    maturity: 2,
    target: 4,
    roadmap: "Déploiement dashboard GAIF Pilot",
  },
  {
    id: "9-2",
    clause: "9.2",
    label: "Audit interne",
    description: "Programme audit annuel.",
    maturity: 1,
    target: 3,
    roadmap: "Pré-audit SVCO 2026",
  },
  {
    id: "9-3",
    clause: "9.3",
    label: "Revue de direction",
    description: "Comitologie formalisée.",
    maturity: 2,
    target: 3,
  },
  {
    id: "10-1",
    clause: "10.1",
    label: "Amélioration continue",
    description: "Cycle amélioration PSGA annuel.",
    maturity: 2,
    target: 3,
  },
  {
    id: "10-2",
    clause: "10.2",
    label: "Non-conformité & actions correctives",
    description: "Suivi NC par processus et par actif.",
    maturity: 2,
    target: 4,
    roadmap: "Registre NC dashboard",
  },
  {
    id: "10-3",
    clause: "10.3",
    label: "Actions prédictives",
    description: "Pilotage anticipé MTBF/MTTR + obsolescence.",
    maturity: 1,
    target: 3,
  },
];

export function getMaturityAverage(): { current: number; target: number; gap: number } {
  const totalC = GAIF_ISO55001_GRID.reduce((acc, c) => acc + c.maturity, 0);
  const totalT = GAIF_ISO55001_GRID.reduce((acc, c) => acc + c.target, 0);
  const n = GAIF_ISO55001_GRID.length;
  return {
    current: parseFloat((totalC / n).toFixed(2)),
    target: parseFloat((totalT / n).toFixed(2)),
    gap: parseFloat(((totalT - totalC) / n).toFixed(2)),
  };
}

export const MATURITY_LABELS = ["Absent", "Initié", "Défini", "Maîtrisé", "Optimisé"];
export const MATURITY_COLORS = ["#EF4444", "#F59E0B", "#EAB308", "#10B981", "#0EA5E9"];
