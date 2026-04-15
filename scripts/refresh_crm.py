#!/usr/bin/env python3
"""
Refresh CRM data from Dynamics 365 OData API — 100% headless, no Excel.

Usage:
    python scripts/refresh_crm.py --all --push                     # fetch + resolve + write to SQLite
    python scripts/refresh_crm.py --all -o data/Extract_CRM.xlsx   # export to Excel
    python scripts/refresh_crm.py -q VAR_Countries                 # test single query
    python scripts/refresh_crm.py --list                           # list queries

Prerequisites:
    pip install msal requests openpyxl
"""

import sys
import os
import json
import sqlite3
import argparse
import warnings
from datetime import datetime, timedelta, timezone

# Suppress deprecation warnings (msal, requests) when running as subprocess
if "--json" in sys.argv:
    warnings.filterwarnings("ignore")

import msal
import requests as http_requests
from openpyxl import Workbook
from init_db import DEFAULT_VAR_CONFIG

# ── Dynamics 365 config ──────────────────────────────────────────────────────
CRM_BASE = "https://bearingpoint.crm4.dynamics.com/api/data/v9.2"
CLIENT_ID = "51f81489-12ee-4a9e-aaae-a2591f45987d"
AUTHORITY = "https://login.microsoftonline.com/organizations"
SCOPES = ["https://bearingpoint.crm4.dynamics.com/.default"]
TOKEN_CACHE = os.path.join(os.path.dirname(__file__), ".token_cache.json")
PAGE_SIZE = 5000
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "api", "dashboard.db")


# ── Auth ─────────────────────────────────────────────────────────────────────
def get_token():
    cache = msal.SerializableTokenCache()
    if os.path.exists(TOKEN_CACHE):
        cache.deserialize(open(TOKEN_CACHE).read())

    app = msal.PublicClientApplication(CLIENT_ID, authority=AUTHORITY, token_cache=cache)
    accounts = app.get_accounts()
    result = None
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])

    if not result:
        print("Opening browser for Azure AD login...")
        result = app.acquire_token_interactive(scopes=SCOPES)

    if "access_token" not in result:
        print(f"Auth failed: {result.get('error_description', result)}")
        sys.exit(1)

    with open(TOKEN_CACHE, "w") as f:
        f.write(cache.serialize())
    return result["access_token"]


# ── OData fetch with pagination ──────────────────────────────────────────────
def fetch_odata(session, entity, select=None, filter_=None, label=""):
    params = {}
    if select:
        params["$select"] = select
    if filter_:
        params["$filter"] = filter_

    url = f"{CRM_BASE}/{entity}"
    all_records = []
    page = 1

    while url:
        # Retry with exponential backoff on transient failures
        for attempt in range(3):
            try:
                resp = session.get(url, params=params if page == 1 else None, timeout=60)
                resp.raise_for_status()
                break
            except Exception as e:
                if attempt == 2:
                    raise
                wait = 2 ** attempt
                print(f"  {label}: retry {attempt+1}/3 after {wait}s ({e})", file=sys.stderr)
                import time; time.sleep(wait)
        data = resp.json()
        all_records.extend(data.get("value", []))
        url = data.get("@odata.nextLink")
        if label:
            print(f"  {label}: {len(all_records)} records (page {page})", end="\r", file=sys.stderr)
        page += 1

    if label:
        print(f"  {label}: {len(all_records)} records          ", file=sys.stderr)
    return all_records


# ── Query definitions (from Power Query M code) ─────────────────────────────
QUERIES = {
    "CRM_Accounts_Target": {
        "entity": "accounts",
        "select": "accountid,name,be_reportingparent,_be_industrysegment_value,be_secondarysegmentcode,_be_accountleader_value,_be_country_value",
        "rename": {
            "be_secondarysegmentcode": "be_subsegment",
            "be_reportingparent": "_be_reportingparent",
            "accountid": "_be_accountid",
            "_be_country_value": "_be_country_value",
            "_be_accountleader_value": "_be_accountleader",
            "_be_industrysegment_value": "_be_industrysegment",
            "name": "Account",
        },
    },
    "CRM_Opportunities_Target": {
        "entity": "opportunities",
        "select": (
            "opportunityid,name,estimatedclosedate,be_engagementtype,be_shortreference,"
            "be_estrevenueweighted_base,be_jobcode,be_soldcm1,actualclosedate,be_grossrevenue_base,"
            "createdon,estimatedvalue_base,be_laststatuschangedate,be_opportunityofferingpercentage,"
            "be_percentage2,be_percentage3,be_opportunitystatus,be_reasonlost,be_commentslost,"
            "_be_serviceline_value,_be_serviceline2_value,_be_serviceline3_value,"
            "_be_servicelineoffering_value,_be_servicelineoffering2_value,_be_servicelineoffering3_value,"
            "_be_alliance_value,_be_alliance2_value,_be_alliance3_value,"
            "_be_manager_value,_be_engagementmanagerid_value,_be_engagementpartnerid_value,"
            "_be_accountname_value,_be_partner_value,_be_reportingcountryid_value,"
            "_parentcontactid_value"
        ),
        "rename": {
            "be_jobcode": "Job Code", "estimatedvalue_base": "Net Revenue", "name": "Opportunity",
            "be_opportunitystatus": "Status", "be_grossrevenue_base": "Gross Revenue",
            "be_shortreference": "Opportunity ID", "_be_manager_value": "_be_manager",
            "be_soldcm1": "CM1%", "_be_partner_value": "_be_partner",
            "_be_accountname_value": "_be_accountname",
            "be_laststatuschangedate": "Last Status Change Date",
            "_be_alliance_value": "technologypartner_1", "_be_alliance2_value": "technologypartner_2",
            "_be_alliance3_value": "technologypartner_3", "createdon": "Creation Date",
            "_be_serviceline_value": "_be_serviceline",
            "be_opportunityofferingpercentage": "Service Offering 1 %",
            "be_percentage2": "Service Offering 2 %", "actualclosedate": "Booking/Lost Date",
            "be_percentage3": "Service Offering 3 %",
            "_be_serviceline2_value": "_be_serviceline2", "_be_serviceline3_value": "_be_serviceline3",
            "_be_servicelineoffering_value": "_be_servicelineoffering",
            "_be_servicelineoffering2_value": "_be_servicelineoffering2",
            "_be_servicelineoffering3_value": "_be_servicelineoffering3",
            "_be_engagementpartnerid_value": "_be_engagementpartnerid",
            "_be_engagementmanagerid_value": "_be_engagementmanagerid",
            "be_reasonlost": "Lost Reason", "be_commentslost": "Lost Comment",
            "be_estrevenueweighted_base": "Weighted Booking",
            "_be_reportingcountryid_value": "_be_reportingcountryid",
            "estimatedclosedate": "Estimated Booking Date",
            "_parentcontactid_value": "_parentcontactid",
        },
    },
    "CRM_Employees": {
        "entity": "systemusers",
        "select": "systemuserid,fullname,title,_be_parentcountryid_value",
        "rename": {
            "systemuserid": "_be_ownerid", "title": "Role",
            "fullname": "fullName", "_be_parentcountryid_value": "_be_countryvalue",
        },
    },
    "CRM_Contacts": {
        "entity": "contacts",
        "select": (
            "contactid,fullname,firstname,lastname,emailaddress1,"
            "telephone1,mobilephone,jobtitle,department,"
            "address1_city,address1_country,"
            "_parentcustomerid_value,_ownerid_value,createdon"
        ),
        "rename": {
            "contactid": "_contactid",
            "fullname": "fullName",
            "firstname": "firstName",
            "lastname": "lastName",
            "emailaddress1": "Email",
            "telephone1": "Phone",
            "mobilephone": "Mobile",
            "jobtitle": "Job Title",
            "department": "Department",
            "address1_city": "City",
            "address1_country": "Country",
            "_parentcustomerid_value": "_parentcustomerid",
            "_ownerid_value": "_ownerid",
            "createdon": "Created On",
        },
    },
    "VAR_Business_Functions": {
        "entity": "be_businessfunctions",
        "select": "be_name,be_businessfunctionid",
        "rename": {"be_businessfunctionid": "_be_businessfunctionid", "be_name": "Business Function"},
    },
    "VAR_Business_Unit": {
        "entity": "businessunits",
        "select": "name,businessunitid",
        "rename": {"name": "Business Unit", "businessunitid": "_be_businessunitid"},
    },
    "VAR_Countries": {
        "entity": "be_countries",
        "select": "be_countryid,be_name,_be_beregion_value",
        "rename": {"be_name": "Country Name", "be_countryid": "_be_countryid", "_be_beregion_value": "_be_beregionid"},
    },
    "VAR_Industry": {
        "entity": "be_segments",
        "select": "be_code,be_name,be_segmentid",
        "rename": {"be_code": "Segment Code", "be_name": "Segment Name", "be_segmentid": "_be_segmentid"},
    },
    "VAR_Industry_Segment": {
        "entity": "be_industrysegments",
        "select": "be_industrysegmentid,be_name,_be_segment_value",
        "rename": {"be_name": "Industry Segment", "be_industrysegmentid": "_be_industrysegmentid", "_be_segment_value": "_be_segmentvalue"},
    },
    "VAR_Products": {
        "entity": "products",
        "select": "productid,name",
        "rename": {"productid": "_be_productid", "name": "Product Name"},
    },
    "VAR_Regions": {
        "entity": "be_beregions",
        "select": "be_beregionid,be_name",
        "rename": {"be_beregionid": "_be_beregionid", "be_name": "Region Name"},
    },
    "VAR_Service_Lines": {
        "entity": "be_servicelines",
        "select": "be_name,be_servicelineid",
        "rename": {"be_name": "Service Line", "be_servicelineid": "_be_servicelineid"},
    },
    "VAR_Service_Offering": {
        "entity": "be_servicelineofferinggroups",
        "select": "be_servicelineofferinggroupid,be_name,be_serviceshortname,_be_serviceline_value",
        "rename": {
            "be_name": "Service Offering", "_be_serviceline_value": "_be_servicelineid",
            "be_serviceshortname": "Service Code", "be_servicelineofferinggroupid": "_be_servicelineofferinggroupid",
        },
    },
    "VAR_Technology_Partner": {
        "entity": "be_alliances",
        "select": "be_alliancename,be_allianceid",
        "rename": {"be_allianceid": "_be_allianceid", "be_alliancename": "Technology Partner"},
    },
}


# ── OptionSet fetch ──────────────────────────────────────────────────────────
def fetch_optionset(session, entity, attribute, label="", strip_prefix=False):
    """Fetch OptionSet labels for a Picklist attribute (e.g. be_engagementtype).

    strip_prefix: remove leading "01 - ", "04 - " etc. from labels.
    """
    url = (
        f"{CRM_BASE}/EntityDefinitions(LogicalName='{entity}')"
        f"/Attributes(LogicalName='{attribute}')"
        f"/Microsoft.Dynamics.CRM.PicklistAttributeMetadata"
        f"?$select=LogicalName&$expand=OptionSet($select=Options)"
    )
    resp = session.get(url)
    resp.raise_for_status()
    options = resp.json().get("OptionSet", {}).get("Options", [])
    mapping = {}
    for opt in options:
        value = opt.get("Value")
        lbl = opt.get("Label", {}).get("UserLocalizedLabel", {})
        name = lbl.get("Label", str(value)) if lbl else str(value)
        if strip_prefix:
            import re
            name = re.sub(r"^\d+\s*-\s*", "", name)
        mapping[value] = name
    if label:
        print(f"  {label}: {len(mapping)} options — {mapping}")
    return mapping


# ── Transform helpers ────────────────────────────────────────────────────────
def apply_rename(records, rename_map):
    out = []
    for rec in records:
        row = {}
        for k, v in rec.items():
            if k.startswith("@") or k.startswith("_transactioncurrency"):
                continue
            row[rename_map.get(k, k)] = v
        out.append(row)
    return out


def sort_columns_alpha(records):
    if not records:
        return records
    return [dict(sorted(rec.items())) for rec in records]


def run_query(session, name):
    qdef = QUERIES[name]
    records = fetch_odata(session, qdef["entity"], qdef.get("select"), qdef.get("filter"), label=name)
    rename_map = qdef.get("rename", {})
    if rename_map:
        records = apply_rename(records, rename_map)
    records = sort_columns_alpha(records)
    post_filter = qdef.get("post_filter")
    if post_filter:
        before = len(records)
        records = [r for r in records if post_filter(r)]
        print(f"    Filtered: {before} → {len(records)}")
    return records


# ── GUID Resolution ──────────────────────────────────────────────────────────
def build_lookups(query_results):
    """Build in-memory lookup dicts from VAR tables for GUID → name resolution."""
    lk = {}
    lk["employees"] = {r["_be_ownerid"]: r["fullName"] for r in query_results.get("CRM_Employees", []) if r.get("_be_ownerid")}
    lk["accounts"] = {r["_be_accountid"]: r for r in query_results.get("CRM_Accounts_Target", []) if r.get("_be_accountid")}
    lk["svc_lines"] = {r["_be_servicelineid"]: r["Service Line"] for r in query_results.get("VAR_Service_Lines", []) if r.get("_be_servicelineid")}
    lk["svc_offerings"] = {r["_be_servicelineofferinggroupid"]: r["Service Offering"] for r in query_results.get("VAR_Service_Offering", []) if r.get("_be_servicelineofferinggroupid")}
    lk["countries"] = {r["_be_countryid"]: r for r in query_results.get("VAR_Countries", []) if r.get("_be_countryid")}
    lk["regions"] = {r["_be_beregionid"]: r["Region Name"] for r in query_results.get("VAR_Regions", []) if r.get("_be_beregionid")}
    lk["tech_partners"] = {r["_be_allianceid"]: r["Technology Partner"] for r in query_results.get("VAR_Technology_Partner", []) if r.get("_be_allianceid")}
    lk["ind_segments"] = {r["_be_industrysegmentid"]: r for r in query_results.get("VAR_Industry_Segment", []) if r.get("_be_industrysegmentid")}
    lk["industry"] = {r["_be_segmentid"]: r for r in query_results.get("VAR_Industry", []) if r.get("_be_segmentid")}

    lk["contacts"] = {r["_contactid"]: r for r in query_results.get("CRM_Contacts", []) if r.get("_contactid")}

    # Build Sub Sub Segment Code mapping (Industry Segment name → subSegmentCode)
    # Read from var_config.segment (consolidated JSON entries)
    lk["subSubSegment"] = {}
    lk["_segment_entries"] = {}  # code → {parent, label, names} for auto-update
    try:
        conn_seg = sqlite3.connect(DB_PATH)
        for row in conn_seg.execute("SELECT key, value FROM var_config WHERE category = 'segment'"):
            code, raw = row
            try:
                val = json.loads(raw)
                lk["_segment_entries"][code] = val
                for name in val.get("names", []):
                    lk["subSubSegment"][name] = code
            except Exception:
                pass
        conn_seg.close()
    except Exception:
        pass  # DB may not exist yet

    # engagementTypes populated later via fetch_optionset (needs session)
    lk["engagementTypes"] = {}

    # Reverse lookup: employee name → empId (from DB employees table)
    lk["name_to_empId"] = {}
    try:
        conn = sqlite3.connect(DB_PATH)
        for row in conn.execute("SELECT empId, name FROM employees"):
            lk["name_to_empId"][row[1]] = row[0]
        conn.close()
    except Exception:
        pass  # DB may not exist yet (first run)

    # Persistent CRM GUID → empId mapping (takes priority over name-based match)
    lk["guid_to_empId"] = {}
    try:
        conn = sqlite3.connect(DB_PATH)
        for row in conn.execute("SELECT crmGuid, empId FROM crm_employee_mapping WHERE empId IS NOT NULL AND empId != ''"):
            lk["guid_to_empId"][row[0]] = row[1]
        conn.close()
    except Exception:
        pass  # Table may not exist yet (first run)

    return lk


def resolve_crm_guid_to_empId(guid, lk):
    """Resolve a CRM systemuserid GUID to empId.
    Priority: persistent mapping table → fallback to name-based match."""
    if not guid:
        return ""
    # 1. Persistent mapping (verified or auto-matched)
    emp_id = lk["guid_to_empId"].get(guid)
    if emp_id:
        return emp_id
    # 2. Fallback: GUID → CRM fullName → empId by name
    name = lk["employees"].get(guid, "")
    if name:
        return lk["name_to_empId"].get(name, "")
    return ""


def resolve_country_region(guid, lk):
    """Resolve a country GUID to (country_name, region_name)."""
    country_rec = lk["countries"].get(guid)
    if not country_rec:
        if guid:
            print(f"    WARNING: GUID lookup failed for country: {guid}", file=sys.stderr)
        return "-", "-"
    country_name = country_rec.get("Country Name", "-")
    region_guid = country_rec.get("_be_beregionid")
    region_name = lk["regions"].get(region_guid, "-") if region_guid else "-"
    return country_name, region_name


def _safe_div(a, b):
    """Weighted Booking / Net Revenue → Win %, or None."""
    try:
        a, b = float(a), float(b)
        if b == 0:
            return None
        return round(a / b * 100, 2)
    except (TypeError, ValueError):
        return None


def resolve_opportunities(opps, lk):
    """Resolve GUIDs and output directly in DB snake_case format."""
    resolved = []
    for opp in opps:
        # Account resolution (needed for segment chain)
        acc_guid = opp.get("_be_accountname")
        acc_rec = lk["accounts"].get(acc_guid)

        # Segment resolution: account → industry segment → segment code (CRM) + sub segment code (BP refinement)
        if acc_rec:
            ind_seg_guid = acc_rec.get("_be_industrysegment")
            ind_seg_rec = lk["ind_segments"].get(ind_seg_guid, {})
            subSegment = ind_seg_rec.get("Industry Segment", "-")
            subSegmentCode = lk["subSubSegment"].get(subSegment, "-")
            # segmentCode: resolve via industry segment → be_segments.be_code
            industry_guid = ind_seg_rec.get("_be_segmentvalue")
            industry_rec = lk["industry"].get(industry_guid, {})
            segmentCode = industry_rec.get("Segment Code", "-")
        else:
            subSegment, subSegmentCode, segmentCode = "-", "-", "-"

        # Country/Region chain
        country, region = resolve_country_region(opp.get("_be_reportingcountryid"), lk)

        resolved.append({
            # Direct fields (OData renamed → snake_case)
            "opportunityId": opp.get("Opportunity ID", ""),
            "crmGuid": opp.get("opportunityid", ""),
            "opportunity": opp.get("Opportunity", ""),
            "status": opp.get("Status"),
            "grossRevenue": opp.get("Gross Revenue"),
            "netRevenue": opp.get("Net Revenue"),
            "winPct": _safe_div(opp.get("Weighted Booking"), opp.get("Net Revenue")),
            "cm1Pct": opp.get("CM1%"),
            "jobCode": opp.get("Job Code"),
            "engagementType": lk["engagementTypes"].get(opp.get("be_engagementtype"), "-"),
            "weightedBooking": opp.get("Weighted Booking"),
            "serviceOffering1Pct": opp.get("Service Offering 1 %"),
            "serviceOffering2Pct": opp.get("Service Offering 2 %"),
            "serviceOffering3Pct": opp.get("Service Offering 3 %"),
            "lostComment": opp.get("Lost Comment"),
            # Dates
            "creationDate": opp.get("Creation Date"),
            "bookingDate": opp.get("Booking/Lost Date"),
            "estimatedBookingDate": opp.get("Estimated Booking Date"),
            "lastStatusChangeDate": opp.get("Last Status Change Date"),
            # GUID → name resolutions
            "accountId": acc_guid or "",
            "account": acc_rec["Account"] if acc_rec else "-",
            "manager": lk["employees"].get(opp.get("_be_manager"), "-"),
            "partner": lk["employees"].get(opp.get("_be_partner"), "-"),
            "em": lk["employees"].get(opp.get("_be_engagementmanagerid"), "-"),
            "ep": lk["employees"].get(opp.get("_be_engagementpartnerid"), "-"),
            # GUID → empId (mapping table first, then name fallback)
            "managerId": resolve_crm_guid_to_empId(opp.get("_be_manager"), lk),
            "partnerId": resolve_crm_guid_to_empId(opp.get("_be_partner"), lk),
            "emId": resolve_crm_guid_to_empId(opp.get("_be_engagementmanagerid"), lk),
            "epId": resolve_crm_guid_to_empId(opp.get("_be_engagementpartnerid"), lk),
            # Raw CRM GUIDs (stable reference)
            "managerCrmGuid": opp.get("_be_manager", ""),
            "partnerCrmGuid": opp.get("_be_partner", ""),
            "emCrmGuid": opp.get("_be_engagementmanagerid", ""),
            "epCrmGuid": opp.get("_be_engagementpartnerid", ""),
            "country": country,
            "region": region,
            "segmentCode": segmentCode,
            "subSegmentCode": subSegmentCode,
            "subSegment": subSegment,
            "serviceLine1": lk["svc_lines"].get(opp.get("_be_serviceline"), "-"),
            "serviceLine2": lk["svc_lines"].get(opp.get("_be_serviceline2"), "-"),
            "serviceLine3": lk["svc_lines"].get(opp.get("_be_serviceline3"), "-"),
            "serviceOffering1": lk["svc_offerings"].get(opp.get("_be_servicelineoffering"), "-"),
            "serviceOffering2": lk["svc_offerings"].get(opp.get("_be_servicelineoffering2"), "-"),
            "serviceOffering3": lk["svc_offerings"].get(opp.get("_be_servicelineoffering3"), "-"),
            "technologyPartner1": lk["tech_partners"].get(opp.get("technologypartner_1"), "-"),
            "technologyPartner2": lk["tech_partners"].get(opp.get("technologypartner_2"), "-"),
            "technologyPartner3": lk["tech_partners"].get(opp.get("technologypartner_3"), "-"),
            # Primary contact
            "primaryContactId": opp.get("_parentcontactid", ""),
            "primaryContact": lk["contacts"].get(opp.get("_parentcontactid"), {}).get("fullName", "-"),
        })
    return resolved


def resolve_contacts(contacts, lk):
    """Resolve GUIDs and output directly in DB snake_case format."""
    resolved = []
    for ct in contacts:
        acc_guid = ct.get("_parentcustomerid")
        acc_rec = lk["accounts"].get(acc_guid)
        resolved.append({
            "contactId": ct.get("_contactid", ""),
            "fullName": ct.get("fullName", ""),
            "firstName": ct.get("firstName", ""),
            "lastName": ct.get("lastName", ""),
            "email": ct.get("Email", ""),
            "phone": ct.get("Phone", ""),
            "mobile": ct.get("Mobile", ""),
            "jobTitle": ct.get("Job Title", ""),
            "department": ct.get("Department", ""),
            "city": ct.get("City", ""),
            "country": ct.get("Country", ""),
            "accountId": acc_guid or "",
            "account": acc_rec["Account"] if acc_rec else "-",
            "owner": lk["employees"].get(ct.get("_ownerid"), "-"),
            "createdOn": ct.get("Created On", ""),
        })
    return resolved


def resolve_accounts(accounts, lk):
    """Resolve GUIDs and output directly in DB snake_case format."""
    resolved = []
    for acc in accounts:
        ind_seg_guid = acc.get("_be_industrysegment")
        ind_seg_rec = lk["ind_segments"].get(ind_seg_guid, {})
        country, region = resolve_country_region(acc.get("_be_country_value"), lk)

        subSegment = ind_seg_rec.get("Industry Segment", "-")
        industry_guid = ind_seg_rec.get("_be_segmentvalue")
        industry_rec = lk["industry"].get(industry_guid, {})
        segmentCode = industry_rec.get("Segment Code", "-")
        resolved.append({
            "accountId": acc.get("_be_accountid", ""),
            "account": acc.get("Account", ""),
            "segmentCode": segmentCode,
            "subSegmentCode": lk["subSubSegment"].get(subSegment, "-"),
            "subSegment": subSegment,
            "country": country,
            "region": region,
            "parentAccount": acc.get("_be_reportingparent", ""),
            "accountLeader": lk["employees"].get(acc.get("_be_accountleader"), "-"),
        })
    return resolved


def _build_segment_updates(lk):
    """Auto-update var_config.segment entries with industry segment names from CRM.

    For each CRM industry segment, resolve its parent segment code via GUID chain.
    If the name is already in an existing segment entry → keep it.
    If the name is new and the parent matches a single subSegment → add it.
    If the parent matches multiple subSegments (e.g. AMD → AUTO/IEM/LSC) → log warning.
    """
    entries = dict(lk.get("_segment_entries", {}))  # copy
    if not entries:
        return {}

    # Build reverse map: parent code → list of subSegment codes
    parent_to_codes = {}
    for code, val in entries.items():
        parent = val.get("parent", code)
        parent_to_codes.setdefault(parent, []).append(code)

    # Build set of already-classified names
    classified = {}  # name → subSegmentCode
    for code, val in entries.items():
        for name in val.get("names", []):
            classified[name] = code

    # Scan all CRM industry segments
    new_names = {}  # parent_code → [new names]
    for rec in lk.get("ind_segments", {}).values():
        name = rec.get("Industry Segment", "")
        if not name or name == "-":
            continue
        if name in classified:
            continue  # already known

        # Resolve parent segment code
        industry_guid = rec.get("_be_segmentvalue")
        industry_rec = lk.get("industry", {}).get(industry_guid, {})
        parent_code = industry_rec.get("Segment Code", "")
        if not parent_code:
            continue

        codes_for_parent = parent_to_codes.get(parent_code, [])
        if len(codes_for_parent) == 1:
            # Single subSegment for this parent → auto-add
            target_code = codes_for_parent[0]
            if name not in entries[target_code].get("names", []):
                entries[target_code].setdefault("names", []).append(name)
                entries[target_code]["names"].sort()
                print(f"  Segment auto-add: '{name}' → {target_code}", file=__import__('sys').stderr)
        else:
            # Multiple subSegments (e.g. AMD → AUTO/IEM/LSC) → warn
            print(f"  WARNING: New industry segment '{name}' under {parent_code} — needs manual classification to {codes_for_parent}", file=__import__('sys').stderr)

    return entries


def build_var_country_region(lk):
    """Build var_country_region from countries + regions lookups."""
    rows = []
    for guid, rec in lk["countries"].items():
        country_name = rec.get("Country Name", "")
        region_guid = rec.get("_be_beregionid")
        region_name = lk["regions"].get(region_guid, "")
        if country_name and region_name:
            rows.append({"country": country_name, "region": region_name})
    return rows


# ── SQLite writer ────────────────────────────────────────────────────────────

OPP_COLUMNS = [
    "opportunityId", "crmGuid", "opportunity",
    "accountId", "account", "status",
    "grossRevenue", "netRevenue", "winPct", "cm1Pct", "jobCode",
    "engagementType", "weightedBooking",
    "creationDate", "bookingDate", "estimatedBookingDate", "lastStatusChangeDate",
    "manager", "partner", "em", "ep",
    "managerId", "partnerId", "emId", "epId",
    "managerCrmGuid", "partnerCrmGuid", "emCrmGuid", "epCrmGuid",
    "country", "region",
    "segmentCode", "subSegmentCode", "subSegment",
    "serviceLine1", "serviceLine2", "serviceLine3",
    "serviceOffering1", "serviceOffering2", "serviceOffering3",
    "serviceOffering1Pct", "serviceOffering2Pct", "serviceOffering3Pct",
    "technologyPartner1", "technologyPartner2", "technologyPartner3",
    "lostComment",
    "primaryContactId", "primaryContact",
    "updatedAt",
]

ACC_COLUMNS = ["accountId", "account", "segmentCode", "subSegmentCode", "subSegment", "country", "region", "parentAccount", "accountLeader", "updatedAt"]

CONTACT_COLUMNS = [
    "contactId", "fullName", "firstName", "lastName", "email",
    "phone", "mobile", "jobTitle", "department",
    "city", "country", "accountId", "account", "owner",
    "createdOn", "updatedAt",
]



def write_to_sqlite(db_path, opportunities, accounts, var_country_region, optionsets=None, contacts=None, crm_employees=None, name_to_empId=None, segment_updates=None):
    """Write resolved data directly to SQLite database."""
    conn = sqlite3.connect(db_path)
    now = datetime.now().isoformat()

    opp_placeholders = ", ".join("?" for _ in OPP_COLUMNS)
    opp_update = ", ".join(f"{c} = excluded.{c}" for c in OPP_COLUMNS if c != "opportunityId")
    opp_sql = f"INSERT INTO crm_opportunities ({', '.join(OPP_COLUMNS)}) VALUES ({opp_placeholders}) ON CONFLICT(opportunityId) DO UPDATE SET {opp_update}"

    acc_placeholders = ", ".join("?" for _ in ACC_COLUMNS)
    acc_sql = f"INSERT OR REPLACE INTO crm_accounts ({', '.join(ACC_COLUMNS)}) VALUES ({acc_placeholders})"

    try:
        cur = conn.cursor()

        # Opportunities — upsert (rows already in snake_case)
        opp_count = 0
        for row in opportunities:
            if not row.get("opportunityId"):
                continue
            row["updatedAt"] = now
            cur.execute(opp_sql, [row.get(c) for c in OPP_COLUMNS])
            opp_count += 1

        # Accounts — upsert (INSERT OR REPLACE preserves user edits for unmodified accounts)
        acc_count = 0
        for row in accounts:
            if not row.get("account"):
                continue
            row["updatedAt"] = now
            cur.execute(acc_sql, [row.get(c) for c in ACC_COLUMNS])
            acc_count += 1

        # VAR country/region
        cur.execute("DELETE FROM var_country_region")
        var_count = 0
        for row in var_country_region:
            if row.get("country") and row.get("region"):
                cur.execute("INSERT OR REPLACE INTO var_country_region (country, region) VALUES (?, ?)", (row["country"], row["region"]))
                var_count += 1

        # OptionSets
        opt_count = 0
        if optionsets:
            cur.execute("DELETE FROM var_optionsets")
            for attr, mapping in optionsets.items():
                for value, label in mapping.items():
                    cur.execute("INSERT OR REPLACE INTO var_optionsets (attribute, value, label) VALUES (?, ?, ?)", (attr, value, label))
                    opt_count += 1

        # Contacts — full reload
        ct_count = 0
        if contacts:
            ct_placeholders = ", ".join("?" for _ in CONTACT_COLUMNS)
            ct_sql = f"INSERT OR REPLACE INTO crm_contacts ({', '.join(CONTACT_COLUMNS)}) VALUES ({ct_placeholders})"
            cur.execute("DELETE FROM crm_contacts")
            for row in contacts:
                if not row.get("contactId"):
                    continue
                row["updatedAt"] = now
                cur.execute(ct_sql, [row.get(c) for c in CONTACT_COLUMNS])
                ct_count += 1

        # CRM employee mapping — upsert new GUIDs, preserve verified mappings
        mapping_count = 0
        if crm_employees and name_to_empId is not None:
            for emp in crm_employees:
                guid = emp.get("_be_ownerid")
                name = emp.get("fullName", "")
                if not guid:
                    continue
                emp_id = name_to_empId.get(name, "")
                # INSERT new entries, but never overwrite a verified (manual) mapping
                cur.execute("""
                    INSERT INTO crm_employee_mapping (crmGuid, empId, fullName, verified, updatedAt)
                    VALUES (?, ?, ?, 0, ?)
                    ON CONFLICT(crmGuid) DO UPDATE SET
                        fullName = excluded.fullName,
                        empId = CASE WHEN crm_employee_mapping.verified = 1 THEN crm_employee_mapping.empId ELSE excluded.empId END,
                        updatedAt = excluded.updatedAt
                """, (guid, emp_id, name, now))
                mapping_count += 1

        # Auto-update var_config.segment names from CRM data
        seg_count = 0
        if segment_updates:
            for code, entry in segment_updates.items():
                cur.execute(
                    "INSERT INTO var_config (category, key, value) VALUES ('segment', ?, ?) ON CONFLICT(category, key) DO UPDATE SET value = excluded.value",
                    (code, json.dumps(entry, ensure_ascii=False))
                )
                seg_count += 1

        # Opportunity snapshots — only record when something changed
        snap_date = now[:10]
        snap_count = 0
        snap_fields = ("status", "grossRevenue", "netRevenue", "winPct", "estimatedBookingDate", "bookingDate", "manager")
        snap_ins = """INSERT INTO opp_history (opportunityId, snapshotDate, status, grossRevenue, netRevenue, winPct, estimatedBookingDate, bookingDate, manager)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                      ON CONFLICT(opportunityId, snapshotDate) DO UPDATE SET
                        status=excluded.status, grossRevenue=excluded.grossRevenue, netRevenue=excluded.netRevenue,
                        winPct=excluded.winPct, estimatedBookingDate=excluded.estimatedBookingDate,
                        bookingDate=excluded.bookingDate, manager=excluded.manager"""
        snap_sel = "SELECT status, grossRevenue, netRevenue, winPct, estimatedBookingDate, bookingDate, manager FROM opp_history WHERE opportunityId = ? ORDER BY snapshotDate DESC LIMIT 1"
        for row in opportunities:
            oid = row.get("opportunityId")
            if not oid:
                continue
            vals = tuple(row.get(f) for f in snap_fields)
            prev = cur.execute(snap_sel, (oid,)).fetchone()
            if prev and tuple(prev) == vals:
                continue  # nothing changed
            cur.execute(snap_ins, (oid, snap_date) + vals)
            snap_count += 1

        # Import log
        cur.execute(
            "INSERT INTO var_importlog (fileName, fileType, rowCount, status, importedAt) VALUES (?, ?, ?, ?, ?)",
            ("crm_script", "crm_import", opp_count + acc_count + ct_count, "success", now),
        )

        conn.commit()
        print(f"  {opp_count} opportunities, {acc_count} accounts, {ct_count} contacts, {var_count} country/region, {opt_count} optionset values, {mapping_count} employee mappings")
        if snap_count:
            print(f"  {snap_count} opportunity changes recorded ({snap_date})")

    finally:
        conn.close()


# ── Delta sync ──────────────────────────────────────────────────────────────

DELTA_STATE_FILE = os.path.join(os.path.dirname(__file__), ".crm_delta_state.json")


def load_delta_state():
    if os.path.exists(DELTA_STATE_FILE):
        try:
            with open(DELTA_STATE_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError) as e:
            print(f"  WARNING: State file corrupted ({e}), starting fresh sync")
            return {}
    return {}


def save_delta_state(state):
    # Atomic write: write to temp file, then rename (prevents corruption on crash)
    tmp = DELTA_STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, DELTA_STATE_FILE)


def delta_sync(session, db_path, json_output=False):
    """Fetch only records modified since last sync, upsert into SQLite."""
    state = load_delta_state()
    last_sync = state.get("last_sync")

    # First run → use 1 hour ago as starting point
    if not last_sync:
        last_sync = (datetime.now(timezone.utc) - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
        if not json_output:
            print(f"  First delta sync — fetching records modified since {last_sync}")
    else:
        if not json_output:
            print(f"  Delta sync — fetching records modified since {last_sync}")

    sync_start = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    filter_str = f"modifiedon ge {last_sync}"

    quiet = json_output  # Suppress progress output in JSON mode

    # Fetch modified opportunities
    opp_qdef = QUERIES["CRM_Opportunities_Target"]
    opp_raw = fetch_odata(session, opp_qdef["entity"], opp_qdef.get("select"), filter_str, label="" if quiet else "Δ Opportunities")
    opp_raw = apply_rename(opp_raw, opp_qdef.get("rename", {}))

    # Fetch modified accounts
    acc_qdef = QUERIES["CRM_Accounts_Target"]
    acc_raw = fetch_odata(session, acc_qdef["entity"], acc_qdef.get("select"), filter_str, label="" if quiet else "Δ Accounts")
    acc_raw = apply_rename(acc_raw, acc_qdef.get("rename", {}))

    # Fetch modified contacts
    ct_qdef = QUERIES["CRM_Contacts"]
    ct_raw = fetch_odata(session, ct_qdef["entity"], ct_qdef.get("select"), filter_str, label="" if quiet else "Δ Contacts")
    ct_raw = apply_rename(ct_raw, ct_qdef.get("rename", {}))

    total = len(opp_raw) + len(acc_raw) + len(ct_raw)
    if total == 0:
        save_delta_state({"last_sync": sync_start})
        if json_output:
            print(json.dumps({"hasChanges": False, "opportunities": [], "accounts": [], "contacts": [], "log": []}))
        return 0

    # Build lookups for GUID resolution
    # Small VAR tables: fetch from OData (fast, ~750 records total)
    var_queries = ["VAR_Countries", "VAR_Regions", "VAR_Industry", "VAR_Industry_Segment",
                   "VAR_Service_Lines", "VAR_Service_Offering", "VAR_Technology_Partner"]
    var_results = {}
    for name in var_queries:
        qdef = QUERIES[name]
        records = fetch_odata(session, qdef["entity"], qdef.get("select"), qdef.get("filter"), label="")
        rename_map = qdef.get("rename", {})
        if rename_map:
            records = apply_rename(records, rename_map)
        var_results[name] = records

    # CRM_Employees (systemusers): must fetch from OData — needed for manager/partner name resolution
    # These are CRM system users (GUID-based), NOT the MDS/SAP employees table
    emp_qdef = QUERIES["CRM_Employees"]
    var_results["CRM_Employees"] = apply_rename(
        fetch_odata(session, emp_qdef["entity"], emp_qdef.get("select"), label=""),
        emp_qdef.get("rename", {}),
    )

    # Accounts: load from SQLite (avoid re-fetching 65K+ via OData)
    # Build fake records compatible with build_lookups + resolve functions
    conn_tmp = sqlite3.connect(db_path)
    acc_rows = conn_tmp.execute(
        "SELECT accountId, account, subSegmentCode, subSegment FROM crm_accounts"
    ).fetchall()

    # Create fake ind_segment entries so the GUID chain resolves from SQLite data
    fake_accounts = []
    fake_ind_segments = []
    for r in acc_rows:
        acc_id, account, sub_seg_code, subSegment = r
        fake_ind_id = "_cached_" + (acc_id or account or "")
        fake_ind_segments.append({
            "_be_industrysegmentid": fake_ind_id,
            "Industry Segment": subSegment or "-",
            "_be_segmentvalue": None,
        })
        fake_accounts.append({
            "_be_accountid": acc_id,
            "Account": account,
            "_be_industrysegment": fake_ind_id,
            "be_subsegment": None,
            "_be_country_value": None,
            "_be_accountleader": None,
            "_be_reportingparent": None,
        })
    var_results["CRM_Accounts_Target"] = fake_accounts
    # Merge fake ind_segments with the real ones from OData
    var_results["VAR_Industry_Segment"] = var_results.get("VAR_Industry_Segment", []) + fake_ind_segments

    var_results["CRM_Contacts"] = ct_raw

    rows = conn_tmp.execute("SELECT value, label FROM var_optionsets WHERE attribute = 'beEngagementtype'").fetchall()
    engagementTypes = {r[0]: r[1] for r in rows}
    conn_tmp.close()

    lk = build_lookups(var_results)
    lk["engagementTypes"] = engagementTypes

    # Resolve GUIDs with complete lookups
    contacts = resolve_contacts(ct_raw, lk)
    opportunities = resolve_opportunities(opp_raw, lk)
    accounts = resolve_accounts(acc_raw, lk)

    # Compare with existing data, upsert, and track changes
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    now = datetime.now().isoformat()
    SKIP_COLS = {"source", "updatedAt"}
    change_log = []  # Human-readable
    # Structured changes for JSON output (resolved records ready for frontend)
    changed_opps = []     # Full resolved opportunity dicts
    changed_accounts = [] # Full resolved account dicts
    changed_contacts = [] # Full resolved contact dicts

    def _diff(existing, row, columns):
        diffs = {}
        for col in columns:
            if col in SKIP_COLS:
                continue
            old_val = existing[col]
            new_val = row.get(col)
            if str(old_val or "") != str(new_val or ""):
                diffs[col] = {"old": old_val, "new": new_val}
        return diffs

    # Short labels for common columns
    _SHORT = {
        "status": "status", "grossRevenue": "gross", "netRevenue": "net",
        "winPct": "win%", "weightedBooking": "weighted", "cm1Pct": "CM1",
        "manager": "mgr", "partner": "partner", "em": "EM", "ep": "EP",
        "subSegmentCode": "segment", "serviceLine1": "SL1",
        "accountLeader": "leader", "jobTitle": "title", "department": "dept",
    }

    def _fmt_val(v):
        if v is None or v == "" or v == "-":
            return "-"
        if isinstance(v, float):
            return "%g" % v
        return str(v)

    def _fmt_diffs(diffs):
        parts = []
        for k, v in diffs.items():
            label = _SHORT.get(k, k)
            parts.append("%s: %s→%s" % (label, _fmt_val(v["old"]), _fmt_val(v["new"])))
        return ", ".join(parts)

    try:
        cur = conn.cursor()
        cur.execute("SAVEPOINT delta_sync")

        # ── Opportunities ──
        opp_placeholders = ", ".join("?" for _ in OPP_COLUMNS)
        opp_update = ", ".join(f"{c} = excluded.{c}" for c in OPP_COLUMNS if c != "opportunityId")
        opp_sql = f"INSERT INTO crm_opportunities ({', '.join(OPP_COLUMNS)}) VALUES ({opp_placeholders}) ON CONFLICT(opportunityId) DO UPDATE SET {opp_update}"
        for row in opportunities:
            opportunityId = row.get("opportunityId")
            if not opportunityId:
                continue
            existing = cur.execute("SELECT * FROM crm_opportunities WHERE opportunityId = ?", (opportunityId,)).fetchone()

            row["updatedAt"] = now
            cur.execute(opp_sql, [row.get(c) for c in OPP_COLUMNS])
            if existing:
                diffs = _diff(existing, row, OPP_COLUMNS)
                if diffs:
                    name = row.get("opportunity", "")
                    change_log.append(f"~ {opportunityId} {name} — {_fmt_diffs(diffs)}")
                    changed_opps.append(row)
            else:
                name = row.get("opportunity", "")
                change_log.append(f"+ {opportunityId} {name}")
                changed_opps.append(row)

        # ── Accounts ──
        acc_sql = f"INSERT OR REPLACE INTO crm_accounts ({', '.join(ACC_COLUMNS)}) VALUES ({', '.join('?' for _ in ACC_COLUMNS)})"
        for row in accounts:
            acc_id = row.get("accountId")
            if not acc_id:
                continue
            existing = cur.execute("SELECT * FROM crm_accounts WHERE accountId = ?", (acc_id,)).fetchone()
            row["updatedAt"] = now
            cur.execute(acc_sql, [row.get(c) for c in ACC_COLUMNS])
            if existing:
                diffs = _diff(existing, row, ACC_COLUMNS)
                if diffs:
                    change_log.append(f"~ compte {row.get('account', '')} — {_fmt_diffs(diffs)}")
                    changed_accounts.append(row)
            else:
                change_log.append(f"+ compte {row.get('account', '')}")
                changed_accounts.append(row)

        # ── Contacts ──
        ct_sql = f"INSERT OR REPLACE INTO crm_contacts ({', '.join(CONTACT_COLUMNS)}) VALUES ({', '.join('?' for _ in CONTACT_COLUMNS)})"
        for row in contacts:
            ct_id = row.get("contactId")
            if not ct_id:
                continue
            existing = cur.execute("SELECT * FROM crm_contacts WHERE contactId = ?", (ct_id,)).fetchone()
            row["updatedAt"] = now
            cur.execute(ct_sql, [row.get(c) for c in CONTACT_COLUMNS])
            if existing:
                diffs = _diff(existing, row, CONTACT_COLUMNS)
                if diffs:
                    change_log.append(f"~ contact {row.get('fullName', '')} — {_fmt_diffs(diffs)}")
                    changed_contacts.append(row)
            else:
                change_log.append(f"+ contact {row.get('fullName', '')}")

        # Snapshot changed opportunities — only if values differ from last snapshot
        snap_date = now[:10]
        snap_fields = ("status", "grossRevenue", "netRevenue", "winPct", "estimatedBookingDate", "bookingDate", "manager")
        snap_ins = """INSERT INTO opp_history (opportunityId, snapshotDate, status, grossRevenue, netRevenue, winPct, estimatedBookingDate, bookingDate, manager)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                      ON CONFLICT(opportunityId, snapshotDate) DO UPDATE SET
                        status=excluded.status, grossRevenue=excluded.grossRevenue, netRevenue=excluded.netRevenue,
                        winPct=excluded.winPct, estimatedBookingDate=excluded.estimatedBookingDate,
                        bookingDate=excluded.bookingDate, manager=excluded.manager"""
        snap_sel = "SELECT status, grossRevenue, netRevenue, winPct, estimatedBookingDate, bookingDate, manager FROM opp_history WHERE opportunityId = ? ORDER BY snapshotDate DESC LIMIT 1"
        for row in changed_opps:
            oid = row.get("opportunityId")
            if not oid:
                continue
            vals = tuple(row.get(f) for f in snap_fields)
            prev = cur.execute(snap_sel, (oid,)).fetchone()
            if prev and tuple(prev) == vals:
                continue
            cur.execute(snap_ins, (oid, snap_date) + vals)

        cur.execute("RELEASE delta_sync")
        conn.commit()
    except Exception:
        try:
            conn.execute("ROLLBACK TO delta_sync")
        except Exception:
            pass
        raise
    finally:
        conn.close()

    save_delta_state({"last_sync": sync_start})
    has_changes = len(changed_opps) + len(changed_accounts) + len(changed_contacts) > 0

    if json_output:
        # Structured output for the poller to parse and broadcast
        result = {
            "hasChanges": has_changes,
            "opportunities": changed_opps,
            "accounts": changed_accounts,
            "contacts": changed_contacts,
            "log": change_log,
        }
        print(json.dumps(result, default=str))
    else:
        if change_log:
            print(f"  Δ {len(change_log)} change(s) detected:")
            for c in change_log:
                print(c)
        else:
            print(f"  Δ {len(opportunities)} opps, {len(accounts)} accounts, {len(contacts)} contacts fetched but no actual changes")

    return total


# ── Excel writer ─────────────────────────────────────────────────────────────
def write_sheet(wb, sheet_name, records):
    ws = wb.create_sheet(sheet_name)
    if not records:
        return
    headers = list(records[0].keys())
    for c, h in enumerate(headers, 1):
        ws.cell(row=1, column=c, value=h)
    for r, rec in enumerate(records, 2):
        for c, h in enumerate(headers, 1):
            ws.cell(row=r, column=c, value=rec.get(h))


# ── Main ─────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Refresh CRM Extract from Dynamics 365 OData API (headless)")
    parser.add_argument("--query", "-q", help="Run a single query (default: VAR_Countries)")
    parser.add_argument("--all", action="store_true", help="Run all queries")
    parser.add_argument("--delta", action="store_true", help="Incremental sync: fetch only records modified since last run")
    parser.add_argument("--json", action="store_true", help="Output delta changes as JSON (for machine consumption)")
    parser.add_argument("--daemon", action="store_true", help="Run as long-lived daemon, reading JSON commands from stdin")
    parser.add_argument("--list", action="store_true", help="List available queries")
    parser.add_argument("--push", action="store_true", help="Write resolved data to SQLite (requires --all)")
    parser.add_argument("--db", help=f"SQLite DB path (default: api/dashboard.db)")
    parser.add_argument("-o", "--output", help="Output Excel path")
    args = parser.parse_args()

    if args.list:
        print("Available queries:")
        for name, qdef in QUERIES.items():
            print(f"  {name:<30} → {qdef['entity']}")
        return

    if args.daemon:
        db_path = args.db or os.path.abspath(DB_PATH)
        daemon_loop(db_path)
        return

    if args.push and not args.all:
        print("Error: --push requires --all (need all tables for GUID resolution)")
        sys.exit(1)

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    # Which queries to run
    if args.all:
        query_names = list(QUERIES.keys())
    else:
        q = args.query or "VAR_Countries"
        if q not in QUERIES:
            print(f"Unknown query '{q}'. Use --list to see available queries.")
            sys.exit(1)
        query_names = [q]

    # Authenticate
    if not args.json:
        print("Authenticating with Dynamics 365...")
    token = get_token()

    session = http_requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Accept": "application/json",
        "Prefer": f"odata.maxpagesize={PAGE_SIZE}",
    })

    # ── Delta mode: incremental sync ──
    if args.delta:
        db_path = args.db or os.path.abspath(DB_PATH)
        if not args.json:
            print(f"\nDelta sync to {db_path}...")
        count = delta_sync(session, db_path, json_output=args.json)
        if not args.json:
            if count == 0:
                print("No changes detected.")
            print("Done!")
        return

    # Fetch
    print(f"\nFetching {len(query_names)} query(ies)...\n")
    query_results = {}
    for name in query_names:
        query_results[name] = run_query(session, name)

    total_raw = sum(len(v) for v in query_results.values())
    print(f"\n{total_raw} total raw records fetched.")

    # ── Push mode: resolve GUIDs and write directly to SQLite ──
    if args.push:
        print("\nBuilding lookup tables...")
        lk = build_lookups(query_results)
        print(f"  Lookups: {len(lk['employees'])} employees, {len(lk['accounts'])} accounts, "
              f"{len(lk['contacts'])} contacts, {len(lk['svc_lines'])} service lines, "
              f"{len(lk['countries'])} countries, {len(lk['regions'])} regions, "
              f"{len(lk['tech_partners'])} tech partners")

        print("Fetching OptionSets...")
        lk["engagementTypes"] = fetch_optionset(session, "opportunity", "be_engagementtype", label="Engagement Types")
        lk["opportunity_statuses"] = fetch_optionset(session, "opportunity", "be_opportunitystatus", label="Opportunity Statuses", strip_prefix=True)

        print("Resolving GUIDs...")
        contacts = resolve_contacts(query_results.get("CRM_Contacts", []), lk)
        opportunities = resolve_opportunities(query_results["CRM_Opportunities_Target"], lk)
        accounts = resolve_accounts(query_results["CRM_Accounts_Target"], lk)
        var_cr = build_var_country_region(lk)

        print(f"  Resolved: {len(opportunities)} opportunities, {len(accounts)} accounts, {len(contacts)} contacts, {len(var_cr)} country/region")

        db_path = args.db or os.path.abspath(DB_PATH)
        print(f"\nWriting to {db_path}...")
        optionsets = {
            "beEngagementtype": lk["engagementTypes"],
            "beOpportunitystatus": lk["opportunity_statuses"],
        }
        # Auto-update segment names from CRM industry segments
        seg_updates = _build_segment_updates(lk)

        write_to_sqlite(db_path, opportunities, accounts, var_cr, optionsets, contacts=contacts,
                        crm_employees=query_results.get("CRM_Employees", []), name_to_empId=lk.get("name_to_empId", {}),
                        segment_updates=seg_updates)
        print("\nDone!")
        return

    # ── Excel output mode ──
    if args.output:
        output_path = args.output if os.path.isabs(args.output) else os.path.join(project_root, args.output)
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M")
        suffix = "full" if args.all else query_names[0]
        output_path = os.path.join(project_root, f"data/CRM_refresh_{suffix}_{ts}.xlsx")

    wb = Workbook()
    wb.remove(wb.active)
    for name in query_names:
        write_sheet(wb, name, query_results[name])

    wb.save(output_path)
    print(f"\n{total_raw} records → {output_path}")
    print("Done!")


# ── Daemon mode ─────────────────────────────────────────────────────────────

def probe_changes(session, last_sync):
    """Lightweight check: are there any changes since last_sync? Uses $count only, no data fetched."""
    filter_str = f"modifiedon ge {last_sync}"
    for entity in ["opportunities", "accounts", "contacts"]:
        try:
            url = f"{CRM_BASE}/{entity}?$filter={filter_str}&$count=true&$top=0"
            resp = session.get(url)
            resp.raise_for_status()
            count = resp.json().get("@odata.count", 0)
            if count > 0:
                return True
        except Exception:
            return True  # On error, assume changes to be safe
    return False


def daemon_loop(db_path):
    """Long-lived daemon: reads JSON commands from stdin, writes JSON responses to stdout.

    Commands:
      {"action": "probe"}           → lightweight change check ($count only)
      {"action": "delta"}           → full delta sync
      {"action": "refresh-lookups"} → re-fetch VAR tables into memory
      {"action": "shutdown"}        → exit cleanly
    """
    # One-time setup: auth + session + lookups
    token = get_token()
    session = http_requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        "Accept": "application/json",
        "Prefer": f"odata.maxpagesize={PAGE_SIZE}",
    })

    # Cache VAR lookup tables in memory (fetched once, refreshable on command)
    cached_var_results = None

    def fetch_var_tables():
        nonlocal cached_var_results
        var_queries = ["CRM_Employees", "VAR_Countries", "VAR_Regions", "VAR_Industry",
                       "VAR_Industry_Segment", "VAR_Service_Lines", "VAR_Service_Offering",
                       "VAR_Technology_Partner"]
        results = {}
        for name in var_queries:
            qdef = QUERIES[name]
            records = fetch_odata(session, qdef["entity"], qdef.get("select"), qdef.get("filter"), label="")
            rename_map = qdef.get("rename", {})
            if rename_map:
                records = apply_rename(records, rename_map)
            results[name] = records

        # Engagement types
        eng = fetch_optionset(session, "opportunity", "be_engagementtype")
        results["_engagementTypes"] = eng
        cached_var_results = results
        return results

    def build_delta_lookups(ct_raw, db_path):
        """Build lookups for delta resolution using cached VAR + SQLite accounts."""
        var = cached_var_results or fetch_var_tables()
        var_copy = dict(var)

        # Accounts from SQLite (avoid re-fetching 65K via OData)
        conn_tmp = sqlite3.connect(db_path)
        acc_rows = conn_tmp.execute(
            "SELECT accountId, account, subSegmentCode, subSegment FROM crm_accounts"
        ).fetchall()
        fake_accounts = []
        fake_ind_segments = []
        for r in acc_rows:
            acc_id, account, sub_seg_code, subSegment = r
            fake_ind_id = "_cached_" + (acc_id or account or "")
            fake_ind_segments.append({
                "_be_industrysegmentid": fake_ind_id,
                "Industry Segment": subSegment or "-",
                "_be_segmentvalue": None,
            })
            fake_accounts.append({
                "_be_accountid": acc_id, "Account": account,
                "_be_industrysegment": fake_ind_id, "be_subsegment": None,
                "_be_country_value": None, "_be_accountleader": None, "_be_reportingparent": None,
            })
        var_copy["CRM_Accounts_Target"] = fake_accounts
        var_copy["VAR_Industry_Segment"] = var_copy.get("VAR_Industry_Segment", []) + fake_ind_segments
        var_copy["CRM_Contacts"] = ct_raw
        conn_tmp.close()

        lk = build_lookups(var_copy)
        lk["engagementTypes"] = var.get("_engagementTypes", {})
        return lk

    # Pre-fetch lookups at startup
    fetch_var_tables()

    # Signal ready
    print(json.dumps({"ready": True}), flush=True)

    # Command loop
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            cmd = json.loads(line)
        except json.JSONDecodeError:
            print(json.dumps({"error": "invalid JSON"}), flush=True)
            continue

        action = cmd.get("action", "")
        db = cmd.get("db", db_path)

        try:
            # Refresh token if needed (MSAL handles this transparently)
            token = get_token()
            session.headers["Authorization"] = f"Bearer {token}"

            if action == "probe":
                state = load_delta_state()
                last_sync = state.get("last_sync")
                if not last_sync:
                    last_sync = (datetime.now(timezone.utc) - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")
                has_changes = probe_changes(session, last_sync)
                print(json.dumps({"hasChanges": has_changes}), flush=True)

            elif action == "delta":
                result_count = delta_sync(session, db, json_output=True)
                # delta_sync already prints JSON to stdout
                sys.stdout.flush()

            elif action == "refresh-lookups":
                fetch_var_tables()
                print(json.dumps({"refreshed": True}), flush=True)

            elif action == "shutdown":
                print(json.dumps({"shutdown": True}), flush=True)
                break

            else:
                print(json.dumps({"error": f"unknown action: {action}"}), flush=True)

        except Exception as e:
            print(json.dumps({"error": str(e)}), flush=True)


if __name__ == "__main__":
    main()
