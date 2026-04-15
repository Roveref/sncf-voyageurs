#!/usr/bin/env python3
"""
Probe SAP API endpoints on ess-be.bearingpoint.com.
Tests OData services, REST endpoints, and system info.

Usage:
    python scripts/probe_sap_api.py                    # interactive login prompt
    python scripts/probe_sap_api.py -u USER -p PASS    # explicit credentials
    python scripts/probe_sap_api.py --sso              # try Azure AD SSO (SAML)

Prerequisites:
    pip install requests
    (optional: pip install msal   — for --sso mode)
"""

import sys
import argparse
import getpass
from urllib.parse import urljoin

import requests
from requests.auth import HTTPBasicAuth

# ── SAP config ────────────────────────────────────────────────────────────────
SAP_BASE = "https://ess-be.bearingpoint.com"
SAP_CLIENT = "006"

# ── Endpoints to probe ────────────────────────────────────────────────────────
# (path, description, expected_content_type_prefix)
PROBE_ENDPOINTS = [
    # System-level
    ("/sap/public/ping", "SAP ICF Ping", None),
    ("/sap/public/info", "SAP System Info", None),
    ("/sap/bc/ping", "ICF BC Ping", None),

    # OData service catalog (IWFND)
    (
        "/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json&sap-client={client}",
        "OData Service Catalog (IWFND v2)",
        "application/json",
    ),
    (
        "/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/$metadata?sap-client={client}",
        "OData Service Catalog — $metadata",
        "application/xml",
    ),

    # Common ESS / HCM OData services
    (
        "/sap/opu/odata/sap/API_BUSINESS_PARTNER?$format=json&sap-client={client}",
        "Business Partner API (S/4HANA)",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/HCMFAB_COMMON_SRV/?$format=json&sap-client={client}",
        "HCM Fabric Common Service",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/HCMFAB_MYPROFILE_SRV/?$format=json&sap-client={client}",
        "HCM My Profile Service (ESS)",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/HCM_TIMESHEET_MAN_SRV/?$format=json&sap-client={client}",
        "HCM Timesheet Management",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/API_MANAGE_WORKFORCE_TIMESHEET/?$format=json&sap-client={client}",
        "Workforce Timesheet API",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/FICATS_COST_ASSIGNMENT_SRV/?$format=json&sap-client={client}",
        "CATS Cost Assignment Service",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/FAP_TIMESHEET_V2_SRV/?$format=json&sap-client={client}",
        "Fiori Timesheet v2",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/HCM_LEAVE_REQ_CREATE_SRV/?$format=json&sap-client={client}",
        "Leave Request Service",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/GBHCM_PER_WORKFORCE_SRV/?$format=json&sap-client={client}",
        "Personnel Workforce Service",
        "application/json",
    ),
    (
        "/sap/opu/odata/sap/ZHR_EMPLOYEE_SRV/?$format=json&sap-client={client}",
        "Custom Employee Service (Z)",
        "application/json",
    ),

    # BAPI / RFC via Gateway
    (
        "/sap/opu/odata/sap/ZAPI_STAFFING_SRV/?$format=json&sap-client={client}",
        "Custom Staffing API (Z)",
        "application/json",
    ),

    # REST / ICF custom
    ("/sap/bc/rest/?sap-client={client}", "REST Handler (ICF)", None),

    # SAP Fiori Launchpad
    ("/sap/bc/ui2/flp?sap-client={client}", "Fiori Launchpad", None),

    # SAP Gateway root
    (
        "/sap/opu/odata/?$format=json&sap-client={client}",
        "OData Root",
        "application/json",
    ),
]


# ── Helpers ───────────────────────────────────────────────────────────────────
STATUS_ICONS = {
    range(200, 300): "\033[92m OK \033[0m",   # green
    range(300, 400): "\033[93m 3xx\033[0m",    # yellow
    range(400, 500): "\033[91m 4xx\033[0m",    # red
    range(500, 600): "\033[91m 5xx\033[0m",    # red
}


def status_icon(code):
    for r, icon in STATUS_ICONS.items():
        if code in r:
            return icon
    return "???"


def probe(session, base, path, description, expected_ct):
    url = urljoin(base, path.format(client=SAP_CLIENT))
    try:
        resp = session.get(url, timeout=15, allow_redirects=False)
        code = resp.status_code
        ct = resp.headers.get("Content-Type", "")
        size = len(resp.content)

        icon = status_icon(code)
        redirect = ""
        if 300 <= code < 400:
            loc = resp.headers.get("Location", "")
            redirect = f" → {loc[:80]}"

        print(f"  {icon} {code:3d}  {description:<42}  [{ct[:40]}] {size:>6}B{redirect}")

        # If 200 + JSON, peek at what we got
        if code == 200 and "json" in ct.lower():
            data = resp.json()
            # OData service collection
            if "d" in data and "results" in data.get("d", {}):
                results = data["d"]["results"]
                print(f"         ↳ {len(results)} entries")
                for svc in results[:8]:
                    title = svc.get("Title") or svc.get("TechnicalServiceName") or svc.get("ServiceName") or ""
                    svc_url = svc.get("ServiceUrl") or svc.get("TechnicalServiceUrl") or ""
                    print(f"           • {title:<40} {svc_url[:60]}")
                if len(results) > 8:
                    print(f"           ... and {len(results) - 8} more")
            # OData entity sets
            elif "d" in data and "EntitySets" in data.get("d", {}):
                sets = data["d"]["EntitySets"]
                print(f"         ↳ EntitySets: {', '.join(sets[:10])}")
                if len(sets) > 10:
                    print(f"           ... and {len(sets) - 10} more")

        return code

    except requests.exceptions.SSLError as e:
        print(f"  \033[91m SSL\033[0m  ---  {description:<42}  SSL Error: {e}")
        return -1
    except requests.exceptions.ConnectionError as e:
        print(f"  \033[91m ERR\033[0m  ---  {description:<42}  Connection Error")
        return -2
    except requests.exceptions.Timeout:
        print(f"  \033[93m T/O\033[0m  ---  {description:<42}  Timeout (15s)")
        return -3
    except Exception as e:
        print(f"  \033[91m ERR\033[0m  ---  {description:<42}  {type(e).__name__}: {e}")
        return -4


# ── SSO auth via MSAL (reuse CRM pattern) ────────────────────────────────────
def get_sso_session():
    """Try Azure AD SSO — SAP may accept SAML bearer tokens."""
    try:
        import msal
        import os
    except ImportError:
        print("msal not installed. Install with: pip install msal")
        sys.exit(1)

    # BearingPoint Azure AD — same tenant as CRM
    CLIENT_ID = "51f81489-12ee-4a9e-aaae-a2591f45987d"
    AUTHORITY = "https://login.microsoftonline.com/organizations"
    # SAP resource scope — try generic
    SCOPES = [f"{SAP_BASE}/.default"]

    TOKEN_CACHE = os.path.join(os.path.dirname(__file__), ".token_cache_sap.json")

    cache = msal.SerializableTokenCache()
    if os.path.exists(TOKEN_CACHE):
        cache.deserialize(open(TOKEN_CACHE).read())

    app = msal.PublicClientApplication(CLIENT_ID, authority=AUTHORITY, token_cache=cache)

    accounts = app.get_accounts()
    result = None
    if accounts:
        result = app.acquire_token_silent(SCOPES, account=accounts[0])

    if not result:
        print("Opening browser for Azure AD login (SAP SSO)...")
        result = app.acquire_token_interactive(scopes=SCOPES)

    with open(TOKEN_CACHE, "w") as f:
        f.write(cache.serialize())

    if "access_token" not in result:
        print(f"SSO auth failed: {result.get('error_description', result)}")
        print("Falling back to Basic auth...\n")
        return None

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {result['access_token']}",
        "Accept": "application/json",
    })
    session.verify = True
    return session


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Probe SAP API endpoints at ess-be.bearingpoint.com")
    parser.add_argument("-u", "--user", help="SAP username")
    parser.add_argument("-p", "--password", help="SAP password (prompted if -u given without -p)")
    parser.add_argument("--sso", action="store_true", help="Try Azure AD SSO (SAML bearer)")
    parser.add_argument("--no-auth", action="store_true", help="Probe without authentication (check what's public)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Show full URLs")
    args = parser.parse_args()

    print(f"{'=' * 78}")
    print(f" SAP API Probe — {SAP_BASE} (client {SAP_CLIENT})")
    print(f"{'=' * 78}\n")

    session = requests.Session()
    session.headers.update({
        "Accept": "application/json, application/xml, text/html, */*",
        "User-Agent": "DashboardBe-SAP-Probe/1.0",
    })
    session.verify = True

    auth_mode = "none"

    if args.no_auth:
        print("Mode: No authentication (public endpoints only)\n")
    elif args.sso:
        print("Mode: Azure AD SSO\n")
        sso_session = get_sso_session()
        if sso_session:
            session = sso_session
            auth_mode = "sso"
        else:
            # Fallback to basic
            user = args.user or input("SAP Username: ")
            pw = args.password or getpass.getpass("SAP Password: ")
            session.auth = HTTPBasicAuth(user, pw)
            auth_mode = "basic"
    else:
        user = args.user or input("SAP Username: ")
        pw = args.password or getpass.getpass("SAP Password: ")
        session.auth = HTTPBasicAuth(user, pw)
        auth_mode = "basic"
        print(f"Mode: Basic Auth (user={user})\n")

    # Run probes
    results = {}
    for path, desc, ct in PROBE_ENDPOINTS:
        code = probe(session, SAP_BASE, path, desc, ct)
        results[desc] = code
        if args.verbose:
            print(f"         URL: {SAP_BASE}{path.format(client=SAP_CLIENT)}")

    # Summary
    print(f"\n{'=' * 78}")
    print(" Summary")
    print(f"{'=' * 78}")

    ok = [d for d, c in results.items() if 200 <= c < 300]
    redir = [d for d, c in results.items() if 300 <= c < 400]
    denied = [d for d, c in results.items() if c in (401, 403)]
    not_found = [d for d, c in results.items() if c == 404]
    errors = [d for d, c in results.items() if c < 0]

    if ok:
        print(f"\n\033[92m  {len(ok)} endpoint(s) accessible:\033[0m")
        for d in ok:
            print(f"    + {d}")

    if redir:
        print(f"\n\033[93m  {len(redir)} redirect(s) (may need SSO/browser):\033[0m")
        for d in redir:
            print(f"    ~ {d}")

    if denied:
        print(f"\n\033[91m  {len(denied)} auth denied (endpoint exists but credentials insufficient):\033[0m")
        for d in denied:
            print(f"    - {d}")

    if not_found:
        print(f"\n  {len(not_found)} not found (service not activated):")
        for d in not_found:
            print(f"    x {d}")

    if errors:
        print(f"\n  {len(errors)} connection error(s):")
        for d in errors:
            print(f"    ! {d}")

    print()

    # Recommendations
    if ok:
        print("Next steps:")
        print("  1. Run with --verbose to see exact URLs")
        print("  2. If Service Catalog returned results, the listed services are callable via OData")
        print("  3. Check $metadata of accessible services for entity types & operations")
    elif denied:
        print("Endpoints exist but auth failed. Options:")
        print("  1. Check credentials (SAP user, not Windows/Azure AD)")
        print("  2. Ask SAP Basis team to authorize your user for OData/ICF services")
        print("  3. Try --sso for Azure AD SSO (if SAP is configured for SAML)")
    elif redir:
        print("Redirects suggest SSO is configured. Try:")
        print("  1. python scripts/probe_sap_api.py --sso")
        print("  2. If SSO fails, you may need a service account with Basic Auth")
    else:
        print("No endpoints responded. The SAP system may not expose HTTP APIs externally.")
        print("Ask the SAP Basis/IT team if API access is available.")


if __name__ == "__main__":
    main()
