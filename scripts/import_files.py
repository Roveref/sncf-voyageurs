#!/usr/bin/env python3
"""
Import Excel files (MDS, SAP, Skills) into SQLite.

Usage:
    python scripts/import_files.py                       # import all files in data/
    python scripts/import_files.py path/to/file.xlsx     # import specific file(s)
    python scripts/import_files.py --list                # list importable files
    python scripts/import_files.py --db path.db          # target specific database

Same logic as api/src/services/excelImport.ts but standalone Python.
No server dependency — reads Excel via openpyxl, writes directly to SQLite.

Prerequisites:
    pip install openpyxl
"""

import sys
import os
import re
import json
import sqlite3
import argparse
from datetime import datetime, timedelta

from openpyxl import load_workbook

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", os.path.join(SCRIPT_DIR, "..", "data"))
DB_PATH = os.path.join(SCRIPT_DIR, "..", "api", "dashboard.db")

EXTENSIONS = {".xlsx", ".xls", ".csv"}
IGNORED = re.compile(r"^\.|~\$")


# ── File type detection ──────────────────────────────────────────────────────

FILE_SIGNATURES = {
    "staffing": [
        "empid", "lastname", "firstname", "jobno", "jobname",
        "startdate", "enddate", "utilization",
        "emp id", "employee id", "last name", "first name",
        "job no", "job name", "job number",
        "start date", "end date", "working days", "hours per day",
        "matricule", "prénom", "prenom", "nom",
        "emp_pnr", "emp_l_name", "emp_f_name",
        "jobNo", "jobName", "dsp_start", "dsp_end", "dsp_util", "dsp_hours",
    ],
    "sap": [
        "personnel number", "personnel no.", "pers.no.", "persno", "pernr",
        "att./absen", "att./abs", "attendance/absence",
        "rec. sales order", "rec.sales order", "sales order",
        "sender cost center", "cost center", "receiver order",
    ],
    "skills": [
        "compétence", "competence", "skill",
        "id client", "idclient", "id_client",
        "catégorie", "categorie", "appétence", "appetence", "niveau",
    ],
    "opportunity": [
        "opportunity id", "gross revenue", "net revenue", "account",
        "service line", "win %", "cm1%", "service offering",
        "opportunity", "job code", "sub segment", "segment code",
    ],
    "candidates": [
        "statut de la candidature", "offres d'emploi", "url linkedin",
        "entretien rh", "recruteur 1", "statut du candidat",
        "évalué par", "date de création :",
    ],
}


def detect_fileType(headers):
    normalized = [h.lower().strip() for h in headers]
    best_type = "staffing"
    best_score = 0
    for ftype, keywords in FILE_SIGNATURES.items():
        score = 0
        for kw in keywords:
            for h in normalized:
                if h == kw:
                    score += 2
                    break
                if kw in h or h in kw:
                    score += 1
                    break
        if score > best_score:
            best_score = score
            best_type = ftype
    return best_type


# ── Helper functions ─────────────────────────────────────────────────────────

def find_field(row, candidates):
    """Find a field in a dict by trying multiple column names (case-insensitive)."""
    for c in candidates:
        if c in row:
            return row[c]
    # Case-insensitive fallback
    lower_map = {k.lower(): k for k in row}
    for c in candidates:
        key = lower_map.get(c.lower())
        if key:
            return row[key]
    return None


def normalize_date(value):
    """Normalize a date value to YYYY-MM-DD string.
    Used for MDS/staffing dates. For SAP dates (which may include Excel serials), use parse_sap_date()."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    s = str(value).strip()
    if not s:
        return None
    # Already YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    # DD.MM.YYYY or DD/MM/YYYY
    m = re.match(r"^(\d{2})[./](\d{2})[./](\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    # MM/DD/YYYY
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(1).zfill(2)}-{m.group(2).zfill(2)}"
    # Timestamp (ms)
    try:
        ts = float(s)
        if ts > 1e12:
            return datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d")
    except ValueError:
        pass
    return s if len(s) == 10 else None


def parse_number(value):
    """Parse a number, handling commas."""
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return value
    s = str(value).replace(" ", "").replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def parse_excel_serial_date(val):
    """Convert Excel serial number to YYYY-MM-DD."""
    if isinstance(val, (int, float)) and 10000 < val < 100000:
        d = datetime(1899, 12, 30) + timedelta(days=val)
        return d.strftime("%Y-%m-%d")
    return None


def parse_sap_date(val):
    """Parse SAP date — more lenient than normalize_date(). Handles Excel serial numbers,
    2-digit years (MM/DD/YY), and float-as-string. Used exclusively for SAP daily records."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.strftime("%Y-%m-%d")
    # Excel serial number
    serial = parse_excel_serial_date(val)
    if serial:
        return serial
    s = str(val).strip()
    if not s:
        return None
    # MM/DD/YYYY or MM/DD/YY (American — slash)
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
    if m:
        year = m.group(3)
        if len(year) == 2:
            year = "20" + year
        return f"{year}-{m.group(1).zfill(2)}-{m.group(2).zfill(2)}"
    # DD.MM.YYYY (European — dot)
    m = re.match(r"^(\d{1,2})\.(\d{1,2})\.(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    # DD-MM-YYYY (European — dash)
    m = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{4})$", s)
    if m:
        return f"{m.group(3)}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
    # YYYY-MM-DD (ISO)
    m = re.match(r"^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$", s)
    if m:
        return f"{m.group(1)}-{m.group(2).zfill(2)}-{m.group(3).zfill(2)}"
    # Serial as string
    try:
        num = float(s)
        serial = parse_excel_serial_date(num)
        if serial:
            return serial
    except ValueError:
        pass
    return None


# ── Job categorization ───────────────────────────────────────────────────────

SPECIAL_JOB_CODES = {
    "9999999996": "reservation",
    "9999999980": "training", "0049": "training",
    "9999999910": "loa", "9999999911": "loa",
    "F016": "loa", "F600": "loa", "F605": "loa", "F613": "loa", "F631": "loa",
    "0010": "vacation", "0013": "vacation", "0015": "vacation", "9999999999": "vacation",
    "10": "vacation", "15": "vacation",
    "7777777777": "pending",
    "F035": "rtt", "F036": "rtt",
    "0200": "illness", "F056": "illness", "F210": "illness",
    "0012": "otherAbsence", "0024": "otherAbsence",
    "F010": "otherAbsence", "F014": "otherAbsence", "F015": "otherAbsence",
    "F030": "otherAbsence", "F032": "otherAbsence", "F033": "otherAbsence", "F045": "otherAbsence",
    "F205": "otherAbsence",
    "0800": "chargeable_route",
    "F810": "overtime", "F816": "travel", "F817": "travelWe",
    "0061": "meeting", "0062": "event", "0092": "event", "0093": "event",
    "0077": "admin", "0080": "corporate", "0081": "community", "0083": "businessDev",
}

SAP_CODE_MAP = [
    ({"0010", "0013", "0015"}, "vacation"),
    ({"F035", "F036"}, "rtt"),
    ({"F600", "F605", "F613", "F631", "F016"}, "loa"),
    ({"0200", "F056", "F210"}, "illness"),
    ({"0012", "0024", "F010", "F014", "F015", "F030", "F032", "F033", "F045", "F205"}, "otherAbsence"),
    ({"F810"}, "overtime"),
    ({"F816", "F817"}, "travel"),
    ({"0800"}, None),  # chargeable — defer to categorize_job_sap
    ({"0049"}, "training"),
    ({"0061"}, "meeting"),
    ({"0062", "0092", "0093"}, "event"),
    ({"0077"}, "admin"),
    ({"0080"}, "corporate"),
    ({"0081"}, "community"),
    ({"0083"}, "businessDev"),
]


def categorize_job(jobNo):
    if not jobNo:
        return "unknown"
    j = str(jobNo).strip()
    special = SPECIAL_JOB_CODES.get(j)
    if special:
        return special
    if len(j) == 6 and j.isdigit():
        return "generalOppty"
    if len(j) == 7 and j.isdigit():
        return "chargeable"
    return "unknown"


def categorize_sap_record(absenceType, salesOrder):
    code = (absenceType or "").strip()
    for code_set, cat in SAP_CODE_MAP:
        if code in code_set or code.upper() in code_set:
            if cat is not None:
                return cat
            # chargeable sub-routing
            if salesOrder:
                j = salesOrder.strip()
                if len(j) == 6 and j.isdigit():
                    return "generalOppty"
                if len(j) == 7 and j.isdigit():
                    return "chargeable"
            return "chargeable"
    if code == "":
        return None
    return "unknown"


# ── MAGR → Grade mapping (for computeMetadata) ──────────────────────────────

MAGR_TO_GRADE = {
    "MAGR01": "Analyst", "MAGR03": "Consultant", "MAGR5A": "Senior Consultant",
    "MAGR07": "Manager", "MAGR7A": "Manager", "MAGR08": "Senior Manager",
    "MAGR8A": "Senior Manager", "MAGR09": "Director", "MAGR11": "Partner",
    "MAGR12": "Partner", "MAGRAP": "Intern",
}


# ── Read Excel ───────────────────────────────────────────────────────────────

def _read_xls_rows(filepath, sheet_name=None):
    """Read .xls format — tries xlrd first, falls back to TSV/CSV if the file is actually text."""
    # Peek at the file to detect TSV/CSV disguised as .xls
    with open(filepath, "rb") as f:
        head = f.read(64)
    if head[:2] != b"\xd0\xcf":  # Not an OLE2 compound document → probably TSV/CSV
        return _read_tsv_rows(filepath)
    import xlrd
    wb = xlrd.open_workbook(filepath)
    ws = wb.sheet_by_name(sheet_name) if sheet_name else wb.sheet_by_index(0)
    if ws.nrows < 2:
        return [], []
    headers = [str(ws.cell_value(0, c) or "").strip() for c in range(ws.ncols)]
    data = []
    for r in range(1, ws.nrows):
        d = {}
        for c, h in enumerate(headers):
            if h:
                val = ws.cell_value(r, c)
                cell_type = ws.cell_type(r, c)
                if cell_type == xlrd.XL_CELL_DATE:
                    try:
                        dt = xlrd.xldate_as_datetime(val, wb.datemode)
                        val = dt.strftime("%Y-%m-%d")
                    except Exception:
                        pass
                elif cell_type == xlrd.XL_CELL_NUMBER and val == int(val):
                    val = int(val)
                d[h] = val
        data.append(d)
    return headers, data


def _read_tsv_rows(filepath):
    """Read a TSV/CSV file disguised as .xls."""
    import csv
    # Try UTF-8 first, fallback to Latin-1 (common for French Excel exports)
    for enc in ["utf-8-sig", "latin-1", "cp1252"]:
        try:
            with open(filepath, "r", encoding=enc) as test:
                test.read(1024)
            break
        except UnicodeDecodeError:
            continue
    else:
        enc = "latin-1"  # Last resort
    with open(filepath, "r", encoding=enc) as f:
        sample = f.read(4096)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters="\t,;")
        reader = csv.DictReader(f, dialect=dialect)
        headers = reader.fieldnames or []
        data = [dict(row) for row in reader]
    # Convert numeric strings
    for row in data:
        for k, v in row.items():
            if isinstance(v, str):
                v = v.strip()
                try:
                    if "." in v:
                        row[k] = float(v)
                    else:
                        row[k] = int(v)
                except ValueError:
                    row[k] = v
    return list(headers), data

def read_csv_rows(filepath):
    """Read a CSV file into a list of dicts with header keys."""
    import csv
    for enc in ["utf-8-sig", "latin-1", "cp1252"]:
        try:
            with open(filepath, "r", encoding=enc) as test:
                test.read(1024)
            break
        except UnicodeDecodeError:
            continue
    else:
        enc = "latin-1"
    with open(filepath, "r", encoding=enc) as f:
        sample = f.read(4096)
        f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        reader = csv.DictReader(f, dialect=dialect)
        headers = reader.fieldnames or []
        data = [dict(row) for row in reader]
    return list(headers), data


def read_excel_rows(filepath, sheet_name=None):
    """Read an Excel sheet into a list of dicts with header keys.
    Supports both .xlsx (openpyxl) and .xls (xlrd) formats."""
    if filepath.lower().endswith(".csv"):
        return read_csv_rows(filepath)
    if filepath.lower().endswith(".xls") and not filepath.lower().endswith(".xlsx"):
        return _read_xls_rows(filepath, sheet_name)
    wb = load_workbook(filepath, read_only=True, data_only=True)
    if sheet_name:
        ws = wb[sheet_name]
    else:
        # Try active sheet first; if it has < 2 rows or no recognized headers,
        # scan all sheets and pick the one with the most data rows
        ws = wb.active
        if ws is not None:
            peek = list(ws.iter_rows(values_only=True, max_row=2))
            if len(peek) < 2:
                ws = None
        if ws is None or len(wb.sheetnames) > 1:
            best_ws, best_rows = ws, 0
            for name in wb.sheetnames:
                candidate = wb[name]
                candidate_rows = list(candidate.iter_rows(values_only=True))
                if len(candidate_rows) > best_rows:
                    best_ws, best_rows = candidate, len(candidate_rows)
            if best_ws is not None:
                ws = best_ws
    if ws is None:
        return [], []
    rows = list(ws.iter_rows(values_only=True))
    wb.close()
    if len(rows) < 2:
        return [], []
    headers = [str(h or "").strip() for h in rows[0]]
    data = []
    for row in rows[1:]:
        d = {}
        for i, h in enumerate(headers):
            if h:
                d[h] = row[i] if i < len(row) else None
        data.append(d)
    return headers, data


def read_excel_raw(filepath):
    """Read an Excel sheet as raw rows (list of lists) for SAP parsing."""
    wb = load_workbook(filepath, read_only=True, data_only=True)
    ws = wb.active
    if ws is None:
        return []
    rows = [list(row) for row in ws.iter_rows(values_only=True)]
    wb.close()
    return rows


# ── Import: Staffing (MDS) ──────────────────────────────────────────────────

def import_staffing(rows, cur, now):
    # Full replace (same pattern as SAP/Skills)
    cur.execute("DELETE FROM mds_assignments")
    inserted = 0
    for row in rows:
        empId = str(find_field(row, ["EMP_PNR"]) or "").strip()
        if not empId:
            continue
        # Normalize: strip leading zeros (consistent with SAP/Skills import)
        empId = re.sub(r"^0+(?=\d)", "", empId)
        lastName = str(find_field(row, ["EMP_L_NAME"]) or "")
        firstName = str(find_field(row, ["EMP_F_NAME"]) or "")
        name = f"{firstName} {lastName}".strip() or None

        cur.execute(
            """INSERT INTO employees (empId, name, updatedAt)
               VALUES (?, ?, ?)
               ON CONFLICT(empId) DO UPDATE SET
                 name = COALESCE(excluded.name, employees.name),
                 updatedAt = excluded.updatedAt""",
            (empId, name, now),
        )

        jobNo = str(find_field(row, ["JOB_NO"]) or "")
        jobName = str(find_field(row, ["JOB_NAME"]) or "")
        if not jobNo and not jobName:
            continue
        category = categorize_job(jobNo)
        startDate = normalize_date(find_field(row, ["DSP_START"]))
        endDate = normalize_date(find_field(row, ["DSP_END"]))
        utilization = parse_number(find_field(row, ["DSP_UTIL"]))
        # DSP_HOURS = total hours over assignment duration (not per day)
        totalHours = parse_number(find_field(row, ["DSP_HOURS"]))
        # Derive hoursPerDay from utilization (util% * 8h)
        hoursPerDay = round((utilization / 100) * 8, 2) if utilization else None
        status = str(find_field(row, ["DSP_STATUS"]) or "") or None

        cur.execute(
            """INSERT INTO mds_assignments (empId, jobNo, jobName, category, startDate, endDate, utilization, hoursPerDay, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (empId, jobNo or None, jobName or None, category or status or None, startDate, endDate, utilization, hoursPerDay, now),
        )
        inserted += 1
    return inserted


# ── Import: SAP ─────────────────────────────────────────────────────────────

SAP_COLUMN_ALIASES = {
    "date": ["date"],
    "empId": ["personnel number"],
    "name": ["name of employee or applicant"],
    "salesOrder": ["rec. sales order"],
    "salesOrderItem": ["recsalesord. item"],
    "absenceType": ["att./absence type"],
    "hours": ["hours"],
    "text": ["text"],
    "shortText": ["short text"],
    "activityType": ["activity type"],
}


def find_sap_headers(rows):
    """Auto-detect header row and column mapping in SAP file."""
    best_score = 0
    best_mapping = {}
    best_idx = 0
    limit = min(len(rows), 15)
    for r in range(limit):
        row = rows[r]
        if not row:
            continue
        normalized = [str(h or "").lower().strip() for h in row]
        mapping = {}
        claimed = set()
        score = 0
        for field, aliases in SAP_COLUMN_ALIASES.items():
            for i, h in enumerate(normalized):
                if i in claimed or not h:
                    continue
                if any(a == h or a in h for a in aliases):
                    mapping[field] = i
                    claimed.add(i)
                    score += 1
                    break
        if score > best_score:
            best_score = score
            best_mapping = mapping
            best_idx = r
    return best_idx, best_mapping


def import_sap(filepath, cur, now):
    raw_rows = read_excel_raw(filepath)
    if len(raw_rows) < 2:
        return 0

    header_idx, col_map = find_sap_headers(raw_rows)
    if "date" not in col_map or "empId" not in col_map or "hours" not in col_map:
        print(f"    ERROR: SAP file missing required columns (date, empId, hours). Found: {list(col_map.keys())}")
        raise ValueError(f"SAP file missing required columns. Found: {list(col_map.keys())}")

    data_rows = raw_rows[header_idx + 1:]

    # Clear existing SAP records before re-import (within savepoint for rollback safety)
    cur.execute("SAVEPOINT sap_import")
    cur.execute("DELETE FROM sap_records")

    inserted = 0
    for row in data_rows:
        if not row or not any(v is not None and str(v).strip() for v in row):
            continue

        raw_date = row[col_map["date"]] if col_map["date"] < len(row) else None
        date = parse_sap_date(raw_date)
        if not date:
            if raw_date is not None:
                print(f"    WARNING: SAP row skipped — unparseable date: {raw_date!r}")
            continue

        def get(field):
            idx = col_map.get(field)
            return str(row[idx] or "").strip() if idx is not None and idx < len(row) else ""

        empId_raw = get("empId")
        empId = re.sub(r"^0+(?=\d)", "", empId_raw)
        if not empId:
            continue

        name_raw = get("name")
        name = re.sub(r"^(?:Mme|Mds|Mrs|Mr|Ms|Mlle|M)\.?\s+", "", name_raw, flags=re.IGNORECASE).strip() or None

        cur.execute(
            """INSERT INTO employees (empId, name, updatedAt)
               VALUES (?, ?, ?)
               ON CONFLICT(empId) DO UPDATE SET
                 name = COALESCE(NULLIF(excluded.name, ''), employees.name),
                 updatedAt = excluded.updatedAt""",
            (empId, name, now),
        )

        absenceType = get("absenceType")
        salesOrder = get("salesOrder")
        salesOrderItem = get("salesOrderItem")
        hours_str = str(row[col_map["hours"]] or "") if col_map["hours"] < len(row) else ""
        hours = 0
        try:
            hours = float(hours_str.replace(",", "."))
        except ValueError:
            pass
        text = get("text") or get("shortText")
        activityType = get("activityType") or None

        category = categorize_sap_record(absenceType, salesOrder)
        if not category and not activityType:
            continue

        cur.execute(
            """INSERT INTO sap_records (empId, date, name, salesOrder, salesOrderItem, absenceType, hours, text, category, activityType, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (empId, date, name, salesOrder or None, salesOrderItem or None,
             absenceType or None, hours, text or None, category or None, activityType, now),
        )
        inserted += 1
    cur.execute("RELEASE sap_import")
    return inserted


# ── Import: Skills ───────────────────────────────────────────────────────────

def import_skills(rows, cur, now):
    # First pass: collect all skills, keep highest level per (empId, skill_name)
    best = {}  # (empId, skill_name) → { level, category }
    for row in rows:
        raw_empId = str(find_field(row, ["ID Client", "IdClient", "Id_Client", "EmpId"]) or "").strip()
        if not raw_empId:
            continue
        empId = re.sub(r"^0+(?=\d)", "", raw_empId)

        skill_name = str(find_field(row, ["Compétences/langues", "Compétence de référence", "Compétence", "Competence", "Skill"]) or "")
        if not skill_name:
            continue

        level_raw = find_field(row, ["Niveau", "Level"])
        level = int(level_raw) if level_raw and str(level_raw).isdigit() else None
        category = str(find_field(row, ["Catégorie (1)", "Catégorie", "Categorie", "Category"]) or "") or None

        key = (empId, skill_name)
        existing = best.get(key)
        if existing is None or (level is not None and (existing["level"] is None or level > existing["level"])):
            best[key] = {"level": level, "category": category}

    # Second pass: insert deduplicated skills (highest level wins)
    cur.execute("DELETE FROM hr_skills")
    inserted = 0
    for (empId, skill_name), info in best.items():
        # Skip skills for employees not in MDS/SAP
        if not cur.execute("SELECT 1 FROM employees WHERE empId = ?", (empId,)).fetchone():
            continue
        level = info["level"]
        category = info["category"]

        cur.execute(
            "INSERT INTO hr_skills (empId, name, level, category) VALUES (?, ?, ?, ?)",
            (empId, skill_name, level, category),
        )
        inserted += 1
    return inserted


# ── Import: Candidates ──────────────────────────────────────────────────────

# Mapping ATS grade/poste → dashboard grades
# Dashboard grades: Partner, Director, Senior Manager, Manager, Senior Consultant, Consultant, Analyst, Intern
GRADE_TO_DASHBOARD = {
    # From "Grade" column
    "analyst": "Analyst",
    "analyst exp": "Analyst",
    "consultant": "Consultant",
    "consultant exp": "Consultant",
    "senior consultant": "Senior Consultant",
    "manager": "Manager",
    "senior manager": "Senior Manager",
    "senior manager exp": "Senior Manager",
    "director": "Director",
    "partner": "Partner",
    "alternance": "Intern",
    "stage de césure": "Intern",
    "stage de césure: 1ère partie": "Intern",
    "stage de fin d'études": "Intern",
    # From "Poste" column (fallback)
    "stagiaire": "Intern",
    "consultant junior": "Analyst",
    "consultant expérimenté / manager": "Consultant",
}


def resolve_gradeBucket(grade_raw, poste_raw):
    """Resolve ATS grade/poste to a dashboard grade. Grade takes priority over poste."""
    g = (grade_raw or "").strip().lower()
    p = (poste_raw or "").strip().lower()
    return GRADE_TO_DASHBOARD.get(g) or GRADE_TO_DASHBOARD.get(p) or "Analyst"


# ── Job posting → Segment / Offering mapping ──────────────────────────────────
# Each individual posting (comma-separated) is either a segment (industry) or an offering.
# We analyze each posting independently and collect unique segments + offerings.

# Keywords that identify a SEGMENT (industry vertical)
_SEGMENT_KEYWORDS = [
    ("automotive", "AUTO"),
    ("automobile", "AUTO"),
    ("mobility", "AUTO"),
    ("banque", "FSI"),
    ("bancaire", "FSI"),
    ("assurance", "FSI"),
    ("m&a", "FSI"),
    ("capital", "FSI"),
    ("energy", "ERT"),
    ("utilities", "ERT"),
    ("environnement", "ERT"),
    ("nucléaire", "ERT"),
    ("transport", "ERT"),
    ("logistics", "ERT"),
    ("consumer", "CRL"),
    ("retail", "CRL"),
    ("luxe", "CRL"),
    ("lifestyle", "CRL"),
    ("media", "TMT"),
    ("entertainment", "TMT"),
    ("culture", "TMT"),
    ("telecoms", "TMT"),
    ("public", "PHS"),
    ("health", "PHS"),
    ("life sciences", "LSC"),
    ("chemicals", "LSC"),
    ("industrial", "IEM"),
    ("manufacturing", "IEM"),
    ("achats", "IEM"),
    ("africa", "AMD"),
    ("casablanca", "AMD"),
    ("international development", "AMD"),
]

# Keywords that identify an OFFERING (functional/service line)
# Finer grain: maps to actual offering names matching CRM serviceOffering1
_OFFERING_KEYWORDS = [
    ("sap advisory", "SAP Advisory"),
    ("sap", "SAP Advisory"),
    ("anaplan", "Anaplan"),
    ("epm", "Performance Management & Planning"),
    ("it strategy", "IT Strategy, Architecture and Governance"),
    ("it transformation", "IT Infrastructure Transformation"),
    ("cybersécurité", "Security"),
    ("cyber", "Security"),
    ("data & analytics", "Data, Analytics and AI"),
    ("data for sales", "Data & CRM"),
    ("data & ai", "Data, Analytics and AI"),
    ("data", "Data, Analytics and AI"),
    ("digital marketing", "Marketing Transformation"),
    ("digital transformation", "Digital Strategy & Innovation"),
    ("digital", "Digital Strategy & Innovation"),
    ("customer experience", "Customer Experience"),
    ("operations", "Operational Excellence"),
    ("operational excellence", "Operational Excellence"),
    ("supply chain", "Supply Chain Strategy"),
    ("real estate", "Real Estate"),
    ("maintenance", "Maintenance"),
    ("pilotage de la performance", "Performance Management & Planning"),
    ("performance", "Performance Management & Planning"),
    ("people & strategy", "People & Strategy"),
    ("management culture & change", "Change Management"),
    ("rse", "Core Sustainability"),
    ("biodiversité", "Core Sustainability"),
    ("i care", "Core Sustainability"),
    ("finance durable", "Core Sustainability"),
    ("analyse du cycle de vie", "Core Sustainability"),
    ("sobriété numérique", "Core Sustainability"),
    ("transformation de la fonction finance", "Finance Excellence"),
    ("finance et risque", "Finance & Regulatory"),
    ("finance excellence", "Finance Excellence"),
    ("finance", "Finance Excellence"),
    ("delivery si", "Systems Integration"),
    ("tech & data", "Technology Services"),
    ("product lifecycle", "Product Life Cycle Management"),
    ("marketing & pricing", "Sales Transformation & Pricing"),
    ("strategy & performance", "Performance Management & Planning"),
    ("stratégie & transformation", "Business Strategy & Organization"),
]


def _classify_posting(posting_lower):
    """Classify a single job posting as segment or offering. Returns (segment, offering)."""
    seg = None
    off = None
    for keyword, code in _SEGMENT_KEYWORDS:
        if keyword in posting_lower:
            seg = code
            break
    for keyword, name in _OFFERING_KEYWORDS:
        if keyword in posting_lower:
            off = name
            break
    return seg, off


def resolve_applications(jobPostings_raw):
    """Analyze comma-separated job postings.
    Returns (primary_segment, primary_offering, applications_list).
    applications_list = [{ posting, segment, offering }, ...] for the join table."""
    raw_postings = [p.strip() for p in (jobPostings_raw or "").split(",") if p.strip()]
    applications = []
    first_segment = None
    first_offering = None

    for raw in raw_postings:
        seg, off = _classify_posting(raw.lower())
        applications.append({"posting": raw, "segment": seg, "offering": off})
        if seg and not first_segment:
            first_segment = seg
        if off and not first_offering:
            first_offering = off

    return first_segment, first_offering, applications


def parse_candidate_date(value):
    """Parse ATS date like '2023-01-26 22:22:06 +0100' → 'YYYY-MM-DD HH:MM:SS'."""
    if not value or not str(value).strip():
        return None
    s = str(value).strip()
    # Remove timezone offset (+0100, +0200, etc.)
    s = re.sub(r"\s*[+-]\d{4}$", "", s)
    return s


def parse_recruiter_field(raw):
    """Parse 'Name - DD/MM/YYYY [- GO/NO GO]' into (name, date_iso, decision)."""
    if not raw or not str(raw).strip():
        return None, None, None
    s = str(raw).strip()
    # Match date pattern DD/MM/YYYY or D/M/YY or D/M/YYYY
    m = re.search(r"[\s-]+(\d{1,2})/(\d{1,2})/(\d{2,4})", s)
    if not m:
        return s, None, None
    name = s[:m.start()].strip().rstrip("-").strip()
    day, month, year = m.group(1), m.group(2), m.group(3)
    if len(year) == 2:
        year = "20" + year
    date_iso = f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    # Decision after the date
    after = s[m.end():].strip().lstrip("-").strip().upper()
    decision = None
    if "NO GO" in after or "NO-GO" in after:
        decision = "NO GO"
    elif "GO" in after:
        decision = "GO"
    return name if name else None, date_iso, decision


def import_candidates(rows, cur, now):
    cur.execute("DELETE FROM nc_scopes")
    cur.execute("DELETE FROM nonconformities")
    inserted = 0
    for row in rows:
        cid = str(find_field(row, ["Id"]) or "").strip()
        if not cid:
            continue

        firstName = str(find_field(row, ["Prénom", "Prenom"]) or "").strip().title()
        lastName = str(find_field(row, ["Nom"]) or "").strip().title()
        email = str(find_field(row, ["E-mail", "Email"]) or "").strip()
        phone = str(find_field(row, ["Téléphone", "Telephone", "Phone"]) or "").strip()
        status = str(find_field(row, ["Statut de la candidature"]) or "").strip()
        poste = str(find_field(row, ["Poste"]) or "").strip()
        grade_raw = str(find_field(row, ["Grade"]) or "").strip()
        gradeBucket = resolve_gradeBucket(grade_raw, poste)
        jobPostings = str(find_field(row, ["Offres d'emploi"]) or "").strip()
        creation_raw = find_field(row, ["Date de création :", "Date de création"])
        creationDate = parse_candidate_date(creation_raw)
        lastActivity = parse_candidate_date(find_field(row, ["Dernière activité à"]))
        grade = str(find_field(row, ["Grade"]) or "").strip()
        candidateStatus = str(find_field(row, ["Statut du candidat"]) or "").strip()
        tags = str(find_field(row, ["Tags"]) or "").strip()
        note_raw = find_field(row, ["Note"])
        note = None
        if note_raw and str(note_raw).strip():
            try:
                note = float(str(note_raw).strip())
            except ValueError:
                pass
        evaluatedBy = str(find_field(row, ["Évalué par", "Evalué par"]) or "").strip()
        hrInterview = str(find_field(row, ["Entretien RH"]) or "").strip()
        linkedinUrl = str(find_field(row, ["URL LinkedIn"]) or "").strip()
        r1_raw = find_field(row, ["Recruteur 1"]) or ""
        r2_raw = find_field(row, ["Recruteur 2"]) or ""
        r3_raw = find_field(row, ["Recruteur 3"]) or ""
        hr_raw = hrInterview

        r1_name, r1_date, r1_dec = parse_recruiter_field(r1_raw)
        r2_name, r2_date, r2_dec = parse_recruiter_field(r2_raw)
        r3_name, r3_date, r3_dec = parse_recruiter_field(r3_raw)
        hr_name, hr_date, hr_dec = parse_recruiter_field(hr_raw)

        _seg, _off, applications = resolve_applications(jobPostings)

        cur.execute(
            """INSERT OR REPLACE INTO nonconformities
               (id, firstName, lastName, email, phone, status, poste, gradeBucket,
                jobPostings, creationDate, lastActivity, grade, candidateStatus,
                tags, note, evaluatedBy, hrInterview, linkedinUrl,
                recruiter1, recruiter1Date, recruiter1Decision,
                recruiter2, recruiter2Date, recruiter2Decision,
                recruiter3, recruiter3Date, recruiter3Decision,
                hrInterviewerName, hrInterviewDate, hrInterviewDecision,
                updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (cid, firstName or "", lastName or "", email or None, phone or None,
             status or None, poste or None, gradeBucket or None,
             jobPostings or None, creationDate, lastActivity,
             grade or None, candidateStatus or None, tags or None, note,
             evaluatedBy or None, hrInterview or None, linkedinUrl or None,
             r1_name, r1_date, r1_dec,
             r2_name, r2_date, r2_dec,
             r3_name, r3_date, r3_dec,
             hr_name, hr_date, hr_dec,
             now),
        )

        # Insert individual applications into join table
        for app in applications:
            cur.execute(
                "INSERT OR IGNORE INTO nc_scopes (candidateId, jobPosting, segment, offering) VALUES (?, ?, ?, ?)",
                (cid, app["posting"], app["segment"], app["offering"]),
            )

        inserted += 1

    return inserted


# ── Match recruitment candidates to employees ───────────────────────────────

def _normalize_name(s):
    """Normalize a name for fuzzy matching: lowercase, strip accents, strip punctuation."""
    import unicodedata
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")  # strip accents
    s = re.sub(r"[^a-z ]", " ", s)
    return " ".join(s.split())


def _clean_recruiter_name(raw):
    """Extract clean name from recruiter field (strip dates, GO/NO GO, etc.)."""
    if not raw:
        return None
    name = re.sub(r"\s*-\s*\d{1,2}/\d{1,2}/\d{2,4}.*$", "", raw).strip()
    # Skip noise (job titles, status notes)
    noise = ["consultant", "manager", "(h/f)", "account exec", "session de",
             "en attente", "retail", "marketing", "customer", "sales", "vp /"]
    if any(x in name.lower() for x in noise):
        return None
    if not name or len(name) < 3:
        return None
    return name


def _fuzzy_score(a, b):
    """Simple fuzzy similarity between two normalized names."""
    from difflib import SequenceMatcher
    score = SequenceMatcher(None, a, b).ratio()
    # Also try reversed order
    parts = a.split()
    if len(parts) >= 2:
        rev = " ".join(reversed(parts))
        score = max(score, SequenceMatcher(None, rev, b).ratio())
    return score


def match_recruitment_to_employees(cur):
    """Fuzzy match recruiter names and hired candidates to employees."""
    employees = cur.execute("SELECT empId, name FROM employees WHERE name IS NOT NULL").fetchall()
    if not employees:
        print("  No employees to match against.")
        return

    emp_lookup = [(eid, _normalize_name(name), name) for eid, name in employees]

    def find_best_match(raw_name, threshold=0.80):
        clean = _clean_recruiter_name(raw_name)
        if not clean:
            return None
        norm = _normalize_name(clean)
        if not norm or len(norm) < 3:
            return None
        best_id, best_score = None, 0
        for eid, enorm, _ in emp_lookup:
            s = _fuzzy_score(norm, enorm)
            if s > best_score:
                best_score = s
                best_id = eid
        return best_id if best_score >= threshold else None

    # Match recruiters
    candidates = cur.execute(
        "SELECT id, recruiter1, recruiter2, recruiter3 FROM nonconformities"
    ).fetchall()

    rec_matched = 0
    for cid, r1, r2, r3 in candidates:
        e1 = find_best_match(r1)
        e2 = find_best_match(r2)
        e3 = find_best_match(r3)
        if e1 or e2 or e3:
            cur.execute(
                "UPDATE nonconformities SET recruiter1EmpId=?, recruiter2EmpId=?, recruiter3EmpId=? WHERE id=?",
                (e1, e2, e3, cid),
            )
            rec_matched += 1

    # Match hired candidates → employees (lower threshold for name variations)
    hired = cur.execute(
        "SELECT id, firstName, lastName FROM nonconformities WHERE status='hired'"
    ).fetchall()

    hire_matched = 0
    for cid, fn, ln in hired:
        full = f"{fn} {ln}".strip()
        norm = _normalize_name(full)
        best_id, best_score = None, 0
        for eid, enorm, _ in emp_lookup:
            s = _fuzzy_score(norm, enorm)
            if s > best_score:
                best_score = s
                best_id = eid
        if best_score >= 0.82:
            cur.execute("UPDATE nonconformities SET matchedEmpId=? WHERE id=?", (best_id, cid))
            hire_matched += 1

    print(f"  Matching: {rec_matched} recruiter links, {hire_matched} hired→employee links")


# ── Compute metadata (grades, arrival/departure from SAP) ────────────────────

def compute_metadata(cur):
    """Compute employee metadata from SAP records and update employees table."""
    sap_rows = cur.execute(
        "SELECT empId, date, activityType FROM sap_records ORDER BY empId, date"
    ).fetchall()
    if not sap_rows:
        return

    # Group by empId
    emp_dates = {}
    global_min = None
    global_max = None
    for empId, date, activityType in sap_rows:
        emp_dates.setdefault(empId, []).append((date, activityType))
        if global_min is None or date < global_min:
            global_min = date
        if global_max is None or date > global_max:
            global_max = date

    # Departure cutoff (M-2)
    max_dt = datetime.strptime(global_max, "%Y-%m-%d") if global_max else datetime.now()
    cutoff_dt = datetime(max_dt.year, max_dt.month, 1) - timedelta(days=1)  # end of M-1
    cutoff_dt = datetime(cutoff_dt.year, cutoff_dt.month, 1) - timedelta(days=1)  # end of M-2
    departure_cutoff = cutoff_dt.strftime("%Y-%m-%d")

    count = 0
    for empId, records in emp_dates.items():
        dates = sorted(set(d for d, _ in records))
        first_date = dates[0]
        last_date = dates[-1]

        # Grade detection
        current_grade = None
        gradeHistory = []
        for date, activityType in records:
            if not activityType:
                continue
            magr = activityType.strip().upper()
            grade = MAGR_TO_GRADE.get(magr)
            if not grade:
                continue
            if grade != current_grade:
                if gradeHistory:
                    gradeHistory[-1]["until"] = date
                since = date
                day = int(date[8:10])
                if day in (2, 3) and gradeHistory:
                    since = date[:8] + "01"
                current_grade = grade
                gradeHistory.append({"grade": grade, "since": since})
            elif gradeHistory:
                gradeHistory[-1]["until"] = date

        # Noise removal: periods <= 5 days
        if len(gradeHistory) > 2:
            filtered = []
            for p in gradeHistory:
                if p.get("until") and p["since"]:
                    days = (datetime.strptime(p["until"], "%Y-%m-%d") - datetime.strptime(p["since"], "%Y-%m-%d")).days + 1
                else:
                    days = 999
                if days <= 5 and filtered:
                    if p.get("until"):
                        filtered[-1]["until"] = p["until"]
                else:
                    filtered.append(dict(p))
            # Merge consecutive same grade
            merged = []
            for p in filtered:
                if merged and merged[-1]["grade"] == p["grade"]:
                    if p.get("until"):
                        merged[-1]["until"] = p["until"]
                else:
                    merged.append(p)
            gradeHistory = merged

        # Arrival
        if first_date > (global_min or ""):
            arrivalDate = first_date
        else:
            d = datetime.strptime(global_min, "%Y-%m-%d") - timedelta(days=1)
            arrivalDate = d.strftime("%Y-%m-%d")

        # Departure
        departureDate = None
        if last_date < (global_max or "") and last_date < departure_cutoff:
            departureDate = last_date

        current_g = gradeHistory[-1]["grade"] if gradeHistory else None
        gh_json = json.dumps(gradeHistory) if gradeHistory else None

        cur.execute(
            "UPDATE employees SET arrivalDate = ?, departureDate = ?, grade = ?, gradeHistory = ? WHERE empId = ?",
            (arrivalDate, departureDate, current_g, gh_json, empId),
        )
        count += 1

    print(f"  Metadata computed for {count} employees.")


# ── Main import logic ────────────────────────────────────────────────────────

def ensure_mtime_column(cur):
    """Add fileMtime column if missing (migration for existing DBs)."""
    cols = [r[1] for r in cur.execute("PRAGMA table_info(var_importlog)").fetchall()]
    if "fileMtime" not in cols:
        cur.execute("ALTER TABLE var_importlog ADD COLUMN fileMtime REAL")


def file_already_imported(filepath, cur):
    """Check if file was already imported with the same mtime."""
    fname = os.path.basename(filepath)
    mtime = os.path.getmtime(filepath)
    row = cur.execute(
        "SELECT fileMtime FROM var_importlog WHERE fileName = ? ORDER BY id DESC LIMIT 1",
        (fname,),
    ).fetchone()
    if row and row[0] is not None and abs(row[0] - mtime) < 0.01:
        return True
    return False


def import_file(filepath, cur, now, force=False):
    """Import a single Excel file. Returns (fileType, inserted) or (None, 0) if skipped."""
    ext = os.path.splitext(filepath)[1].lower()
    if ext not in EXTENSIONS:
        return None, 0

    # Skip if file hasn't changed since last import
    if not force and file_already_imported(filepath, cur):
        return "skipped", 0

    headers, rows = read_excel_rows(filepath)
    if not headers:
        print(f"    Empty or unreadable: {os.path.basename(filepath)}")
        return None, 0

    fileType = detect_fileType(headers)
    inserted = 0

    if fileType == "staffing":
        inserted = import_staffing(rows, cur, now)
    elif fileType == "sap":
        inserted = import_sap(filepath, cur, now)
    elif fileType == "skills":
        inserted = import_skills(rows, cur, now)
    elif fileType == "candidates":
        inserted = import_candidates(rows, cur, now)
        match_recruitment_to_employees(cur)
    elif fileType == "opportunity":
        # CRM opportunities are handled by refresh_crm.py, skip here
        print(f"    {os.path.basename(filepath)}: CRM file — use refresh_crm.py instead")
        return fileType, 0

    # Log with file mtime for delta detection
    mtime = os.path.getmtime(filepath)
    cur.execute(
        "INSERT INTO var_importlog (fileName, fileType, rowCount, status, importedAt, fileMtime) VALUES (?, ?, ?, ?, ?, ?)",
        (os.path.basename(filepath), fileType, len(rows), "success", now, mtime),
    )
    return fileType, inserted


def find_files(directory):
    if not os.path.isdir(directory):
        return []
    files = []
    for f in sorted(os.listdir(directory)):
        if IGNORED.match(f):
            continue
        ext = os.path.splitext(f)[1].lower()
        if ext in EXTENSIONS:
            files.append(os.path.join(directory, f))
    return files


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Import Excel files (MDS, SAP, Skills) into SQLite")
    parser.add_argument("files", nargs="*", help="Specific files to import (default: scan data/)")
    parser.add_argument("--list", action="store_true", help="List importable files without importing")
    parser.add_argument("--force", action="store_true", help="Re-import even if file hasn't changed")
    parser.add_argument("--db", help="SQLite DB path (default: api/dashboard.db)")
    args = parser.parse_args()

    data_dir = os.path.abspath(DATA_DIR)

    if args.list:
        files = find_files(data_dir)
        if not files:
            print(f"No importable files in {data_dir}")
        else:
            print(f"{len(files)} file(s) in {data_dir}:")
            for f in files:
                print(f"  {os.path.basename(f)}")
        return

    targets = args.files if args.files else find_files(data_dir)
    if not targets:
        print("No files to import.")
        return

    db_path = args.db or os.path.abspath(DB_PATH)
    if not os.path.exists(db_path):
        print(f"Error: database not found at {db_path}")
        print("Run init_db.py first.")
        sys.exit(1)

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    now = datetime.now().isoformat()
    had_sap = False

    force = args.force

    print(f"Importing {len(targets)} file(s) into {db_path}...\n")

    try:
        cur = conn.cursor()
        ensure_mtime_column(cur)
        skipped = 0
        for filepath in targets:
            fname = os.path.basename(filepath)
            fileType, inserted = import_file(filepath, cur, now, force=force)
            if fileType == "skipped":
                skipped += 1
            elif fileType:
                print(f"  {fname}: {fileType}, {inserted} rows")
                if fileType == "sap" and inserted > 0:
                    had_sap = True

        if skipped > 0:
            print(f"  ({skipped} file(s) unchanged, skipped)")

        if had_sap:
            print("\nComputing employee metadata from SAP...")
            compute_metadata(cur)

        conn.commit()
    finally:
        conn.close()

    print("\nDone!")


if __name__ == "__main__":
    main()
