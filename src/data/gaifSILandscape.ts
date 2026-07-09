/**
 * Paysage SI externe — référentiels & GMAO par patrimoine GAIF.
 *
 * Source : PSGA chapitre 4.6 (Outils de gestion d'actifs) +
 *          Note d'inventaire du parc & outils (chapitres outils existants).
 */

export type SIStatus = "actif" | "en_deploiement" | "a_remplacer" | "a_creer";

export interface SIToolDef {
  key: string;
  name: string;
  purpose: string;
  patrimoines: string[];
  type: "Référentiel" | "GMAO" | "Gestion d'actifs" | "Gestion fluides" | "Gestion foncière" | "Autre";
  operateur: string;
  status: SIStatus;
  note?: string;
}

export const GAIF_SI_LANDSCAPE: SIToolDef[] = [
  // Ferroviaire
  {
    key: "GAIA",
    name: "GAIA",
    purpose: "Référencement objets ferroviaires",
    patrimoines: ["Ferroviaire"],
    type: "Référentiel",
    operateur: "SNCF Réseau",
    status: "actif",
    note: "Tenue à jour incertaine pour Transilien",
  },
  {
    key: "ARMEN",
    name: "ARMEN",
    purpose: "Référencement complémentaire objets ferroviaires",
    patrimoines: ["Ferroviaire"],
    type: "Référentiel",
    operateur: "SNCF Réseau",
    status: "actif",
  },
  {
    key: "SPOT",
    name: "SPOT",
    purpose: "GMAO ferroviaire SNCF Réseau",
    patrimoines: ["Ferroviaire"],
    type: "GMAO",
    operateur: "SNCF Réseau",
    status: "a_remplacer",
    note: "Utilisation résiduelle pour actifs Transilien",
  },
  // Immobilier
  {
    key: "IMMOSIS",
    name: "IMMOSIS",
    purpose: "Inventaire immobilier GPU (biens, baux, technique)",
    patrimoines: ["Immobilier", "Foncier"],
    type: "Référentiel",
    operateur: "SNCF Immobilier",
    status: "actif",
    note: "Hébergeur de CONSO (fluides), lié GMAO IGO",
  },
  {
    key: "CARNET_SANTE",
    name: "Carnet de Santé",
    purpose: "Expression besoins CAPEX + évaluation état parc",
    patrimoines: ["Immobilier"],
    type: "Gestion d'actifs",
    operateur: "SNCF Immobilier",
    status: "actif",
  },
  {
    key: "IGO",
    name: "IGO",
    purpose: "GMAO immobilier pour travaux OPEX (contrat E2MT)",
    patrimoines: ["Immobilier"],
    type: "GMAO",
    operateur: "SNCF Immobilier / E2MT",
    status: "actif",
  },
  {
    key: "CONSO",
    name: "CONSO",
    purpose: "Gestion contrats fluides (eau, élec, gaz)",
    patrimoines: ["Immobilier"],
    type: "Gestion fluides",
    operateur: "SNCF Immobilier",
    status: "actif",
  },
  // IO
  {
    key: "MAXIMO_V8",
    name: "Maximo v8",
    purpose: "GMAO IO (legacy) — en cours de migration",
    patrimoines: ["IO"],
    type: "GMAO",
    operateur: "Transilien / SNCF V",
    status: "a_remplacer",
    note: "À migrer vers v9 d'ici fin 2026",
  },
  {
    key: "MAXIMO_V9",
    name: "Maximo v9",
    purpose: "GMAO IO (cible) — pilote Noisy, déploiement national",
    patrimoines: ["IO"],
    type: "GMAO",
    operateur: "Transilien / SNCF V (IBM Maximo)",
    status: "en_deploiement",
    note: "Déploiement national 2026",
  },
  {
    key: "DECA",
    name: "DECA",
    purpose: "Suivi des Équipements de Surveillance et de Mesure (ESM)",
    patrimoines: ["IO"],
    type: "Autre",
    operateur: "Services métrologie",
    status: "actif",
  },
  // Foncier
  {
    key: "GEOPRISM",
    name: "GEOPRISM",
    purpose: "Gestion foncière et cartographique",
    patrimoines: ["Foncier"],
    type: "Gestion foncière",
    operateur: "SNCF Immobilier",
    status: "actif",
  },
  // Courants forts
  {
    key: "ENERGIS",
    name: "ENERGIS",
    purpose: "Référencement courants forts",
    patrimoines: ["Courants Faibles"],
    type: "Référentiel",
    operateur: "SNCF",
    status: "actif",
  },
  // Cible
  {
    key: "GAIF_PILOT",
    name: "GAIF Pilot",
    purpose: "Plateforme de pilotage global GA actifs installations fixes",
    patrimoines: [
      "Ferroviaire",
      "Immobilier",
      "IO",
      "Courants Faibles",
      "Propriete Intellectuelle",
      "Gares Lignes",
      "Foncier",
    ],
    type: "Gestion d'actifs",
    operateur: "Transilien / GAIF",
    status: "en_deploiement",
    note: "Dashboard unifié au-dessus des GMAO et référentiels existants",
  },
];

export const SI_STATUS_COLOR: Record<SIStatus, string> = {
  actif: "#10B981",
  en_deploiement: "#F59E0B",
  a_remplacer: "#EF4444",
  a_creer: "#94A3B8",
};

export const SI_STATUS_LABEL: Record<SIStatus, string> = {
  actif: "Actif",
  en_deploiement: "En déploiement",
  a_remplacer: "À remplacer",
  a_creer: "À créer",
};
