/**
 * Générateur de données fictives pour démo Claude API.
 *
 * Crée un jeu de données complet et réaliste (mais 100% fictif) pour
 * démontrer les capacités IA sans envoyer de données confidentielles.
 *
 * Remplit TOUTES les tables nécessaires au fonctionnement de l'app :
 * - var_country_region, var_optionsets, var_config (config)
 * - employees, sites, assets (données sources)
 * - mds_assignments, sap_records, hr_skills (staffing)
 * - user_actions, user_staffing_needs (modifications)
 */

import { getDemoDb } from "../db/database.js";
import { log } from "../utils/logger.js";

const db = getDemoDb();

// ── Helpers ──

const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min: number, max: number, decimals = 2) =>
  parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
const uuid = () => `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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

// ── Reference data ──

const ACTIVITY_TYPES: Record<string, string> = {
  Partner: "MAGR11",
  Director: "MAGR09",
  "Senior Manager": "MAGR08",
  Manager: "MAGR07",
  "Senior Consultant": "MAGR5A",
  Consultant: "MAGR03",
  Analyst: "MAGR01",
  Intern: "MAGRAP",
};

const FIRST_NAMES = [
  "Alexandre",
  "Sophie",
  "Thomas",
  "Marie",
  "Nicolas",
  "Julie",
  "Pierre",
  "Camille",
  "Antoine",
  "Laura",
  "Julien",
  "Emma",
  "Maxime",
  "Charlotte",
  "Lucas",
  "Lea",
  "Hugo",
  "Manon",
  "Gabriel",
  "Chloe",
  "Raphael",
  "Alice",
  "Louis",
  "Sarah",
  "Arthur",
  "Elise",
  "Paul",
  "Clara",
  "Victor",
  "Ines",
  "Etienne",
  "Margaux",
  "Sebastien",
  "Aurelie",
  "Guillaume",
  "Caroline",
  "Mathieu",
  "Nathalie",
  "Benoit",
  "Valerie",
  "Romain",
  "Isabelle",
  "Cedric",
  "Helene",
  "Damien",
  "Stephanie",
  "Olivier",
  "Catherine",
  "Arnaud",
  "Sandrine",
];

const LAST_NAMES = [
  "Martin",
  "Bernard",
  "Dubois",
  "Thomas",
  "Robert",
  "Richard",
  "Petit",
  "Durand",
  "Leroy",
  "Moreau",
  "Simon",
  "Laurent",
  "Lefebvre",
  "Michel",
  "Garcia",
  "David",
  "Bertrand",
  "Roux",
  "Vincent",
  "Fournier",
  "Morel",
  "Girard",
  "Andre",
  "Mercier",
  "Dupont",
  "Lambert",
  "Bonnet",
  "Francois",
  "Martinez",
  "Legrand",
  "Chevalier",
  "Blanchard",
  "Garnier",
  "Faure",
  "Perrin",
  "Robin",
  "Clement",
  "Morin",
  "Gauthier",
  "Lemaire",
  "Picard",
  "Renard",
  "Marchand",
  "Barbier",
];

const ACCOUNTS = [
  // FSI — Financial Services
  { name: "Societe Generale", subSegmentCode: "FSI", subSegment: "Commercial Banks", country: "France", region: "WST" },
  { name: "BNP Paribas", subSegmentCode: "FSI", subSegment: "Commercial Banks", country: "France", region: "WST" },
  {
    name: "Credit Agricole",
    subSegmentCode: "FSI",
    subSegment: "Saving & State Banks",
    country: "France",
    region: "WST",
  },
  { name: "AXA Group", subSegmentCode: "FSI", subSegment: "General Insurances", country: "France", region: "WST" },
  { name: "Commerzbank AG", subSegmentCode: "FSI", subSegment: "Commercial Banks", country: "Germany", region: "CER" },
  { name: "Allianz SE", subSegmentCode: "FSI", subSegment: "General Insurances", country: "Germany", region: "CER" },
  { name: "ING Group", subSegmentCode: "FSI", subSegment: "Commercial Banks", country: "Netherlands", region: "NRT" },
  // ERT — Energy, Resources & Transport
  { name: "TotalEnergies SE", subSegmentCode: "ERT", subSegment: "Oil & Gas", country: "France", region: "WST" },
  {
    name: "EDF Renewables",
    subSegmentCode: "ERT",
    subSegment: "Utilities (Energy, Water, Waste)",
    country: "France",
    region: "WST",
  },
  {
    name: "Engie SA",
    subSegmentCode: "ERT",
    subSegment: "Utilities (Energy, Water, Waste)",
    country: "France",
    region: "WST",
  },
  {
    name: "SNCF Voyageurs",
    subSegmentCode: "ERT",
    subSegment: "Public Transport & Rail",
    country: "France",
    region: "WST",
  },
  {
    name: "Siemens Energy",
    subSegmentCode: "ERT",
    subSegment: "Utilities (Energy, Water, Waste)",
    country: "Germany",
    region: "CER",
  },
  {
    name: "Deutsche Bahn AG",
    subSegmentCode: "ERT",
    subSegment: "Public Transport & Rail",
    country: "Germany",
    region: "CER",
  },
  // TMT — Telecoms, Media, Tech
  { name: "Orange Business", subSegmentCode: "TMT", subSegment: "Communications", country: "France", region: "WST" },
  { name: "Thales Digital", subSegmentCode: "TMT", subSegment: "Med- & High-Tech", country: "France", region: "WST" },
  // AUTO — Automotive
  { name: "Renault Group", subSegmentCode: "AUTO", subSegment: "Automotive OEM", country: "France", region: "WST" },
  { name: "Volkswagen Group", subSegmentCode: "AUTO", subSegment: "Automotive OEM", country: "Germany", region: "CER" },
  { name: "Volvo Group", subSegmentCode: "AUTO", subSegment: "Automotive OEM", country: "Sweden", region: "NRT" },
  // CRL — Consumer, Retail, Luxury
  {
    name: "Carrefour Group",
    subSegmentCode: "CRL",
    subSegment: "Retail & Wholesale",
    country: "France",
    region: "WST",
  },
  { name: "L'Oreal Group", subSegmentCode: "CRL", subSegment: "Luxury & Fashion", country: "France", region: "WST" },
  {
    name: "Danone SA",
    subSegmentCode: "CRL",
    subSegment: "Fast-Moving Consumer Goods",
    country: "France",
    region: "WST",
  },
  // PHS — Public, Health, Social
  { name: "AP-HP Paris", subSegmentCode: "PHS", subSegment: "Public Healthcare", country: "France", region: "WST" },
  {
    name: "Ministere Economie",
    subSegmentCode: "PHS",
    subSegment: "Central Government",
    country: "France",
    region: "WST",
  },
  // IEM — Industrial, Engineering, Manufacturing
  {
    name: "Airbus Defence & Space",
    subSegmentCode: "IEM",
    subSegment: "Aerospace & Defence OEMs",
    country: "France",
    region: "WST",
  },
  {
    name: "Safran Group",
    subSegmentCode: "IEM",
    subSegment: "Aerospace & Defence OEMs",
    country: "France",
    region: "WST",
  },
];

const SERVICE_LINES = [
  "Enterprise SAP Transformation",
  "Technology",
  "Core Industry FS",
  "Core Industry CS",
  "Core Industry PS",
  "Finance & Regulatory",
  "Customer & Growth",
  "Operations",
  "People & Strategy",
  "IT Strategy & Transformation",
  "Information Management",
];

const SERVICE_OFFERINGS = [
  "Application Management SAP",
  "Azure Infrastructure Platform",
  "Agile Program & Project Management",
  "BS-Corporate Strategy",
  "BS-Sustainability",
  "BT-Business Process Mgt.",
  "Access, Search & Delivery",
  "Aftersales & Service Management",
  "BS-Growth",
  "BS-Innovation",
  "BS-Market Analysis & Entry",
  "BS-Pricing",
  "BT-Business Turnaround",
];

const TECH_PARTNERS = ["SAP", "Microsoft", "Salesforce", "ServiceNow", "AWS"];

const PROJECT_PREFIXES = [
  "Transformation Digitale",
  "Migration Cloud",
  "Optimisation Processus",
  "Deploiement SAP",
  "Strategie Data",
  "Programme ESG",
  "Audit Cybersecurite",
  "Modernisation SI",
  "Refonte Architecture",
  "Accompagnement Change",
  "Due Diligence Tech",
  "Plan Strategique",
  "Pilotage Programme",
  "Revue Organisation",
  "Deploiement CRM",
  "Data Governance",
];

const CONTACT_JOB_TITLES = [
  "CFO",
  "CTO",
  "CIO",
  "CDO",
  "VP IT",
  "VP Finance",
  "IT Director",
  "Head of Digital",
  "Head of Procurement",
  "Head of Strategy",
  "Program Director",
  "Transformation Lead",
  "Chief Data Officer",
  "Managing Director",
  "General Manager",
  "VP Operations",
];

const CONTACT_DEPARTMENTS = [
  "IT",
  "Finance",
  "Strategy",
  "Digital",
  "Operations",
  "Procurement",
  "Risk Management",
  "Compliance",
  "Data & Analytics",
  "Human Resources",
];

const SKILLS = [
  { name: "SAP S/4HANA", category: "Technology" },
  { name: "Python", category: "Technology" },
  { name: "Power BI", category: "Data" },
  { name: "Azure", category: "Cloud" },
  { name: "Agile / Scrum", category: "Methodology" },
  { name: "Project Management", category: "Management" },
  { name: "Financial Modeling", category: "Finance" },
  { name: "Change Management", category: "Management" },
  { name: "Data Governance", category: "Data" },
  { name: "Cybersecurity", category: "Technology" },
  { name: "SQL / Databases", category: "Technology" },
  { name: "Machine Learning", category: "Data" },
  { name: "Stakeholder Management", category: "Management" },
  { name: "Process Mining", category: "Methodology" },
  { name: "ESG Reporting", category: "Sustainability" },
  { name: "Salesforce", category: "Technology" },
  { name: "AWS", category: "Cloud" },
  { name: "Terraform", category: "Cloud" },
  { name: "JIRA / Confluence", category: "Methodology" },
  { name: "Tableau", category: "Data" },
];

// ── Generator functions ──

interface DemoEmployee {
  empId: string;
  name: string;
  grade: string;
  subTeam: string | null;
  serviceLine: string | null;
  managerId: string | null;
  arrival: string;
  departure: string | null;
  gradeHistory: string | null;
}

function generateEmployees(): DemoEmployee[] {
  const employees: DemoEmployee[] = [];
  const usedNames = new Set<string>();

  // Bigger pyramid: ~60 employees
  const gradeDistribution = [
    { grade: "Partner", count: 3 },
    { grade: "Director", count: 4 },
    { grade: "Senior Manager", count: 6 },
    { grade: "Manager", count: 8 },
    { grade: "Senior Consultant", count: 12 },
    { grade: "Consultant", count: 14 },
    { grade: "Analyst", count: 8 },
    { grade: "Intern", count: 3 },
  ];

  const SEGMENTS = ["FSI", "ERT", "TMT", "AUTO", "CRL", "PHS", "IEM"];
  let empIndex = 0;

  for (const { grade, count } of gradeDistribution) {
    for (let i = 0; i < count; i++) {
      let firstName: string, lastName: string, fullName: string;
      do {
        firstName = randomFrom(FIRST_NAMES);
        lastName = randomFrom(LAST_NAMES);
        fullName = `${firstName} ${lastName}`;
      } while (usedNames.has(fullName));
      usedNames.add(fullName);

      const yearsAgo =
        grade === "Partner"
          ? randomBetween(8, 15)
          : grade === "Director"
            ? randomBetween(6, 12)
            : grade === "Senior Manager"
              ? randomBetween(4, 8)
              : grade === "Manager"
                ? randomBetween(3, 6)
                : grade === "Senior Consultant"
                  ? randomBetween(2, 4)
                  : grade === "Consultant"
                    ? randomBetween(1, 3)
                    : grade === "Analyst"
                      ? randomBetween(0, 2)
                      : 0;

      const arrival = addDays("2026-03-28", -yearsAgo * 365 - randomBetween(0, 180));

      // ~10% departed, ~5% departing soon
      let departure: string | null = null;
      if (grade !== "Partner") {
        const roll = Math.random();
        if (roll < 0.05)
          departure = addDays("2026-03-28", randomBetween(14, 90)); // leaving soon
        else if (roll < 0.1) departure = randomDate("2025-06-01", "2026-02-28"); // already departed
      }

      // Some employees have grade history (promoted recently)
      let gradeHistory: string | null = null;
      if (Math.random() < 0.15 && !["Partner", "Intern"].includes(grade)) {
        const prevGrades: Record<string, string> = {
          Director: "Senior Manager",
          "Senior Manager": "Manager",
          Manager: "Senior Consultant",
          "Senior Consultant": "Consultant",
          Consultant: "Analyst",
          Analyst: "Intern",
        };
        const prevGrade = prevGrades[grade];
        if (prevGrade) {
          const promoDate = randomDate("2025-06-01", "2026-01-31");
          gradeHistory = JSON.stringify([
            { grade: prevGrade, since: arrival },
            { grade, since: promoDate },
          ]);
        }
      }

      // Each employee belongs to either a segment OR a service line, not both
      const isSegment = Math.random() < 0.6; // 60% segment, 40% service line
      const subTeam = isSegment ? randomFrom(SEGMENTS) : null;
      const serviceLine = isSegment ? null : randomFrom(SERVICE_LINES);

      employees.push({
        empId: `DEMO${String(empIndex + 1).padStart(4, "0")}`,
        name: fullName,
        grade,
        subTeam,
        serviceLine,
        managerId: null,
        arrival,
        departure,
        gradeHistory,
      });
      empIndex++;
    }
  }

  // Build DM hierarchy
  const byGrade = (g: string) => employees.filter((e) => e.grade === g);
  const partners = byGrade("Partner");
  const directors = byGrade("Director");
  const sms = byGrade("Senior Manager");
  const managers = byGrade("Manager");
  const juniors = employees.filter((e) => ["Senior Consultant", "Consultant", "Analyst", "Intern"].includes(e.grade));

  directors.forEach((d) => {
    d.managerId = randomFrom(partners).empId;
  });
  sms.forEach((s) => {
    s.managerId = randomFrom(directors).empId;
  });
  managers.forEach((m) => {
    m.managerId = randomFrom(sms).empId;
  });
  juniors.forEach((j) => {
    j.managerId = randomFrom(managers).empId;
  });

  return employees;
}

interface DemoOpportunity {
  opportunityId: string;
  opportunity: string;
  accountId?: string;
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
  partner: string;
  em: string | null;
  ep: string | null;
  country: string;
  region: string;
  subSegmentCode: string;
  subSegment: string;
  serviceLine1: string;
  serviceLine2: string | null;
  serviceOffering1: string;
  serviceOffering1Pct: number;
  serviceOffering2: string | null;
  serviceOffering2Pct: number | null;
  techPartner1: string | null;
  creationDate: string;
  bookingDate: string | null;
  estimatedBookingDate: string | null;
  lastStatusChangeDate: string;
  lostComment: string | null;
}

function generateOpportunities(employees: DemoEmployee[]): DemoOpportunity[] {
  const partners = employees.filter((e) => e.grade === "Partner");
  const seniors = employees.filter((e) => ["Manager", "Senior Manager", "Director"].includes(e.grade));
  const statuses = [
    { status: 1, weight: 12 }, // Lead
    { status: 4, weight: 8 }, // Go Approved
    { status: 6, weight: 10 }, // Proposal
    { status: 11, weight: 6 }, // Won
    { status: 14, weight: 25 }, // Booked
    { status: 15, weight: 8 }, // Lost
  ];

  const totalWeight = statuses.reduce((s, v) => s + v.weight, 0);
  const pickStatus = () => {
    let r = Math.random() * totalWeight;
    for (const s of statuses) {
      r -= s.weight;
      if (r <= 0) return s.status;
    }
    return 1;
  };

  const engagementTypes = ["New Project", "Extension / Sell on", "Extension with separate Job Code"];
  const lostComments = [
    "Client chose a cheaper competitor",
    "Budget redirected to another project",
    "Internal reorganization at the client",
    "Timing not aligned with needs",
    "Reduced scope, project not profitable",
  ];

  const opps: DemoOpportunity[] = [];

  for (let i = 0; i < 80; i++) {
    const account = randomFrom(ACCOUNTS);
    const status = pickStatus();
    const grossRevenue =
      status === 14
        ? randomBetween(50, 3000) * 1000
        : status === 15
          ? randomBetween(30, 800) * 1000
          : randomBetween(20, 2000) * 1000;
    const netRevenue = Math.round(grossRevenue * randomFloat(0.6, 0.85));
    const winPct =
      status === 14
        ? 100
        : status === 15
          ? 0
          : status === 11
            ? 100
            : status === 6
              ? randomBetween(30, 70)
              : status === 4
                ? randomBetween(20, 50)
                : randomBetween(5, 25);

    const creationDate = randomDate("2025-01-01", "2026-03-15");
    const prefix = randomFrom(PROJECT_PREFIXES);
    const sl2 = Math.random() < 0.3 ? randomFrom(SERVICE_LINES) : null;
    const so2 = Math.random() < 0.3 ? randomFrom(SERVICE_OFFERINGS) : null;
    const so1Pct = so2 ? randomBetween(50, 80) : 100;

    const manager = randomFrom(seniors);
    const partner = randomFrom(partners);

    opps.push({
      opportunityId: `OPP-${String(i + 1).padStart(4, "0")}`,
      opportunity: `${prefix} - ${account.name}`,
      account: account.name,
      status,
      grossRevenue,
      netRevenue,
      winPct,
      cm1Pct: randomFloat(20, 50),
      jobCode: `JC${randomBetween(10000, 99999)}`,
      engagementType: randomFrom(engagementTypes),
      weightedBooking: Math.round((grossRevenue * winPct) / 100),
      manager: manager.name,
      partner: partner.name,
      em: Math.random() < 0.5 ? randomFrom(seniors).name : null,
      ep: Math.random() < 0.3 ? randomFrom(partners).name : null,
      country: account.country,
      region: account.region,
      subSegmentCode: account.subSegmentCode,
      subSegment: account.subSegment,
      serviceLine1: randomFrom(SERVICE_LINES),
      serviceLine2: sl2,
      serviceOffering1: randomFrom(SERVICE_OFFERINGS),
      serviceOffering1Pct: so1Pct,
      serviceOffering2: so2,
      serviceOffering2Pct: so2 ? 100 - so1Pct : null,
      techPartner1: Math.random() < 0.4 ? randomFrom(TECH_PARTNERS) : null,
      creationDate,
      bookingDate: status === 14 || status === 15 ? randomDate(creationDate, "2026-03-28") : null,
      estimatedBookingDate: [1, 4, 6].includes(status) ? randomDate("2026-04-01", "2026-12-31") : null,
      lastStatusChangeDate: randomDate(creationDate, "2026-03-28"),
      lostComment: status === 15 ? randomFrom(lostComments) : null,
    });
  }

  return opps;
}

function generateAssignments(employees: DemoEmployee[], opps: DemoOpportunity[]) {
  const assignments: {
    empId: string;
    jobNo: string;
    jobName: string;
    category: string;
    startDate: string;
    endDate: string;
    utilization: number;
    hoursPerDay: number;
  }[] = [];

  const activeOpps = opps.filter((o) => [4, 6, 11, 14].includes(o.status));
  const activeEmployees = employees.filter((e) => !e.departure || e.departure > "2026-03-28");

  for (const emp of activeEmployees) {
    const isExec = ["Partner", "Director"].includes(emp.grade);
    const hpd = emp.grade === "Intern" ? 7 : 8;

    // ── Load profile: heavy (40%), medium (35%), light (25%) ──
    const roll = Math.random();
    const loadProfile = roll < 0.4 ? "heavy" : roll < 0.75 ? "medium" : "light";

    // utilization is stored as 0-100 (percentage), NOT 0-1
    const profileConfig = isExec
      ? {
          heavy: { past: [2, 3], current: [2, 3], future: [1, 2], utils: [20, 25, 30, 40] },
          medium: { past: [1, 2], current: [1, 2], future: [0, 1], utils: [10, 15, 20, 25] },
          light: { past: [0, 1], current: [0, 1], future: [0, 1], utils: [5, 10, 15] },
        }[loadProfile]
      : {
          heavy: { past: [3, 5], current: [2, 3], future: [1, 3], utils: [50, 75, 75, 80, 100, 100] },
          medium: { past: [2, 3], current: [1, 2], future: [1, 2], utils: [25, 40, 50, 50, 75] },
          light: { past: [1, 2], current: [0, 1], future: [0, 1], utils: [10, 20, 25] },
        }[loadProfile];

    const numPast = randomBetween(profileConfig.past[0], profileConfig.past[1]);
    const numCurrent = randomBetween(profileConfig.current[0], profileConfig.current[1]);
    const numFuture = randomBetween(profileConfig.future[0], profileConfig.future[1]);

    // Past missions (Jan 2025 → Dec 2025)
    for (let i = 0; i < numPast; i++) {
      const opp = randomFrom(activeOpps);
      const startDate = randomDate("2025-01-01", "2025-08-01");
      const endDate = randomDate("2025-06-01", "2025-12-31");
      if (endDate <= startDate) continue;
      const utilization = randomFrom(profileConfig.utils);
      assignments.push({
        empId: emp.empId,
        jobNo: opp.jobCode,
        jobName: opp.opportunity.slice(0, 60),
        category: "chargeable",
        startDate,
        endDate,
        utilization,
        hoursPerDay: (utilization / 100) * hpd,
      });
    }

    // Current missions (overlapping today)
    for (let i = 0; i < numCurrent; i++) {
      const opp = randomFrom(activeOpps);
      const startDate = randomDate("2025-09-01", "2026-02-15");
      const durationDays = randomBetween(90, 300);
      const endDate = addDays(startDate, durationDays);
      const utilization = randomFrom(profileConfig.utils);
      assignments.push({
        empId: emp.empId,
        jobNo: opp.jobCode,
        jobName: opp.opportunity.slice(0, 60),
        category: "chargeable",
        startDate,
        endDate,
        utilization,
        hoursPerDay: (utilization / 100) * hpd,
      });
    }

    // Future missions (2026 Q2+)
    for (let i = 0; i < numFuture; i++) {
      const opp = randomFrom(activeOpps);
      const startDate = randomDate("2026-04-01", "2026-09-01");
      const durationDays = randomBetween(60, 240);
      const endDate = addDays(startDate, durationDays);
      const utilization = randomFrom(profileConfig.utils);
      assignments.push({
        empId: emp.empId,
        jobNo: opp.jobCode,
        jobName: opp.opportunity.slice(0, 60),
        category: "chargeable",
        startDate,
        endDate,
        utilization,
        hoursPerDay: (utilization / 100) * hpd,
      });
    }

    // ── Absences & training: spread across 2025-2026 ──
    const absenceTypes = [
      { cat: "vacation", name: "Conges", dur: [5, 15], weight: 4 },
      { cat: "rtt", name: "RTT", dur: [1, 1], weight: 8 },
      { cat: "training", name: "Formation", dur: [2, 5], weight: 3 },
      { cat: "otherAbsence", name: "Absence", dur: [1, 3], weight: 1 },
      { cat: "loa", name: "Leave of Absence", dur: [5, 20], weight: 1 },
    ];
    const absPool = absenceTypes.flatMap((a) => Array(a.weight).fill(a));

    const numAbsences = randomBetween(6, 14);
    for (let i = 0; i < numAbsences; i++) {
      const abs = randomFrom(absPool);
      const start = randomDate("2025-01-01", "2026-11-01");
      const dur = randomBetween(abs.dur[0], abs.dur[1]);
      assignments.push({
        empId: emp.empId,
        jobNo: abs.cat.toUpperCase(),
        jobName: abs.name,
        category: abs.cat,
        startDate: start,
        endDate: addDays(start, dur),
        utilization: 100,
        hoursPerDay: hpd,
      });
    }
  }

  return assignments;
}

function generateSapRecords(employees: DemoEmployee[], opps: DemoOpportunity[]) {
  const records: {
    empId: string;
    date: string;
    name: string;
    salesOrder: string | null;
    salesOrderItem: string | null;
    hours: number;
    category: string;
    activityType: string;
    text: string;
  }[] = [];

  const activeOpps = opps.filter((o) => [11, 14].includes(o.status));
  const activeEmployees = employees.filter((e) => !e.departure || e.departure > "2026-01-01");

  // Full 2025 + Q1 2026 SAP records (Jan 2025 → Mar 2026)
  const start = new Date("2025-01-06");
  const end = new Date("2026-03-27");

  for (const emp of activeEmployees) {
    const isExec = ["Partner", "Director"].includes(emp.grade);
    const hpd = emp.grade === "Intern" ? 7 : 8;
    // Each employee has a "primary project" for consistency
    const primaryOpp = randomFrom(activeOpps);
    const secondaryOpp = randomFrom(activeOpps);

    const d = new Date(start);
    while (d <= end) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) {
        const dateStr = d.toISOString().slice(0, 10);
        // Skip if employee not yet arrived or already departed
        if (dateStr >= emp.arrival && (!emp.departure || dateStr <= emp.departure)) {
          const roll = Math.random();
          if (isExec) {
            // Execs: 40% chargeable, 30% businessDev, 20% corporate, 10% admin
            if (roll < 0.4) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: primaryOpp.jobCode,
                salesOrderItem: "10",
                hours: hpd,
                category: "chargeable",
                activityType: ACTIVITY_TYPES[emp.grade],
                text: primaryOpp.opportunity.slice(0, 40),
              });
            } else if (roll < 0.7) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "businessDev",
                activityType: ACTIVITY_TYPES[emp.grade],
                text: "Business Development",
              });
            } else if (roll < 0.9) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "corporate",
                activityType: ACTIVITY_TYPES[emp.grade],
                text: "Corporate activities",
              });
            } else {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "admin",
                activityType: ACTIVITY_TYPES[emp.grade],
                text: "Administration",
              });
            }
          } else {
            // Consultants: 75% chargeable, 8% admin, 5% training, 5% absence, 4% bizdev, 3% corporate
            if (roll < 0.75) {
              const opp = Math.random() < 0.7 ? primaryOpp : secondaryOpp;
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: opp.jobCode,
                salesOrderItem: "10",
                hours: hpd,
                category: "chargeable",
                activityType: ACTIVITY_TYPES[emp.grade] || "MAGR03",
                text: opp.opportunity.slice(0, 40),
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
                activityType: ACTIVITY_TYPES[emp.grade] || "MAGR03",
                text: "Administration",
              });
            } else if (roll < 0.88) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "training",
                activityType: ACTIVITY_TYPES[emp.grade] || "MAGR03",
                text: "Formation interne",
              });
            } else if (roll < 0.93) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: randomFrom(["vacation", "rtt", "illness", "otherAbsence", "loa"]),
                activityType: ACTIVITY_TYPES[emp.grade] || "MAGR03",
                text: "",
              });
            } else if (roll < 0.97) {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "businessDev",
                activityType: ACTIVITY_TYPES[emp.grade] || "MAGR03",
                text: "Avant-vente",
              });
            } else {
              records.push({
                empId: emp.empId,
                date: dateStr,
                name: emp.name,
                salesOrder: null,
                salesOrderItem: null,
                hours: hpd,
                category: "corporate",
                activityType: ACTIVITY_TYPES[emp.grade] || "MAGR03",
                text: "Corporate",
              });
            }
          }
        }
      }
      d.setDate(d.getDate() + 1);
    }
  }

  return records;
}

function generateSkills(employees: DemoEmployee[]) {
  const skills: { empId: string; name: string; level: number; category: string }[] = [];

  for (const emp of employees) {
    const numSkills = randomBetween(3, 8);
    const picked = new Set<number>();
    for (let i = 0; i < numSkills; i++) {
      let idx: number;
      do {
        idx = randomBetween(0, SKILLS.length - 1);
      } while (picked.has(idx));
      picked.add(idx);

      const skill = SKILLS[idx];
      const maxLevel = ["Partner", "Director"].includes(emp.grade)
        ? 4
        : ["Senior Manager", "Manager"].includes(emp.grade)
          ? randomBetween(2, 4)
          : randomBetween(1, 3);

      skills.push({ empId: emp.empId, name: skill.name, level: maxLevel, category: skill.category });
    }
  }
  return skills;
}

function generateUserData(opps: DemoOpportunity[], employees: DemoEmployee[]) {
  const actions: {
    id: string;
    opportunityId: string;
    description: string;
    owner: string;
    dueDate: string;
    priority: string;
    status: string;
  }[] = [];
  const staffingNeeds: {
    id: string;
    opportunityId: string;
    grade: string;
    quantity: number;
    startDate: string;
    endDate: string;
    skills: string;
    probability: number;
    utilization: number;
  }[] = [];

  const seniors = employees.filter((e) => ["Manager", "Senior Manager", "Director", "Partner"].includes(e.grade));
  const activeOpps = opps.filter((o) => [1, 4, 6, 11].includes(o.status));

  // Actions on ~60% of active opps
  for (const opp of activeOpps) {
    if (Math.random() < 0.6) {
      actions.push({
        id: uuid(),
        opportunityId: opp.opportunityId,
        description: randomFrom([
          "Relancer le client sur la proposition commerciale",
          "Planifier le comite de pilotage mensuel",
          "Envoyer le rapport d'avancement au sponsor",
          "Preparer la presentation pour le COMEX client",
          "Confirmer la disponibilite de l'equipe projet",
          "Mettre a jour le plan de charge previsionnel",
          "Organiser le kick-off avec les equipes techniques",
          "Valider les livrables de la phase 1",
          "Negocier les conditions du contrat cadre",
          "Revoir le budget avec le directeur de mission",
          "Identifier les risques projet et mitigations",
          "Preparer le business case pour l'extension",
        ]),
        owner: randomFrom(seniors).name,
        dueDate: randomDate("2026-03-28", "2026-06-30"),
        priority: randomFrom(["high", "medium", "low"]),
        status: randomFrom(["open", "open", "open", "done"]),
      });
    }

    // Staffing needs on ~70% of Go/Proposal/Won
    if ([4, 6, 11].includes(opp.status) && Math.random() < 0.7) {
      const numNeeds = randomBetween(1, 4);
      for (let i = 0; i < numNeeds; i++) {
        const grade = randomFrom([
          "Senior Consultant",
          "Senior Consultant",
          "Consultant",
          "Consultant",
          "Manager",
          "Analyst",
        ]);
        const startDate = randomDate("2026-04-01", "2026-08-01");
        const durationDays = randomBetween(60, 180);
        const endDate = addDays(startDate, durationDays);
        // Pick 1-3 real skills
        const numSkills = randomBetween(1, 3);
        const pickedSkills: string[] = [];
        const skillPool = [...SKILLS];
        for (let j = 0; j < numSkills && skillPool.length > 0; j++) {
          const idx = randomBetween(0, skillPool.length - 1);
          pickedSkills.push(skillPool[idx].name);
          skillPool.splice(idx, 1);
        }
        const utilOptions = [25, 50, 75, 100, 100, 100]; // weighted toward 100%
        staffingNeeds.push({
          id: uuid(),
          opportunityId: opp.opportunityId,
          grade,
          quantity: randomBetween(1, 2),
          startDate,
          endDate,
          skills: JSON.stringify(pickedSkills),
          probability: opp.winPct / 100,
          utilization: utilOptions[randomBetween(0, utilOptions.length - 1)],
        });
      }
    }
  }

  // Revenue team on Won/Booked opportunities (100% coverage)
  const revenueTeam: { id: string; opportunityId: string; name: string; gradeBucket: string; percentage: number }[] =
    [];
  const wonBookedOpps = opps.filter((o) => [11, 14].includes(o.status));
  for (const opp of wonBookedOpps) {
    // Partner (5-15%), Director or SM (15-30%), rest Consultant-level
    const partnerPct = randomBetween(5, 15);
    const dirPct = randomBetween(15, 30);
    const consultantPct = 100 - partnerPct - dirPct;
    const partner = seniors.find((e) => e.grade === "Partner") || randomFrom(seniors);
    const director = seniors.find((e) => e.grade === "Director" || e.grade === "Senior Manager") || randomFrom(seniors);
    revenueTeam.push(
      {
        id: uuid(),
        opportunityId: opp.opportunityId,
        name: partner.name,
        gradeBucket: "Partner",
        percentage: partnerPct,
      },
      {
        id: uuid(),
        opportunityId: opp.opportunityId,
        name: director.name,
        gradeBucket: "Director",
        percentage: dirPct,
      },
      {
        id: uuid(),
        opportunityId: opp.opportunityId,
        name: opp.manager,
        gradeBucket: "M/SM",
        percentage: consultantPct,
      }
    );
  }

  return { actions, staffingNeeds, revenueTeam };
}

interface DemoContact {
  contactId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  mobile: string;
  jobTitle: string;
  department: string;
  city: string;
  country: string;
  accountId: string;
  account: string;
}

function generateContacts(accounts: { name: string; country: string }[]): DemoContact[] {
  const contacts: DemoContact[] = [];
  const CITIES: Record<string, string[]> = {
    France: ["Paris", "Lyon", "Marseille", "Toulouse", "Nantes"],
    Germany: ["Frankfurt", "Munich", "Berlin", "Hamburg", "Düsseldorf"],
    Netherlands: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
    Sweden: ["Stockholm", "Gothenburg", "Malmö"],
  };

  for (const acc of accounts) {
    const count = randomBetween(2, 5);
    const cities = CITIES[acc.country] || ["Paris"];
    for (let i = 0; i < count; i++) {
      const firstName = randomFrom(FIRST_NAMES);
      const lastName = randomFrom(LAST_NAMES);
      const domain = acc.name.toLowerCase().replace(/[^a-z]/g, "") + ".com";
      contacts.push({
        contactId: uuid(),
        fullName: `${firstName} ${lastName}`,
        firstName: firstName,
        lastName: lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
        phone: `+33 1 ${randomBetween(40, 99)} ${randomBetween(10, 99)} ${randomBetween(10, 99)} ${randomBetween(10, 99)}`,
        mobile:
          Math.random() < 0.6
            ? `+33 6 ${randomBetween(10, 99)} ${randomBetween(10, 99)} ${randomBetween(10, 99)} ${randomBetween(10, 99)}`
            : "",
        jobTitle: randomFrom(CONTACT_JOB_TITLES),
        department: randomFrom(CONTACT_DEPARTMENTS),
        city: randomFrom(cities),
        country: acc.country,
        accountId: "", // assigned later in seedDemoData
        account: acc.name,
      });
    }
  }
  return contacts;
}

// ── Main seeder ──

export function seedDemoData(): { counts: Record<string, number> } {
  log("demo", "Generating comprehensive dummy data...");

  const employees = generateEmployees();
  const opps = generateOpportunities(employees);
  const assignments = generateAssignments(employees, opps);
  const sapRecords = generateSapRecords(employees, opps);
  const skills = generateSkills(employees);
  const { actions, staffingNeeds, revenueTeam } = generateUserData(opps, employees);

  const partners = employees.filter((e) => e.grade === "Partner");
  const accounts = ACCOUNTS.map((a) => ({ ...a, accountId: uuid(), accountLeader: randomFrom(partners).name }));

  // Build account name → GUID lookup and assign to opps/contacts
  const accGuidByName: Record<string, string> = {};
  for (const a of accounts) accGuidByName[a.name] = a.accountId;
  for (const opp of opps) opp.accountId = accGuidByName[opp.account] || "";

  const contacts = generateContacts(accounts);
  for (const c of contacts) c.accountId = accGuidByName[c.account] || "";

  // Assign a primary contact to each opportunity
  for (const opp of opps) {
    const accountContacts = contacts.filter((c) => c.accountId === opp.accountId);
    if (accountContacts.length > 0) {
      (opp as any).primaryContactId = accountContacts[0].contactId;
      (opp as any).primaryContact = accountContacts[0].fullName;
    }
  }

  const insertAll = db.transaction(() => {
    const now = new Date().toISOString();

    // ── Employees ──

    const insEmp = db.prepare(
      `INSERT OR REPLACE INTO employees (empId, name, grade, subTeam, serviceLine, managerId, arrivalDate, departureDate, gradeHistory, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const e of employees) {
      insEmp.run(
        e.empId,
        e.name,
        e.grade,
        e.subTeam,
        e.serviceLine,
        e.managerId,
        e.arrival,
        e.departure,
        e.gradeHistory,
        now
      );
    }

    // ── Accounts ──

    const insAcc = db.prepare(
      `INSERT OR REPLACE INTO sites (accountId, account, subSegmentCode, subSegment, country, region, accountLeader, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of accounts)
      insAcc.run(a.accountId, a.name, a.subSegmentCode, a.subSegment, a.country, a.region, a.accountLeader, now);

    // ── Opportunities ──

    const insOpp = db.prepare(
      `INSERT OR REPLACE INTO assets
       (opportunityId, opportunity, accountId, account, status, grossRevenue, netRevenue, winPct, cm1Pct, jobCode,
        engagementType, weightedBooking,
        manager, partner, em, ep, country, region, subSegmentCode, subSegment,
        serviceLine1, serviceLine2,
        serviceOffering1, serviceOffering1Pct, serviceOffering2, serviceOffering2Pct,
        technologyPartner1,
        creationDate, bookingDate, estimatedBookingDate, lastStatusChangeDate,
        lostComment,
        primaryContactId, primaryContact,
        updatedAt)
       Values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const o of opps) {
      insOpp.run(
        o.opportunityId,
        o.opportunity,
        o.accountId || null,
        o.account,
        o.status,
        o.grossRevenue,
        o.netRevenue,
        o.winPct,
        o.cm1Pct,
        o.jobCode,
        o.engagementType,
        o.weightedBooking,
        o.manager,
        o.partner,
        o.em,
        o.ep,
        o.country,
        o.region,
        o.subSegmentCode,
        o.subSegment,
        o.serviceLine1,
        o.serviceLine2,
        o.serviceOffering1,
        o.serviceOffering1Pct,
        o.serviceOffering2,
        o.serviceOffering2Pct,
        o.techPartner1,
        o.creationDate,
        o.bookingDate,
        o.estimatedBookingDate,
        o.lastStatusChangeDate,
        o.lostComment,
        (o as any).primaryContactId || null,
        (o as any).primaryContact || null,
        now
      );
    }

    // ── MDS Assignments ──

    const insAss = db.prepare(
      `INSERT INTO mds_assignments (empId, jobNo, jobName, category, startDate, endDate, utilization, hoursPerDay, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of assignments)
      insAss.run(a.empId, a.jobNo, a.jobName, a.category, a.startDate, a.endDate, a.utilization, a.hoursPerDay, now);

    // ── SAP Daily Records ──

    const insSap = db.prepare(
      `INSERT INTO sap_records (empId, date, name, salesOrder, salesOrderItem, hours, category, activityType, text, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of sapRecords)
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

    // ── Skills ──

    const insSkill = db.prepare("INSERT OR IGNORE INTO hr_skills (empId, name, level, category) VALUES (?, ?, ?, ?)");
    for (const s of skills) insSkill.run(s.empId, s.name, s.level, s.category);

    // ── Contacts (crm_contacts dropped post-refonte v2 — skipped) ──

    // ── User data (actions, staffing needs) ──

    const insAction = db.prepare(
      `INSERT INTO user_actions (id, opportunityId, description, owner, dueDate, priority, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const a of actions)
      insAction.run(a.id, a.opportunityId, a.description, a.owner, a.dueDate, a.priority, a.status, now);

    const insNeed = db.prepare(
      `INSERT INTO user_staffing_needs (id, opportunityId, grade, quantity, startDate, endDate, skills, probability, utilization, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
    );
    for (const n of staffingNeeds)
      insNeed.run(
        n.id,
        n.opportunityId,
        n.grade,
        n.quantity,
        n.startDate,
        n.endDate,
        n.skills,
        n.probability,
        n.utilization,
        now
      );

    // var_* tables are NOT seeded here — they come from the real DB via copyVarTables() in demo.ts

    // ── Revenue team ──

    const insRevTeam = db.prepare(
      "INSERT INTO user_asset_team (id, opportunityId, name, gradeBucket, percentage) VALUES (?, ?, ?, ?, ?)"
    );
    for (const rt of revenueTeam) insRevTeam.run(rt.id, rt.opportunityId, rt.name, rt.gradeBucket, rt.percentage);

    // ── Sample scenarios ──

    db.prepare(
      `INSERT OR REPLACE INTO user_scenarios (id, name, baseId, overrides, empOverrides, createdAt) VALUES (?, ?, NULL, '{}', '{}', ?)`
    ).run("scenario_baseline", "Baseline Q2 2026", now);
    db.prepare(
      `INSERT OR REPLACE INTO user_scenarios (id, name, baseId, overrides, empOverrides, createdAt) VALUES (?, ?, 'scenario_baseline', '{}', '{}', ?)`
    ).run("scenario_optimistic", "Optimistic — All Go Won", now);

    // ── Employee overrides → EAV table (user_overrides) ──

    const insOverride = db.prepare(
      `INSERT OR REPLACE INTO user_overrides (entityType, entityId, field, oldValue, newValue, modifiedAt)
       VALUES ('employee', ?, ?, NULL, ?, ?)`
    );

    const partnerNames = employees.filter((e) => e.grade === "Partner").map((e) => e.name);
    const ROLES = [
      "Responsable patrimoine",
      "Expert référent",
      "Chef de mission",
      "Chargé de mission",
      "Directeur de patrimoine",
      "Responsable mission",
      "Pilote GAIF",
    ];

    for (const emp of employees) {
      // DM — every employee has a direct manager
      const dm = randomFrom(partnerNames);
      insOverride.run(emp.empId, "dm", dm, now);

      // Role — the employee's grade
      insOverride.run(emp.empId, "role", emp.grade, now);

      // Segment and service line — use the employee's own values
      if (emp.subTeam) insOverride.run(emp.empId, "segment", emp.subTeam, now);
      if (emp.serviceLine) insOverride.run(emp.empId, "serviceLine", emp.serviceLine, now);

      // Arrival date — all employees have one (their actual arrival)
      insOverride.run(emp.empId, "arrivalDate", emp.arrival, now);

      // Departure date — ~15% have a planned departure
      const departureDate = emp.departure || (Math.random() < 0.15 ? randomDate("2026-06-01", "2027-03-31") : null);
      if (departureDate) {
        insOverride.run(emp.empId, "departureDate", departureDate, now);
        if (!emp.departure) insOverride.run(emp.empId, "manual_departure", "true", now);
      }

      // Grade history — ~30% have a promotion history
      if (Math.random() < 0.3 && !["Partner", "Intern"].includes(emp.grade)) {
        const prevGrades: Record<string, string> = {
          Director: "Senior Manager",
          "Senior Manager": "Manager",
          Manager: "Senior Consultant",
          "Senior Consultant": "Consultant",
          Consultant: "Analyst",
          Analyst: "Intern",
        };
        const prev = prevGrades[emp.grade];
        if (prev) {
          const gradeHistory = JSON.stringify([
            { grade: prev, since: emp.arrival },
            { grade: emp.grade, since: randomDate("2025-06-01", "2026-02-28") },
          ]);
          insOverride.run(emp.empId, "gradeHistory", gradeHistory, now);
        }
      }

      // ETP adjustments — ~8% part-time
      if (Math.random() < 0.08) {
        const etpStart = randomDate("2026-01-01", "2026-06-30");
        const etpEnd = addDays(etpStart, randomBetween(60, 180));
        const etp = randomFrom([0.5, 0.6, 0.8]);
        insOverride.run(
          emp.empId,
          "etp_adjustments",
          JSON.stringify([{ startDate: etpStart, endDate: etpEnd, ratio: etp }]),
          now
        );
      }
    }

    // ── Manual employees (user-created — same columns as employees) ──

    const insManualEmp = db.prepare(
      `INSERT OR REPLACE INTO user_employees (empId, name, grade, subTeam, serviceLine, managerId, arrivalDate, gradeHistory, source, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
    );
    const manualEmps = [
      {
        empId: "MANUAL001",
        name: "Jean-Paul Fictif",
        grade: "Consultant",
        subTeam: "FSI",
        serviceLine: "Technology",
        arrival: "2026-04-01",
      },
      {
        empId: "MANUAL002",
        name: "Marie Virtuelle",
        grade: "Analyst",
        subTeam: "ERT",
        serviceLine: "Operations",
        arrival: "2026-05-15",
      },
      {
        empId: "MANUAL003",
        name: "Antoine Simule",
        grade: "Senior Consultant",
        subTeam: "TMT",
        serviceLine: "Customer & Growth",
        arrival: "2026-03-01",
      },
    ];
    for (const me of manualEmps) {
      insManualEmp.run(
        me.empId,
        me.name,
        me.grade,
        me.subTeam,
        me.serviceLine,
        randomFrom(partnerNames),
        me.arrival,
        null,
        now,
        now
      );
    }

    // ── Recruitment candidates + applications ──

    const RECRUITMENT_STATUSES = [
      "new",
      "screening",
      "interview_1",
      "interview_2",
      "hrInterview",
      "offer",
      "hired",
      "rejected",
    ];
    const GRADE_BUCKETS = ["Intern", "Analyst", "Consultant+"];
    const JOB_POSTINGS = [
      "Consultant Data & Analytics",
      "Analyst Financial Services",
      "Senior Consultant Cloud",
      "Consultant Cybersecurity",
      "Analyst Operations",
      "Consultant SAP S/4HANA",
    ];
    const recruiters = employees.filter((e) => ["Manager", "Senior Manager", "Director"].includes(e.grade)).slice(0, 8);

    const insCandidate = db.prepare(
      `INSERT OR REPLACE INTO nonconformities
       (id, firstName, lastName, email, phone, status, poste, gradeBucket, jobPostings,
        creationDate, lastActivity, grade, candidateStatus, tags, note, evaluatedBy,
        recruiter1, recruiter1Date, recruiter1Decision, recruiter1EmpId,
        recruiter2, recruiter2Date, recruiter2Decision, recruiter2EmpId,
        hrInterviewerName, hrInterviewDate, hrInterviewDecision,
        matchedEmpId, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insApp = db.prepare(
      `INSERT OR REPLACE INTO nc_scopes (candidateId, jobPosting, segment, offering)
       VALUES (?, ?, ?, ?)`
    );

    const candidateCount = randomBetween(25, 40);
    let recruitCandidates = 0;
    let recruitApps = 0;
    for (let i = 0; i < candidateCount; i++) {
      const cid = `recruit-demo-${uuid()}`;
      const firstName = randomFrom(FIRST_NAMES);
      const lastName = randomFrom(LAST_NAMES);
      const status = randomFrom(RECRUITMENT_STATUSES);
      const gradeBucket = randomFrom(GRADE_BUCKETS);
      const posting = randomFrom(JOB_POSTINGS);
      const creationDate = randomDate("2025-10-01", "2026-03-31");
      const lastActivity = addDays(creationDate, randomBetween(1, 60));
      const rec1 = randomFrom(recruiters);
      const rec1Date = addDays(creationDate, randomBetween(3, 14));
      const rec1Decision = status === "rejected" && Math.random() < 0.3 ? "no" : "go";
      const rec2 = randomFrom(recruiters);
      const rec2Date = rec1Decision === "go" ? addDays(rec1Date, randomBetween(5, 14)) : null;
      const rec2Decision = rec2Date ? (status === "rejected" && Math.random() < 0.4 ? "no" : "go") : null;
      const hrName = randomFrom(partners).name;
      const hrDate = rec2Decision === "go" ? addDays(rec2Date!, randomBetween(5, 10)) : null;
      const hrDecision = hrDate ? (status === "hired" ? "go" : status === "rejected" ? "no" : null) : null;
      const matchedEmpId = status === "hired" ? `recruit_${cid}` : null;
      const note = Math.random() < 0.6 ? randomFloat(2, 5, 1) : null;

      insCandidate.run(
        cid,
        firstName,
        lastName,
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        `+33 6 ${randomBetween(10, 99)} ${randomBetween(10, 99)} ${randomBetween(10, 99)} ${randomBetween(10, 99)}`,
        status,
        posting,
        gradeBucket,
        JSON.stringify([posting]),
        creationDate,
        lastActivity,
        gradeBucket === "Consultant+" ? "Consultant" : gradeBucket,
        status,
        JSON.stringify(Math.random() < 0.4 ? ["bilingual", "top-school"] : []),
        note,
        note ? randomFrom(recruiters).name : null,
        rec1.name,
        rec1Date,
        rec1Decision,
        rec1.empId,
        rec2?.name || null,
        rec2Date,
        rec2Decision,
        rec2?.empId || null,
        hrName,
        hrDate,
        hrDecision,
        matchedEmpId,
        now
      );
      recruitCandidates++;

      // 1-2 applications per candidate
      const appCount = randomBetween(1, 2);
      const usedPostings = new Set<string>();
      for (let j = 0; j < appCount; j++) {
        let p = randomFrom(JOB_POSTINGS);
        while (usedPostings.has(p)) p = randomFrom(JOB_POSTINGS);
        usedPostings.add(p);
        const useSegment = Math.random() < 0.5;
        insApp.run(
          cid,
          p,
          useSegment ? randomFrom(["FSI", "ERT", "TMT", "AUTO", "PHS"]) : null,
          useSegment ? null : randomFrom(SERVICE_LINES)
        );
        recruitApps++;
      }
    }

    // ── Manual user opportunities (user-created opps — full data like CRM) ──

    const insUserOpp = db.prepare(
      `INSERT OR REPLACE INTO user_assets
       (opportunityId, opportunity, accountId, account, status, grossRevenue, netRevenue, winPct, cm1Pct,
        jobCode, engagementType, weightedBooking,
        creationDate, bookingDate, estimatedBookingDate, lastStatusChangeDate,
        manager, partner, em, ep, country, region, subSegmentCode, subSegment,
        serviceLine1, serviceLine2, serviceOffering1, serviceOffering1Pct,
        serviceOffering2, serviceOffering2Pct,
        technologyPartner1, primaryContactId, primaryContact,
        createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const managerNames = employees.filter((e) => ["Manager", "Senior Manager"].includes(e.grade)).map((e) => e.name);
    const userOpps = [
      { opportunity: "Internal Tool — Dashboard V2", account: accounts[0], revenue: 85000, sl: "Technology" },
      { opportunity: "Quick Win — Process Audit", account: accounts[1], revenue: 35000, sl: "Operations" },
      {
        opportunity: "Cloud Migration — Phase 2",
        account: accounts[2],
        revenue: 220000,
        sl: "Enterprise SAP Transformation",
      },
    ];
    for (const uo of userOpps) {
      const uoid = `manual-${uuid()}`;
      const gross = uo.revenue;
      const net = Math.round(gross * 0.85);
      const winPct = randomBetween(40, 80);
      const cm1 = randomFloat(15, 35);
      const weighted = Math.round((gross * winPct) / 100);
      const creationDate = randomDate("2026-01-01", "2026-03-01");
      const estBooking = addDays(creationDate, randomBetween(30, 120));
      const contact = contacts.find((c) => c.accountId === uo.account.accountId);
      insUserOpp.run(
        uoid,
        uo.opportunity,
        uo.account.accountId,
        uo.account.name,
        4,
        gross,
        net,
        winPct,
        cm1,
        `M-${randomBetween(100000, 999999)}`,
        randomFrom(["Time & Material", "Fixed Price", "Advisory"]),
        weighted,
        creationDate,
        null,
        estBooking,
        creationDate,
        randomFrom(managerNames),
        randomFrom(partnerNames),
        randomFrom(managerNames),
        randomFrom(partnerNames),
        uo.account.country,
        uo.account.region,
        uo.account.subSegmentCode,
        uo.account.subSegment,
        uo.sl,
        Math.random() < 0.4 ? randomFrom(SERVICE_LINES) : null,
        randomFrom(SERVICE_OFFERINGS),
        randomBetween(60, 100),
        Math.random() < 0.3 ? randomFrom(SERVICE_OFFERINGS) : null,
        Math.random() < 0.3 ? randomBetween(20, 40) : null,
        Math.random() < 0.3 ? randomFrom(["Microsoft", "SAP", "AWS", "Google Cloud"]) : null,
        contact?.contactId || null,
        contact?.fullName || null,
        now,
        now
      );
    }

    // ── Manual user accounts (1 user-created account) ──

    db.prepare(
      `INSERT OR REPLACE INTO user_accounts (accountId, account, subSegmentCode, subSegment, country, region, accountLeader, source, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`
    ).run(
      uuid(),
      "Demo Corp (Manual)",
      "FIN",
      "Financial Services",
      "France",
      "WST",
      randomFrom(partnerNames),
      now,
      now
    );

    // ── Status overrides (some opportunities with status changed by user) ──

    const statusOverrideInsert = db.prepare(
      `INSERT OR REPLACE INTO user_overrides (entityType, entityId, field, oldValue, newValue, modifiedAt)
       VALUES ('opportunity', ?, ?, ?, ?, ?)`
    );
    // Override a few pipeline opps to Won/Booked
    const pipelineOpps = opps.filter((o) => [1, 4, 6].includes(o.status));
    for (let i = 0; i < Math.min(3, pipelineOpps.length); i++) {
      const po = pipelineOpps[i];
      statusOverrideInsert.run(po.opportunityId, "status", String(po.status), "11", now);
      statusOverrideInsert.run(po.opportunityId, "override_comment", null, "Moved to Won by demo user", now);
    }

    // ── Notifications ──

    const insNotif = db.prepare(
      `INSERT INTO user_notifications (type, title, message, opportunityId, empId, isRead, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const notifTemplates = [
      { type: "staffing_need", title: "New staffing need", msg: "2x Consultant needed for ${opp}" },
      { type: "status_change", title: "Status updated", msg: "${opp} moved to Qualified" },
      { type: "action", title: "Action due soon", msg: "Prepare proposal for ${opp}" },
      { type: "import", title: "Data refreshed", msg: "CRM data updated (${n} opportunities)" },
    ];
    const notifCount = randomBetween(8, 15);
    for (let i = 0; i < notifCount; i++) {
      const tmpl = randomFrom(notifTemplates);
      const opp = randomFrom(opps);
      const msg = tmpl.msg.replace("${opp}", opp.opportunity).replace("${n}", String(opps.length));
      insNotif.run(
        tmpl.type,
        tmpl.title,
        msg,
        tmpl.type !== "import" ? opp.opportunityId : null,
        null,
        Math.random() < 0.4 ? 1 : 0,
        randomDate("2026-02-01", "2026-03-31") +
          "T" +
          `${randomBetween(8, 18)}:${randomBetween(0, 59).toString().padStart(2, "0")}:00Z`
      );
    }
  });

  insertAll();

  const counts = {
    employees: employees.length,
    accounts: accounts.length,
    contacts: contacts.length,
    opportunities: opps.length,
    assignments: assignments.length,
    sapRecords: sapRecords.length,
    skills: skills.length,
    actions: actions.length,
    staffingNeeds: staffingNeeds.length,
    revenueTeam: revenueTeam.length,
    recruitCandidates: 30,
    manualOpportunities: 3,
    manualEmployees: 3,
    notifications: 10,
  };

  log("demo", `Seeded: ${JSON.stringify(counts)}`);
  return { counts };
}

/**
 * Supprime toutes les données demo et remet à zéro.
 */
export function clearDemoData() {
  db.transaction(() => {
    // User data (new tables)
    db.exec("DELETE FROM user_overrides");
    db.exec("DELETE FROM user_assets");
    db.exec("DELETE FROM user_employees");
    db.exec("DELETE FROM user_asset_team");
    db.exec("DELETE FROM user_scenarios");
    // var_* tables are NOT cleared here — managed by copyVarTables() in demo.ts
    db.exec("DELETE FROM user_staffing_needs");
    db.exec("DELETE FROM user_actions");
    db.exec("DELETE FROM user_accounts");
    db.exec("DELETE FROM user_notifications");
    // Recruitment
    db.exec("DELETE FROM nc_scopes");
    db.exec("DELETE FROM nonconformities");
    // Source data
    db.exec("DELETE FROM hr_skills");
    db.exec("DELETE FROM sap_records");
    db.exec("DELETE FROM mds_assignments");
    db.exec("DELETE FROM assets");
    db.exec("DELETE FROM sites");
    db.exec("DELETE FROM employees");
    // AI history
    db.exec("DELETE FROM var_aihistory");
  })();

  log("demo", "All demo data cleared.");
}

/**
 * Vérifie si des données demo existent déjà.
 */
export function hasDemoData(): boolean {
  const emp = db.prepare("SELECT COUNT(*) as cnt FROM employees").get() as { cnt: number };
  if (emp.cnt === 0) return false;
  // Also check user data tables — if employees exist but user data was cleared, re-seed
  const needs = db.prepare("SELECT COUNT(*) as cnt FROM user_staffing_needs").get() as { cnt: number };
  return needs.cnt > 0;
}
