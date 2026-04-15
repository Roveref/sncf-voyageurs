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

CREATE TABLE IF NOT EXISTS crm_opportunities (
  opportunityId TEXT PRIMARY KEY,
  crmGuid TEXT,
  opportunity TEXT NOT NULL,
  accountId TEXT,
  account TEXT,
  status INTEGER,
  grossRevenue REAL,
  netRevenue REAL,
  winPct REAL,
  cm1Pct REAL,
  jobCode TEXT,
  engagementType TEXT,
  weightedBooking REAL,
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

CREATE TABLE IF NOT EXISTS crm_accounts (
  accountId TEXT PRIMARY KEY,
  account TEXT NOT NULL,
  segmentCode TEXT,
  subSegmentCode TEXT,
  subSegment TEXT,
  country TEXT,
  region TEXT,
  parentAccount TEXT,
  accountLeader TEXT,
  updatedAt TEXT
);

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

CREATE TABLE IF NOT EXISTS hr_candidates (
  id TEXT PRIMARY KEY,
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
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

CREATE INDEX IF NOT EXISTS idx_recruit_status ON hr_candidates(status);
CREATE INDEX IF NOT EXISTS idx_recruit_date ON hr_candidates(creationDate);

-- Each candidate can have multiple job applications (one per posting)
CREATE TABLE IF NOT EXISTS hr_applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidateId TEXT NOT NULL REFERENCES hr_candidates(id) ON DELETE CASCADE,
  jobPosting TEXT NOT NULL,
  segment TEXT,
  offering TEXT,
  UNIQUE(candidateId, jobPosting)
);
CREATE INDEX IF NOT EXISTS idx_recruit_app_candidate ON hr_applications(candidateId);
CREATE INDEX IF NOT EXISTS idx_recruit_app_segment ON hr_applications(segment);
CREATE INDEX IF NOT EXISTS idx_recruit_app_offering ON hr_applications(offering);

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
-- user_opportunities: full user-created opportunities (CRM-like schema)
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

-- Manual opportunities: full user-created opportunities (no overrides here)
CREATE TABLE IF NOT EXISTS user_opportunities (
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
  weightedBooking REAL,
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
  opportunityId TEXT NOT NULL REFERENCES crm_opportunities(opportunityId) ON DELETE CASCADE,
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
  opportunityId TEXT NOT NULL REFERENCES crm_opportunities(opportunityId) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS user_revenue_team (
  id TEXT PRIMARY KEY,
  opportunityId TEXT NOT NULL REFERENCES crm_opportunities(opportunityId) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_user_revenue_team_opportunityId ON user_revenue_team(opportunityId);
CREATE INDEX IF NOT EXISTS idx_var_aihistory_session ON var_aihistory(session);
CREATE INDEX IF NOT EXISTS idx_var_importlog_file ON var_importlog(fileName);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_account ON crm_contacts(account);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_accountId ON crm_contacts(accountId);
CREATE INDEX IF NOT EXISTS idx_crm_opp_status ON crm_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_crm_opp_accountId ON crm_opportunities(accountId);
CREATE INDEX IF NOT EXISTS idx_crm_opp_country ON crm_opportunities(country);
CREATE INDEX IF NOT EXISTS idx_crm_opp_region ON crm_opportunities(region);
CREATE INDEX IF NOT EXISTS idx_crm_opp_jobCode ON crm_opportunities(jobCode);
CREATE INDEX IF NOT EXISTS idx_sap_records_salesOrder ON sap_records(salesOrder);
CREATE INDEX IF NOT EXISTS idx_mds_assignments_jobNo ON mds_assignments(jobNo);
CREATE INDEX IF NOT EXISTS idx_mds_assignments_category ON mds_assignments(category);

-- Employee lifecycle: heavily filtered for active employee queries
CREATE INDEX IF NOT EXISTS idx_employees_arrival ON employees(arrivalDate);
CREATE INDEX IF NOT EXISTS idx_employees_departure ON employees(departureDate);

-- CRM date filters: pipeline by creation/booking date
CREATE INDEX IF NOT EXISTS idx_crm_opp_creationDate ON crm_opportunities(creationDate);
CREATE INDEX IF NOT EXISTS idx_crm_opp_bookingDate ON crm_opportunities(bookingDate);
CREATE INDEX IF NOT EXISTS idx_crm_opp_estimated_booking ON crm_opportunities(estimatedBookingDate);
CREATE INDEX IF NOT EXISTS idx_crm_opp_subSegment ON crm_opportunities(subSegmentCode);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_crm_opp_managerId ON crm_opportunities(managerId);
CREATE INDEX IF NOT EXISTS idx_crm_opp_serviceLine ON crm_opportunities(serviceLine1);
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

CREATE TABLE IF NOT EXISTS candidate_staffing_match (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  candidateId TEXT NOT NULL REFERENCES hr_candidates(id) ON DELETE CASCADE,
  staffingNeedId TEXT NOT NULL REFERENCES user_staffing_needs(id) ON DELETE CASCADE,
  matchScore REAL,
  matchedAt TEXT,
  matchedBy TEXT,
  UNIQUE(candidateId, staffingNeedId)
);
CREATE INDEX IF NOT EXISTS idx_csm_candidate ON candidate_staffing_match(candidateId);
CREATE INDEX IF NOT EXISTS idx_csm_need ON candidate_staffing_match(staffingNeedId);


-- Contact uniqueness (prevent duplicate imports)
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_email_account ON crm_contacts(email, accountId) WHERE email IS NOT NULL AND email != '';

-- CRM GUID uniqueness
