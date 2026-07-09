#!/usr/bin/env python3
"""
Initialize the SQLite databases: create tables, run migrations, seed config.

Creates BOTH databases:
  - api/dashboard.db      (real data)
  - api/dashboard-demo.db (demo/AI data)

Usage:
    python scripts/init_db.py                  # create tables + seed config (both DBs)
    python scripts/init_db.py --force          # drop all + recreate + re-seed
    python scripts/init_db.py --config-only    # only seed var_config (skip table creation)
    python scripts/init_db.py --list           # list config categories
    python scripts/init_db.py --db path.db     # target a specific database only

No API call needed — reads schema from api/schema.sql, config is static.
"""

import sys
import os
import sqlite3
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, "..", "api", "dashboard.db")
DEMO_DB_PATH = os.path.join(SCRIPT_DIR, "..", "api", "dashboard-demo.db")
SCHEMA_PATH = os.path.join(SCRIPT_DIR, "..", "api", "schema.sql")


# ── Application config defaults ─────────────────────────────────────────────
# Seeded into var_config so they can be edited in the DB.
# INSERT OR IGNORE — won't overwrite manual edits.

DEFAULT_VAR_CONFIG = {
    "grade": {
        "Intern": '{"order":1,"target":95,"family":"M-","hoursPerDay":7,"abbr":"Int","bg":"#f7f8f8","text":"#8a8e94","border":"#d8dade"}',
        "Analyst": '{"order":2,"target":90,"family":"M-","hoursPerDay":8,"abbr":"A","bg":"#f5f5f6","text":"#7a7e84","border":"#cccfd4"}',
        "Consultant": '{"order":3,"target":85,"family":"M-","hoursPerDay":8,"abbr":"CM","bg":"#eff0f2","text":"#5a5e64","border":"#b4b8be"}',
        "Senior Consultant": '{"order":4,"target":80,"family":"M-","hoursPerDay":8,"abbr":"Exp","bg":"#ecedef","text":"#4a4e54","border":"#a8abb2"}',
        "Manager": '{"order":5,"target":70,"family":"M+","hoursPerDay":8,"abbr":"Adj","bg":"#f7f2ee","text":"#806659","border":"#cdbdaf"}',
        "Senior Manager": '{"order":6,"target":60,"family":"M+","hoursPerDay":8,"abbr":"RP","bg":"#f2edeb","text":"#6b554a","border":"#b8a89e"}',
        "Director": '{"order":7,"target":40,"family":"M+","hoursPerDay":8,"abbr":"Dir","bg":"#f0e9e4","text":"#5C4A3F","border":"#b09a8a"}',
        "Partner": '{"order":8,"target":25,"family":"M+","hoursPerDay":8,"abbr":"P","bg":"#ede5e0","text":"#4a3728","border":"#a8917e"}',
    },
    "magrProfile": {
        "MAGRAP": '{"grade":"Intern","scr":135.68,"rcAdvisory":860,"rcImplementation":360,"rcStrategy":1220,"advanced":false}',
        "MAGR00": '{"grade":"Analyst","scr":135.68,"rcAdvisory":860,"rcImplementation":360,"rcStrategy":1220,"advanced":false}',
        "MAGR01": '{"grade":"Analyst","scr":351.2,"rcAdvisory":1110,"rcImplementation":860,"rcStrategy":1220,"advanced":false}',
        "MAGR02": '{"grade":"Analyst","scr":351.2,"rcAdvisory":1110,"rcImplementation":860,"rcStrategy":1220,"advanced":true}',
        "MAGR03": '{"grade":"Consultant","scr":407.76,"rcAdvisory":1310,"rcImplementation":1020,"rcStrategy":1470,"advanced":false}',
        "MAGR5A": '{"grade":"Senior Consultant","scr":494.8,"rcAdvisory":1520,"rcImplementation":1240,"rcStrategy":1720,"advanced":false}',
        "MAGR07": '{"grade":"Manager","scr":600,"rcAdvisory":1830,"rcImplementation":1420,"rcStrategy":2020,"advanced":false}',
        "MAGR7A": '{"grade":"Manager","scr":648.4,"rcAdvisory":1830,"rcImplementation":1420,"rcStrategy":2020,"advanced":true}',
        "MAGR08": '{"grade":"Senior Manager","scr":748.16,"rcAdvisory":2230,"rcImplementation":1810,"rcStrategy":2630,"advanced":false}',
        "MAGR8A": '{"grade":"Senior Manager","scr":901.12,"rcAdvisory":2230,"rcImplementation":1810,"rcStrategy":2630,"advanced":true}',
        "MAGR09": '{"grade":"Director","scr":1098.72,"rcAdvisory":2730,"rcImplementation":2090,"rcStrategy":3030,"advanced":false}',
        "MAGR9A": '{"grade":"Director","scr":1098.72,"rcAdvisory":2730,"rcImplementation":2090,"rcStrategy":3030,"advanced":true}',
        "MAGR11": '{"grade":"Partner","scr":1098.72,"rcAdvisory":2930,"rcImplementation":2090,"rcStrategy":3440,"advanced":false}',
        "MAGR12": '{"grade":"Partner","scr":1098.72,"rcAdvisory":2930,"rcImplementation":2090,"rcStrategy":3440,"advanced":true}',
    },
    "category": {
        "vacation": '{"main":"absence","label":"Vacation","bg":"#fef2f2","text":"#dc2626","bar":"#f87171","border":"#fca5a5","jobCodes":["0010","0013","0015","10","15","9999999999"],"sapLabels":["Holiday (full day)","Holiday (half day)","Trainee holiday"],"mdsLabels":["Holiday (full day)","Holiday (half day)","Vacation"]}',
        "rtt": '{"main":"absence","label":"RTT","bg":"#fef2f2","text":"#b91c1c","bar":"#ef4444","border":"#f87171","jobCodes":["F035","F036"],"sapLabels":["RTT (full day)","RTT (half day)"],"mdsLabels":["RTT (full day)","RTT (half day)"]}',
        "loa": '{"main":"absence","label":"LOA (Leave of Absence)","bg":"#fff1f2","text":"#e11d48","bar":"#fb7185","border":"#fda4af","jobCodes":["9999999910","9999999911","F016","F600","F605","F613","F631"],"sapLabels":["Conge Post Pater","Forfait Réduit","Paternity leave","Retour Congé Maternité","Unpaid leave"],"mdsLabels":["LOA (Capacity Reduction)","LOA manual","Unpaid leave"]}',
        "illness": '{"main":"absence","label":"Sick Leave","bg":"#fff1f2","text":"#be123c","bar":"#f43f5e","border":"#fb7185","jobCodes":["0200","F056","F210"],"sapLabels":["Illness Children","Illness with certificate","Work related accident"]}',
        "otherAbsence": '{"main":"absence","label":"Other Absences","bg":"#fef2f2","text":"#b91c1c","bar":"#fca5a5","border":"#fecaca","jobCodes":["0012","0024","F010","F014","F015","F030","F032","F033","F045","F205"],"sapLabels":["Accident in transit","Authorized Abs. Paid","Birth of Child","Educational Leave/Exam","Family Related Absences","Removal","Récup Déplacement Semaine","Récup Déplacement WE","Weddings","Weekend-credit OT"],"mdsLabels":["Authorized Abs. Paid","Removal","Weddings","Weekend credit OT"]}',
        "holiday": '{"main":"absence","label":"Public Holiday","bg":"#fef2f2","text":"#991b1b","bar":"#dc2626","border":"#ef4444"}',
        "chargeable": '{"main":"chargeable","label":"Chargeable","bg":"#eff6ff","text":"#1d4ed8","bar":"#60a5fa","border":"#93c5fd","routeCodes":["0800"]}',
        "generalOppty": '{"main":"chargeable","label":"General Oppty Code","bg":"#ecfeff","text":"#0e7490","bar":"#22d3ee","border":"#67e8f9"}',
        "pending": '{"main":"chargeable","label":"Pending jobcode","bg":"#fefce8","text":"#a16207","bar":"#facc15","border":"#fde047","jobCodes":["7777777777"],"mdsLabels":["pending jobcode"]}',
        "overtime": '{"main":"chargeable","label":"Overtime","bg":"#eef2ff","text":"#4f46e5","bar":"#a5b4fc","border":"#c7d2fe","jobCodes":["F810"],"sapLabels":["Overtime Paid (h suppl.)"]}',
        "travel": '{"main":"nonChargeable","label":"Travel","bg":"#f0f9ff","text":"#0284c7","bar":"#7dd3fc","border":"#bae6fd","jobCodes":["F816"],"sapLabels":["Déplacement Semaine","Déplacement WE"]}',
        "travelWe": '{"main":"nonChargeable","label":"Travel WE","bg":"#f0f9ff","text":"#64748b","bar":"#94a3b8","border":"#cbd5e1","jobCodes":["F817"]}',
        "training": '{"main":"training","label":"Training","bg":"#ecfdf5","text":"#047857","bar":"#34d399","border":"#6ee7b7","jobCodes":["0049","9999999980"],"sapLabels":["Animation de formation","Formation BE nvx entrants","Formation RSE","Formation Tronc Commun BE France","Specific training BTU","Training FW"],"mdsLabels":["Education"]}',
        "reservation": '{"main":"reservation","label":"Reservation w/o jobcode","bg":"#fffbeb","text":"#b45309","bar":"#fbbf24","border":"#fcd34d","jobCodes":["9999999996"],"mdsLabels":["Reserved Hours"]}',
        "meeting": '{"main":"nonChargeable","label":"Team Meeting","bg":"#f8fafc","text":"#475569","bar":"#94a3b8","border":"#cbd5e1","jobCodes":["0061"],"sapLabels":["Department meeting"]}',
        "event": '{"main":"nonChargeable","label":"Event / Forum","bg":"#fafafa","text":"#52525b","bar":"#a1a1aa","border":"#d4d4d8","jobCodes":["0062","0092","0093"],"sapLabels":["Com/Mkg recrutement","Congress / Event","Forums","Jobboards & réseaux sociaux"]}',
        "admin": '{"main":"nonChargeable","label":"Administration","bg":"#fafaf9","text":"#57534e","bar":"#a8a29e","border":"#d6d3d1","jobCodes":["0077"],"sapLabels":["Administration"]}',
        "corporate": '{"main":"nonChargeable","label":"Corporate / Union","bg":"#fafafa","text":"#525252","bar":"#a3a3a3","border":"#d4d4d4","jobCodes":["0080"],"sapLabels":["CSR General","Délégation CSE","Réunion CSE"]}',
        "community": '{"main":"nonChargeable","label":"Communities","bg":"#ecfdf5","text":"#059669","bar":"#6ee7b7","border":"#a7f3d0","jobCodes":["0081"],"sapLabels":["AI Incubator","Foundation","GenAI Tiger Teams"]}',
        "businessDev": '{"main":"nonChargeable","label":"Business Dev / Proposals","bg":"#f7fee7","text":"#4d7c0f","bar":"#a3e635","border":"#bef264","jobCodes":["0083"]}',
        "other": '{"main":"nonChargeable","label":"Other","bg":"#f9fafb","text":"#4b5563","bar":"#9ca3af","border":"#d1d5db"}',
        "unknown": '{"main":"nonChargeable","label":"Unknown","bg":"#f9fafb","text":"#6b7280","bar":"#d1d5db","border":"#e5e7eb"}',
    },
    "appSetting": {
        "mdsExtractStart": "2025-09-01",
        "tuLow": "50",
        "tuPartial": "80",
        "tuFull": "100",
        "annualGross": "0",
        "annualNet": "0",
        "ioGross": "0",
    },
    "segment": {
        "AUTO": '{"parent":"AMD","label":"Automotive","names":["Automotive OEM","Automotive Sales & Services","Automotive Supplier","Mobility Provider"]}',
        "IEM": '{"parent":"AMD","label":"Industrial Equipment & Manufacturing","names":["Aerospace & Defence OEMs","Business & Facility Services","Construction & Engineering","Heavy Machinery","Manufacturing","Med- & High-Tech","Metals & Mining"]}',
        "LSC": '{"parent":"AMD","label":"Life Sciences & Chemicals","names":["Chemicals","Life Sciences"]}',
        "CRL": '{"parent":"CRL","label":"Consumer, Retail & Lifestyle","names":["Agri/Agro and Food and bev.","Consumer Health","Fast-Moving Consumer Goods","Hospitality","Luxury & Fashion","Packaging & Others","Retail & Wholesale","Retail Real Estate","Tourism"]}',
        "ERT": '{"parent":"ERT","label":"Energy, Resources & Transportation","names":["Aviation & Sea","Forestry","Logistics & Shipping","Oil & Gas","Postal","Public Transport & Rail","Rail","Shipping","Transportation Infrastructure","Travel","Utilities (Energy, Water, Waste)"]}',
        "FSI": '{"parent":"FSI","label":"Financial Services Industry","names":["Asset & Wealthmanagement","Banking Services","Captive Banks","Commercial Banks","Credit Unions","Development Banks","Exchange & Brokers","FinTechs","General Insurances","Health Insurances","Insurance Brokers","Other Financial Institutions","Professional Services","Real Estate","Regulators","Reinsurances","Saving & State Banks"]}',
        "PHS": '{"parent":"PHS","label":"Public & Health Services","names":["Central Government","Defence","Education","European Commission & Agencies","International Public Sector","Non Profit Organisations","Public Healthcare","Social Care","State & Local Government","State Government"]}',
        "TMT": '{"parent":"TMT","label":"Technology, Media & Telco","names":["Communications","Media & Entertainment incl. Culture","Software"]}',
    },
    "brand": {
        "colors": '{"primary":"#EB0070","primaryDark":"#B8005A","primaryLight":"#F04093","primaryLighter":"#F571B0","primaryLightest":"#FAA3CC","primaryBg":"#FDD6E8","primaryDeep":"#870042","primaryDeepest":"#3C001E","secondary":"#374151","secondaryDark":"#1F2937","secondaryLight":"#4B5563","secondaryLighter":"#6B7280","secondaryLightest":"#9CA3AF","secondaryBg":"#E5E7EB","background":"#F8FAFC","white":"#FFFFFF","black":"#000000","darkBg":"#0F172A","darkPaper":"#1E293B","darkSurface":"#263244","darkBorder":"#334155","success":"#10B981","successLight":"#34D399","successDark":"#059669","warning":"#F59E0B","warningLight":"#FBBF24","warningDark":"#D97706","info":"#3b82f6"}',
        "identity": '{"fontFamily":"Avenir, \\"Segoe UI\\", Roboto, \\"Helvetica Neue\\", Arial, sans-serif","logoPath":"/gaif-logo.svg","appName":"GAIF Pilot","borderRadius":"12"}',
    },
    "theme": {
        "chart": '["#EB0070","#C8102E","#1E4E8C","#00A3A1","#F59E0B","#7C3AED","#0EA5E9","#10B981","#374151"]',
        "macroGrade": '{"M+":"#1e40af","M-":"#7c3aed"}',
        "mainCategory": '{"absence":"#ef4444","chargeable":"#EB0070","training":"#10b981","reservation":"#f59e0b","nonChargeable":"#6b7280"}',
        "region": '{"IDF":{"main":"#EB0070","light":"#F571B0","dark":"#B8005A"},"National":{"main":"#374151","light":"#6B7280","dark":"#1F2937"},"Sud":{"main":"#F59E0B","light":"#FBBF24","dark":"#D97706"},"Est":{"main":"#0EA5E9","light":"#38BDF8","dark":"#0284C7"},"Ouest":{"main":"#10B981","light":"#34D399","dark":"#059669"},"Nord":{"main":"#7C3AED","light":"#A78BFA","dark":"#6D28D9"}}',
        "segment": '{"Clients":"#EB0070","Agilite":"#0EA5E9","JusteBesoin":"#10B981","Innovation":"#F59E0B","LSC":"#EB0070","IEM":"#0EA5E9","AUTO":"#10B981","CRL":"#F59E0B","TMT":"#7C3AED","UTL":"#06B6D4","AMD":"#EC4899","CLR":"#6366F1","FSI":"#84CC16","INS":"#F97316","PHS":"#14B8A6","HSC":"#A855F7","ERT":"#EF4444"}',
        "serviceLine": '{"Ferroviaire":"#C8102E","Immobilier":"#1E4E8C","IO":"#00A3A1","Courants Faibles":"#F59E0B","Propriete Intellectuelle":"#7C3AED","Gares Lignes":"#0EA5E9","BTU":"#EB0070","ETU":"#374151","Products":"#C8102E","Arcwide":"#1E4E8C"}',
        "utilization": '{"available":{"bg":"#f3f4f6","text":"#4b5563","bar":"#d1d5db","dot":"#9ca3af"},"low":{"bg":"#f0f9ff","text":"#0369a1","bar":"#38bdf8","dot":"#38bdf8"},"partial":{"bg":"#eff6ff","text":"#1d4ed8","bar":"#3b82f6","dot":"#3b82f6"},"optimal":{"bg":"#ecfdf5","text":"#047857","bar":"#10b981","dot":"#10b981"},"overbooked":{"bg":"#fef2f2","text":"#b91c1c","bar":"#ef4444","dot":"#ef4444"}}',
    },
    "chatBranding": {
        "ollama_name": "GAIF Pilot", "ollama_fabBg": "#EB0070", "ollama_fabHoverBg": "#B8005A",
        "ollama_headerBg": "#870042", "ollama_icon": "/gaif-logo.svg",
        "claude_name": "Claude", "claude_fabBg": "#D97757", "claude_fabHoverBg": "#C4673F",
        "claude_headerBg": "#D97757", "claude_icon": "/claude_logo.png",
    },
}


# ── Functions ────────────────────────────────────────────────────────────────

def create_tables(db_path):
    """Create all tables from schema.sql."""
    schema_sql = open(SCHEMA_PATH).read()
    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(schema_sql)
        table_count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0]
        print(f"  {table_count} tables ready.")
    finally:
        conn.close()


def seed_var_config(db_path, force=False):
    """Seed var_config with default values."""
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()

        if force:
            cur.execute("DELETE FROM var_config")
            print("  Cleared existing var_config entries.")

        # Clean up legacy sap_category entries (now unified into jobCategory)
        cur.execute("DELETE FROM var_config WHERE category = 'sap_category'")

        # Clean up legacy categories consolidated into brand/theme/appSetting
        for legacy in [
            'brandDark', 'brandFunctional', 'brandIdentity',
            'segmentColor', 'serviceLineColor', 'utilizationColor',
            'mainCatColor', 'macroGradeColor', 'chartPalette', 'regionColor',
            'tuThreshold', 'bookingTarget',
        ]:
            cur.execute("DELETE FROM var_config WHERE category = ?", (legacy,))

        # Clean up legacy flat brand keys (now consolidated into brand.colors / brand.identity)
        cur.execute(
            "DELETE FROM var_config WHERE category = 'brand' AND key NOT IN ('colors', 'identity')"
        )

        count = 0
        for category, entries in DEFAULT_VAR_CONFIG.items():
            for key, value in entries.items():
                cur.execute(
                    "INSERT OR IGNORE INTO var_config (category, key, value) VALUES (?, ?, ?)",
                    (category, key, value),
                )
                count += cur.rowcount

        conn.commit()
        total = cur.execute("SELECT COUNT(*) FROM var_config").fetchone()[0]
        print(f"  {count} new entries added, {total} total in var_config.")
    finally:
        conn.close()


def seed_var_holidays(db_path):
    """Seed var_holidays with French public holidays 2025-2027."""
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        # Fixed-date French public holidays
        fixed = [
            ("01-01", "Jour de l'an"),
            ("05-01", "Fête du Travail"),
            ("05-08", "Victoire 1945"),
            ("07-14", "Fête nationale"),
            ("08-15", "Assomption"),
            ("11-01", "Toussaint"),
            ("11-11", "Armistice"),
            ("12-25", "Noël"),
        ]
        # Moving holidays (Easter-based) — pre-computed for 2025-2027
        moving = {
            2025: [
                ("2025-04-21", "Lundi de Pâques"),
                ("2025-05-29", "Ascension"),
                ("2025-06-09", "Lundi de Pentecôte"),
            ],
            2026: [
                ("2026-04-06", "Lundi de Pâques"),
                ("2026-05-14", "Ascension"),
                ("2026-05-25", "Lundi de Pentecôte"),
            ],
            2027: [
                ("2027-03-29", "Lundi de Pâques"),
                ("2027-05-06", "Ascension"),
                ("2027-05-17", "Lundi de Pentecôte"),
            ],
        }

        count = 0
        for year in range(2025, 2028):
            for md, name in fixed:
                cur.execute(
                    "INSERT OR IGNORE INTO var_holidays (date, name, country) VALUES (?, ?, 'FR')",
                    (f"{year}-{md}", name),
                )
                count += cur.rowcount
            for date_str, name in moving.get(year, []):
                cur.execute(
                    "INSERT OR IGNORE INTO var_holidays (date, name, country) VALUES (?, ?, 'FR')",
                    (date_str, name),
                )
                count += cur.rowcount

        conn.commit()
        total = cur.execute("SELECT COUNT(*) FROM var_holidays").fetchone()[0]
        print(f"  {count} new holidays added, {total} total in var_holidays.")
    finally:
        conn.close()


def seed_var_renaming(db_path):
    """Seed var_renaming with source→DB column mappings."""
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM var_renaming")

        mappings = [
            # CRM Opportunities (Dynamics 365 → assets)
            ("CRM", "assets", "opportunityid", "opportunityId", "Dynamics GUID = PK"),
            ("CRM", "assets", "name", "opportunity", "Opportunity name"),
            ("CRM", "assets", "be_grossrevenue_base", "grossRevenue", "Gross revenue EUR"),
            ("CRM", "assets", "estimatedvalue_base", "netRevenue", "Net revenue EUR"),
            ("CRM", "assets", "be_opportunitystatus", "status", "Status code (1=Émergence, 4=Investissement, 14=En exploitation, 15=Déclassé)"),
            ("CRM", "assets", "be_soldcm1", "cm1Pct", "CM1 margin %"),
            ("CRM", "assets", "be_jobcode", "jobCode", "Project job code"),
            ("CRM", "assets", "be_engagementtype", "engagementType", "Engagement type"),
            ("CRM", "assets", "be_estrevenueweighted_base", "weightedBooking", "Weighted booking EUR"),
            ("CRM", "assets", "be_shortreference", "opportunityId", "Short reference (used as ID)"),
            ("CRM", "assets", "createdon", "creationDate", "Creation date"),
            ("CRM", "assets", "actualclosedate", "bookingDate", "Actual close/booking date"),
            ("CRM", "assets", "estimatedclosedate", "estimatedBookingDate", "Estimated close date"),
            ("CRM", "assets", "be_laststatuschangedate", "lastStatusChangeDate", "Last status change"),
            ("CRM", "assets", "be_commentslost", "lostComment", "Lost comment"),
            ("CRM", "assets", "be_opportunityofferingpercentage", "serviceOffering1Pct", "Service offering 1 %"),
            ("CRM", "assets", "be_percentage2", "serviceOffering2Pct", "Service offering 2 %"),
            ("CRM", "assets", "be_percentage3", "serviceOffering3Pct", "Service offering 3 %"),
            ("CRM", "assets", "_be_alliance_value", "technologyPartner1", "Technology partner 1 GUID"),
            ("CRM", "assets", "_be_alliance2_value", "technologyPartner2", "Technology partner 2 GUID"),
            ("CRM", "assets", "_be_alliance3_value", "technologyPartner3", "Technology partner 3 GUID"),
            ("CRM", "assets", "_be_serviceline_value", "serviceLine1", "Service line 1 GUID → resolved to name"),
            ("CRM", "assets", "_be_serviceline2_value", "serviceLine2", "Service line 2 GUID"),
            ("CRM", "assets", "_be_serviceline3_value", "serviceLine3", "Service line 3 GUID"),
            ("CRM", "assets", "_be_servicelineoffering_value", "serviceOffering1", "Service offering 1 GUID"),
            ("CRM", "assets", "_be_servicelineoffering2_value", "serviceOffering2", "Service offering 2 GUID"),
            ("CRM", "assets", "_be_servicelineoffering3_value", "serviceOffering3", "Service offering 3 GUID"),
            ("CRM", "assets", "_be_accountname_value", "accountId", "Account GUID"),
            ("CRM", "assets", "_be_manager_value", "manager", "Manager GUID → resolved to name"),
            ("CRM", "assets", "_be_partner_value", "partner", "Partner GUID → resolved to name"),
            ("CRM", "assets", "_be_engagementmanagerid_value", "em", "Engagement Manager GUID → resolved to name"),
            ("CRM", "assets", "_be_engagementpartnerid_value", "ep", "Engagement Partner GUID → resolved to name"),
            ("CRM", "assets", "_be_manager_value(raw)", "managerCrmGuid", "Manager raw CRM systemuserid"),
            ("CRM", "assets", "_be_partner_value(raw)", "partnerCrmGuid", "Partner raw CRM systemuserid"),
            ("CRM", "assets", "_be_engagementmanagerid_value(raw)", "emCrmGuid", "EM raw CRM systemuserid"),
            ("CRM", "assets", "_be_engagementpartnerid_value(raw)", "epCrmGuid", "EP raw CRM systemuserid"),
            ("CRM", "assets", "_be_reportingcountryid_value", "country", "Country GUID → resolved to name"),
            ("CRM", "assets", "_parentcontactid_value", "primaryContactId", "Primary contact GUID"),

            # CRM Accounts (Dynamics 365 → sites)
            ("CRM", "sites", "accountid", "accountId", "Account GUID"),
            ("CRM", "sites", "name", "account", "Account name"),
            ("CRM", "sites", "be_secondarysegmentcode", "subSegmentCode", "Sub-segment code"),
            ("CRM", "sites", "_be_industrysegment_value", "subSegment", "Industry segment GUID → resolved"),
            ("CRM", "sites", "_be_accountleader_value", "accountLeader", "Account leader GUID → resolved"),
            ("CRM", "sites", "_be_country_value", "country", "Country GUID → resolved"),
            ("CRM", "sites", "be_reportingparent", "parentAccount", "Parent account"),

            # CRM Contacts (Dynamics 365 → crm_contacts)
            ("CRM", "crm_contacts", "contactid", "contactId", "Contact GUID"),
            ("CRM", "crm_contacts", "fullname", "fullName", "Full name"),
            ("CRM", "crm_contacts", "firstname", "firstName", "First name"),
            ("CRM", "crm_contacts", "lastname", "lastName", "Last name"),
            ("CRM", "crm_contacts", "emailaddress1", "email", "Email address"),
            ("CRM", "crm_contacts", "telephone1", "phone", "Phone"),
            ("CRM", "crm_contacts", "mobilephone", "mobile", "Mobile"),
            ("CRM", "crm_contacts", "jobtitle", "jobTitle", "Job title"),
            ("CRM", "crm_contacts", "address1_city", "city", "City"),
            ("CRM", "crm_contacts", "address1_country", "country", "Country"),
            ("CRM", "crm_contacts", "_parentcustomerid_value", "accountId", "Account GUID"),
            ("CRM", "crm_contacts", "_ownerid_value", "owner", "Owner GUID → resolved"),
            ("CRM", "crm_contacts", "createdon", "createdOn", "Created date"),

            # MDS Staffing (Excel → employees + mds_assignments)
            ("MDS", "employees", "EMP_PNR", "empId", "Employee ID"),
            ("MDS", "employees", "EMP_L_NAME", "name", "Last name (combined with first name)"),
            ("MDS", "employees", "EMP_F_NAME", "name", "First name (combined with last name)"),
            ("MDS", "mds_assignments", "JOB_NO", "jobNo", "Job number"),
            ("MDS", "mds_assignments", "JOB_NAME", "jobName", "Job name"),
            ("MDS", "mds_assignments", "DSP_START", "startDate", "Assignment start date"),
            ("MDS", "mds_assignments", "DSP_END", "endDate", "Assignment end date"),
            ("MDS", "mds_assignments", "DSP_UTIL", "utilization", "Utilization %"),
            ("MDS", "mds_assignments", "DSP_STATUS", "category", "Status → used as category"),
            ("MDS", "mds_assignments", "DSP_HOURS", "totalHours", "Total hours (NOT per day). hoursPerDay = utilization × 8h."),

            # SAP (Excel → sap_records)
            ("SAP", "sap_records", "Date", "date", "Record date"),
            ("SAP", "sap_records", "Personnel Number", "empId", "Employee ID"),
            ("SAP", "sap_records", "Name of employee or applicant", "name", "Employee name"),
            ("SAP", "sap_records", "Rec. sales order", "salesOrder", "Sales order number"),
            ("SAP", "sap_records", "RecSalesOrd. item", "salesOrderItem", "Sales order item"),
            ("SAP", "sap_records", "Att./Absence type", "absenceType", "Absence type"),
            ("SAP", "sap_records", "Hours", "hours", "Hours worked"),
            ("SAP", "sap_records", "Text", "text", "Description text"),
            ("SAP", "sap_records", "Short Text", "text", "Short text"),
            ("SAP", "sap_records", "Activity Type", "activityType", "Activity type (grade code)"),

            # Skills / YourSkills (Excel → hr_skills)
            ("Skills", "hr_skills", "ID Client", "empId", "Employee ID"),
            ("Skills", "hr_skills", "Compétences/langues", "name", "Skill name (display)"),
            ("Skills", "hr_skills", "Compétence de référence", "name", "Skill name (reference, used if no display)"),
            ("Skills", "hr_skills", "Catégorie (1)", "category", "Skill category"),
            ("Skills", "hr_skills", "Niveau", "level", "Skill level (1-4)"),

            # Candidates (CSV → nonconformities + nc_scopes)
            ("Candidates", "nonconformities", "Id", "id", "Candidate ID"),
            ("Candidates", "nonconformities", "Prénom", "firstName", "First name"),
            ("Candidates", "nonconformities", "Nom", "lastName", "Last name"),
            ("Candidates", "nonconformities", "E-mail", "email", "Email address"),
            ("Candidates", "nonconformities", "Téléphone", "phone", "Phone number"),
            ("Candidates", "nonconformities", "Statut de la candidature", "status", "Application status"),
            ("Candidates", "nonconformities", "Poste", "poste", "Job position"),
            ("Candidates", "nonconformities", "Grade", "grade", "Grade"),
            ("Candidates", "nonconformities", "Offres d'emploi", "jobPostings", "Job postings (comma-separated)"),
            ("Candidates", "nonconformities", "Date de création :", "creationDate", "Creation date"),
            ("Candidates", "nonconformities", "Dernière activité à", "lastActivity", "Last activity date"),
            ("Candidates", "nonconformities", "Statut du candidat", "candidateStatus", "Candidate status"),
            ("Candidates", "nonconformities", "Tags", "tags", "Tags"),
            ("Candidates", "nonconformities", "Note", "note", "Evaluation score"),
            ("Candidates", "nonconformities", "Évalué par", "evaluatedBy", "Evaluated by"),
            ("Candidates", "nonconformities", "Entretien RH", "hrInterview", "HR interview status"),
            ("Candidates", "nonconformities", "URL LinkedIn", "linkedinUrl", "LinkedIn URL"),
            ("Candidates", "nonconformities", "Recruteur 1", "recruiter1", "Recruiter 1 (name + date + decision)"),
            ("Candidates", "nonconformities", "Recruteur 2", "recruiter2", "Recruiter 2 (name + date + decision)"),
            ("Candidates", "nonconformities", "Recruteur 3", "recruiter3", "Recruiter 3 (name + date + decision)"),
            ("Candidates", "nc_scopes", "Offres d'emploi", "jobPosting", "Each posting becomes 1 application row"),
        ]

        ins = cur.execute  # shorthand
        for m in mappings:
            cur.execute(
                "INSERT OR REPLACE INTO var_renaming (source, targetTable, sourceField, dbColumn, description) VALUES (?, ?, ?, ?, ?)",
                m,
            )

        conn.commit()
        print(f"  {len(mappings)} entries in var_renaming.")
    finally:
        conn.close()


def seed_var_optionsets(db_path):
    """Seed var_optionsets with GAIF lifecycle status labels."""
    conn = sqlite3.connect(db_path)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM var_optionsets")

        gaif_statuses = [
            ("be_opportunitystatus", 1, "Émergence"),
            ("be_opportunitystatus", 4, "Investissement / CEB"),
            ("be_opportunitystatus", 6, "Étude en cours"),
            ("be_opportunitystatus", 11, "Maintenance lourde"),
            ("be_opportunitystatus", 13, "Conventionné"),
            ("be_opportunitystatus", 14, "En exploitation"),
            ("be_opportunitystatus", 15, "Déclassé"),
        ]
        count = 0
        for attr, val, label in gaif_statuses:
            cur.execute(
                "INSERT OR REPLACE INTO var_optionsets (attribute, value, label) VALUES (?, ?, ?)",
                (attr, val, label),
            )
            count += cur.rowcount

        conn.commit()
        total = cur.execute("SELECT COUNT(*) FROM var_optionsets").fetchone()[0]
        print(f"  {count} new optionsets added, {total} total in var_optionsets.")
    finally:
        conn.close()


def init_single_db(db_path, label, force=False, config_only=False):
    """Initialize a single database: tables + config."""
    if force and os.path.exists(db_path):
        os.remove(db_path)
        print(f"  Removed existing database.")

    print(f"\n[{label}] {db_path}")

    if not config_only:
        print("  Creating tables...")
        create_tables(db_path)

    print("  Seeding config...")
    seed_var_config(db_path, force=force)

    print("  Seeding holidays...")
    seed_var_holidays(db_path)

    print("  Seeding optionsets...")
    seed_var_optionsets(db_path)

    print("  Seeding renaming table...")
    seed_var_renaming(db_path)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Initialize SQLite databases: create tables + seed config")
    parser.add_argument("--force", action="store_true", help="Drop all tables and recreate + re-seed config")
    parser.add_argument("--config-only", action="store_true", help="Only seed var_config (skip table creation)")
    parser.add_argument("--list", action="store_true", help="List config categories")
    parser.add_argument("--db", help="Target a specific database only (default: both real + demo)")
    args = parser.parse_args()

    if args.list:
        print("Config categories:")
        for cat, entries in DEFAULT_VAR_CONFIG.items():
            print(f"  {cat:<25} ({len(entries)} entries)")
        print(f"\nTotal: {sum(len(e) for e in DEFAULT_VAR_CONFIG.values())} entries")
        return

    if not os.path.exists(SCHEMA_PATH):
        print(f"Error: schema.sql not found at {SCHEMA_PATH}")
        sys.exit(1)

    if args.db:
        # Single database mode
        init_single_db(os.path.abspath(args.db), "custom", force=args.force, config_only=args.config_only)
    else:
        # Both databases
        init_single_db(os.path.abspath(DB_PATH), "real", force=args.force, config_only=args.config_only)
        init_single_db(os.path.abspath(DEMO_DB_PATH), "demo", force=args.force, config_only=args.config_only)

    print("\nDone!")


if __name__ == "__main__":
    main()
