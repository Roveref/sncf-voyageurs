/**
 * Générateur de données GAIF Pilot — démo SNCF Voyageurs.
 *
 * Remplit les tables existantes (aucune modification de schéma) avec un mapping
 * sémantique GAIF :
 *  - employees          → équipe GAIF anonymisée (16 personnes)
 *  - sites       → sites & technicentres (15)
 *  - assets  → actifs du parc (~300 répartis sur 6 patrimoines)
 *  - mds_assignments    → affectations équipe sur actifs/projets/contrats (~80)
 *  - hr_skills          → compétences GAIF (~60)
 *  - nonconformities      → non-conformités (~40)
 *  - user_staffing_needs→ besoins en compétences non couverts (~8)
 *  - user_actions       → actions associées à des initiatives d'industrialisation
 */

import db from "../db/database.js";
import { log } from "../utils/logger.js";

// Uses the proxy db — setDemoMode() controls whether this writes to real or demo DB.

// ── Helpers ──

const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number, decimals = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const uuid = (prefix = "gaif") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function randomDate(start: string, end: string): string {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return new Date(s + Math.random() * (e - s)).toISOString().slice(0, 10);
}

const TODAY = new Date().toISOString().slice(0, 10);

// ── Équipe GAIF (16 collaborateurs anonymisés) ──

interface GaifEmployee {
  empId: string;
  name: string;
  grade: string; // niveau hiérarchique GAIF
  subTeam: string; // pôle
  serviceLine: string; // patrimoine dominant
  managerId: string | null;
  arrival: string;
  departure: string | null;
}

// Grades mappés sur les valeurs BP canoniques (attendues par shared/staffingConstants.ts) :
//   Director = Directeur GAIF
//   Senior Manager = Responsable pôle
//   Manager = Adj. pôle / Secrétaire Tech / PMO
//   Senior Consultant = Expert senior / Chargé mission senior
//   Consultant = Chargé mission
const GAIF_EMPLOYEES: GaifEmployee[] = [
  {
    empId: "GAIF001",
    name: "Thomas BERNARD",
    grade: "Director",
    subTeam: "Direction",
    serviceLine: "Transverse",
    managerId: null,
    arrival: "2024-01-15",
    departure: null,
  },
  {
    empId: "GAIF002",
    name: "Marie LEFEBVRE",
    grade: "Manager",
    subTeam: "Direction",
    serviceLine: "Transverse",
    managerId: "GAIF001",
    arrival: "2024-02-01",
    departure: null,
  },
  {
    empId: "GAIF003",
    name: "Julien MOREAU",
    grade: "Senior Manager",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Transverse",
    managerId: "GAIF001",
    arrival: "2024-01-15",
    departure: null,
  },
  {
    empId: "GAIF004",
    name: "Sophie DUBOIS",
    grade: "Manager",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Transverse",
    managerId: "GAIF003",
    arrival: "2024-04-08",
    departure: null,
  },
  {
    empId: "GAIF005",
    name: "Nicolas PETIT",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Transverse",
    managerId: "GAIF003",
    arrival: "2024-03-11",
    departure: null,
  },
  {
    empId: "GAIF006",
    name: "Émilie BLANC",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Ferroviaire",
    managerId: "GAIF003",
    arrival: "2024-05-20",
    departure: null,
  },
  {
    empId: "GAIF007",
    name: "Thierry LAURENT",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Ferroviaire",
    managerId: "GAIF006",
    arrival: "2024-09-02",
    departure: null,
  },
  {
    empId: "GAIF008",
    name: "Laurent MERCIER",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Immobilier",
    managerId: "GAIF003",
    arrival: "2024-02-26",
    departure: null,
  },
  {
    empId: "GAIF009",
    name: "Céline ROUSSEAU",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Foncier",
    managerId: "GAIF003",
    arrival: "2024-06-17",
    departure: null,
  },
  {
    empId: "GAIF010",
    name: "Isabelle GIRARD",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "IO",
    managerId: "GAIF003",
    arrival: "2024-03-04",
    departure: null,
  },
  {
    empId: "GAIF011",
    name: "Antoine FAURE",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "IO",
    managerId: "GAIF010",
    arrival: "2024-10-14",
    departure: null,
  },
  {
    empId: "GAIF012",
    name: "Caroline MARTIN",
    grade: "Senior Manager",
    subTeam: "Emergence",
    serviceLine: "Transverse",
    managerId: "GAIF001",
    arrival: "2024-01-22",
    departure: null,
  },
  {
    empId: "GAIF013",
    name: "Philippe ROUX",
    grade: "Manager",
    subTeam: "Emergence",
    serviceLine: "Transverse",
    managerId: "GAIF012",
    arrival: "2024-04-15",
    departure: null,
  },
  {
    empId: "GAIF014",
    name: "Aurélie SIMON",
    grade: "Senior Consultant",
    subTeam: "Emergence",
    serviceLine: "Ferroviaire",
    managerId: "GAIF012",
    arrival: "2024-07-01",
    departure: null,
  },
  {
    empId: "GAIF015",
    name: "Maxime RENARD",
    grade: "Consultant",
    subTeam: "Emergence",
    serviceLine: "Immobilier",
    managerId: "GAIF012",
    arrival: "2025-01-13",
    departure: null,
  },
  {
    empId: "GAIF016",
    name: "Vincent MOREL",
    grade: "Manager",
    subTeam: "PMO",
    serviceLine: "Transverse",
    managerId: "GAIF001",
    arrival: "2024-09-09",
    departure: "2026-09-30",
  },
  // ── Renfort équipe GAIF (pilote v2, ~30 ETP supplémentaires) ──
  {
    empId: "GAIF017",
    name: "Hélène DURAND",
    grade: "Senior Manager",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Courants Faibles",
    managerId: "GAIF001",
    arrival: "2024-02-05",
    departure: null,
  },
  {
    empId: "GAIF018",
    name: "Franck LEROY",
    grade: "Manager",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Courants Faibles",
    managerId: "GAIF017",
    arrival: "2024-03-18",
    departure: null,
  },
  {
    empId: "GAIF019",
    name: "Marion BERTIN",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Courants Faibles",
    managerId: "GAIF017",
    arrival: "2024-04-02",
    departure: null,
  },
  {
    empId: "GAIF020",
    name: "Olivier CHEVALIER",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Courants Faibles",
    managerId: "GAIF019",
    arrival: "2024-06-10",
    departure: null,
  },
  {
    empId: "GAIF021",
    name: "Léa MARCHAND",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Immobilier",
    managerId: "GAIF003",
    arrival: "2024-04-22",
    departure: null,
  },
  {
    empId: "GAIF022",
    name: "Pierre GAUTHIER",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Immobilier",
    managerId: "GAIF008",
    arrival: "2024-09-23",
    departure: null,
  },
  {
    empId: "GAIF023",
    name: "Sarah COHEN",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Immobilier",
    managerId: "GAIF008",
    arrival: "2024-11-04",
    departure: null,
  },
  {
    empId: "GAIF024",
    name: "Bruno NGUYEN",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Ferroviaire",
    managerId: "GAIF003",
    arrival: "2024-03-12",
    departure: null,
  },
  {
    empId: "GAIF025",
    name: "Marc PERRIN",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Ferroviaire",
    managerId: "GAIF024",
    arrival: "2024-10-07",
    departure: null,
  },
  {
    empId: "GAIF026",
    name: "Chloé FONTAINE",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Ferroviaire",
    managerId: "GAIF006",
    arrival: "2024-11-18",
    departure: null,
  },
  {
    empId: "GAIF027",
    name: "Samir BENOIT",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "IO",
    managerId: "GAIF003",
    arrival: "2024-05-06",
    departure: null,
  },
  {
    empId: "GAIF028",
    name: "Nadia ARNAUD",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "IO",
    managerId: "GAIF010",
    arrival: "2025-02-03",
    departure: null,
  },
  {
    empId: "GAIF029",
    name: "David ROBERT",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Foncier",
    managerId: "GAIF003",
    arrival: "2024-07-29",
    departure: null,
  },
  {
    empId: "GAIF030",
    name: "Amélie PICARD",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Foncier",
    managerId: "GAIF009",
    arrival: "2024-10-21",
    departure: null,
  },
  {
    empId: "GAIF031",
    name: "Jérôme GARNIER",
    grade: "Manager",
    subTeam: "Emergence",
    serviceLine: "Ferroviaire",
    managerId: "GAIF012",
    arrival: "2024-03-25",
    departure: null,
  },
  {
    empId: "GAIF032",
    name: "Valérie NOEL",
    grade: "Senior Consultant",
    subTeam: "Emergence",
    serviceLine: "Immobilier",
    managerId: "GAIF012",
    arrival: "2024-06-03",
    departure: null,
  },
  {
    empId: "GAIF033",
    name: "Romain DENIS",
    grade: "Senior Consultant",
    subTeam: "Emergence",
    serviceLine: "IO",
    managerId: "GAIF012",
    arrival: "2024-08-19",
    departure: null,
  },
  {
    empId: "GAIF034",
    name: "Clémence FABRE",
    grade: "Consultant",
    subTeam: "Emergence",
    serviceLine: "Ferroviaire",
    managerId: "GAIF014",
    arrival: "2024-11-25",
    departure: null,
  },
  {
    empId: "GAIF035",
    name: "Guillaume MAILLARD",
    grade: "Consultant",
    subTeam: "Emergence",
    serviceLine: "IO",
    managerId: "GAIF033",
    arrival: "2025-01-20",
    departure: null,
  },
  {
    empId: "GAIF036",
    name: "Estelle LEGRAND",
    grade: "Manager",
    subTeam: "PMO",
    serviceLine: "Transverse",
    managerId: "GAIF001",
    arrival: "2024-05-13",
    departure: null,
  },
  {
    empId: "GAIF037",
    name: "Antoine BERGER",
    grade: "Senior Consultant",
    subTeam: "PMO",
    serviceLine: "Transverse",
    managerId: "GAIF036",
    arrival: "2024-08-26",
    departure: null,
  },
  {
    empId: "GAIF038",
    name: "Sophie LACOMBE",
    grade: "Consultant",
    subTeam: "PMO",
    serviceLine: "Transverse",
    managerId: "GAIF036",
    arrival: "2025-03-17",
    departure: null,
  },
  {
    empId: "GAIF039",
    name: "Mickaël SCHMITT",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Propriete Intellectuelle",
    managerId: "GAIF003",
    arrival: "2024-04-15",
    departure: null,
  },
  {
    empId: "GAIF040",
    name: "Julie TEIXEIRA",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Propriete Intellectuelle",
    managerId: "GAIF039",
    arrival: "2024-12-02",
    departure: null,
  },
  {
    empId: "GAIF041",
    name: "Frédéric POIRIER",
    grade: "Senior Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Gares & Lignes",
    managerId: "GAIF003",
    arrival: "2024-06-24",
    departure: null,
  },
  {
    empId: "GAIF042",
    name: "Manon CARPENTIER",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Gares & Lignes",
    managerId: "GAIF041",
    arrival: "2024-09-16",
    departure: null,
  },
  {
    empId: "GAIF043",
    name: "Stéphane CHARPENTIER",
    grade: "Manager",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Ferroviaire",
    managerId: "GAIF003",
    arrival: "2024-07-08",
    departure: null,
  },
  {
    empId: "GAIF044",
    name: "Camille ADAM",
    grade: "Consultant",
    subTeam: "Excellence Patrimoine",
    serviceLine: "Ferroviaire",
    managerId: "GAIF043",
    arrival: "2025-02-24",
    departure: null,
  },
  {
    empId: "GAIF045",
    name: "Benoît BOUCHER",
    grade: "Senior Consultant",
    subTeam: "Emergence",
    serviceLine: "Courants Faibles",
    managerId: "GAIF012",
    arrival: "2024-10-28",
    departure: null,
  },
  {
    empId: "GAIF046",
    name: "Laetitia VIDAL",
    grade: "Consultant",
    subTeam: "Emergence",
    serviceLine: "Gares & Lignes",
    managerId: "GAIF031",
    arrival: "2024-12-15",
    departure: "2026-03-31",
  },
];

// ── Sites & technicentres (sites) ──

interface GaifSite {
  accountId: string;
  name: string;
  type: string;
  region: string;
  parent: string;
  leader: string;
}

// Sites groupés par BU (Business Unit) — 3 entités : TN (Transilien), TER (Régions), IC (Intercités)
const GAIF_SITES: GaifSite[] = [
  // ── BU TN (Transilien) — périmètre IDF historique, majorité du parc ──
  {
    accountId: "SITE-TM-VSG",
    name: "TM Villeneuve Saint-Georges",
    type: "Technicentre",
    region: "IDF",
    parent: "TN",
    leader: "GAIF003",
  },
  { accountId: "SITE-SMR-NSY", name: "SMR Noisy", type: "SMR", region: "IDF", parent: "TN", leader: "GAIF010" },
  {
    accountId: "SITE-TPSL-VND",
    name: "TPSL Val Notre-Dame",
    type: "Technicentre",
    region: "IDF",
    parent: "TN",
    leader: "GAIF008",
  },
  {
    accountId: "SITE-TPN-JON",
    name: "TPN Joncherolles",
    type: "Technicentre",
    region: "IDF",
    parent: "TN",
    leader: "GAIF006",
  },
  {
    accountId: "SITE-TTM-TRP",
    name: "TTM Trappes",
    type: "Technicentre",
    region: "IDF",
    parent: "TN",
    leader: "GAIF008",
  },
  { accountId: "SITE-SMGL-BCY", name: "SMGL Bercy", type: "SMGL", region: "IDF", parent: "TN", leader: "GAIF006" },
  {
    accountId: "SITE-TNC-LAD",
    name: "TNC Les Ardoines",
    type: "Technicentre",
    region: "IDF",
    parent: "TN",
    leader: "GAIF006",
  },
  {
    accountId: "SITE-TPSL-ACH",
    name: "TPSL Achères",
    type: "Technicentre",
    region: "IDF",
    parent: "TN",
    leader: "GAIF008",
  },
  { accountId: "SITE-SMGL-VRS", name: "SMGL Vaires", type: "SMGL", region: "IDF", parent: "TN", leader: "GAIF010" },
  { accountId: "SITE-SMR-MSY", name: "SMR Massy", type: "SMR", region: "IDF", parent: "TN", leader: "GAIF008" },
  { accountId: "SITE-SMR-VRM", name: "SMR Versailles M", type: "SMR", region: "IDF", parent: "TN", leader: "GAIF010" },

  // ── BU TER — scope national, extension A2P ──
  {
    accountId: "SITE-TER-LYN",
    name: "Technicentre TER Lyon-Vaise",
    type: "Technicentre",
    region: "IDF",
    parent: "TER",
    leader: "GAIF014",
  },
  {
    accountId: "SITE-TER-TLS",
    name: "Technicentre TER Toulouse Matabiau",
    type: "Technicentre",
    region: "IDF",
    parent: "TER",
    leader: "GAIF014",
  },
  {
    accountId: "SITE-TER-BDX",
    name: "Technicentre TER Bordeaux",
    type: "Technicentre",
    region: "IDF",
    parent: "TER",
    leader: "GAIF015",
  },
  {
    accountId: "SITE-TER-MRS",
    name: "Technicentre TER Marseille (Blancarde)",
    type: "Technicentre",
    region: "IDF",
    parent: "TER",
    leader: "GAIF012",
  },
  {
    accountId: "SITE-TER-DJN",
    name: "Technicentre TER Dijon-Perrigny",
    type: "Technicentre",
    region: "IDF",
    parent: "TER",
    leader: "GAIF014",
  },

  // ── BU IC (Intercités) ──
  {
    accountId: "SITE-IC-PLY",
    name: "Technicentre IC Paris-Lyon",
    type: "Technicentre",
    region: "IDF",
    parent: "IC",
    leader: "GAIF013",
  },
  {
    accountId: "SITE-IC-CLF",
    name: "Technicentre IC Clermont-Ferrand",
    type: "Technicentre",
    region: "IDF",
    parent: "IC",
    leader: "GAIF013",
  },

  // ── Parties externes (non rattachées à une BU ; utilisées pour expertise/interface) ──
  { accountId: "EXT-IDFM", name: "IDFM", type: "AOT", region: "IDF", parent: "TN", leader: "GAIF001" },
  {
    accountId: "EXT-SNCF-R",
    name: "SNCF Réseau IDF",
    type: "Partenaire",
    region: "IDF",
    parent: "TN",
    leader: "GAIF005",
  },
  {
    accountId: "EXT-SNCF-IMMO",
    name: "SNCF Immobilier IDF",
    type: "Partenaire",
    region: "IDF",
    parent: "TN",
    leader: "GAIF008",
  },
];

// ── Patrimoines et familles d'actifs ──

interface AssetFamilyTemplate {
  famille: string;
  sousFamilles: string[];
  criticityProfile: "high" | "mixed" | "low"; // distribution type
}

const PATRIMOINES: Record<string, AssetFamilyTemplate[]> = {
  Ferroviaire: [
    { famille: "ADV", sousFamilles: ["ADV simple", "ADV de traversée", "ADV croisée"], criticityProfile: "high" },
    {
      famille: "Signalisation",
      sousFamilles: ["Signal BAL", "Signal nodal", "Signal manoeuvre"],
      criticityProfile: "mixed",
    },
    {
      famille: "Caténaire",
      sousFamilles: ["Caténaire 1500V", "Caténaire 25kV", "Caténaire escamotable"],
      criticityProfile: "high",
    },
    { famille: "Poste aiguillage", sousFamilles: ["PIVOS", "Poste nodal", "Poste local"], criticityProfile: "high" },
    {
      famille: "Équipement sur voie",
      sousFamilles: ["Eclairage voie", "Estacade", "Armoire de sectionnement"],
      criticityProfile: "low",
    },
  ],
  Immobilier: [
    {
      famille: "Bâtiment majeur",
      sousFamilles: ["Atelier", "Hall maintenance", "Bâtiment tertiaire"],
      criticityProfile: "high",
    },
    {
      famille: "CVC",
      sousFamilles: ["Centrale de traitement d'air", "Chaudière", "Pompe à chaleur"],
      criticityProfile: "mixed",
    },
    {
      famille: "Monte-charge",
      sousFamilles: ["Monte-charge industriel", "Pont roulant bâtiment"],
      criticityProfile: "high",
    },
    {
      famille: "Porte ferroviaire",
      sousFamilles: ["Porte sectionnelle", "Porte coulissante", "Porte pivotante"],
      criticityProfile: "mixed",
    },
    {
      famille: "Charpente/Couverture",
      sousFamilles: ["Charpente métallique", "Couverture bac acier", "Étanchéité"],
      criticityProfile: "mixed",
    },
  ],
  IO: [
    {
      famille: "Tour en fosse",
      sousFamilles: ["Tour en fosse 3 essieux", "Tour en fosse 6 essieux"],
      criticityProfile: "high",
    },
    { famille: "Vérin en fosse", sousFamilles: ["Vérin hydraulique", "Vérin électrique"], criticityProfile: "high" },
    { famille: "Banc d'essieu", sousFamilles: ["Banc mesure charge", "Banc calage"], criticityProfile: "mixed" },
    { famille: "Pont roulant", sousFamilles: ["Pont 10T", "Pont 25T", "Pont 50T"], criticityProfile: "high" },
    { famille: "Machine à laver", sousFamilles: ["Portique lavage", "Tunnel lavage"], criticityProfile: "low" },
    { famille: "Production air", sousFamilles: ["Compresseur", "Sécheur air"], criticityProfile: "mixed" },
    { famille: "Caténaire escamotable", sousFamilles: ["Caténaire escamotable 1500V"], criticityProfile: "high" },
  ],
  "Courants Faibles": [
    { famille: "SSI", sousFamilles: ["Détection incendie", "Désenfumage", "Alarme voc."], criticityProfile: "high" },
    {
      famille: "Contrôle d'accès",
      sousFamilles: ["Portillon", "Lecteur badge", "Contrôleur"],
      criticityProfile: "mixed",
    },
    { famille: "Télécom réseau", sousFamilles: ["Switch", "Borne Wi-Fi", "Commutateur"], criticityProfile: "low" },
  ],
  "Propriete Intellectuelle": [
    {
      famille: "Logiciel métier",
      sousFamilles: ["Licence Maximo", "Licence CAO", "Outil GTB"],
      criticityProfile: "mixed",
    },
    { famille: "Brevet", sousFamilles: ["Brevet équipement ferro", "Design pivot"], criticityProfile: "low" },
    {
      famille: "Licence technique",
      sousFamilles: ["Référentiel technique", "Norme propriétaire"],
      criticityProfile: "low",
    },
  ],
  "Gares Lignes": [
    { famille: "Escabelle", sousFamilles: ["Escabelle 3m", "Escabelle 5m"], criticityProfile: "low" },
    { famille: "Estacade", sousFamilles: ["Estacade fixe", "Estacade mobile"], criticityProfile: "low" },
    { famille: "Éclairage voies", sousFamilles: ["Mât éclairage LED", "Projecteur halo"], criticityProfile: "mixed" },
  ],
  Foncier: [
    { famille: "Acquisition", sousFamilles: ["Acquisition terrain", "Acquisition emprise"], criticityProfile: "mixed" },
    { famille: "Cession", sousFamilles: ["Cession terrain", "Cession emprise non utile"], criticityProfile: "low" },
    {
      famille: "Désimbrication",
      sousFamilles: ["Désimbrication site AO", "Partage foncier SA"],
      criticityProfile: "high",
    },
    {
      famille: "Transfert AO",
      sousFamilles: ["Transfert actif AO", "Pré-protection stratégique"],
      criticityProfile: "high",
    },
  ],
};

const PATRIMOINE_VOLUMES: Record<string, number> = {
  Ferroviaire: 130,
  Immobilier: 100,
  IO: 120,
  "Courants Faibles": 50,
  "Propriete Intellectuelle": 25,
  "Gares Lignes": 60,
  Foncier: 35,
};

// Volumes globaux pour affichage "label" dans les widgets patrimoines
export const PATRIMOINE_DISPLAY: Record<string, { label: string; volumeLabel: string; icon: string }> = {
  Ferroviaire: { label: "Ferroviaire", volumeLabel: "573 ADV · 130 km voies", icon: "Train" },
  Immobilier: { label: "Immobilier", volumeLabel: "435 bâtiments · 251 k m²", icon: "HomeWork" },
  IO: { label: "Installations & Outillages", volumeLabel: "3 057 équipements", icon: "Build" },
  "Courants Faibles": { label: "Courants faibles", volumeLabel: "SSI · Contrôle accès · Télécom", icon: "Cable" },
  "Propriete Intellectuelle": {
    label: "Propriété intellectuelle",
    volumeLabel: "Licences · Brevets · Normes",
    icon: "MenuBook",
  },
  "Gares Lignes": { label: "Gares & lignes", volumeLabel: "Escabelles · Estacades · Éclairage", icon: "Storefront" },
  Foncier: { label: "Foncier", volumeLabel: "423 terrains · 3,9 M m²", icon: "Terrain" },
};

// ── Missions socles GAIF ──

const MISSIONS_SOCLES = [
  "Définition et pilotage stratégie IFT",
  "Connaissance du patrimoine",
  "Contribution SD et projets émergence",
  "Prescription politiques GA",
  "Pilotage contrats prestataires",
  "Gestion dossiers fonciers",
];

// ── Marqueurs d'industrialisation ──

const MARQUEURS = ["Clients", "Agilite", "JusteBesoin", "Innovation"];

// ── Types d'actifs (engagementType → type physique) ──

const ASSET_TYPES = ["Équipement", "Bâtiment", "Installation", "Outillage", "Logiciel", "Infrastructure"];

// ── Prestataires ──

const PRESTATAIRES: Record<string, string[]> = {
  Ferroviaire: ["TSO", "SFERIS", "SNCF Réseau"],
  Immobilier: ["E2MT Equans", "Engie Solutions", "Dalkia", "SNCF Immobilier"],
  IO: ["SPIE", "Interne SNCF", "CMC Maintenance"],
  "Courants Faibles": ["Bouygues Energies", "Vinci Energies"],
  "Propriete Intellectuelle": ["IBM Maximo", "Dassault Systèmes"],
  "Gares Lignes": ["SNCF Gares & Connexions", "Interne SNCF"],
  Foncier: ["DAFG SNCF", "SNCF Immobilier"],
};

// ── Compétences GAIF ──

const GAIF_SKILLS_CATALOG = [
  // Gestion d'actifs
  { name: "ISO 55001 auditeur", category: "Gestion d'actifs" },
  { name: "ISO 55001 manager", category: "Gestion d'actifs" },
  { name: "PSGA rédaction", category: "Gestion d'actifs" },
  { name: "Stratégie cycle de vie", category: "Gestion d'actifs" },
  { name: "Matrice de criticité", category: "Gestion d'actifs" },
  { name: "Priorisation investissements", category: "Gestion d'actifs" },
  // Ferroviaire
  { name: "Voies & ADV", category: "Ferroviaire" },
  { name: "Signalisation BAL/BAPR", category: "Ferroviaire" },
  { name: "Caténaires & EALE", category: "Ferroviaire" },
  { name: "Postes d'aiguillage", category: "Ferroviaire" },
  { name: "Contractualisation SNCF Réseau", category: "Ferroviaire" },
  { name: "Design book voies de service", category: "Ferroviaire" },
  { name: "PIVOS", category: "Ferroviaire" },
  // Immobilier
  { name: "GTB / Décret BACS", category: "Immobilier" },
  { name: "Décret tertiaire", category: "Immobilier" },
  { name: "CEPIA", category: "Immobilier" },
  { name: "Contrat E2MT", category: "Immobilier" },
  { name: "MOA bâtimentaire", category: "Immobilier" },
  { name: "Cartographie immobilière", category: "Immobilier" },
  // IO / GMAO
  { name: "Maximo v8", category: "IO" },
  { name: "Maximo v9 déploiement", category: "IO" },
  { name: "Tour en fosse", category: "IO" },
  { name: "Vérin en fosse", category: "IO" },
  { name: "Banc d'essieu", category: "IO" },
  { name: "MTBF / MTTR", category: "IO" },
  // Foncier
  { name: "CGI foncier", category: "Foncier" },
  { name: "Désimbrication sites", category: "Foncier" },
  { name: "Transfert d'actifs", category: "Foncier" },
  { name: "Relation IDFM/AOT", category: "Foncier" },
  // Transverse
  { name: "Contract management TSO/SFERIS", category: "Transverse" },
  { name: "RSE & économie circulaire", category: "Transverse" },
  { name: "Audit interne", category: "Transverse" },
  { name: "PMO", category: "Transverse" },
  { name: "RAO / AO / CEB", category: "Transverse" },
  { name: "Animation COPAT", category: "Transverse" },
];

// Affectations compétences → pôles/patrimoines
const SKILL_BY_EMPLOYEE: Record<string, Array<{ name: string; level: number }>> = {
  GAIF001: [
    { name: "ISO 55001 manager", level: 5 },
    { name: "PSGA rédaction", level: 5 },
    { name: "Stratégie cycle de vie", level: 5 },
    { name: "PMO", level: 4 },
    { name: "RAO / AO / CEB", level: 5 },
  ],
  GAIF002: [
    { name: "PMO", level: 4 },
    { name: "RAO / AO / CEB", level: 4 },
    { name: "Audit interne", level: 3 },
  ],
  GAIF003: [
    { name: "ISO 55001 manager", level: 5 },
    { name: "Stratégie cycle de vie", level: 5 },
    { name: "Matrice de criticité", level: 5 },
    { name: "Contract management TSO/SFERIS", level: 4 },
    { name: "Audit interne", level: 4 },
  ],
  GAIF004: [
    { name: "PSGA rédaction", level: 4 },
    { name: "Priorisation investissements", level: 4 },
    { name: "Audit interne", level: 3 },
  ],
  GAIF005: [
    { name: "Relation IDFM/AOT", level: 5 },
    { name: "Contractualisation SNCF Réseau", level: 4 },
    { name: "Animation COPAT", level: 5 },
    { name: "MOA bâtimentaire", level: 3 },
  ],
  GAIF006: [
    { name: "Voies & ADV", level: 5 },
    { name: "Signalisation BAL/BAPR", level: 5 },
    { name: "PIVOS", level: 5 },
    { name: "Design book voies de service", level: 5 },
    { name: "Contract management TSO/SFERIS", level: 4 },
  ],
  GAIF007: [
    { name: "Voies & ADV", level: 3 },
    { name: "Caténaires & EALE", level: 3 },
    { name: "Postes d'aiguillage", level: 2 },
  ],
  GAIF008: [
    { name: "GTB / Décret BACS", level: 5 },
    { name: "Décret tertiaire", level: 5 },
    { name: "CEPIA", level: 4 },
    { name: "Contrat E2MT", level: 5 },
    { name: "MOA bâtimentaire", level: 5 },
    { name: "Cartographie immobilière", level: 5 },
  ],
  GAIF009: [
    { name: "CGI foncier", level: 5 },
    { name: "Désimbrication sites", level: 5 },
    { name: "Transfert d'actifs", level: 5 },
    { name: "Relation IDFM/AOT", level: 4 },
  ],
  GAIF010: [
    { name: "Maximo v8", level: 5 },
    { name: "Maximo v9 déploiement", level: 5 },
    { name: "Tour en fosse", level: 5 },
    { name: "MTBF / MTTR", level: 5 },
    { name: "Vérin en fosse", level: 4 },
  ],
  GAIF011: [
    { name: "Maximo v9 déploiement", level: 3 },
    { name: "MTBF / MTTR", level: 3 },
    { name: "Banc d'essieu", level: 2 },
  ],
  GAIF012: [
    { name: "RAO / AO / CEB", level: 5 },
    { name: "Stratégie cycle de vie", level: 4 },
    { name: "Priorisation investissements", level: 5 },
    { name: "PMO", level: 4 },
  ],
  GAIF013: [
    { name: "RAO / AO / CEB", level: 4 },
    { name: "Priorisation investissements", level: 3 },
    { name: "PMO", level: 3 },
  ],
  GAIF014: [
    { name: "Voies & ADV", level: 4 },
    { name: "Contractualisation SNCF Réseau", level: 4 },
    { name: "RAO / AO / CEB", level: 3 },
  ],
  GAIF015: [
    { name: "MOA bâtimentaire", level: 3 },
    { name: "GTB / Décret BACS", level: 3 },
    { name: "RAO / AO / CEB", level: 2 },
  ],
  GAIF016: [
    { name: "PMO", level: 5 },
    { name: "RAO / AO / CEB", level: 4 },
    { name: "Audit interne", level: 3 },
  ],
};

// ── Projets d'investissement majeurs (pour les assignments) ──

interface GaifProject {
  id: string;
  name: string;
  patrimoine: string;
  site: string | null;
  phase: number; // status = 1..14
  marqueur: string;
  lead: string; // empId
  team: string[]; // empIds
  startDate: string;
  endDate: string;
  budget: number;
}

const GAIF_PROJECTS: GaifProject[] = [
  {
    id: "PROJ-PIVOS-ARDOINES",
    name: "PIVOS Les Ardoines — reprise exploitation poste",
    patrimoine: "Ferroviaire",
    site: "SITE-TNC-LAD",
    phase: 11,
    marqueur: "Innovation",
    lead: "GAIF006",
    team: ["GAIF006", "GAIF007", "GAIF005"],
    startDate: "2025-03-01",
    endDate: "2026-12-31",
    budget: 4_800_000,
  },
  {
    id: "PROJ-MAXIMO-NOISY",
    name: "Déploiement Maximo v9 — site pilote Noisy",
    patrimoine: "IO",
    site: "SITE-SMR-NSY",
    phase: 6,
    marqueur: "Innovation",
    lead: "GAIF010",
    team: ["GAIF010", "GAIF011"],
    startDate: "2025-06-15",
    endDate: "2026-06-30",
    budget: 1_200_000,
  },
  {
    id: "PROJ-MAXIMO-NAT",
    name: "Maximo v9 — généralisation nationale",
    patrimoine: "IO",
    site: null,
    phase: 4,
    marqueur: "Innovation",
    lead: "GAIF010",
    team: ["GAIF010", "GAIF011", "GAIF016"],
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    budget: 3_500_000,
  },
  {
    id: "PROJ-GTB-BACS",
    name: "GTB / Décret BACS — déploiement SMR",
    patrimoine: "Immobilier",
    site: "SITE-SMR-MSY",
    phase: 6,
    marqueur: "Innovation",
    lead: "GAIF008",
    team: ["GAIF008", "GAIF015", "GAIF005"],
    startDate: "2025-04-01",
    endDate: "2027-01-31",
    budget: 5_200_000,
  },
  {
    id: "PROJ-ISO-SVCO",
    name: "Certification ISO 55001 — BU SVCO",
    patrimoine: "Ferroviaire",
    site: null,
    phase: 6,
    marqueur: "Innovation",
    lead: "GAIF003",
    team: ["GAIF003", "GAIF004", "GAIF006", "GAIF008"],
    startDate: "2025-09-01",
    endDate: "2026-12-31",
    budget: 650_000,
  },
  {
    id: "PROJ-FONCIER-LANDY",
    name: "Transfert foncier Le Landy",
    patrimoine: "Immobilier",
    site: null,
    phase: 11,
    marqueur: "JusteBesoin",
    lead: "GAIF009",
    team: ["GAIF009"],
    startDate: "2025-01-15",
    endDate: "2026-06-30",
    budget: 380_000,
  },
  {
    id: "PROJ-DESIMBR-BLANC",
    name: "Désimbrication Blancarde — BU PACA",
    patrimoine: "Immobilier",
    site: null,
    phase: 4,
    marqueur: "JusteBesoin",
    lead: "GAIF009",
    team: ["GAIF009", "GAIF013"],
    startDate: "2025-11-01",
    endDate: "2027-03-31",
    budget: 1_100_000,
  },
  {
    id: "PROJ-RAO-TER",
    name: "Appui RAO TER (Aura/Occitanie/BFC/Sud PACA)",
    patrimoine: "Ferroviaire",
    site: null,
    phase: 4,
    marqueur: "Clients",
    lead: "GAIF012",
    team: ["GAIF012", "GAIF013", "GAIF014", "GAIF006"],
    startDate: "2025-10-01",
    endDate: "2026-09-30",
    budget: 780_000,
  },
  {
    id: "PROJ-MAINT-SR",
    name: "Maintenance ferroviaire sans SNCF Réseau — extension TER",
    patrimoine: "Ferroviaire",
    site: null,
    phase: 4,
    marqueur: "JusteBesoin",
    lead: "GAIF006",
    team: ["GAIF006", "GAIF007", "GAIF005"],
    startDate: "2026-01-15",
    endDate: "2027-06-30",
    budget: 950_000,
  },
  {
    id: "PROJ-CATA-TPSL",
    name: "Régénération caténaire TPSL Achères",
    patrimoine: "Ferroviaire",
    site: "SITE-TPSL-ACH",
    phase: 1,
    marqueur: "Agilite",
    lead: "GAIF006",
    team: ["GAIF006"],
    startDate: "2026-05-01",
    endDate: "2027-12-31",
    budget: 2_300_000,
  },
  {
    id: "PROJ-PSGA-MAJ",
    name: "Mise à jour PSGA v2 + processus cycle de vie",
    patrimoine: "Transverse",
    site: null,
    phase: 6,
    marqueur: "Innovation",
    lead: "GAIF003",
    team: ["GAIF003", "GAIF004", "GAIF005"],
    startDate: "2025-10-01",
    endDate: "2026-05-31",
    budget: 220_000,
  },
  {
    id: "PROJ-CATALOG-DET",
    name: "Présentation catalogue de services DET TER/IC",
    patrimoine: "Transverse",
    site: null,
    phase: 4,
    marqueur: "Clients",
    lead: "GAIF012",
    team: ["GAIF012", "GAIF013"],
    startDate: "2026-01-15",
    endDate: "2026-03-31",
    budget: 85_000,
  },
];

// ── Contrats prestataires ──

interface GaifContract {
  id: string;
  prestataire: string;
  patrimoine: string;
  scope: string;
  sites: string[];
  startDate: string;
  endDate: string;
  amount: number;
  perfScore: number;
  manager: string; // empId
}

const GAIF_CONTRACTS: GaifContract[] = [
  {
    id: "CONT-TSO-Z2N",
    prestataire: "TSO",
    patrimoine: "Ferroviaire",
    scope: "Maintenance voies & ADV sites Z2N",
    sites: ["SITE-SMGL-BCY", "SITE-TNC-LAD", "SITE-TTM-TRP"],
    startDate: "2024-01-01",
    endDate: "2027-12-31",
    amount: 8_400_000,
    perfScore: 87,
    manager: "GAIF006",
  },
  {
    id: "CONT-SFERIS-LVL",
    prestataire: "SFERIS",
    patrimoine: "Ferroviaire",
    scope: "Maintenance voies & ADV — Levallois",
    sites: ["SITE-TPSL-VND"],
    startDate: "2023-06-01",
    endDate: "2026-05-31",
    amount: 2_100_000,
    perfScore: 82,
    manager: "GAIF006",
  },
  {
    id: "CONT-E2MT-IDF",
    prestataire: "E2MT Equans",
    patrimoine: "Immobilier",
    scope: "Entretien exploitation maintenance multi-techniques IFG IDF",
    sites: ["SITE-TM-VSG", "SITE-SMR-NSY", "SITE-TPSL-VND", "SITE-TPN-JON"],
    startDate: "2024-04-01",
    endDate: "2028-03-31",
    amount: 12_300_000,
    perfScore: 91,
    manager: "GAIF008",
  },
  {
    id: "CONT-ENGIE-IDF",
    prestataire: "Engie Solutions",
    patrimoine: "Immobilier",
    scope: "GTB & chauffage SMR/SMGL",
    sites: ["SITE-SMR-MSY", "SITE-SMR-VRM", "SITE-SMGL-VRS"],
    startDate: "2024-09-01",
    endDate: "2027-08-31",
    amount: 3_800_000,
    perfScore: 79,
    manager: "GAIF008",
  },
  {
    id: "CONT-SPIE-IO",
    prestataire: "SPIE",
    patrimoine: "IO",
    scope: "Maintenance vérins & tours en fosse TM",
    sites: ["SITE-TM-VSG", "SITE-TNC-LAD", "SITE-TTM-TRP"],
    startDate: "2024-01-15",
    endDate: "2026-12-31",
    amount: 2_900_000,
    perfScore: 85,
    manager: "GAIF010",
  },
  {
    id: "CONT-IBM-MAX",
    prestataire: "IBM Maximo",
    patrimoine: "Propriete Intellectuelle",
    scope: "Licence & support Maximo v9",
    sites: [],
    startDate: "2025-01-01",
    endDate: "2027-12-31",
    amount: 1_500_000,
    perfScore: 95,
    manager: "GAIF010",
  },
  {
    id: "CONT-BOUY-CF",
    prestataire: "Bouygues Energies",
    patrimoine: "Courants Faibles",
    scope: "SSI + contrôle d'accès Technicentres IDF",
    sites: ["SITE-TM-VSG", "SITE-TPSL-VND", "SITE-TPN-JON"],
    startDate: "2024-06-01",
    endDate: "2027-05-31",
    amount: 1_650_000,
    perfScore: 88,
    manager: "GAIF005",
  },
  {
    id: "CONT-DALKIA-CVC",
    prestataire: "Dalkia",
    patrimoine: "Immobilier",
    scope: "CVC ateliers sud IDF",
    sites: ["SITE-SMR-MSY", "SITE-TPSL-ACH"],
    startDate: "2023-10-01",
    endDate: "2026-09-30",
    amount: 1_200_000,
    perfScore: 76,
    manager: "GAIF008",
  },
];

// ── Comitologie GAIF (4 comités officiels TN) ──

interface GaifComiteSeed {
  id: string;
  label: string;
  shortLabel: string;
  cadence: "mensuel" | "bimestriel" | "trimestriel" | "semestriel";
  coAnimateur: string;
  themes: string[];
  raciLeadId: string;
  nextOccurrenceOffsetMonths: number;
  color: string;
}

const GAIF_COMITES: GaifComiteSeed[] = [
  {
    id: "COPIL-RESEAU",
    label: "COPIL Interfaces SNCF Réseau",
    shortLabel: "COPIL Réseau",
    cadence: "trimestriel",
    coAnimateur: "SNCF Réseau IDF",
    themes: [
      "Contrats ferro TSO/SFERIS",
      "Substitution technos propriétaires (PIVOS, CTFU, clés S, SYPRAI)",
      "Interfaces MOA projets",
    ],
    raciLeadId: "GAIF006",
    nextOccurrenceOffsetMonths: 1,
    color: "#C8102E",
  },
  {
    id: "COPIL-IMMO",
    label: "COPIL Immo trajectoires d'investissement",
    shortLabel: "COPIL Immo",
    cadence: "bimestriel",
    coAnimateur: "SNCF Immobilier / DI IDF",
    themes: [
      "PPI 2026-2030 Immo",
      "Décret BACS / Tertiaire / CEPIA",
      "Avis Carnet de Santé",
      "Animation correspondants patrimoine",
    ],
    raciLeadId: "GAIF008",
    nextOccurrenceOffsetMonths: 0,
    color: "#1E4E8C",
  },
  {
    id: "COTECH-IDFM",
    label: "COTECH GAIF avec IDFM",
    shortLabel: "COTECH IDFM",
    cadence: "bimestriel",
    coAnimateur: "IDFM",
    themes: ["Analyse imbrication / transfert actifs AO", "Sollicitations expertises IDFM", "Accompagnement POC/DI"],
    raciLeadId: "GAIF001",
    nextOccurrenceOffsetMonths: 1,
    color: "#7C3AED",
  },
  {
    id: "COPIL-RSE",
    label: "COPIL RSE avec SG TN",
    shortLabel: "COPIL RSE",
    cadence: "mensuel",
    coAnimateur: "Secrétariat Général TN",
    themes: [
      "Consommations eau / élec / gaz",
      "Conformité décrets BACS / Tertiaire / CEPIA / ACC",
      "Économie circulaire",
    ],
    raciLeadId: "GAIF001",
    nextOccurrenceOffsetMonths: 0,
    color: "#10B981",
  },
];

const GAIF_COMITE_ACTIONS: Array<{
  id: string;
  comiteId: string;
  description: string;
  ownerId: string;
  dueDateOffsetDays: number;
  priority: string;
  status: string;
}> = [
  {
    id: "CA-COPIL-IMMO-01",
    comiteId: "COPIL-IMMO",
    description: "Avis expert sur demandes Carnet de Santé TPSL Achères (3 demandes)",
    ownerId: "GAIF008",
    dueDateOffsetDays: 21,
    priority: "haute",
    status: "open",
  },
  {
    id: "CA-COPIL-IMMO-02",
    comiteId: "COPIL-IMMO",
    description: "Plan déploiement GTB BACS 2027 — 12 sites > 70 kW",
    ownerId: "GAIF008",
    dueDateOffsetDays: 60,
    priority: "haute",
    status: "in_progress",
  },
  {
    id: "CA-COPIL-IMMO-03",
    comiteId: "COPIL-IMMO",
    description: "Arbitrage budget 2027 immobilier — trajectoire MCO",
    ownerId: "GAIF008",
    dueDateOffsetDays: 90,
    priority: "moyenne",
    status: "open",
  },
  {
    id: "CA-COPIL-RESEAU-01",
    comiteId: "COPIL-RESEAU",
    description: "Revue contractuelle TSO sites Z2N — négociation 2027",
    ownerId: "GAIF006",
    dueDateOffsetDays: 45,
    priority: "haute",
    status: "in_progress",
  },
  {
    id: "CA-COPIL-RESEAU-02",
    comiteId: "COPIL-RESEAU",
    description: "Stratégie substitution PIVOS Les Ardoines",
    ownerId: "GAIF006",
    dueDateOffsetDays: 120,
    priority: "moyenne",
    status: "open",
  },
  {
    id: "CA-COTECH-IDFM-01",
    comiteId: "COTECH-IDFM",
    description: "Préparation dossier transfert Le Landy vers société dédiée",
    ownerId: "GAIF009",
    dueDateOffsetDays: 30,
    priority: "haute",
    status: "in_progress",
  },
  {
    id: "CA-COTECH-IDFM-02",
    comiteId: "COTECH-IDFM",
    description: "Expertise Blancarde — désimbrication BU PACA",
    ownerId: "GAIF009",
    dueDateOffsetDays: 90,
    priority: "haute",
    status: "open",
  },
  {
    id: "CA-COTECH-IDFM-03",
    comiteId: "COTECH-IDFM",
    description: "Analyse imbrication foncière SMGL Bercy pour future AO",
    ownerId: "GAIF009",
    dueDateOffsetDays: 150,
    priority: "moyenne",
    status: "open",
  },
  {
    id: "CA-COPIL-RSE-01",
    comiteId: "COPIL-RSE",
    description: "Tableau de bord consommations mensuel T1 2026",
    ownerId: "GAIF008",
    dueDateOffsetDays: 15,
    priority: "moyenne",
    status: "open",
  },
  {
    id: "CA-COPIL-RSE-02",
    comiteId: "COPIL-RSE",
    description: "Revue conformité décret Tertiaire — objectif 2030",
    ownerId: "GAIF008",
    dueDateOffsetDays: 60,
    priority: "haute",
    status: "in_progress",
  },
];

// ── Risques & opportunités ISO 55001 §6.1 ──

const GAIF_RISKS_SEED: Array<{
  id: string;
  title: string;
  description: string;
  kind: "risque" | "opportunite";
  severity: "critique" | "majeur" | "modere" | "mineur";
  stage: "identifie" | "evalue" | "plan_mitigation" | "cloture";
  ownerId: string;
  processus: string;
  patrimoine: string | null;
  dueDate: string;
}> = [
  {
    id: "RISK-001",
    title: "Perte savoir-faire expertise foncière",
    description: "Seul expert foncier senior (GAIF009) — bus-factor critique sur CGI / désimbrication.",
    kind: "risque",
    severity: "critique",
    stage: "plan_mitigation",
    ownerId: "GAIF001",
    processus: "Support — Ressources (§7.1)",
    patrimoine: "Foncier",
    dueDate: "2026-06-30",
  },
  {
    id: "RISK-002",
    title: "Retard migration Maximo v9 national",
    description: "Charge équipe IO sous-dimensionnée pour tenir 2026.",
    kind: "risque",
    severity: "majeur",
    stage: "evalue",
    ownerId: "GAIF010",
    processus: "Fonctionnement — Produits & technologies (§8.3)",
    patrimoine: "IO",
    dueDate: "2026-09-30",
  },
  {
    id: "RISK-003",
    title: "Non-conformité décret BACS 2027",
    description: "Puissance cumulée > 70 kW sur 12 sites non équipés GTB.",
    kind: "risque",
    severity: "majeur",
    stage: "plan_mitigation",
    ownerId: "GAIF008",
    processus: "Planification — Risques & opportunités (§6.1)",
    patrimoine: "Immobilier",
    dueDate: "2027-01-01",
  },
  {
    id: "RISK-004",
    title: "Injonctions contradictoires DI IDF / TM",
    description: "Priorisation divergente sur investissements immobilier.",
    kind: "risque",
    severity: "modere",
    stage: "evalue",
    ownerId: "GAIF008",
    processus: "Fonctionnement — Contrôle du changement (§8.2)",
    patrimoine: "Immobilier",
    dueDate: "2026-04-30",
  },
  {
    id: "RISK-005",
    title: "Substitution technologies propriétaires SNCF Réseau",
    description: "PIVOS / CTFU / clés S / SYPRAI bloquent l'externalisation.",
    kind: "risque",
    severity: "majeur",
    stage: "identifie",
    ownerId: "GAIF006",
    processus: "Fonctionnement — Planification (§8.1)",
    patrimoine: "Ferroviaire",
    dueDate: "2026-12-31",
  },
  {
    id: "OPP-001",
    title: "Certification ISO 55001 SVCO — vitrine RAO",
    description: "Premier site certifié → levier de différenciation sur AO IDFM.",
    kind: "opportunite",
    severity: "majeur",
    stage: "plan_mitigation",
    ownerId: "GAIF003",
    processus: "Amélioration — Amélioration continue (§10.1)",
    patrimoine: null,
    dueDate: "2026-12-31",
  },
  {
    id: "OPP-002",
    title: "Animation correspondants patrimoine TM",
    description: "Maillage existant et apprécié.",
    kind: "opportunite",
    severity: "modere",
    stage: "evalue",
    ownerId: "GAIF008",
    processus: "Support — Communication (§7.4)",
    patrimoine: "Immobilier",
    dueDate: "2026-06-30",
  },
  {
    id: "RISK-006",
    title: "Qualité données GMAO hétérogène",
    description: "GAIA/ARMEN pas tenus à jour.",
    kind: "risque",
    severity: "modere",
    stage: "identifie",
    ownerId: "GAIF010",
    processus: "Support — Données & informations (§7.6)",
    patrimoine: "IO",
    dueDate: "2026-09-30",
  },
  {
    id: "RISK-007",
    title: "Surcharge équipe GAIF",
    description: "Plan de charge 2026 déborde malgré +4 arrivants.",
    kind: "risque",
    severity: "modere",
    stage: "evalue",
    ownerId: "GAIF016",
    processus: "Support — Ressources (§7.1)",
    patrimoine: null,
    dueDate: "2026-03-31",
  },
  {
    id: "OPP-003",
    title: "Maintenance ferro sans SNCF Réseau — extension TER",
    description: "Extension TSO/SFERIS au périmètre TER.",
    kind: "opportunite",
    severity: "majeur",
    stage: "plan_mitigation",
    ownerId: "GAIF006",
    processus: "Fonctionnement — Externalisation (§8.3)",
    patrimoine: "Ferroviaire",
    dueDate: "2027-06-30",
  },
];

// ── Audits ISO 55001 ──

const GAIF_AUDITS_SEED: Array<{
  id: string;
  kind: "audit_interne" | "revue_direction" | "pre_audit" | "certification";
  label: string;
  scope: string;
  plannedDate: string;
  auditor: string;
  status: "planifie" | "en_cours" | "realise";
}> = [
  {
    id: "AUD-001",
    kind: "pre_audit",
    label: "Pré-audit ISO 55001 SVCO",
    scope: "Patrimoine ferroviaire + immobilier SVCO",
    plannedDate: "2026-06-15",
    auditor: "Pôle Excellence Patrimoine (GAIF004)",
    status: "planifie",
  },
  {
    id: "AUD-002",
    kind: "certification",
    label: "Audit certification ISO 55001 SVCO",
    scope: "Certification externe (tiers indépendant)",
    plannedDate: "2026-11-20",
    auditor: "Organisme de certification",
    status: "planifie",
  },
  {
    id: "AUD-003",
    kind: "audit_interne",
    label: "Audit SGA annuel TN",
    scope: "Tous patrimoines — grille 55001",
    plannedDate: "2026-09-30",
    auditor: "Pôle Excellence Patrimoine + PMO",
    status: "planifie",
  },
  {
    id: "AUD-004",
    kind: "revue_direction",
    label: "Revue de direction GAIF 2026",
    scope: "Bilan objectifs PSGA + ajustement stratégie",
    plannedDate: "2026-12-15",
    auditor: "Directeur GAIF + CODIR",
    status: "planifie",
  },
  {
    id: "AUD-005",
    kind: "audit_interne",
    label: "Audit qualité données GMAO",
    scope: "Maximo v8/v9, IMMOSIS, GAIA",
    plannedDate: "2026-04-18",
    auditor: "Pôle IO + PMO",
    status: "en_cours",
  },
  {
    id: "AUD-006",
    kind: "pre_audit",
    label: "Pré-audit conformité décret BACS",
    scope: "12 sites immo > 70 kW",
    plannedDate: "2026-10-01",
    auditor: "Expert immobilier + SNCF Immo",
    status: "planifie",
  },
];

// ── Documents doctrinaires (corpus pour knowledge_base_lookup) ──

const GAIF_DOCS_SEED: Array<{
  id: string;
  title: string;
  category: string;
  version: string;
  lastUpdate: string;
  owner: string;
  status: string;
  summary: string;
  content: string;
  tags: string[];
}> = [
  {
    id: "PSGA-V2",
    title: "Plan Stratégique de Gestion d'Actifs (PSGA)",
    category: "Stratégie",
    version: "v2",
    lastUpdate: "2024-09-25",
    owner: "TN GAIF",
    status: "Publié",
    summary:
      "Traduit la Politique GA IF en objectifs mesurables. 3 indicateurs GA + 8 indicateurs pilotage. 6 patrimoines. Cohérence ISO 55001.",
    content:
      "Vision : 5 objectifs (sécurité, satisfaction client, disponibilité, maîtrise des coûts, RSE). 3 axes stratégiques : externalisation maintenance, mise à niveau RSE (BACS/Tertiaire/CEPIA), digitalisation du SGA. Indicateurs GA : disponibilité résiduelle, non-conformité, coût GA/rame. Cycle de vie en 4 phases : collecte besoin → stratégie → exploitation → fin de vie.",
    tags: ["psga", "strategie", "vision", "cycle de vie", "kpi", "55001"],
  },
  {
    id: "POL-GA",
    title: "Politique de Gestion d'Actifs Installations Fixes",
    category: "Politique",
    version: "v2",
    lastUpdate: "2024-10-15",
    owner: "Direction Transilien",
    status: "Validation",
    summary: "Orientations stratégiques signées par Frank RENAULT. 3 axes : externalisation, RSE, digitalisation.",
    content:
      "La politique de gestion d'actifs IFT de Transilien définit les grandes orientations stratégiques pour les installations fixes. 3 axes fondamentaux : (1) externalisation maintenance pour ferro/immo/IO non critiques ; (2) mise à niveau RSE (décrets BACS, Tertiaire, CEPIA) ; (3) digitalisation pour rationaliser inventaires, planification et conformité.",
    tags: ["politique", "strategie", "rse", "externalisation", "digitalisation"],
  },
  {
    id: "PR-CRITIC",
    title: "Prescription — Définition de la criticité",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Publié",
    summary: "Matrice 4×4 (occurrence × impact) adaptée par patrimoine ferro/immo/IO.",
    content:
      "La criticité désigne le degré d'importance d'un actif. Matrice 4 niveaux (improbable/rare/probable/fréquente) × impact pondéré. Critères par patrimoine : ferro (impact exploitation, solution contournement, financier) ; immo (sécurité, production, financier, social, image) ; IO (MTBF, MTTR, redondance, vérif réglementaire, chaîne système).",
    tags: ["criticite", "matrice", "ferro", "immo", "io", "mtbf", "mttr"],
  },
  {
    id: "PR-INVEST",
    title: "Prescription — Cycle de vie : Investissement",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Emergence",
    status: "Publié",
    summary: "Émergence → EP → CEB. Processus Carnet de Santé, avis expert immobilier.",
    content:
      "Immobilier : demande TM via Carnet de Santé → avis expert immobilier GAIF (favorable / reporté / défavorable) → arbitrage direction. Ferro : émergence via schéma directeur (IDFM ou Directions de lignes). IO : FEB (Fiche Expression Besoin) + analyse rentabilité.",
    tags: ["investissement", "immo", "carnet", "workflow", "avis", "feb"],
  },
  {
    id: "PR-EXPL",
    title: "Prescription — Cycle de vie : Exploitation",
    category: "Prescription",
    version: "v0.9",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Work in progress",
    summary: "Contractualisation SNCF Réseau, doc technique Transilien, postes d'aiguillage.",
    content:
      "Transilien se dote progressivement de documentation technique en substitution des documents SNCF Réseau (consigne S6, S11). Postes d'aiguillage Joncherolles et Les Ardoines : compétences internes en développement.",
    tags: ["exploitation", "ferro", "snc reseau", "documentation"],
  },
  {
    id: "PR-MAINT",
    title: "Prescription — Cycle de vie : Maintenance",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Publié",
    summary: "Externalisation ferro (TSO, SFERIS), contrat E2MT immo, 3 schémas IO.",
    content:
      "Ferro : TSO maintient voies/ADV des sites Z2N (Bercy, Ardoines, Villeneuve, Montrouge). SFERIS : Levallois. Autres sites : SNCF Réseau. Immo : contrat E2MT multi-techniques (SNCF Immobilier). IO : 3 schémas (interne total, externalisation totale, mix). Le mix est privilégié.",
    tags: ["maintenance", "tso", "sferis", "e2mt", "io", "ferro", "immo", "externalisation"],
  },
  {
    id: "PR-FIN",
    title: "Prescription — Cycle de vie : Fin de vie",
    category: "Prescription",
    version: "v0.9",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Work in progress",
    summary: "Économie circulaire, valorisation, RSE des investissements.",
    content:
      "Privilégier l'économie circulaire : réutilisation, recyclage, valorisation des matériaux. Formalisation REX alimentant le design book pour amélioration continue.",
    tags: ["fin de vie", "rse", "economie circulaire", "design book", "rex"],
  },
  {
    id: "PR-GOUV",
    title: "Prescription — Processus, Gouvernance & Comitologie",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Direction GAIF",
    status: "Publié",
    summary: "11 processus PSGA + RACI complet. Comitologie 4 comités TN.",
    content:
      "RACI sur 11 processus avec 10 rôles (Dir GAIF, Resp Pat, CoPat TM, Mainteneur, IDFM, DG TN, Strat&Dev, DET, Dir lignes, A2IF). Comitologie : COPIL Réseau trimestriel, COPIL Immo bimestriel, COTECH IDFM bimestriel, COPIL RSE mensuel.",
    tags: ["raci", "gouvernance", "comitologie", "copil", "cotech", "processus"],
  },
  {
    id: "PR-PERF",
    title: "Prescription — Performance du SGA",
    category: "Prescription",
    version: "v1",
    lastUpdate: "2024-10-01",
    owner: "Direction GAIF",
    status: "Publié",
    summary: "Seuils cibles par criticité : taux dispo, non-conformité, coût GA/rame.",
    content:
      "Disponibilité résiduelle : critiques <15% optimal / autres <40%. Non-conformité : critiques <1% optimal / autres <5%. Évolution coût GA/rame : diminution >5% sur 5 ans optimal. Indicateurs pilotage : taux disponibilité, taux utilisation, incidents, taux conformité, consommations, coût maintenance, coût possession, coût exploitation, coût m² (immo).",
    tags: ["performance", "seuils", "kpi", "psga", "criticite"],
  },
  {
    id: "NOTE-PP",
    title: "Note — Parties prenantes GA IF",
    category: "Note",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Strat & Dev",
    status: "Publié",
    summary: "Cartographie parties prenantes + RACI 12 activités × 6 PP + RACI 55001.",
    content:
      "6 parties prenantes : IDFM, DG TN, TN GAIF, Directions de lignes, Technicentres, Prestataires. 12 activités : pilotage/analyse perf, cycle de vie, exploitation, maintenance, documentation, logistique, achat, financier, RH, prescription, audit interne, externalisation.",
    tags: ["parties prenantes", "raci", "idfm", "gaif", "technicentre"],
  },
  {
    id: "NOTE-INV",
    title: "Note — Inventaire du parc & outils",
    category: "Note",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Publié",
    summary: "53 UT · 539 bâtiments · 251k m² · 3057 équipements. Outils SI par patrimoine.",
    content:
      "Parc immo : 53 UT, 539 bâtiments, 251k m², 3057 équipements rattachés. États ABE : 55% Satisfaisant, 25% Acceptable, 11% Moyen, 1% Insuffisant. Ferro : 573 ADV, 130 km voies. IO : ~11 439 au total (6 639 hors ESM). Outils : IMMOSIS, Carnet Santé, IGO, CONSO (immo) ; Maximo v8/v9, DECA (IO) ; GAIA, ARMEN, SPOT (ferro) ; GEOPRISM (foncier) ; ENERGIS (courants forts).",
    tags: ["inventaire", "abe", "immosis", "maximo", "outils", "si"],
  },
  {
    id: "NOTE-GRAN",
    title: "Note — Application de la granularité",
    category: "Note",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Publié",
    summary: "Granularité ferro (obj → composants), immo (UT/LOT/BAT/LOCAL), IO (ESM vs Hors ESM).",
    content:
      "Ferro : famille équipement → sous-ensembles → objets ferroviaires → composants. Immo : UT (Unité Topographique) → LOT → BAT → LOCAL. IO : distinction Installations vs Outillages (ESM / Hors ESM).",
    tags: ["granularite", "ut", "lot", "bat", "esm", "objets"],
  },
  {
    id: "NOTE-AUDIT",
    title: "Note — Audit interne 55001",
    category: "Note",
    version: "v1",
    lastUpdate: "2024-09-26",
    owner: "Pôle Excellence Patrimoine",
    status: "Work in progress",
    summary: "SWOT + état des lieux + plan d'amélioration ISO 55001.",
    content:
      "SWOT du SGA : forces (entité dédiée, volonté direction, compétences opérateur historique) · faiblesses (silos, manque standardisation TM, absence critères évaluation) · opportunités (mise en concurrence, standardisation) · risques (approches multiples selon propriétaire).",
    tags: ["audit", "55001", "swot", "amelioration"],
  },
  {
    id: "PRES-A2P",
    title: "Présentation entité A2P / GAIF",
    category: "Présentation",
    version: "v1",
    lastUpdate: "2026-04-03",
    owner: "Direction A2P",
    status: "Publié",
    summary: "Organigramme A2P, missions, catalogue services, comitologie, enjeux 2026.",
    content:
      "A2P = Ateliers Projets et Patrimoine, entité BL DSP. Direction GAIF : 2 pôles (Excellence Patrimoine, Emergence) + PMO. 6 missions socles : stratégie IFT, connaissance patrimoine, SD/émergence, prescription, pilotage contrats, fonciers. Catalogue 4 volets (RAO, support SD, contrat actuel, post-IDFM) × 2 modes (FIXE/FREE).",
    tags: ["a2p", "organigramme", "missions", "catalogue", "socles", "pôles"],
  },
];

// ── Generators ──

function generateActifs(): Array<{
  opportunityId: string;
  opportunity: string;
  accountId: string;
  account: string;
  status: number;
  grossRevenue: number;
  netRevenue: number;
  winPct: number;
  cm1Pct: number;
  jobCode: string;
  engagementType: string;
  weightedBooking: number;
  manager: string;
  managerId: string;
  em: string | null;
  ep: string | null;
  country: string;
  region: string;
  segmentCode: string;
  subSegmentCode: string;
  subSegment: string;
  serviceLine1: string; // patrimoine
  serviceLine2: string | null; // famille
  serviceLine3: string | null; // sous-famille
  serviceOffering1: string; // mission socle
  creationDate: string;
  bookingDate: string | null;
  estimatedBookingDate: string | null;
  lastStatusChangeDate: string;
  partner: string | null; // prestataire
  lostComment: string | null;
  // GAIF native metrics
  utilizationPct: number;
  incidents12m: number;
  consoEau: number;
  consoElec: number;
  consoGaz: number;
  surfaceM2: number;
  mtbf: number;
  mttr: number;
  etatAbe: string | null;
}> {
  const actifs = [];
  let assetIndex = 1;

  for (const [patrimoine, familles] of Object.entries(PATRIMOINES)) {
    const targetVolume = PATRIMOINE_VOLUMES[patrimoine];
    const perFamille = Math.ceil(targetVolume / familles.length);

    for (const family of familles) {
      const count = Math.min(perFamille, targetVolume - (actifs.length % targetVolume));

      for (let i = 0; i < count; i++) {
        // Site selection pondérée : 65% TN, 25% TER, 10% IC
        const physicalSites = GAIF_SITES.filter((s) => !s.accountId.startsWith("EXT"));
        const tnSites = physicalSites.filter((s) => s.parent === "TN");
        const terSites = physicalSites.filter((s) => s.parent === "TER");
        const icSites = physicalSites.filter((s) => s.parent === "IC");
        const buRoll = Math.random();
        let sitePool: typeof physicalSites;
        if (buRoll < 0.65) sitePool = tnSites;
        else if (buRoll < 0.9) sitePool = terSites;
        else sitePool = icSites;
        const site = sitePool.length > 0 ? randomFrom(sitePool) : randomFrom(physicalSites);

        // Criticity distribution based on family profile
        const critRoll = Math.random();
        let criticity: "critique" | "moderee" | "non_critique";
        if (family.criticityProfile === "high") {
          criticity = critRoll < 0.5 ? "critique" : critRoll < 0.85 ? "moderee" : "non_critique";
        } else if (family.criticityProfile === "mixed") {
          criticity = critRoll < 0.2 ? "critique" : critRoll < 0.6 ? "moderee" : "non_critique";
        } else {
          criticity = critRoll < 0.05 ? "critique" : critRoll < 0.25 ? "moderee" : "non_critique";
        }

        // Status mappé sur les phases de cycle de vie GAIF.
        // On utilise les codes BP canoniques car les filtres front dépendent de status=14 pour l'onglet Maintenance.
        //   1  = Émergence (5%)
        //   4  = Investissement / CEB (5%)
        //   14 = En exploitation (75% — majorité visible dans Maintenance)
        //   11 = Maintenance lourde planifiée (10%)
        //   15 = Fin de vie (5%)
        const statusRoll = Math.random();
        const status =
          statusRoll < 0.05
            ? 1
            : statusRoll < 0.1
              ? 4
              : statusRoll < 0.18
                ? 6
                : statusRoll < 0.82
                  ? 14
                  : statusRoll < 0.93
                    ? 11
                    : 15;

        // Disponibilité % — réaliste par criticité et phase cycle de vie
        // Actifs critiques en exploitation → haute dispo (95-99%), fin de vie → basse (20-60%)
        const baseAvailability =
          criticity === "critique"
            ? randomBetween(95, 99)
            : criticity === "moderee"
              ? randomBetween(88, 97)
              : randomBetween(82, 95);
        const winPct =
          status === 15
            ? randomBetween(15, 55) // Fin de vie : dispo dégradée
            : status === 11
              ? randomBetween(70, 88) // Maintenance lourde : dispo réduite
              : status === 1
                ? 0 // Émergence : pas encore en service
                : status === 6
                  ? randomBetween(40, 75) // Étude en cours : dispo partielle
                  : baseAvailability; // En exploitation (14) ou investissement (4) : dispo normale

        // Conformity
        const conformityRoll = Math.random();
        const cm1Pct =
          criticity === "critique" && conformityRoll < 0.08
            ? randomBetween(70, 89)
            : conformityRoll < 0.2
              ? randomBetween(85, 94)
              : randomBetween(95, 100);

        // Coûts réalistes par famille (grossRevenue = coût annuel exploitation+maintenance, netRevenue = coût maintenance seul)
        // Source : ordres de grandeur SNCF Transilien / benchmarks industriels ferroviaires
        const FAMILY_COSTS: Record<string, [number, number]> = {
          // Ferroviaire — k€ annuel maintenance
          ADV: [15, 50],
          Signalisation: [8, 35],
          Caténaire: [10, 45],
          "Poste aiguillage": [50, 150],
          "Équipement sur voie": [2, 8],
          // Immobilier — k€ annuel exploitation
          "Bâtiment majeur": [120, 480],
          CVC: [25, 85],
          "Monte-charge": [12, 35],
          "Porte ferroviaire": [5, 18],
          "Charpente/Couverture": [8, 30],
          // IO — k€ annuel maintenance
          "Tour en fosse": [35, 80],
          "Vérin en fosse": [18, 45],
          "Banc d'essieu": [10, 30],
          "Pont roulant": [15, 40],
          "Machine à laver": [12, 35],
          "Production air": [8, 25],
          "Caténaire escamotable": [20, 55],
          // Courants faibles
          SSI: [15, 45],
          "Contrôle d'accès": [8, 22],
          "Télécom réseau": [5, 15],
          // PI
          "Logiciel métier": [80, 350],
          Brevet: [5, 25],
          "Licence technique": [10, 60],
          // Gares/Lignes
          Escabelle: [1, 4],
          Estacade: [2, 8],
          "Éclairage voies": [3, 12],
        };
        const costRange = FAMILY_COSTS[family.famille] || [10, 50];
        const baseCostK = randomBetween(costRange[0], costRange[1]);
        const baseCost = baseCostK * 1000;
        // grossRevenue = valeur d'achat (affichée quand toggle = "Val. achat")
        // netRevenue = valeur résiduelle (affichée quand toggle = "Val. résid.")
        // Le coût maintenance annuel est dans baseCost, stocké aussi dans serviceOffering2Pct
        const maintenanceCost =
          criticity === "critique"
            ? Math.round(baseCost * 1.3)
            : criticity === "moderee"
              ? baseCost
              : Math.round(baseCost * 0.8);

        // Dates
        const acquisitionDate = randomDate("2005-01-01", "2023-12-31");
        const lastVr = randomDate("2024-06-01", "2026-03-15");
        const nextVrOffsetDays = criticity === "critique" ? randomBetween(30, 180) : randomBetween(180, 730);
        const nextVr = addDays(lastVr, nextVrOffsetDays);

        // Responsible GAIF team member (by patrimoine dominance)
        const specialists = GAIF_EMPLOYEES.filter((e) => e.serviceLine === patrimoine);
        const fallback = GAIF_EMPLOYEES.filter((e) => e.serviceLine === "Transverse");
        const responsable = specialists.length > 0 ? randomFrom(specialists) : randomFrom(fallback);
        const partner = GAIF_EMPLOYEES.find((e) => e.empId === "GAIF001")!;
        // Responsable mission (em) — un opérationnel du même patrimoine, différent du responsable.
        // Priorité aux chargés de mission / experts juniors (Consultant/Senior Consultant) pour refléter le terrain.
        const missionCandidates = specialists.filter(
          (e) => e.empId !== responsable.empId && (e.grade === "Consultant" || e.grade === "Senior Consultant")
        );
        const responsableMission =
          missionCandidates.length > 0
            ? randomFrom(missionCandidates)
            : specialists.find((e) => e.empId !== responsable.empId) || responsable;

        // Prestataire
        const prestatairePool = PRESTATAIRES[patrimoine] || ["Interne SNCF"];
        const prestataire = Math.random() < 0.7 ? randomFrom(prestatairePool) : null;

        // Asset name
        const numRef = `${String(assetIndex).padStart(4, "0")}`;
        const sousFam = randomFrom(family.sousFamilles);
        const name = `${sousFam} ${numRef}`;

        // Mapping final :
        //   subSegmentCode = Patrimoine (6 valeurs, niveau 0 — sidebar gauche « Patrimoines »)
        //   subSegment     = Famille (~19 valeurs, niveau -1 expandable)
        //   serviceLine1   = Nom du site (technicentre / SMR / SMGL), niveau 0 — sidebar « Unit »
        //   serviceLine2   = Patrimoine (pour rétrocompat charts)
        //   serviceLine3   = Famille
        //   engagementType = criticité
        const critLabel = criticity === "critique" ? "Critique" : criticity === "moderee" ? "Modérée" : "Non critique";

        // Calcul valeur d'achat et résiduelle
        const valeurs = (() => {
          const VALEUR_NEUF_MULT: Record<string, [number, number]> = {
            "Bâtiment majeur": [20, 40],
            "Poste aiguillage": [15, 35],
            "Tour en fosse": [10, 25],
            ADV: [8, 18],
            "Vérin en fosse": [8, 15],
            CVC: [5, 12],
            "Monte-charge": [6, 12],
            Caténaire: [8, 16],
            "Caténaire escamotable": [10, 20],
            Signalisation: [6, 14],
            "Pont roulant": [8, 15],
            "Machine à laver": [5, 10],
            "Production air": [5, 10],
            "Banc d'essieu": [6, 12],
            SSI: [4, 10],
            "Contrôle d'accès": [3, 8],
            "Logiciel métier": [2, 5],
            Escabelle: [3, 6],
            Estacade: [4, 8],
            "Éclairage voies": [3, 7],
          };
          const mult = VALEUR_NEUF_MULT[family.famille] || [5, 12];
          const valeurNeuf = baseCost * randomBetween(mult[0], mult[1]);
          const ageYears = new Date().getFullYear() - new Date(acquisitionDate).getFullYear();
          const dureeVie = patrimoine === "Immobilier" ? 40 : patrimoine === "Ferroviaire" ? 30 : 20;
          const residualPct = Math.max(0, Math.min(1, 1 - ageYears / dureeVie));
          return {
            achat: Math.round(valeurNeuf),
            resid: Math.round(valeurNeuf * residualPct),
          };
        })();

        // Taux d'utilisation (temps utilisé / temps dispo) — distinct de winPct (disponibilité).
        // Actifs critiques très sollicités (80-95%), autres plus variables (40-85%).
        const utilizationPct =
          status === 15
            ? randomBetween(5, 30)
            : status === 1
              ? 0
              : criticity === "critique"
                ? randomBetween(78, 95)
                : criticity === "moderee"
                  ? randomBetween(55, 85)
                  : randomBetween(30, 70);

        // Nombre d'incidents/AT sur 12 mois glissants
        // Actifs critiques 0-3, modérés 0-2, non critiques 0-1
        const incidents12m =
          criticity === "critique"
            ? Math.random() < 0.15
              ? randomBetween(1, 3)
              : 0
            : criticity === "moderee"
              ? Math.random() < 0.08
                ? randomBetween(1, 2)
                : 0
              : Math.random() < 0.04
                ? 1
                : 0;

        // Consommations RSE (PSGA axe 2 — conformité RSE / décrets BACS, Tertiaire, CEPIA)
        // Eau : uniquement immobilier, m³/an
        // Électricité : immobilier (kWh/m²/an) et IO (kWh/an)
        // Gaz : uniquement immobilier, kWh/an
        const consoMetrics = (() => {
          if (patrimoine === "Immobilier") {
            return {
              consoEau: randomBetween(120, 800), // m³/an
              consoElec: randomBetween(45, 180), // kWh/m²/an (décret tertiaire cible ~85)
              consoGaz: randomBetween(5000, 60000), // kWh/an
              surfaceM2: randomBetween(80, 2500),
            };
          }
          if (patrimoine === "IO") {
            return {
              consoEau: 0,
              consoElec: randomBetween(2000, 45000), // kWh/an
              consoGaz: 0,
              surfaceM2: 0,
            };
          }
          return { consoEau: 0, consoElec: 0, consoGaz: 0, surfaceM2: 0 };
        })();

        // MTBF / MTTR — pertinent surtout pour IO et Ferroviaire (selon Prescription criticité IO)
        // MTBF en heures, MTTR en heures
        const reliability = (() => {
          if (patrimoine !== "IO" && patrimoine !== "Ferroviaire") return { mtbf: 0, mttr: 0 };
          const baseMtbf =
            criticity === "critique"
              ? randomBetween(4000, 12000) // > 6 mois
              : criticity === "moderee"
                ? randomBetween(800, 4000) // ~1-6 mois
                : randomBetween(150, 800); // < 1 mois
          const baseMttr =
            criticity === "critique"
              ? randomBetween(2, 8) // < 24h
              : criticity === "moderee"
                ? randomBetween(6, 24)
                : randomBetween(12, 48);
          return { mtbf: baseMtbf, mttr: baseMttr };
        })();

        // État ABE — spécifique patrimoine immobilier (source : Note inventaire)
        // Distribution réelle SNCF : 55% Satisfaisant, 25% Acceptable, 11% Moyen, 1% Insuffisant, 8% Non Visité/Concerné
        const etatAbe = (() => {
          if (patrimoine !== "Immobilier") return null;
          const roll = Math.random();
          if (roll < 0.55) return "Satisfaisant";
          if (roll < 0.8) return "Acceptable";
          if (roll < 0.91) return "Moyen";
          if (roll < 0.93) return "Insuffisant";
          if (roll < 0.99) return "Non Visité";
          return "Non Concerné";
        })();

        // Commentaire lisible (les métriques sont stockées en colonnes natives depuis la refonte #28)
        const humanComment =
          status === 15
            ? "Actif en fin de vie — remplacement programmé"
            : cm1Pct < 90
              ? `Non-conformité en cours de traitement — criticité ${critLabel}`
              : `Criticité ${critLabel}`;

        actifs.push({
          opportunityId: `ACT-${patrimoine.slice(0, 4).toUpperCase()}-${numRef}`,
          opportunity: name,
          accountId: site.accountId,
          account: site.name,
          status,
          grossRevenue: valeurs.achat, // Toggle OFF → valeur d'achat dans les graphiques
          netRevenue: valeurs.resid, // Toggle ON → valeur résiduelle dans les graphiques
          winPct,
          cm1Pct,
          jobCode: `GAIF-${patrimoine.slice(0, 3).toUpperCase()}-${numRef}`,
          engagementType: `Criticité ${critLabel}`,
          weightedBooking: valeurs.resid, // Aussi dans weightedBooking pour la carte
          valeurAchat: valeurs.achat, // Pour serviceOffering1Pct
          maintenanceCost, // Pour serviceOffering2Pct (coût maintenance annuel)
          manager: responsable.name,
          managerId: responsable.empId,
          em: responsableMission.name,
          emId: responsableMission.empId,
          ep: partner.name,
          country: "France",
          region: site.region,
          segmentCode: site.parent, // TN / TER / IC (pour couleurs segment)
          subSegmentCode: patrimoine, // Patrimoine (niveau 0 sidebar gauche)
          subSegment: family.famille, // Famille (niveau -1 expandable)
          serviceLine1: site.name, // Nom du site → sidebar Unit groupe par BU
          serviceLine2: patrimoine,
          serviceLine3: family.famille,
          serviceOffering1: randomFrom(MISSIONS_SOCLES),
          creationDate: acquisitionDate,
          bookingDate: lastVr,
          estimatedBookingDate: nextVr,
          lastStatusChangeDate: lastVr,
          partner: prestataire,
          lostComment: humanComment,
          // GAIF native metrics (colonnes natives, remplace ::META:: JSON)
          utilizationPct,
          incidents12m,
          consoEau: consoMetrics.consoEau,
          consoElec: consoMetrics.consoElec,
          consoGaz: consoMetrics.consoGaz,
          surfaceM2: consoMetrics.surfaceM2,
          mtbf: reliability.mtbf,
          mttr: reliability.mttr,
          etatAbe,
        });

        assetIndex++;
        if (actifs.filter((a) => a.serviceLine1 === patrimoine).length >= targetVolume) break;
      }
      if (actifs.filter((a) => a.serviceLine1 === patrimoine).length >= targetVolume) break;
    }
  }

  return actifs;
}

function generateAssignments(actifs: ReturnType<typeof generateActifs>) {
  const assignments: Array<{
    empId: string;
    jobNo: string;
    jobName: string;
    category: string;
    startDate: string;
    endDate: string;
    utilization: number;
    hoursPerDay: number;
  }> = [];

  // Catégories utilisées (BP canoniques, nécessaires pour CHARGEABLE_CATS / TRAINING_CATS / ABSENCE_CATS) :
  //   chargeable    = pilotage d'actif / contrat (missions facturables BU)
  //   generalOppty  = projet d'investissement (MOA émergence/CEB/réalisation)
  //   nonChargeable = activité transverse (COPAT, PSGA, audit interne)
  //   training      = formation / montée en compétences
  //   otherAbsence  = absence

  // 1. Projets d'investissement majeurs
  for (const proj of GAIF_PROJECTS) {
    const perPersonUtil = Math.floor(70 / proj.team.length);
    for (const empId of proj.team) {
      const util = empId === proj.lead ? perPersonUtil + 20 : perPersonUtil;
      assignments.push({
        empId,
        jobNo: proj.id,
        jobName: `${proj.patrimoine} — ${proj.name}`,
        category: "generalOppty",
        startDate: proj.startDate,
        endDate: proj.endDate,
        utilization: Math.min(util, 80),
        hoursPerDay: 8,
      });
    }
  }

  // 2. Pilotage de contrats prestataires
  for (const contract of GAIF_CONTRACTS) {
    assignments.push({
      empId: contract.manager,
      jobNo: contract.id,
      jobName: `${contract.patrimoine} — Contrat ${contract.prestataire}`,
      category: "chargeable",
      startDate: contract.startDate,
      endDate: contract.endDate,
      utilization: randomBetween(10, 25),
      hoursPerDay: 8,
    });
  }

  // 3. Pilotage d'actifs critiques (experts qui suivent des équipements critiques)
  // Note : expert.serviceLine = patrimoine (Immobilier, Ferroviaire, …) — doit matcher
  // asset.subSegmentCode (ou asset.serviceLine2 = patrimoine), PAS asset.serviceLine1 (site).
  const criticalActifs = actifs.filter((a) => a.engagementType === "Criticité Critique");
  const experts = GAIF_EMPLOYEES.filter((e) => e.grade === "Senior Consultant");
  for (const expert of experts) {
    const theirPatrimoine = expert.serviceLine;
    const relevantAssets = criticalActifs.filter((a) => a.subSegmentCode === theirPatrimoine).slice(0, 3);
    for (const asset of relevantAssets) {
      assignments.push({
        empId: expert.empId,
        jobNo: asset.opportunityId,
        jobName: `${theirPatrimoine} — ${asset.opportunity.split(" — ")[0]}`,
        category: "chargeable",
        startDate: "2025-10-01",
        endDate: "2026-12-31",
        utilization: randomBetween(5, 15),
        hoursPerDay: 8,
      });
    }
  }

  // 3b. Historique — affectations passées sur actifs (pour la section « Affectations passées »).
  // Couvre 2024-2025 sur des actifs variés (pas seulement critiques) — chaque expert a eu
  // 2 à 4 missions historiques sur son patrimoine pour refléter la mémoire terrain.
  const PAST_WINDOWS: Array<{ start: string; end: string }> = [
    { start: "2024-03-01", end: "2024-09-30" },
    { start: "2024-06-01", end: "2024-12-31" },
    { start: "2024-09-01", end: "2025-03-31" },
    { start: "2025-01-01", end: "2025-06-30" },
    { start: "2025-04-01", end: "2025-09-30" },
  ];
  for (const expert of experts) {
    const theirPatrimoine = expert.serviceLine;
    const pool = actifs.filter((a) => a.subSegmentCode === theirPatrimoine);
    if (pool.length === 0) continue;
    // 2 à 4 missions passées par expert — sous-ensemble aléatoire d'actifs du patrimoine.
    const historyCount = randomBetween(2, 4);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, historyCount);
    for (const asset of shuffled) {
      const window = randomFrom(PAST_WINDOWS);
      assignments.push({
        empId: expert.empId,
        jobNo: asset.opportunityId,
        jobName: `${theirPatrimoine} — ${asset.opportunity.split(" — ")[0]} (rétrospective)`,
        category: "chargeable",
        startDate: window.start,
        endDate: window.end,
        utilization: randomBetween(8, 20),
        hoursPerDay: 8,
      });
    }
  }
  // Missions passées sur actifs pour les Consultants / Managers aussi, afin que chaque
  // actif (ou presque) ait un historique consultable.
  const operationnels = GAIF_EMPLOYEES.filter((e) => e.grade === "Consultant" || e.grade === "Manager");
  for (const emp of operationnels) {
    const theirPatrimoine = emp.serviceLine;
    const pool = actifs.filter((a) => a.subSegmentCode === theirPatrimoine);
    if (pool.length === 0) continue;
    const historyCount = randomBetween(1, 3);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, historyCount);
    for (const asset of shuffled) {
      const window = randomFrom(PAST_WINDOWS);
      assignments.push({
        empId: emp.empId,
        jobNo: asset.opportunityId,
        jobName: `${theirPatrimoine} — ${asset.opportunity.split(" — ")[0]} (suivi)`,
        category: "chargeable",
        startDate: window.start,
        endDate: window.end,
        utilization: randomBetween(5, 18),
        hoursPerDay: 8,
      });
    }
  }

  // 3c. Affectations en cours pour Consultants & Managers (pour que les nouveaux ETP aient
  // aussi des missions visibles dans « Affectations en cours »).
  for (const emp of operationnels) {
    const theirPatrimoine = emp.serviceLine;
    const pool = actifs.filter(
      (a) => a.subSegmentCode === theirPatrimoine && a.engagementType !== "Criticité Non critique"
    );
    if (pool.length === 0) continue;
    const currentCount = randomBetween(1, 3);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, currentCount);
    for (const asset of shuffled) {
      assignments.push({
        empId: emp.empId,
        jobNo: asset.opportunityId,
        jobName: `${theirPatrimoine} — ${asset.opportunity.split(" — ")[0]}`,
        category: "chargeable",
        startDate: "2025-11-01",
        endDate: "2026-12-31",
        utilization: randomBetween(6, 18),
        hoursPerDay: 8,
      });
    }
  }

  // 4. Activités transverses
  const transverseActivities = [
    { id: "TRANS-PSGA", label: "Transverse — Rédaction PSGA v2", emps: ["GAIF003", "GAIF004"], util: 15 },
    { id: "TRANS-COPAT", label: "Transverse — Animation COPAT IDF", emps: ["GAIF005"], util: 20 },
    { id: "TRANS-IDFM", label: "Transverse — COTECH GAIF avec IDFM", emps: ["GAIF001", "GAIF005"], util: 8 },
    { id: "TRANS-RSE", label: "Transverse — COPIL RSE avec SG TN", emps: ["GAIF008"], util: 10 },
    { id: "TRANS-AUDIT", label: "Transverse — Audit ISO 55001 interne", emps: ["GAIF003", "GAIF004"], util: 12 },
    { id: "TRANS-REP-CLIENT", label: "Transverse — Relation clients TC & SD", emps: ["GAIF005"], util: 25 },
    {
      id: "TRANS-GMAO-DATA",
      label: "Transverse — Mise en qualité données GMAO",
      emps: ["GAIF010", "GAIF011"],
      util: 15,
    },
  ];
  for (const act of transverseActivities) {
    for (const empId of act.emps) {
      assignments.push({
        empId,
        jobNo: act.id,
        jobName: act.label,
        category: "nonChargeable",
        startDate: "2025-09-01",
        endDate: "2026-12-31",
        utilization: act.util,
        hoursPerDay: 8,
      });
    }
  }

  // 5. Absences for realism
  const ABSENCES = [
    { cat: "otherAbsence", name: "Congés", dur: 10 },
    { cat: "otherAbsence", name: "Congés", dur: 7 },
    { cat: "training", name: "Formation ISO 55001", dur: 5 },
    { cat: "training", name: "Formation GMAO", dur: 3 },
  ];
  for (const emp of GAIF_EMPLOYEES) {
    if (emp.departure) continue;
    for (const abs of ABSENCES.slice(0, randomBetween(2, 4))) {
      const start = randomDate("2025-10-01", "2026-11-01");
      assignments.push({
        empId: emp.empId,
        jobNo: `ABS-${emp.empId}-${Math.random().toString(36).slice(2, 6)}`,
        jobName: abs.name,
        category: abs.cat,
        startDate: start,
        endDate: addDays(start, abs.dur),
        utilization: 100,
        hoursPerDay: 8,
      });
    }
  }

  return assignments;
}

function generateSkills() {
  const skills: Array<{ empId: string; name: string; level: number; category: string }> = [];
  for (const [empId, empSkills] of Object.entries(SKILL_BY_EMPLOYEE)) {
    for (const s of empSkills) {
      const cat = GAIF_SKILLS_CATALOG.find((c) => c.name === s.name)?.category || "Transverse";
      skills.push({ empId, name: s.name, level: s.level, category: cat });
    }
  }
  return skills;
}

function generateNonConformites(actifs: ReturnType<typeof generateActifs>) {
  const nc: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
    poste: string;
    gradeBucket: string;
    note: number;
    creationDate: string;
    hrInterview: string | null;
    recruiter1: string;
    recruiter1Date: string | null;
    recruiter1Decision: string | null;
    recruiter1EmpId: string;
    grade: string;
  }> = [];

  // Non-conforming actifs first (low conformity rate)
  const nonConformes = actifs.filter((a) => a.cm1Pct < 95);
  const sampled = nonConformes.slice(0, 80);

  const NC_STATUSES = ["detectee", "en_analyse", "plan_action", "en_traitement", "resolue"];
  const NC_TYPES = ["VR en retard", "Défaut technique", "Non-conformité réglementaire", "Écart audit ISO 55001"];

  let ncIndex = 1;
  for (const asset of sampled) {
    const status = NC_STATUSES[Math.min(ncIndex % NC_STATUSES.length, 4)];
    const severity =
      asset.subSegmentCode === "critique"
        ? randomFrom(["majeure", "critique"])
        : asset.subSegmentCode === "moderee"
          ? randomFrom(["moyenne", "majeure"])
          : randomFrom(["mineure", "moyenne"]);
    const type = randomFrom(NC_TYPES);
    const detectionDate = randomDate("2025-09-01", "2026-03-15");
    const analysisDate = status !== "detectee" ? addDays(detectionDate, randomBetween(3, 15)) : null;
    const responsable = GAIF_EMPLOYEES.find((e) => e.empId === asset.managerId) || GAIF_EMPLOYEES[0];

    nc.push({
      id: `NC-${String(ncIndex).padStart(4, "0")}`,
      firstName: asset.opportunity.split(" — ")[0] || "Actif",
      lastName: asset.serviceLine1,
      email: asset.opportunityId,
      status,
      poste: severity,
      gradeBucket: type,
      note: randomBetween(3, 9),
      creationDate: detectionDate,
      hrInterview: analysisDate,
      recruiter1: responsable.name,
      recruiter1Date: analysisDate,
      recruiter1Decision: status === "resolue" ? "Résolue" : status === "en_traitement" ? "En cours" : null,
      recruiter1EmpId: responsable.empId,
      grade: status,
    });
    ncIndex++;
  }
  return nc;
}

function generateStaffingNeeds(actifs: ReturnType<typeof generateActifs>) {
  // Besoins liés à différents actifs/projets pour réalisme
  const getActif = (i: number) => actifs[i % actifs.length]?.opportunityId || "ACT-GENERIC";
  const mk = (
    id: string,
    oppIdx: number,
    grade: string,
    qty: number,
    skills: string[],
    desc: string,
    util = 100,
    start = "2026-06-01",
    end = "2027-05-31",
    status = "open"
  ) => ({
    id,
    opportunityId: getActif(oppIdx),
    grade,
    quantity: qty,
    utilization: util,
    startDate: start,
    endDate: end,
    skills: JSON.stringify(skills),
    description: desc,
    status,
  });
  return [
    // ── Besoins immédiats (Q2-Q3 2026) — liés à des projets en cours ──
    mk(
      "NEED-001",
      0,
      "Senior Consultant",
      1,
      ["ISO 55001 auditeur"],
      "Expert ISO 55001 auditeur interne pour accompagnement certification SVCO",
      100,
      "2026-05-01",
      "2027-04-30"
    ),
    mk(
      "NEED-002",
      5,
      "Senior Consultant",
      1,
      ["Contract management TSO/SFERIS"],
      "Expert contract management pour pilotage externalisation maintenance ferroviaire",
      100,
      "2026-04-01",
      "2027-03-31"
    ),
    mk(
      "NEED-003",
      10,
      "Consultant",
      1,
      ["GTB / Décret BACS"],
      "Expert GTB / décret BACS pour déploiement patrimoine immobilier SMR",
      80,
      "2026-05-01",
      "2027-04-30"
    ),
    mk(
      "NEED-004",
      15,
      "Manager",
      1,
      ["PMO", "Animation COPAT"],
      "PMO renforcé pour anticiper départ Vincent MOREL Q3 2026",
      100,
      "2026-07-01",
      "2028-06-30"
    ),

    // ── Besoins de montée en charge TER/IC (Q3-Q4 2026) ──
    mk(
      "NEED-005",
      20,
      "Senior Consultant",
      2,
      ["Voies & ADV", "PIVOS"],
      "2 chargés mission TER pour couverture sites Aura/Occitanie",
      100,
      "2026-09-01",
      "2028-08-31"
    ),
    mk(
      "NEED-006",
      25,
      "Consultant",
      1,
      ["Maximo v9 déploiement", "MTBF / MTTR"],
      "Chargé mission IO pour généralisation Maximo v9 sur 6 technicentres TER",
      100,
      "2026-07-01",
      "2027-12-31"
    ),
    mk(
      "NEED-007",
      30,
      "Senior Consultant",
      1,
      ["MOA bâtimentaire", "Cartographie immobilière"],
      "Expert immobilier pour piloter trajectoire MCO TER Sud",
      80,
      "2026-09-01",
      "2028-05-31"
    ),
    mk(
      "NEED-008",
      35,
      "Consultant",
      1,
      ["Relation IDFM/AOT"],
      "Chargé relation clients technicentres pour renforcer animation COPAT",
      100,
      "2026-08-01",
      "2027-07-31"
    ),

    // ── Besoins data & reporting (2027) ──
    mk(
      "NEED-009",
      40,
      "Consultant",
      1,
      ["Data analyst patrimoine", "BI", "Power BI"],
      "Data analyst patrimoine pour industrialiser le reporting KPIs PSGA",
      100,
      "2026-10-01",
      "2027-12-31"
    ),
    mk(
      "NEED-010",
      45,
      "Senior Consultant",
      1,
      ["Matrice de criticité", "ISO 55001 manager"],
      "Expert criticité transverse pour harmoniser méthodologie sur les 6 patrimoines",
      80,
      "2026-06-01",
      "2028-05-31"
    ),

    // ── Besoins de remplacement et succession ──
    mk(
      "NEED-011",
      50,
      "Consultant",
      1,
      ["CGI foncier", "Désimbrication sites"],
      "Chargé mission foncier junior pour appuyer Céline ROUSSEAU (charge à 110%)",
      100,
      "2026-06-01",
      "2027-05-31"
    ),
    mk(
      "NEED-012",
      55,
      "Consultant",
      1,
      ["RSE & économie circulaire", "Décret tertiaire"],
      "Chargé mission RSE pour conformité décret tertiaire et CEPIA sur parc immobilier",
      80,
      "2026-09-01",
      "2027-08-31"
    ),

    // ── Besoins spécifiques IC ──
    mk(
      "NEED-013",
      60,
      "Senior Consultant",
      1,
      ["Signalisation BAL/BAPR", "Contractualisation SNCF Réseau"],
      "Expert ferroviaire IC pour pilotage maintenance sans SNCF Réseau sur sites IC",
      100,
      "2027-01-01",
      "2028-12-31"
    ),

    // ── Besoins en cours de traitement (non ouverts) ──
    mk(
      "NEED-014",
      65,
      "Consultant",
      1,
      ["Maximo v8", "Maximo v9 déploiement"],
      "Technicien GMAO pour mise en qualité données IO — site pilote Noisy (en cours recrutement)",
      100,
      "2026-04-15",
      "2026-12-31",
      "in_progress"
    ),
    mk(
      "NEED-015",
      70,
      "Senior Consultant",
      1,
      ["Caténaires & EALE", "Design book voies de service"],
      "Expert caténaire pour régénération TPSL Achères (candidat identifié)",
      80,
      "2026-06-01",
      "2027-05-31",
      "in_progress"
    ),

    // ── Besoins pourvus (historique) ──
    mk(
      "NEED-016",
      75,
      "Consultant",
      1,
      ["Audit interne"],
      "Auditeur interne ISO 55001 — mission ponctuelle SVCO (pourvu)",
      100,
      "2025-11-01",
      "2026-04-30",
      "filled"
    ),
    mk(
      "NEED-017",
      80,
      "Manager",
      1,
      ["RAO / AO / CEB"],
      "Responsable projet EMG pour appui RAO TER Aura (pourvu)",
      100,
      "2025-10-01",
      "2026-09-30",
      "filled"
    ),
    mk(
      "NEED-018",
      85,
      "Consultant",
      1,
      ["Tour en fosse", "Vérin en fosse"],
      "Technicien IO spécialiste tours en fosse — renfort TM VSG (pourvu)",
      100,
      "2025-09-01",
      "2026-06-30",
      "filled"
    ),
  ];
}

function generateUserActions(actifs: ReturnType<typeof generateActifs>) {
  // Initiatives d'industrialisation racontées comme user_actions associées à des actifs
  const initiatives = [
    {
      description: "Finaliser la rédaction du processus de cycle de vie (ferroviaire)",
      owner: "Julien MOREAU",
      due: "2026-05-31",
      priority: "high",
      status: "in_progress",
    },
    {
      description: "Formaliser RACI ISO 55001 avec DET",
      owner: "Sophie DUBOIS",
      due: "2026-04-30",
      priority: "high",
      status: "in_progress",
    },
    {
      description: "Déployer Maximo v9 sur site pilote Noisy",
      owner: "Isabelle GIRARD",
      due: "2026-06-30",
      priority: "high",
      status: "in_progress",
    },
    {
      description: "Généraliser Maximo v9 sur TM Villeneuve",
      owner: "Antoine FAURE",
      due: "2026-09-30",
      priority: "high",
      status: "open",
    },
    {
      description: "Produire guide bonnes pratiques GMAO",
      owner: "Isabelle GIRARD",
      due: "2026-07-15",
      priority: "medium",
      status: "in_progress",
    },
    {
      description: "Mettre à jour le PSGA v2",
      owner: "Julien MOREAU",
      due: "2026-05-31",
      priority: "high",
      status: "in_progress",
    },
    {
      description: "Auditer la conformité ISO 55001 SVCO",
      owner: "Sophie DUBOIS",
      due: "2026-11-30",
      priority: "high",
      status: "open",
    },
    {
      description: "Structurer interfaces Technicentres ↔ GAIF",
      owner: "Nicolas PETIT",
      due: "2026-06-30",
      priority: "medium",
      status: "open",
    },
    {
      description: "Présenter catalogue de services DET TER/IC",
      owner: "Caroline MARTIN",
      due: "2026-03-31",
      priority: "high",
      status: "in_progress",
    },
    {
      description: "Déployer GTB sur SMR Massy (Décret BACS)",
      owner: "Laurent MERCIER",
      due: "2026-12-31",
      priority: "high",
      status: "in_progress",
    },
    {
      description: "Contractualiser E2MT extension SMGL",
      owner: "Laurent MERCIER",
      due: "2026-05-31",
      priority: "medium",
      status: "open",
    },
    {
      description: "Mettre en place méthode priorisation investissements",
      owner: "Julien MOREAU",
      due: "2026-06-30",
      priority: "medium",
      status: "open",
    },
    {
      description: "Base consolidée patrimoine (ferroviaire + immo + IO)",
      owner: "Nicolas PETIT",
      due: "2027-03-31",
      priority: "medium",
      status: "open",
    },
    {
      description: "Rédiger doctrine transfert d'actifs ouverture concurrence",
      owner: "Céline ROUSSEAU",
      due: "2026-06-30",
      priority: "high",
      status: "in_progress",
    },
    {
      description: "Finaliser désimbrication Blancarde BU PACA",
      owner: "Céline ROUSSEAU",
      due: "2027-03-31",
      priority: "high",
      status: "open",
    },
    {
      description: "Construire feuille de route Immo avec DI",
      owner: "Laurent MERCIER",
      due: "2026-06-30",
      priority: "medium",
      status: "in_progress",
    },
    {
      description: "Animation bimestrielle COPIL Immo",
      owner: "Laurent MERCIER",
      due: "2026-12-31",
      priority: "medium",
      status: "in_progress",
    },
    {
      description: "Harmoniser matrice de criticité 3 patrimoines",
      owner: "Julien MOREAU",
      due: "2026-09-30",
      priority: "medium",
      status: "in_progress",
    },
    {
      description: "Outil pilotage trajectoires immobilières",
      owner: "Laurent MERCIER",
      due: "2026-12-31",
      priority: "medium",
      status: "open",
    },
    {
      description: "Renforcer gouvernance COPIL Interfaces SNCF Réseau",
      owner: "Nicolas PETIT",
      due: "2026-06-30",
      priority: "medium",
      status: "open",
    },
  ];

  const actions = [];
  for (let i = 0; i < initiatives.length; i++) {
    const asset = actifs[i % actifs.length];
    actions.push({
      id: `ACT-INIT-${String(i + 1).padStart(3, "0")}`,
      opportunityId: asset.opportunityId,
      description: initiatives[i].description,
      owner: initiatives[i].owner,
      dueDate: initiatives[i].due,
      priority: initiatives[i].priority,
      status: initiatives[i].status,
    });
  }
  return actions;
}

// ── Interventions (pour le BookingsTab / Maintenance) ──

const INTERVENTION_TYPES = [
  "VR",
  "VR",
  "VR",
  "Préventive",
  "Préventive",
  "Préventive",
  "Corrective",
  "Corrective",
  "Audit",
];
const INTERVENTION_LABELS: Record<string, string[]> = {
  VR: [
    "VR annuelle",
    "VR quinquennale",
    "VR semestrielle",
    "VR électrique",
    "VR mécanique",
    "Vérification réglementaire",
  ],
  Préventive: [
    "Maintenance préventive",
    "Remplacement programmé",
    "Graissage / lubrification",
    "Contrôle périodique",
    "Inspection visuelle",
  ],
  Corrective: ["Réparation urgente", "Remplacement composant défaillant", "Remise en état suite incident", "Dépannage"],
  Audit: ["Audit conformité ISO 55001", "Audit sécurité", "Inspection technique approfondie", "Audit énergétique"],
};

function generateInterventions(actifs: ReturnType<typeof generateActifs>) {
  const interventions = [];
  const physicalSites = GAIF_SITES.filter((s) => !s.accountId.startsWith("EXT"));

  for (let i = 0; i < 400; i++) {
    const type = randomFrom(INTERVENTION_TYPES);
    const label = randomFrom(INTERVENTION_LABELS[type]);
    const actif = randomFrom(actifs);
    const site = physicalSites.find((s) => s.accountId === actif.accountId) || randomFrom(physicalSites);
    const responsable = randomFrom(GAIF_EMPLOYEES);
    const prestatairePool = PRESTATAIRES[actif.serviceLine2 || "Ferroviaire"] || ["Interne SNCF"];
    const prestataire = randomFrom(prestatairePool);

    // Distribution des statuts : 40% réalisées, 30% planifiées, 20% en préparation, 10% annulées
    const statusRoll = Math.random();
    const status = statusRoll < 0.4 ? 14 : statusRoll < 0.7 ? 1 : statusRoll < 0.9 ? 4 : 15;

    // Dates cohérentes
    const creationDate = randomDate("2025-01-01", "2026-03-15");
    const planDate = addDays(creationDate, randomBetween(15, 120));
    const realDate = status === 14 ? addDays(planDate, randomBetween(-5, 15)) : null;
    // Coûts réalistes par type d'intervention (€ HT, benchmarks maintenance industrielle ferroviaire)
    const cost =
      type === "VR"
        ? randomBetween(800, 6000) // VR : 800€ (simple) à 6 000€ (quinquennale)
        : type === "Préventive"
          ? randomBetween(1500, 12000) // Préventive : 1 500€ à 12 000€
          : type === "Corrective"
            ? randomBetween(3000, 45000) // Corrective : 3 000€ à 45 000€ (pièces + urgence)
            : randomBetween(8000, 25000); // Audit : 8 000€ à 25 000€
    // Durées réalistes (heures de main-d'œuvre)
    const hours =
      type === "VR"
        ? randomBetween(4, 16)
        : type === "Préventive"
          ? randomBetween(8, 32)
          : type === "Corrective"
            ? randomBetween(8, 120)
            : randomBetween(16, 56);

    interventions.push({
      opportunityId: `INTV-${String(i + 1).padStart(4, "0")}`,
      opportunity: `${label} — ${actif.opportunity.split(" — ")[0]}`,
      accountId: site.accountId,
      account: site.name,
      status,
      // Pour les interventions, grossRevenue = netRevenue = coût de l'intervention (€).
      // Le toggle « Val. achat / Val. résid. » ne s'applique pas ici — afficher le même
      // coût dans les deux cas évite les écarts trompeurs dans l'onglet Maintenance.
      grossRevenue: cost,
      netRevenue: cost,
      intervHours: hours,
      winPct: status === 14 ? (Math.random() < 0.85 ? 100 : 0) : 0, // 85% conformes si réalisées
      cm1Pct: type === "VR" ? 5 : type === "Corrective" ? 1 : type === "Audit" ? 4 : 3, // Priorité 1-5
      engagementType: type,
      bookingDate: realDate,
      estimatedBookingDate: planDate,
      creationDate,
      serviceLine1: site.name,
      serviceLine2: actif.serviceLine2 || "Ferroviaire",
      subSegmentCode: actif.subSegmentCode,
      subSegment: actif.subSegment,
      segmentCode: site.parent,
      manager: responsable.name,
      partner: prestataire,
      lostComment: actif.opportunityId, // Ref vers l'actif source
      country: "France",
      region: site.region,
    });
  }
  return interventions;
}

// ── SAP Records (historique jour par jour pour le staffing tab) ──

const GAIF_ACTIVITY_TYPES: Record<string, string> = {
  Director: "MAGR09",
  "Senior Manager": "MAGR08",
  Manager: "MAGR07",
  "Senior Consultant": "MAGR5A",
  Consultant: "MAGR03",
};

function generateSapRecords(actifs: ReturnType<typeof generateActifs>) {
  const records: Array<{
    empId: string;
    date: string;
    name: string;
    salesOrder: string | null;
    salesOrderItem: string | null;
    hours: number;
    category: string;
    activityType: string;
    text: string;
  }> = [];

  const activeActifs = actifs.filter((a) => [11, 14].includes(a.status));
  const activeEmployees = GAIF_EMPLOYEES.filter((e) => !e.departure || e.departure > "2025-01-01");

  // Historique SAP : jan 2025 → mi-avril 2026 (~330 jours ouvrés × 16 employés ≈ 5000+ lignes)
  const start = new Date("2025-01-06");
  const end = new Date("2026-04-15");

  for (const emp of activeEmployees) {
    const isExec = emp.grade === "Director";
    const hpd = 8;
    const actType = GAIF_ACTIVITY_TYPES[emp.grade] || "MAGR03";

    // Chaque employé a 2-3 projets principaux pour cohérence
    const primaryActif = randomFrom(activeActifs);
    const secondaryActif = randomFrom(activeActifs);

    const d = new Date(start);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        const dateStr = d.toISOString().slice(0, 10);
        if (dateStr >= emp.arrival && (!emp.departure || dateStr <= emp.departure)) {
          const roll = Math.random();
          if (isExec) {
            // Direction : 35% pilotage actif, 25% cadrage/RAO, 20% transverse, 10% formation, 10% absence
            if (roll < 0.35) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: primaryActif.jobCode,
                salesOrderItem: "10",
                hours: hpd,
                category: "chargeable",
                activityType: actType,
                text: primaryActif.opportunity.slice(0, 40),
              });
            } else if (roll < 0.6) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "businessDev",
                activityType: actType,
                text: "Cadrage / RAO",
              });
            } else if (roll < 0.8) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "corporate",
                activityType: actType,
                text: "Transverse / COPIL",
              });
            } else if (roll < 0.9) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "training",
                activityType: actType,
                text: "Formation",
              });
            } else {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: randomFrom(["vacation", "rtt", "otherAbsence"]),
                activityType: actType,
                text: "",
              });
            }
          } else {
            // Opérationnels : 65% pilotage actif/contrat, 10% cadrage, 8% transverse, 7% formation, 10% absence
            if (roll < 0.65) {
              const actif = Math.random() < 0.65 ? primaryActif : secondaryActif;
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: actif.jobCode,
                salesOrderItem: "10",
                hours: hpd,
                category: "chargeable",
                activityType: actType,
                text: actif.opportunity.slice(0, 40),
              });
            } else if (roll < 0.75) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "businessDev",
                activityType: actType,
                text: "Cadrage / Émergence",
              });
            } else if (roll < 0.83) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "admin",
                activityType: actType,
                text: "Administration / COPAT",
              });
            } else if (roll < 0.9) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "training",
                activityType: actType,
                text: "Formation ISO 55001",
              });
            } else {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: randomFrom(["vacation", "rtt", "otherAbsence", "illness"]),
                activityType: actType,
                text: "",
              });
            }
          }
        }
      }
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0); // DST safety
    }
  }

  return records;
}

// ── Main ──

export function seedGaifData(): { counts: Record<string, number> } {
  log("demo", "Generating GAIF Pilot seed data...");

  const employees = GAIF_EMPLOYEES;
  const sites = GAIF_SITES;
  const actifs = generateActifs();
  const assignments = generateAssignments(actifs);
  const skills = generateSkills();
  const nonConformites = generateNonConformites(actifs);
  const staffingNeeds = generateStaffingNeeds(actifs);
  const actions = generateUserActions(actifs);
  const interventions = generateInterventions(actifs);
  const sapRecords = generateSapRecords(actifs);

  const insertAll = db.transaction(() => {
    const now = new Date().toISOString();

    // ── Employees ──
    const insEmp = db.prepare(
      `INSERT OR REPLACE INTO employees (empId, name, grade, subTeam, serviceLine, managerId, arrivalDate, departureDate, gradeHistory, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of employees) {
      insEmp.run(e.empId, e.name, e.grade, e.subTeam, e.serviceLine, e.managerId, e.arrival, e.departure, null, now);
    }

    // ── Accounts (sites) ──
    // NB : segmentCode/subSegmentCode laissés null côté accounts car la hiérarchie
    // patrimoine → famille ne doit remonter que depuis les opportunités (actifs).
    const insAcc = db.prepare(
      `INSERT OR REPLACE INTO sites (accountId, account, segmentCode, subSegmentCode, subSegment, country, region, parentAccount, accountLeader, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const s of sites) {
      const leaderName = employees.find((e) => e.empId === s.leader)?.name || "";
      insAcc.run(s.accountId, s.name, null, null, null, "France", s.region, s.parent, leaderName, now);
    }

    // ── Opportunities (actifs) — colonnes GAIF natives incluses ──
    const insOpp = db.prepare(
      `INSERT OR REPLACE INTO assets
       (opportunityId, opportunity, accountId, account, status, grossRevenue, netRevenue, winPct, cm1Pct, jobCode,
        engagementType, weightedBooking,
        manager, managerId, partner, em, ep, country, region, segmentCode, subSegmentCode, subSegment,
        serviceLine1, serviceLine2, serviceLine3,
        serviceOffering1, serviceOffering1Pct, serviceOffering2Pct,
        creationDate, bookingDate, estimatedBookingDate, lastStatusChangeDate,
        lostComment,
        utilizationPct, incidents12m, consoEau, consoElec, consoGaz, surfaceM2, mtbf, mttr, etatAbe,
        updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of actifs) {
      insOpp.run(
        a.opportunityId,
        a.opportunity,
        a.accountId,
        a.account,
        a.status,
        a.grossRevenue,
        a.netRevenue,
        a.winPct,
        a.cm1Pct,
        a.jobCode,
        a.engagementType,
        a.weightedBooking,
        a.manager,
        a.managerId,
        a.partner,
        a.em,
        a.ep,
        a.country,
        a.region,
        a.segmentCode,
        a.subSegmentCode,
        a.subSegment,
        a.serviceLine1,
        a.serviceLine2,
        a.serviceLine3,
        a.serviceOffering1,
        (a as any).valeurAchat || null,
        (a as any).maintenanceCost || null,
        a.creationDate,
        a.bookingDate,
        a.estimatedBookingDate,
        a.lastStatusChangeDate,
        a.lostComment,
        a.utilizationPct,
        a.incidents12m,
        a.consoEau,
        a.consoElec,
        a.consoGaz,
        a.surfaceM2,
        a.mtbf,
        a.mttr,
        a.etatAbe,
        now
      );
    }

    // ── Assignments ──
    const insAss = db.prepare(
      `INSERT INTO mds_assignments (empId, jobNo, jobName, category, startDate, endDate, utilization, hoursPerDay, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of assignments) {
      insAss.run(a.empId, a.jobNo, a.jobName, a.category, a.startDate, a.endDate, a.utilization, a.hoursPerDay, now);
    }

    // ── Skills ──
    const insSkill = db.prepare("INSERT OR IGNORE INTO hr_skills (empId, name, level, category) VALUES (?, ?, ?, ?)");
    for (const s of skills) {
      insSkill.run(s.empId, s.name, s.level, s.category);
    }

    // ── Non-conformités (stockées dans nonconformities) ──
    const insNc = db.prepare(
      `INSERT OR REPLACE INTO nonconformities
       (id, firstName, lastName, email, status, poste, gradeBucket, note, creationDate, hrInterview,
        recruiter1, recruiter1Date, recruiter1Decision, recruiter1EmpId, grade, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const n of nonConformites) {
      insNc.run(
        n.id,
        n.firstName,
        n.lastName,
        n.email,
        n.status,
        n.poste,
        n.gradeBucket,
        n.note,
        n.creationDate,
        n.hrInterview,
        n.recruiter1,
        n.recruiter1Date,
        n.recruiter1Decision,
        n.recruiter1EmpId,
        n.grade,
        now
      );
    }

    // ── Staffing needs ──
    const insNeed = db.prepare(
      `INSERT OR REPLACE INTO user_staffing_needs
       (id, opportunityId, grade, quantity, utilization, startDate, endDate, skills, description, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const n of staffingNeeds) {
      insNeed.run(
        n.id,
        n.opportunityId,
        n.grade,
        n.quantity,
        n.utilization,
        n.startDate,
        n.endDate,
        n.skills,
        n.description,
        n.status,
        now
      );
    }

    // ── User actions (initiatives industrialisation) ──
    const insAction = db.prepare(
      `INSERT OR REPLACE INTO user_actions (id, opportunityId, description, owner, dueDate, priority, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of actions) {
      insAction.run(a.id, a.opportunityId, a.description, a.owner, a.dueDate, a.priority, a.status, now);
    }

    // ── Interventions → user_assets (données indépendantes pour le tab Maintenance) ──
    const insIntv = db.prepare(
      `INSERT OR REPLACE INTO user_assets
       (opportunityId, opportunity, accountId, account, status, grossRevenue, netRevenue, winPct, cm1Pct,
        engagementType, bookingDate, estimatedBookingDate, creationDate,
        serviceLine1, serviceLine2, segmentCode, subSegmentCode, subSegment,
        manager, partner, lostComment, country, region, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const v of interventions) {
      insIntv.run(
        v.opportunityId,
        v.opportunity,
        v.accountId,
        v.account,
        v.status,
        v.grossRevenue,
        v.netRevenue,
        v.winPct,
        v.cm1Pct,
        v.engagementType,
        v.bookingDate,
        v.estimatedBookingDate,
        v.creationDate,
        v.serviceLine1,
        v.serviceLine2,
        v.segmentCode,
        v.subSegmentCode,
        v.subSegment,
        v.manager,
        v.partner,
        v.lostComment,
        v.country,
        v.region,
        now,
        now
      );
    }

    // ── SAP Records (historique jour par jour — alimente le staffing tab TU/variance) ──
    const insSap = db.prepare(
      `INSERT INTO sap_records (empId, date, name, salesOrder, salesOrderItem, hours, category, activityType, text, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of sapRecords) {
      insSap.run(
        r.empId,
        r.date,
        r.name,
        r.salesOrder,
        r.salesOrderItem,
        r.hours,
        r.category,
        r.activityType,
        r.text,
        now
      );
    }

    // ── GAIF Contracts ──
    const insContract = db.prepare(
      `INSERT OR REPLACE INTO gaif_contracts
       (id, prestataire, patrimoine, scope, sites, startDate, endDate, amount, perfScore, managerId, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of GAIF_CONTRACTS) {
      insContract.run(
        c.id,
        c.prestataire,
        c.patrimoine,
        c.scope,
        JSON.stringify(c.sites),
        c.startDate,
        c.endDate,
        c.amount,
        c.perfScore,
        c.manager,
        "actif",
        now,
        now
      );
    }

    // ── GAIF Projets (PPI 2026-2030) ──
    const insProject = db.prepare(
      `INSERT OR REPLACE INTO gaif_projects
       (id, name, patrimoine, siteId, phase, marqueur, leadId, startDate, endDate, budget, budgetByYear, description, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of GAIF_PROJECTS) {
      // Distribution linéaire du budget par année couverte
      const startYear = new Date(p.startDate).getFullYear();
      const endYear = new Date(p.endDate).getFullYear();
      const nYears = Math.max(1, endYear - startYear + 1);
      const perYear: Record<string, number> = {};
      for (let y = startYear; y <= endYear; y++) perYear[String(y)] = Math.round(p.budget / nYears);
      insProject.run(
        p.id,
        p.name,
        p.patrimoine,
        p.site,
        p.phase,
        p.marqueur,
        p.lead,
        p.startDate,
        p.endDate,
        p.budget,
        JSON.stringify(perYear),
        null,
        now,
        now
      );
    }

    // ── GAIF Comités ──
    const insComite = db.prepare(
      `INSERT OR REPLACE INTO gaif_comites
       (id, label, shortLabel, cadence, coAnimateur, themes, raciLeadId, nextOccurrence, color, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of GAIF_COMITES) {
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + c.nextOccurrenceOffsetMonths);
      insComite.run(
        c.id,
        c.label,
        c.shortLabel,
        c.cadence,
        c.coAnimateur,
        JSON.stringify(c.themes),
        c.raciLeadId,
        nextDate.toISOString().slice(0, 10),
        c.color,
        now,
        now
      );
    }

    // ── GAIF Actions de comité ──
    const insComiteAction = db.prepare(
      `INSERT OR REPLACE INTO gaif_comite_actions
       (id, comiteId, description, ownerId, dueDate, priority, status, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of GAIF_COMITE_ACTIONS) {
      const due = new Date();
      due.setDate(due.getDate() + a.dueDateOffsetDays);
      insComiteAction.run(
        a.id,
        a.comiteId,
        a.description,
        a.ownerId,
        due.toISOString().slice(0, 10),
        a.priority,
        a.status,
        now
      );
    }

    // ── GAIF Risques & opportunités ──
    const insRisk = db.prepare(
      `INSERT OR REPLACE INTO gaif_risks
       (id, title, description, kind, severity, stage, ownerId, processus, patrimoine, dueDate, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of GAIF_RISKS_SEED) {
      insRisk.run(
        r.id,
        r.title,
        r.description,
        r.kind,
        r.severity,
        r.stage,
        r.ownerId,
        r.processus,
        r.patrimoine,
        r.dueDate,
        now,
        now
      );
    }

    // ── GAIF Audits ──
    const insAudit = db.prepare(
      `INSERT OR REPLACE INTO gaif_audits
       (id, kind, label, scope, plannedDate, auditor, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of GAIF_AUDITS_SEED) {
      insAudit.run(a.id, a.kind, a.label, a.scope, a.plannedDate, a.auditor, a.status, now, now);
    }

    // ── GAIF Documents doctrinaires ──
    const insDoc = db.prepare(
      `INSERT OR REPLACE INTO gaif_doctrinaire_docs
       (id, title, category, version, lastUpdate, owner, status, summary, content, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const d of GAIF_DOCS_SEED) {
      insDoc.run(
        d.id,
        d.title,
        d.category,
        d.version,
        d.lastUpdate,
        d.owner,
        d.status,
        d.summary,
        d.content,
        JSON.stringify(d.tags)
      );
    }

    // ── GAIF VR Schedule — 1 à 2 VR par actif (passée + prochaine) ──
    const insVr = db.prepare(
      `INSERT INTO gaif_vr_schedule
       (assetId, plannedDate, executedDate, vrType, status, inspector, result, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of actifs) {
      // VR passée (exécutée)
      if (a.bookingDate) {
        insVr.run(
          a.opportunityId,
          a.bookingDate,
          a.bookingDate,
          "reglementaire",
          "realisee",
          a.partner || "Interne SNCF",
          a.cm1Pct < 90 ? "reserve" : "conforme",
          now,
          now
        );
      }
      // VR future (planifiée)
      if (a.estimatedBookingDate) {
        const planned = new Date(a.estimatedBookingDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const status = planned < today ? "retardee" : "planifiee";
        insVr.run(
          a.opportunityId,
          a.estimatedBookingDate,
          null,
          "reglementaire",
          status,
          a.partner || "Interne SNCF",
          null,
          now,
          now
        );
      }
    }
  });

  insertAll();

  const counts = {
    employees: employees.length,
    sites: sites.length,
    actifs: actifs.length,
    assignments: assignments.length,
    skills: skills.length,
    nonConformites: nonConformites.length,
    staffingNeeds: staffingNeeds.length,
    actions: actions.length,
    interventions: interventions.length,
    sapRecords: sapRecords.length,
    contracts: GAIF_CONTRACTS.length,
    projects: GAIF_PROJECTS.length,
    comites: GAIF_COMITES.length,
    comiteActions: GAIF_COMITE_ACTIONS.length,
    risks: GAIF_RISKS_SEED.length,
    audits: GAIF_AUDITS_SEED.length,
    docs: GAIF_DOCS_SEED.length,
    vrSchedule: actifs.length * 2, // approx : 1 passée + 1 future par actif avec dates
  };

  log("demo", `GAIF seed complete: ${JSON.stringify(counts)}`);
  return { counts };
}

export function clearGaifData() {
  const tx = db.transaction(() => {
    // GAIF native tables d'abord (FK sur assets via assetId)
    const gaifTables = [
      "gaif_vr_schedule",
      "gaif_comite_actions",
      "gaif_comites",
      "gaif_risks",
      "gaif_audits",
      "gaif_doctrinaire_docs",
      "gaif_projects",
      "gaif_contracts",
    ];
    for (const t of gaifTables) {
      try {
        db.prepare(`DELETE FROM ${t}`).run();
      } catch {
        /* table might not exist — ignore */
      }
    }
    db.prepare("DELETE FROM sap_records").run();
    db.prepare("DELETE FROM mds_assignments").run();
    db.prepare("DELETE FROM hr_skills").run();
    db.prepare("DELETE FROM nonconformities").run();
    db.prepare("DELETE FROM user_actions").run();
    db.prepare("DELETE FROM user_staffing_needs").run();
    db.prepare("DELETE FROM user_assets").run();
    db.prepare("DELETE FROM assets").run();
    db.prepare("DELETE FROM sites").run();
    db.prepare("DELETE FROM employees").run();
  });
  tx();
  log("demo", "GAIF data cleared");
}

export function hasGaifData(): boolean {
  const row = db.prepare("SELECT COUNT(*) as c FROM employees WHERE empId LIKE 'GAIF%'").get() as { c: number };
  return row.c > 0;
}
