/**
 * Cartographie des parties prenantes GAIF.
 * Source : Note "Parties prenantes de la gestion d'actifs installations fixes" Transilien.
 */

export interface Stakeholder {
  key: string;
  label: string;
  type: "AOT" | "Client" | "Partenaire" | "Prestataire" | "Hierarchique" | "Interne";
  color: string;
  relation: "contractuelle" | "hierarchique" | "cooperation";
  frequency: "mensuel" | "bimestriel" | "trimestriel" | "ad hoc";
  comitologie: string;
}

export const GAIF_STAKEHOLDERS: Stakeholder[] = [
  {
    key: "idfm",
    label: "IDFM",
    type: "AOT",
    color: "#EB0070",
    relation: "contractuelle",
    frequency: "bimestriel",
    comitologie: "COTECH GAIF",
  },
  {
    key: "dg_tn",
    label: "DG TN",
    type: "Hierarchique",
    color: "#374151",
    relation: "hierarchique",
    frequency: "mensuel",
    comitologie: "COPIL Transilien",
  },
  {
    key: "bldsp",
    label: "BL DSP",
    type: "Hierarchique",
    color: "#1F2937",
    relation: "hierarchique",
    frequency: "mensuel",
    comitologie: "COMEX A2P",
  },
  {
    key: "dir_lignes",
    label: "Dir. lignes",
    type: "Interne",
    color: "#0EA5E9",
    relation: "cooperation",
    frequency: "mensuel",
    comitologie: "COPIL Lignes",
  },
  {
    key: "technicentres",
    label: "Technicentres",
    type: "Interne",
    color: "#06B6D4",
    relation: "cooperation",
    frequency: "mensuel",
    comitologie: "COPAT",
  },
  {
    key: "sncf_reseau",
    label: "SNCF Réseau",
    type: "Partenaire",
    color: "#10B981",
    relation: "contractuelle",
    frequency: "trimestriel",
    comitologie: "COPIL Interfaces SR",
  },
  {
    key: "sncf_immo",
    label: "SNCF Immobilier",
    type: "Partenaire",
    color: "#F59E0B",
    relation: "contractuelle",
    frequency: "bimestriel",
    comitologie: "COPIL Immo",
  },
  {
    key: "bu_ter",
    label: "BU TER",
    type: "Client",
    color: "#7C3AED",
    relation: "cooperation",
    frequency: "ad hoc",
    comitologie: "Interface BU",
  },
  {
    key: "bu_ic",
    label: "BU IC",
    type: "Client",
    color: "#A855F7",
    relation: "cooperation",
    frequency: "ad hoc",
    comitologie: "Interface BU",
  },
  {
    key: "prestataires",
    label: "Prestataires",
    type: "Prestataire",
    color: "#8B5CF6",
    relation: "contractuelle",
    frequency: "mensuel",
    comitologie: "COPAT contrat",
  },
  {
    key: "sg_tn_rse",
    label: "SG TN RSE",
    type: "Interne",
    color: "#84CC16",
    relation: "cooperation",
    frequency: "mensuel",
    comitologie: "COPIL RSE",
  },
  {
    key: "drao",
    label: "DRAO",
    type: "Interne",
    color: "#EF4444",
    relation: "cooperation",
    frequency: "ad hoc",
    comitologie: "Appui RAO",
  },
];

export interface StakeholderEdge {
  source: string;
  target: string;
  type: "contractuelle" | "hierarchique" | "cooperation";
  strength: number; // 1-5, épaisseur du trait
}

export const STAKEHOLDER_EDGES: StakeholderEdge[] = [
  { source: "gaif", target: "idfm", type: "contractuelle", strength: 5 },
  { source: "gaif", target: "dg_tn", type: "hierarchique", strength: 5 },
  { source: "gaif", target: "bldsp", type: "hierarchique", strength: 4 },
  { source: "gaif", target: "dir_lignes", type: "cooperation", strength: 4 },
  { source: "gaif", target: "technicentres", type: "cooperation", strength: 5 },
  { source: "gaif", target: "sncf_reseau", type: "contractuelle", strength: 3 },
  { source: "gaif", target: "sncf_immo", type: "contractuelle", strength: 5 },
  { source: "gaif", target: "bu_ter", type: "cooperation", strength: 4 },
  { source: "gaif", target: "bu_ic", type: "cooperation", strength: 3 },
  { source: "gaif", target: "prestataires", type: "contractuelle", strength: 4 },
  { source: "gaif", target: "sg_tn_rse", type: "cooperation", strength: 3 },
  { source: "gaif", target: "drao", type: "cooperation", strength: 3 },
];
