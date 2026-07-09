-- ═══════════════════════════════════════════════════════════════════════════
-- Dashboard SQLite Schema — Single source of truth
-- Used by: scripts/init_db.py (setup) + api/src/db/initSchema.ts (demo DB)
-- ═══════════════════════════════════════════════════════════════════════════

-- SOURCE DATA

CREATE TABLE IF NOT EXISTS employees (
  empId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  grade TEXT,
  subTeam TEXT,
  serviceLine TEXT,
  managerId TEXT,
  arrivalDate TEXT,
  departureDate TEXT,
  gradeHistory TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS mds_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empId TEXT NOT NULL REFERENCES employees(empId) ON DELETE CASCADE,
  jobNo TEXT,
  jobName TEXT,
  category TEXT,
  startDate TEXT,
  endDate TEXT,
  utilization REAL,
  hoursPerDay REAL,
  updatedAt TEXT
);

-- ═══════════════════════════════════════════════════════════════════════════
-- GAIF native tables (refonte v2 — tables renommées depuis crm_* hérité BP)
-- assets (ex-crm_opportunities) → actifs du parc installations fixes
-- sites (ex-crm_accounts) → sites & technicentres
-- user_assets (ex-user_opportunities) → actifs créés par l'utilisateur
-- nonconformities (ex-hr_candidates) → non-conformités ISO 55001
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS assets (
  opportunityId TEXT PRIMARY KEY,         -- identifiant de l'actif (conservé pour compat React Query/filtres existants)
  crmGuid TEXT,
  opportunity TEXT NOT NULL,              -- nom de l'actif
  accountId TEXT,
  account TEXT,
  status INTEGER,                          -- phase cycle de vie (1=Émergence ... 15=Déclassé)
  grossRevenue REAL,                       -- valeur d'achat (€)
  netRevenue REAL,                         -- valeur résiduelle (€)
  winPct REAL,                             -- taux de disponibilité (%)
  cm1Pct REAL,                             -- taux de conformité (%)
  jobCode TEXT,                            -- code projet / WO
  engagementType TEXT,                     -- criticité (Critique/Modérée/Non critique)
  weightedBooking REAL,                    -- [legacy BP, usage résiduel frontend]
  creationDate TEXT,                       -- date d'acquisition
  bookingDate TEXT,                        -- dernière VR
  estimatedBookingDate TEXT,               -- prochaine VR planifiée
  lastStatusChangeDate TEXT,
  manager TEXT,
  partner TEXT,                            -- prestataire de maintenance
  em TEXT,
  ep TEXT,
  managerId TEXT,
  partnerId TEXT,
  emId TEXT,
  epId TEXT,
  managerCrmGuid TEXT,
  partnerCrmGuid TEXT,
  emCrmGuid TEXT,
  epCrmGuid TEXT,
  country TEXT,
  region TEXT,
  segmentCode TEXT,
  subSegmentCode TEXT,                     -- patrimoine (Ferroviaire, Immobilier, IO, ...)
  subSegment TEXT,                         -- famille d'actif
  serviceLine1 TEXT,                       -- site/technicentre
  serviceLine2 TEXT,
  serviceLine3 TEXT,
  serviceOffering1 TEXT,                   -- mission socle GAIF
  serviceOffering2 TEXT,
  serviceOffering3 TEXT,
  serviceOffering1Pct REAL,
  serviceOffering2Pct REAL,                -- coût maintenance annuel
  serviceOffering3Pct REAL,
  technologyPartner1 TEXT,                 -- [legacy BP, peut être null en GAIF]
  technologyPartner2 TEXT,                 -- [legacy BP]
  technologyPartner3 TEXT,                 -- [legacy BP]
  lostComment TEXT,                        -- commentaire actif (fin de vie, NC, etc.)
  primaryContactId TEXT,                   -- [legacy CRM]
  primaryContact TEXT,                     -- [legacy CRM]
  -- GAIF native metrics
  utilizationPct REAL,
  incidents12m INTEGER DEFAULT 0,
  consoEau REAL DEFAULT 0,
  consoElec REAL DEFAULT 0,
  consoGaz REAL DEFAULT 0,
  surfaceM2 REAL DEFAULT 0,
  mtbf REAL DEFAULT 0,
  mttr REAL DEFAULT 0,
  etatAbe TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS sap_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empId TEXT NOT NULL REFERENCES employees(empId) ON DELETE CASCADE,
  date TEXT NOT NULL,
  name TEXT,
  salesOrder TEXT,
  salesOrderItem TEXT,
  absenceType TEXT,
  hours REAL DEFAULT 0,
  text TEXT,
  category TEXT,
  activityType TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS hr_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  empId TEXT NOT NULL REFERENCES employees(empId) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER,
  category TEXT
);

CREATE TABLE IF NOT EXISTS sites (
  accountId TEXT PRIMARY KEY,              -- identifiant du site
  account TEXT NOT NULL,                   -- nom du site
  segmentCode TEXT,                         -- BU (TN, TER, IC)
  subSegmentCode TEXT,
  subSegment TEXT,
  country TEXT,
  region TEXT,
  parentAccount TEXT,
  accountLeader TEXT,
  updatedAt TEXT
);

-- Contacts CRM (commercial) — conservée pour refresh Dynamics, faible usage GAIF
CREATE TABLE IF NOT EXISTS crm_contacts (
  contactId TEXT PRIMARY KEY,
  fullName TEXT,
  firstName TEXT,
  lastName TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  jobTitle TEXT,
  department TEXT,
  city TEXT,
  country TEXT,
  accountId TEXT,
  account TEXT,
  owner TEXT,
  createdOn TEXT,
  updatedAt TEXT
);

-- Renommée depuis hr_candidates — stocke les non-conformités ISO 55001
CREATE TABLE IF NOT EXISTS nonconformities (
  id TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,                 -- référence NC (ex: NC-2026-0042)
  lastName TEXT NOT NULL,                  -- titre / libellé NC
  email TEXT,
  phone TEXT,
  status TEXT,
  poste TEXT,
  gradeBucket TEXT,
  jobPostings TEXT,
  creationDate TEXT,
  lastActivity TEXT,
  grade TEXT,
  candidateStatus TEXT,
  tags TEXT,
  note REAL,
  evaluatedBy TEXT,
  hrInterview TEXT,
  linkedinUrl TEXT,
  recruiter1 TEXT,
  recruiter1Date TEXT,
  recruiter1Decision TEXT,
  recruiter1EmpId TEXT,
  recruiter2 TEXT,
  recruiter2Date TEXT,
  recruiter2Decision TEXT,
  recruiter2EmpId TEXT,
  recruiter3 TEXT,
  recruiter3Date TEXT,
  recruiter3Decision TEXT,
  recruiter3EmpId TEXT,
  hrInterviewerName TEXT,
  hrInterviewDate TEXT,
  hrInterviewDecision TEXT,
  matchedEmpId TEXT,
  updatedAt TEXT
);

CREATE INDEX IF NOT EXISTS idx_nc_status ON nonconformities(status);
CREATE INDEX IF NOT EXISTS idx_nc_date ON nonconformities(creationDate);

-- Une NC peut avoir plusieurs rattachements (sites, patrimoines impactés) — renommée depuis hr_applications
CREATE TABLE IF NOT EXISTS nc_scopes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidateId TEXT NOT NULL REFERENCES nonconformities(id) ON DELETE CASCADE,
  jobPosting TEXT NOT NULL,
  segment TEXT,
  offering TEXT,
  UNIQUE(candidateId, jobPosting)
);
CREATE INDEX IF NOT EXISTS idx_nc_scope_candidate ON nc_scopes(candidateId);
CREATE INDEX IF NOT EXISTS idx_nc_scope_segment ON nc_scopes(segment);
CREATE INDEX IF NOT EXISTS idx_nc_scope_offering ON nc_scopes(offering);

CREATE TABLE IF NOT EXISTS var_country_region (
  country TEXT PRIMARY KEY,
  region TEXT
);

CREATE TABLE IF NOT EXISTS var_optionsets (
  attribute TEXT NOT NULL,
  value INTEGER NOT NULL,
  label TEXT NOT NULL,
  PRIMARY KEY (attribute, value)
);

-- Source → DB column mapping reference (populated by init_db.py)
CREATE TABLE IF NOT EXISTS var_renaming (
  source TEXT NOT NULL,           -- 'CRM', 'MDS', 'SAP', 'Skills'
  targetTable TEXT NOT NULL,      -- 'crm_opportunities', 'employees', etc.
  sourceField TEXT NOT NULL,      -- field name in source system
  dbColumn TEXT NOT NULL,         -- column name in our DB
  description TEXT,
  PRIMARY KEY (source, targetTable, sourceField)
);

CREATE TABLE IF NOT EXISTS var_config (
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (category, key)
);

CREATE TABLE IF NOT EXISTS var_holidays (
  date TEXT PRIMARY KEY,
  name TEXT,
  country TEXT DEFAULT 'FR'
);

-- USER MODIFICATIONS
-- Architecture: EAV table for overrides + dedicated tables for manual creations.
-- user_overrides: 1 row per modified field (entityType + entityId + field + old/new value)
-- user_assets: actifs créés manuellement par l'utilisateur (cible GAIF v2)
-- user_employees: user-created employees (minimal)

CREATE TABLE IF NOT EXISTS user_accounts (
  accountId TEXT PRIMARY KEY,
  account TEXT,
  segmentCode TEXT,
  subSegmentCode TEXT,
  subSegment TEXT,
  country TEXT,
  region TEXT,
  parentAccount TEXT,
  accountLeader TEXT,
  source TEXT DEFAULT 'manual',
  createdAt TEXT,
  updatedAt TEXT
);

-- EAV table: ALL modifications to existing entities (opportunities + employees)
CREATE TABLE IF NOT EXISTS user_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entityType TEXT NOT NULL,       -- 'opportunity' | 'employee'
  entityId TEXT NOT NULL,         -- opportunityId or empId
  field TEXT NOT NULL,             -- 'status', 'dm', 'gradeHistory', etc.
  oldValue TEXT,                  -- previous value (NULL if unknown)
  newValue TEXT NOT NULL,         -- new value (JSON string for complex types)
  modifiedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_overrides_entity ON user_overrides(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_user_overrides_modified ON user_overrides(modifiedAt);

-- Actifs créés manuellement par l'utilisateur (mirror de assets)
CREATE TABLE IF NOT EXISTS user_assets (
  opportunityId TEXT PRIMARY KEY,
  opportunity TEXT,
  accountId TEXT,
  account TEXT,
  status INTEGER,
  grossRevenue REAL,
  netRevenue REAL,
  winPct REAL,
  cm1Pct REAL,
  jobCode TEXT,
  engagementType TEXT,
  creationDate TEXT,
  bookingDate TEXT,
  estimatedBookingDate TEXT,
  lastStatusChangeDate TEXT,
  manager TEXT,
  partner TEXT,
  em TEXT,
  ep TEXT,
  managerId TEXT,
  partnerId TEXT,
  emId TEXT,
  epId TEXT,
  managerCrmGuid TEXT,
  partnerCrmGuid TEXT,
  emCrmGuid TEXT,
  epCrmGuid TEXT,
  country TEXT,
  region TEXT,
  segmentCode TEXT,
  subSegmentCode TEXT,
  subSegment TEXT,
  serviceLine1 TEXT,
  serviceLine2 TEXT,
  serviceLine3 TEXT,
  serviceOffering1 TEXT,
  serviceOffering2 TEXT,
  serviceOffering3 TEXT,
  serviceOffering1Pct REAL,
  serviceOffering2Pct REAL,
  serviceOffering3Pct REAL,
  technologyPartner1 TEXT,
  technologyPartner2 TEXT,
  technologyPartner3 TEXT,
  lostComment TEXT,
  primaryContactId TEXT,
  primaryContact TEXT,
  weightedBooking REAL,
  -- GAIF native metrics (mirror of assets)
  utilizationPct REAL,
  incidents12m INTEGER DEFAULT 0,
  consoEau REAL DEFAULT 0,
  consoElec REAL DEFAULT 0,
  consoGaz REAL DEFAULT 0,
  surfaceM2 REAL DEFAULT 0,
  mtbf REAL DEFAULT 0,
  mttr REAL DEFAULT 0,
  etatAbe TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

-- Manual employees: user-created employees (same schema as employees)
-- NOTE: No FK to employees(empId) — manual employees don't exist in the employees table.
CREATE TABLE IF NOT EXISTS user_employees (
  empId TEXT PRIMARY KEY,
  name TEXT,
  grade TEXT,
  subTeam TEXT,
  serviceLine TEXT,
  managerId TEXT,
  arrivalDate TEXT,
  departureDate TEXT,
  gradeHistory TEXT,
  source TEXT DEFAULT 'manual',
  createdAt TEXT,
  updatedAt TEXT
);


-- NOTE: No FK to employees(empId) — same reason as user_employees.
CREATE TABLE IF NOT EXISTS user_assignments (
  empId TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  modifiedBy TEXT
);

CREATE TABLE IF NOT EXISTS user_actions (
  id TEXT PRIMARY KEY,
  opportunityId TEXT NOT NULL REFERENCES assets(opportunityId) ON DELETE CASCADE,
  description TEXT,
  owner TEXT,
  dueDate TEXT,
  priority TEXT,
  status TEXT,
  createdAt TEXT,
  modifiedBy TEXT
);

CREATE TABLE IF NOT EXISTS user_staffing_needs (
  id TEXT PRIMARY KEY,
  opportunityId TEXT NOT NULL REFERENCES assets(opportunityId) ON DELETE CASCADE,
  grade TEXT,
  quantity INTEGER,
  utilization INTEGER,
  startDate TEXT,
  endDate TEXT,
  skills TEXT,
  probability REAL,
  status TEXT DEFAULT 'open',
  description TEXT,
  assignedTo TEXT,
  createdAt TEXT,
  modifiedAt TEXT,
  modifiedBy TEXT
);

-- Équipe projet par actif (ex-user_revenue_team — nom BP commercial)
CREATE TABLE IF NOT EXISTS user_asset_team (
  id TEXT PRIMARY KEY,
  opportunityId TEXT NOT NULL REFERENCES assets(opportunityId) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gradeBucket TEXT NOT NULL,
  percentage REAL NOT NULL DEFAULT 100,
  modifiedAt TEXT,
  modifiedBy TEXT
);

CREATE TABLE IF NOT EXISTS user_scenarios (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  baseId TEXT,
  overrides TEXT,
  empOverrides TEXT,
  createdAt TEXT
);

-- IA

CREATE TABLE IF NOT EXISTS var_aihistory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session TEXT NOT NULL,
  role TEXT NOT NULL,
  message TEXT NOT NULL,
  context TEXT,
  userId TEXT,
  createdAt TEXT
);

-- NOTIFICATIONS

CREATE TABLE IF NOT EXISTS user_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  opportunityId TEXT,
  empId TEXT,
  isRead INTEGER DEFAULT 0,
  createdAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications(isRead, createdAt);

-- LOGOS (cache Brandfetch domain lookups)

CREATE TABLE IF NOT EXISTS var_logos (
  accountName TEXT PRIMARY KEY,
  domain TEXT,
  logoUrl TEXT,
  status TEXT DEFAULT 'pending',
  updatedAt TEXT
);

-- CRM ↔ EMPLOYEE MAPPING (persistent GUID → empId resolution)

CREATE TABLE IF NOT EXISTS crm_employee_mapping (
  crmGuid TEXT PRIMARY KEY,          -- systemuserid from Dynamics 365
  empId TEXT,                        -- empId from employees table (MDS/SAP)
  fullName TEXT,                     -- CRM display name (for debug)
  verified INTEGER DEFAULT 0,        -- 0 = auto-matched by name, 1 = manually verified
  updatedAt TEXT
);

-- SYSTEME

CREATE TABLE IF NOT EXISTS var_importlog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fileName TEXT NOT NULL,
  fileType TEXT,
  rowCount INTEGER,
  status TEXT,
  error TEXT,
  importedAt TEXT,
  fileMtime REAL
);

-- AUDIT

CREATE TABLE IF NOT EXISTS var_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT,
  action TEXT NOT NULL,
  entityType TEXT,
  entityId TEXT,
  details TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_var_audit_entity ON var_audit(entityType, entityId);
CREATE INDEX IF NOT EXISTS idx_var_audit_date ON var_audit(createdAt);

-- AUTH

CREATE TABLE IF NOT EXISTS var_auth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  displayName TEXT,
  createdAt TEXT NOT NULL,
  lastLogin TEXT
);

-- INDEX

CREATE INDEX IF NOT EXISTS idx_mds_assignments_empId ON mds_assignments(empId);
CREATE INDEX IF NOT EXISTS idx_mds_assignments_dates ON mds_assignments(startDate, endDate);
CREATE INDEX IF NOT EXISTS idx_sap_records_emp_date ON sap_records(empId, date);
CREATE INDEX IF NOT EXISTS idx_hr_skills_empId ON hr_skills(empId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_skills_unique ON hr_skills(empId, name);
CREATE INDEX IF NOT EXISTS idx_user_actions_opportunityId ON user_actions(opportunityId);
CREATE INDEX IF NOT EXISTS idx_user_staffing_needs_opportunityId ON user_staffing_needs(opportunityId);
CREATE INDEX IF NOT EXISTS idx_user_asset_team_opportunityId ON user_asset_team(opportunityId);
CREATE INDEX IF NOT EXISTS idx_var_aihistory_session ON var_aihistory(session);
CREATE INDEX IF NOT EXISTS idx_var_importlog_file ON var_importlog(fileName);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_accountId ON assets(accountId);
CREATE INDEX IF NOT EXISTS idx_assets_country ON assets(country);
CREATE INDEX IF NOT EXISTS idx_assets_region ON assets(region);
CREATE INDEX IF NOT EXISTS idx_assets_jobCode ON assets(jobCode);
CREATE INDEX IF NOT EXISTS idx_sap_records_salesOrder ON sap_records(salesOrder);
CREATE INDEX IF NOT EXISTS idx_mds_assignments_jobNo ON mds_assignments(jobNo);
CREATE INDEX IF NOT EXISTS idx_mds_assignments_category ON mds_assignments(category);

-- Employee lifecycle: heavily filtered for active employee queries
CREATE INDEX IF NOT EXISTS idx_employees_arrival ON employees(arrivalDate);
CREATE INDEX IF NOT EXISTS idx_employees_departure ON employees(departureDate);

-- Assets date filters: parc par dates d'acquisition/VR
CREATE INDEX IF NOT EXISTS idx_assets_creationDate ON assets(creationDate);
CREATE INDEX IF NOT EXISTS idx_assets_bookingDate ON assets(bookingDate);
CREATE INDEX IF NOT EXISTS idx_assets_estimated_booking ON assets(estimatedBookingDate);
CREATE INDEX IF NOT EXISTS idx_assets_subSegment ON assets(subSegmentCode);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_assets_managerId ON assets(managerId);
CREATE INDEX IF NOT EXISTS idx_assets_serviceLine ON assets(serviceLine1);
CREATE INDEX IF NOT EXISTS idx_sap_activity_date ON sap_records(activityType, date);
CREATE INDEX IF NOT EXISTS idx_mds_emp_cat_end ON mds_assignments(empId, category, endDate);
CREATE INDEX IF NOT EXISTS idx_staffing_needs_period ON user_staffing_needs(startDate, endDate);

-- HISTORY

CREATE TABLE IF NOT EXISTS opp_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opportunityId TEXT NOT NULL,
  snapshotDate TEXT NOT NULL,
  status INTEGER,
  grossRevenue REAL,
  netRevenue REAL,
  winPct REAL,
  estimatedBookingDate TEXT,
  bookingDate TEXT,
  manager TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_opp_history_snap ON opp_history(opportunityId, snapshotDate);

-- CANDIDATE ↔ STAFFING NEEDS

-- NC ↔ STAFFING NEEDS — rapprochement d'une NC avec un besoin en compétences GAIF
CREATE TABLE IF NOT EXISTS nc_staffing_match (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidateId TEXT NOT NULL REFERENCES nonconformities(id) ON DELETE CASCADE,
  staffingNeedId TEXT NOT NULL REFERENCES user_staffing_needs(id) ON DELETE CASCADE,
  matchScore REAL,
  matchedAt TEXT,
  matchedBy TEXT,
  UNIQUE(candidateId, staffingNeedId)
);
CREATE INDEX IF NOT EXISTS idx_ncsm_candidate ON nc_staffing_match(candidateId);
CREATE INDEX IF NOT EXISTS idx_ncsm_need ON nc_staffing_match(staffingNeedId);

-- ═══════════════════════════════════════════════════════════════════════════
-- GAIF — Domain-specific tables (cible opérationnelle Direction GAIF)
-- Complète assets + sites avec les tables métier EAM propres à la gestion
-- d'actifs installations fixes.
-- ═══════════════════════════════════════════════════════════════════════════

-- Contrats prestataires (TSO, SFERIS, E2MT Equans, Engie, SPIE, etc.)
CREATE TABLE IF NOT EXISTS gaif_contracts (
  id TEXT PRIMARY KEY,
  prestataire TEXT NOT NULL,
  patrimoine TEXT NOT NULL,
  scope TEXT,
  sites TEXT,                     -- JSON array of accountId
  startDate TEXT,
  endDate TEXT,
  amount REAL,
  perfScore INTEGER,
  managerId TEXT,                 -- empId (pas de FK : peut cibler un user_employees)
  status TEXT DEFAULT 'actif',
  createdAt TEXT,
  updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_gaif_contracts_patrimoine ON gaif_contracts(patrimoine);
CREATE INDEX IF NOT EXISTS idx_gaif_contracts_endDate ON gaif_contracts(endDate);

-- Planification des Visites Réglementaires (VR) et maintenances préventives
CREATE TABLE IF NOT EXISTS gaif_vr_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  assetId TEXT NOT NULL,          -- opportunityId (assets ou user_assets)
  plannedDate TEXT NOT NULL,
  executedDate TEXT,
  vrType TEXT,                    -- 'reglementaire' | 'preventive' | 'corrective' | 'audit'
  status TEXT DEFAULT 'planifiee', -- 'planifiee' | 'en_cours' | 'realisee' | 'retardee'
  inspector TEXT,
  result TEXT,                    -- 'conforme' | 'reserve' | 'non_conforme'
  comment TEXT,
  createdAt TEXT,
  updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_gaif_vr_assetId ON gaif_vr_schedule(assetId);
CREATE INDEX IF NOT EXISTS idx_gaif_vr_planned ON gaif_vr_schedule(plannedDate);
CREATE INDEX IF NOT EXISTS idx_gaif_vr_status ON gaif_vr_schedule(status);

-- Registre des risques & opportunités ISO 55001 §6.1
CREATE TABLE IF NOT EXISTS gaif_risks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  kind TEXT NOT NULL,             -- 'risque' | 'opportunite'
  severity TEXT NOT NULL,         -- 'critique' | 'majeur' | 'modere' | 'mineur'
  stage TEXT NOT NULL,            -- 'identifie' | 'evalue' | 'plan_mitigation' | 'cloture'
  ownerId TEXT,                   -- empId
  processus TEXT,                 -- chapitre ISO 55001
  patrimoine TEXT,
  dueDate TEXT,
  createdAt TEXT,
  updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_gaif_risks_stage ON gaif_risks(stage);
CREATE INDEX IF NOT EXISTS idx_gaif_risks_kind ON gaif_risks(kind);
CREATE INDEX IF NOT EXISTS idx_gaif_risks_severity ON gaif_risks(severity);

-- Audits internes, pré-audits, certifications, revues de direction (ISO §9.2/9.3)
CREATE TABLE IF NOT EXISTS gaif_audits (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,             -- 'audit_interne' | 'revue_direction' | 'pre_audit' | 'certification'
  label TEXT NOT NULL,
  scope TEXT,
  plannedDate TEXT NOT NULL,
  completedDate TEXT,
  auditor TEXT,
  status TEXT DEFAULT 'planifie', -- 'planifie' | 'en_cours' | 'realise'
  report TEXT,
  createdAt TEXT,
  updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_gaif_audits_date ON gaif_audits(plannedDate);
CREATE INDEX IF NOT EXISTS idx_gaif_audits_status ON gaif_audits(status);

-- Référentiel documentaire (PSGA, prescriptions, notes, politique, présentation)
CREATE TABLE IF NOT EXISTS gaif_doctrinaire_docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,         -- 'Stratégie' | 'Prescription' | 'Note' | 'Présentation' | 'Politique'
  version TEXT,
  lastUpdate TEXT,
  owner TEXT,
  status TEXT DEFAULT 'Publié',   -- 'Publié' | 'Validation' | 'Work in progress'
  summary TEXT,
  content TEXT,                   -- full text for knowledge_base_lookup
  url TEXT,
  tags TEXT                       -- JSON array of searchable tags
);
CREATE INDEX IF NOT EXISTS idx_gaif_docs_category ON gaif_doctrinaire_docs(category);

-- Comitologie GAIF (4 comités officiels TN : COPIL Réseau, COPIL Immo, COTECH IDFM, COPIL RSE)
CREATE TABLE IF NOT EXISTS gaif_comites (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  shortLabel TEXT,
  cadence TEXT NOT NULL,          -- 'mensuel' | 'bimestriel' | 'trimestriel' | 'semestriel'
  coAnimateur TEXT,
  themes TEXT,                    -- JSON array
  raciLeadId TEXT,                -- empId
  nextOccurrence TEXT NOT NULL,
  color TEXT,
  createdAt TEXT,
  updatedAt TEXT
);

-- Actions & décisions liées à un comité
CREATE TABLE IF NOT EXISTS gaif_comite_actions (
  id TEXT PRIMARY KEY,
  comiteId TEXT NOT NULL REFERENCES gaif_comites(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  ownerId TEXT,                   -- empId
  dueDate TEXT,
  priority TEXT,                  -- 'haute' | 'moyenne' | 'basse'
  status TEXT DEFAULT 'open',     -- 'open' | 'in_progress' | 'done' | 'cancelled'
  decisionDate TEXT,
  outcome TEXT,
  createdAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_gaif_comite_actions_comite ON gaif_comite_actions(comiteId);
CREATE INDEX IF NOT EXISTS idx_gaif_comite_actions_status ON gaif_comite_actions(status);

-- Projets & initiatives d'industrialisation (PPI 2026-2030)
CREATE TABLE IF NOT EXISTS gaif_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  patrimoine TEXT,
  siteId TEXT,                    -- accountId
  phase INTEGER,                  -- status CRM 1..15 (émergence, CEB, étude, exploitation, fin de vie)
  marqueur TEXT,                  -- 'Clients' | 'Agilite' | 'JusteBesoin' | 'Innovation'
  leadId TEXT,                    -- empId
  startDate TEXT,
  endDate TEXT,
  budget REAL,
  budgetByYear TEXT,              -- JSON { '2026': 150000, '2027': 200000, ... }
  description TEXT,
  createdAt TEXT,
  updatedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_gaif_projects_patrimoine ON gaif_projects(patrimoine);
CREATE INDEX IF NOT EXISTS idx_gaif_projects_phase ON gaif_projects(phase);

-- ═══════════════════════════════════════════════════════════════════════════
-- GAIF — Migration helpers for existing databases
-- ═══════════════════════════════════════════════════════════════════════════
-- Note : SQLite ne supporte pas `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
-- Les colonnes GAIF natives ajoutées dans CREATE TABLE plus haut seront
-- appliquées automatiquement pour toute nouvelle DB. Pour les DB existantes,
-- la fonction `ensureGaifColumns` dans api/src/db/initSchema.ts vérifie et
-- ajoute les colonnes manquantes.

-- CRM GUID uniqueness
