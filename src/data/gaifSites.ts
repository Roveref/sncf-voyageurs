/**
 * Catalogue géographique des sites opérationnels GAIF SNCF Voyageurs.
 *
 * Regroupe les 18 sites physiques (11 Transilien IDF + 5 TER + 2 Intercités)
 * avec leurs coordonnées réelles, leur typologie (TM / SMR / SMGL),
 * leur rattachement BU et leur responsable GAIF (empId).
 *
 * Utilisé par :
 *  - GaifSitesMap (landing page + widgets) pour la visualisation France
 *  - Facade hooks pour enrichir les données d'actifs avec la localisation
 */

export type BUKey = "TN" | "TER" | "IC";
export type SiteTypologie = "Technicentre" | "SMR" | "SMGL";

export interface GaifSiteGeo {
  /** Identifiant SNCF (miroir de sites.accountId). */
  accountId: string;
  /** Libellé court utilisé dans l'UI. */
  name: string;
  /** Nom complet. */
  fullName: string;
  /** Coordonnées WGS84 (latitude, longitude). */
  coords: [number, number];
  /** Typologie du site. */
  typologie: SiteTypologie;
  /** Business Unit de rattachement. */
  bu: BUKey;
  /** Ville/département pour tooltip. */
  city: string;
  /** Responsable GAIF (empId). */
  leaderId: string;
}

export const GAIF_SITES_GEO: GaifSiteGeo[] = [
  // ── BU TN (Transilien) — 11 sites IDF ──
  {
    accountId: "SITE-TM-VSG",
    name: "TM VSG",
    fullName: "TM Villeneuve Saint-Georges",
    coords: [48.7303, 2.4489],
    typologie: "Technicentre",
    bu: "TN",
    city: "Villeneuve-Saint-Georges (94)",
    leaderId: "GAIF003",
  },
  {
    accountId: "SITE-SMR-NSY",
    name: "SMR Noisy",
    fullName: "SMR Noisy-le-Sec",
    coords: [48.8969, 2.4517],
    typologie: "SMR",
    bu: "TN",
    city: "Noisy-le-Sec (93)",
    leaderId: "GAIF010",
  },
  {
    accountId: "SITE-TPSL-VND",
    name: "TPSL VND",
    fullName: "TPSL Val Notre-Dame",
    coords: [48.9655, 2.1378],
    typologie: "Technicentre",
    bu: "TN",
    city: "Argenteuil (95)",
    leaderId: "GAIF008",
  },
  {
    accountId: "SITE-TPN-JON",
    name: "TPN JON",
    fullName: "TPN Joncherolles",
    coords: [48.9495, 2.3568],
    typologie: "Technicentre",
    bu: "TN",
    city: "Villetaneuse (93)",
    leaderId: "GAIF006",
  },
  {
    accountId: "SITE-TTM-TRP",
    name: "TTM Trappes",
    fullName: "TTM Trappes",
    coords: [48.7747, 2.0105],
    typologie: "Technicentre",
    bu: "TN",
    city: "Trappes (78)",
    leaderId: "GAIF008",
  },
  {
    accountId: "SITE-SMGL-BCY",
    name: "SMGL Bercy",
    fullName: "SMGL Bercy (Paris 12)",
    coords: [48.8394, 2.383],
    typologie: "SMGL",
    bu: "TN",
    city: "Paris 12e (75)",
    leaderId: "GAIF006",
  },
  {
    accountId: "SITE-TNC-LAD",
    name: "TNC LAD",
    fullName: "TNC Les Ardoines",
    coords: [48.7791, 2.3921],
    typologie: "Technicentre",
    bu: "TN",
    city: "Vitry-sur-Seine (94)",
    leaderId: "GAIF006",
  },
  {
    accountId: "SITE-TPSL-ACH",
    name: "TPSL ACH",
    fullName: "TPSL Achères",
    coords: [48.9764, 2.0729],
    typologie: "Technicentre",
    bu: "TN",
    city: "Achères (78)",
    leaderId: "GAIF008",
  },
  {
    accountId: "SITE-SMGL-VRS",
    name: "SMGL Vaires",
    fullName: "SMGL Vaires-Torcy",
    coords: [48.8748, 2.6404],
    typologie: "SMGL",
    bu: "TN",
    city: "Vaires-sur-Marne (77)",
    leaderId: "GAIF010",
  },
  {
    accountId: "SITE-SMR-MSY",
    name: "SMR Massy",
    fullName: "SMR Massy",
    coords: [48.7325, 2.2796],
    typologie: "SMR",
    bu: "TN",
    city: "Massy (91)",
    leaderId: "GAIF008",
  },
  {
    accountId: "SITE-SMR-VRM",
    name: "SMR Versailles",
    fullName: "SMR Versailles-Matelots",
    coords: [48.8024, 2.1196],
    typologie: "SMR",
    bu: "TN",
    city: "Versailles (78)",
    leaderId: "GAIF010",
  },

  // ── BU TER — 5 sites nationaux ──
  {
    accountId: "SITE-TER-LYN",
    name: "TER Lyon",
    fullName: "Technicentre TER Lyon-Vaise",
    coords: [45.7774, 4.8075],
    typologie: "Technicentre",
    bu: "TER",
    city: "Lyon-Vaise (69)",
    leaderId: "GAIF014",
  },
  {
    accountId: "SITE-TER-TLS",
    name: "TER Toulouse",
    fullName: "Technicentre TER Toulouse Matabiau",
    coords: [43.6119, 1.4547],
    typologie: "Technicentre",
    bu: "TER",
    city: "Toulouse (31)",
    leaderId: "GAIF014",
  },
  {
    accountId: "SITE-TER-BDX",
    name: "TER Bordeaux",
    fullName: "Technicentre TER Bordeaux",
    coords: [44.8253, -0.5556],
    typologie: "Technicentre",
    bu: "TER",
    city: "Bordeaux (33)",
    leaderId: "GAIF015",
  },
  {
    accountId: "SITE-TER-MRS",
    name: "TER Blancarde",
    fullName: "Technicentre TER Marseille Blancarde",
    coords: [43.2975, 5.4104],
    typologie: "Technicentre",
    bu: "TER",
    city: "Marseille (13)",
    leaderId: "GAIF012",
  },
  {
    accountId: "SITE-TER-DJN",
    name: "TER Dijon",
    fullName: "Technicentre TER Dijon-Perrigny",
    coords: [47.3106, 5.0185],
    typologie: "Technicentre",
    bu: "TER",
    city: "Dijon-Perrigny (21)",
    leaderId: "GAIF014",
  },

  // ── BU IC (Intercités) — 2 sites ──
  {
    accountId: "SITE-IC-PLY",
    name: "IC Paris-Lyon",
    fullName: "Technicentre IC Paris-Lyon",
    coords: [48.8443, 2.3734],
    typologie: "Technicentre",
    bu: "IC",
    city: "Paris 12e (75)",
    leaderId: "GAIF013",
  },
  {
    accountId: "SITE-IC-CLF",
    name: "IC Clermont",
    fullName: "Technicentre IC Clermont-Ferrand",
    coords: [45.7782, 3.0894],
    typologie: "Technicentre",
    bu: "IC",
    city: "Clermont-Ferrand (63)",
    leaderId: "GAIF013",
  },
];

export const BU_LABEL: Record<BUKey, string> = {
  TN: "Transilien (IDF)",
  TER: "TER (national)",
  IC: "Intercités",
};

export const BU_COLOR: Record<BUKey, string> = {
  TN: "#EB0070",
  TER: "#0EA5E9",
  IC: "#7C3AED",
};

export const TYPOLOGIE_LABEL: Record<SiteTypologie, string> = {
  Technicentre: "Technicentre",
  SMR: "Service Maint. & Remisage",
  SMGL: "Service Maint. Garages en Ligne",
};

/** Taille du marker selon la typologie (Technicentre > SMR > SMGL). */
export const TYPOLOGIE_RADIUS: Record<SiteTypologie, number> = {
  Technicentre: 7,
  SMR: 5.5,
  SMGL: 4.5,
};
