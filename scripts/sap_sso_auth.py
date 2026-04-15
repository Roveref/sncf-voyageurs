#!/usr/bin/env python3
"""
SAP SSO Authentication via Azure AD — multiple strategies.
Authenticates with Azure AD and establishes a SAP session to probe OData endpoints.

Strategies (tried in order):
  1. ROPC (Resource Owner Password Credentials) — direct API, no browser
  2. MSAL interactive — opens browser for Azure AD login (handles MFA, federation)
  3. Full SAML browser flow — selenium fallback (if Bearer auth not accepted)

Usage:
    python scripts/sap_sso_auth.py                           # MSAL interactive (browser)
    python scripts/sap_sso_auth.py -u user@bearingpoint.com   # ROPC first, then interactive
    python scripts/sap_sso_auth.py --discover                 # just decode SAML metadata

Prerequisites:
    pip install requests msal
"""

import sys
import os
import re
import json
import base64
import argparse
import getpass
from urllib.parse import urlparse, parse_qs, urljoin
from html.parser import HTMLParser

import requests

# ── SAP + Azure AD config ────────────────────────────────────────────────────
SAP_BASE = "https://ess-be.bearingpoint.com"
SAP_CLIENT = "006"
SAP_TRIGGER_URL = f"{SAP_BASE}/sap/bc/gui/sap/its/webgui?~sap-client={SAP_CLIENT}&sap-language=EN"

TENANT_ID = "aa321b6e-c2f4-42f8-95b8-4d018e6d28ec"
SAP_ENTITY_ID = "AZURESSO"  # from SAMLRequest Issuer

# Well-known Azure AD public clients (allowed for ROPC/interactive)
AZURE_PS_CLIENT = "1b730954-1685-4b74-9bfd-dac224a7b894"  # Azure PowerShell
PQ_CLIENT = "51f81489-12ee-4a9e-aaae-a2591f45987d"  # Power Query (used in CRM script)

AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
TOKEN_CACHE = os.path.join(os.path.dirname(__file__), ".token_cache_sap.json")

# OData endpoints to test after auth
ODATA_ENDPOINTS = [
    ("/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json&sap-client={client}", "Service Catalog"),
    ("/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/$metadata?sap-client={client}", "Catalog $metadata"),
    ("/sap/opu/odata/sap/HCM_TIMESHEET_MAN_SRV/?$format=json&sap-client={client}", "HCM Timesheet"),
    ("/sap/opu/odata/sap/FAP_TIMESHEET_V2_SRV/?$format=json&sap-client={client}", "Fiori Timesheet v2"),
    ("/sap/opu/odata/sap/HCMFAB_MYPROFILE_SRV/?$format=json&sap-client={client}", "HCM My Profile"),
    ("/sap/opu/odata/sap/HCM_LEAVE_REQ_CREATE_SRV/?$format=json&sap-client={client}", "Leave Request"),
    ("/sap/opu/odata/sap/GBHCM_PER_WORKFORCE_SRV/?$format=json&sap-client={client}", "Personnel Workforce"),
    ("/sap/opu/odata/sap/API_BUSINESS_PARTNER?$format=json&sap-client={client}", "Business Partner"),
    ("/sap/opu/odata/?$format=json&sap-client={client}", "OData Root"),
    ("/sap/public/info?sap-client={client}", "System Info"),
]


# ── HTML helpers ──────────────────────────────────────────────────────────────
class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self._cur = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "form":
            self._cur = {"action": a.get("action", ""), "method": a.get("method", "GET").upper(), "fields": {}}
        elif tag == "input" and self._cur is not None:
            name = a.get("name")
            if name:
                self._cur["fields"][name] = a.get("value", "")

    def handle_endtag(self, tag):
        if tag == "form" and self._cur:
            self.forms.append(self._cur)
            self._cur = None


def extract_forms(html):
    p = FormParser()
    p.feed(html)
    return p.forms


# ── Strategy 1: ROPC (no browser needed) ─────────────────────────────────────
def try_ropc(username, password):
    """Try Resource Owner Password Credentials grant with Azure AD v1 endpoint.
    Returns an access_token if successful, None if blocked (MFA, etc.)."""
    print("\n\033[1mStrategy 1: ROPC (direct API)\033[0m")
    print("=" * 60)

    # Try multiple resource identifiers — SAP might be registered under different names
    resources = [
        SAP_ENTITY_ID,                  # "AZURESSO"
        f"{SAP_BASE}/",                 # "https://ess-be.bearingpoint.com/"
        f"{SAP_BASE}",                  # without trailing slash
    ]

    for client_id in [PQ_CLIENT, AZURE_PS_CLIENT]:
        client_name = "Power Query" if client_id == PQ_CLIENT else "Azure PS"
        for resource in resources:
            print(f"  Trying client={client_name}, resource={resource[:40]}...")
            try:
                resp = requests.post(
                    f"{AUTHORITY}/oauth2/token",
                    data={
                        "grant_type": "password",
                        "client_id": client_id,
                        "resource": resource,
                        "username": username,
                        "password": password,
                    },
                    timeout=15,
                )
                data = resp.json()

                if "access_token" in data:
                    token_type = data.get("token_type", "Bearer")
                    expires_in = data.get("expires_in", "?")
                    print(f"  \033[92m→ Token obtained! ({token_type}, expires in {expires_in}s)\033[0m")
                    return data

                error = data.get("error", "")
                desc = data.get("error_description", "")

                if "AADSTS50076" in desc or "AADSTS50079" in desc:
                    print(f"  → MFA required — ROPC blocked")
                    return {"error": "mfa_required"}
                elif "AADSTS65001" in desc:
                    print(f"  → Consent required for this client")
                    continue
                elif "AADSTS700016" in desc:
                    print(f"  → Application not found")
                    continue
                elif "AADSTS50126" in desc:
                    print(f"  → Invalid credentials")
                    return {"error": "invalid_credentials"}
                elif "AADSTS500011" in desc:
                    print(f"  → Resource '{resource}' not found")
                    continue
                elif "AADSTS7000218" in desc:
                    print(f"  → ROPC not allowed for this client")
                    continue
                else:
                    err_code = re.search(r"AADSTS(\d+)", desc)
                    code_str = err_code.group(0) if err_code else error
                    print(f"  → {code_str}: {desc[:100]}")
                    continue

            except Exception as e:
                print(f"  → Error: {e}")
                continue

    print("  ROPC: no combination worked")
    return None


# ── Strategy 2: MSAL interactive (browser popup) ─────────────────────────────
def try_msal_interactive():
    """Open browser for Azure AD login via MSAL, get access token."""
    print("\n\033[1mStrategy 2: MSAL Interactive (browser)\033[0m")
    print("=" * 60)

    try:
        import msal
    except ImportError:
        print("  msal not installed. Run: pip install msal")
        return None

    cache = msal.SerializableTokenCache()
    if os.path.exists(TOKEN_CACHE):
        cache.deserialize(open(TOKEN_CACHE).read())

    app = msal.PublicClientApplication(PQ_CLIENT, authority=AUTHORITY, token_cache=cache)

    # Try silent first (cached)
    accounts = app.get_accounts()
    result = None
    if accounts:
        print(f"  Trying cached token for {accounts[0].get('username', '?')}...")
        # Try different scopes
        for scope in [f"{SAP_BASE}/.default", f"api://{SAP_ENTITY_ID}/.default"]:
            result = app.acquire_token_silent([scope], account=accounts[0])
            if result and "access_token" in result:
                print(f"  \033[92m→ Cached token valid (scope={scope})\033[0m")
                break

    if not result or "access_token" not in result:
        # Interactive — try different scopes
        for scope in [f"{SAP_BASE}/.default", f"api://{SAP_ENTITY_ID}/.default", "openid profile"]:
            print(f"  Opening browser for login (scope={scope[:40]})...")
            try:
                result = app.acquire_token_interactive(scopes=[scope])
                if result and "access_token" in result:
                    print(f"  \033[92m→ Token obtained via browser!\033[0m")
                    break
                err = result.get("error_description", result.get("error", ""))
                if "AADSTS500011" in str(err):
                    print(f"  → Resource not found for this scope, trying next...")
                    continue
                else:
                    print(f"  → {err[:100]}")
                    break
            except Exception as e:
                print(f"  → {e}")
                continue

    # Save cache
    if cache.has_state_changed:
        with open(TOKEN_CACHE, "w") as f:
            f.write(cache.serialize())

    if result and "access_token" in result:
        return result

    print(f"  \033[91mMSAL interactive failed\033[0m")
    if result:
        print(f"  Error: {result.get('error_description', result.get('error', 'unknown'))[:150]}")
    return None


# ── Strategy 3: Full SAML browser flow (selenium) ────────────────────────────
def try_saml_browser_flow():
    """Use selenium to complete the full SAML SSO flow and capture cookies."""
    print("\n\033[1mStrategy 3: SAML Browser Flow (selenium)\033[0m")
    print("=" * 60)

    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
    except ImportError:
        print("  selenium not installed. Run: pip install selenium")
        print("  Also needs Chrome/ChromeDriver installed.")
        return None

    options = Options()
    # Don't use headless — user may need to do MFA
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    print("  Opening Chrome browser...")
    print("  Please log in to Azure AD when prompted.")
    print("  The browser will close automatically once authenticated.\n")

    try:
        driver = webdriver.Chrome(options=options)
        driver.get(SAP_TRIGGER_URL)

        # Wait for SAP to load (URL changes from Azure AD back to SAP)
        print("  Waiting for authentication (up to 120s)...")
        WebDriverWait(driver, 120).until(
            lambda d: SAP_BASE in d.current_url and "login.microsoftonline.com" not in d.current_url
        )

        print(f"  \033[92m→ Authenticated! URL: {driver.current_url[:60]}\033[0m")

        # Extract cookies
        cookies = driver.get_cookies()
        driver.quit()

        # Build a requests session with the cookies
        session = requests.Session()
        for c in cookies:
            session.cookies.set(c["name"], c["value"], domain=c.get("domain", ""))

        sap_cookies = [c for c in cookies if "sap" in c["name"].lower() or "MYSAPSSO2" in c["name"]]
        print(f"  SAP cookies: {len(sap_cookies)}")
        for c in sap_cookies:
            print(f"    {c['name']} = {c['value'][:30]}...")

        return session

    except Exception as e:
        print(f"  \033[91mSelenium error: {e}\033[0m")
        try:
            driver.quit()
        except Exception:
            pass
        return None


# ── Try Bearer auth on SAP ────────────────────────────────────────────────────
def try_bearer_auth(token_data):
    """Test if SAP accepts the OAuth2 Bearer token from Azure AD."""
    print("\n\033[1mTesting Bearer Auth on SAP\033[0m")
    print("=" * 60)

    access_token = token_data.get("access_token", "")
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json, application/xml, text/html, */*",
    })

    # Test with the service catalog
    test_url = f"{SAP_BASE}/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json&sap-client={SAP_CLIENT}"
    print(f"  GET Service Catalog...")
    resp = session.get(test_url, timeout=15, allow_redirects=False)
    print(f"  → {resp.status_code} [{resp.headers.get('Content-Type', '')}] ({len(resp.content)}B)")

    if resp.status_code == 200:
        print(f"  \033[92m→ Bearer auth accepted by SAP!\033[0m")
        return session

    # Try submitting the token as a SAML assertion via the ACS endpoint
    # (some SAP systems accept OAuth tokens at the SAML ACS)
    print(f"\n  Bearer returned {resp.status_code}. Trying SAML ACS approach...")
    return try_saml_session_from_token(token_data)


def try_saml_session_from_token(token_data):
    """Try to establish SAP session via SAML by replaying the SSO flow with Azure AD cookies."""
    # Get a fresh session and replay the SAML flow
    # The idea: since we authenticated with Azure AD (via MSAL),
    # Azure AD might have set session cookies that let us complete the SAML flow
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.7",
    })

    # Step 1: Get SAP page with SAMLRequest form
    print(f"  → GET SAP trigger URL...")
    resp = session.get(SAP_TRIGGER_URL)
    forms = extract_forms(resp.text)

    saml_req_form = next((f for f in forms if "SAMLRequest" in f["fields"]), None)
    if not saml_req_form:
        print(f"  → No SAMLRequest form found")
        return None

    # Step 2: POST SAMLRequest to Azure AD
    # If Azure AD has a cached session from our MSAL login, it should return
    # a SAMLResponse without asking for credentials again
    print(f"  → POST SAMLRequest to Azure AD...")
    resp = session.post(saml_req_form["action"], data=saml_req_form["fields"], allow_redirects=True)

    # Look for SAMLResponse in the response chain
    forms = extract_forms(resp.text)
    saml_resp_form = next((f for f in forms if "SAMLResponse" in f["fields"]), None)

    if not saml_resp_form:
        # Azure AD asked for login again (no shared session between MSAL and requests)
        print(f"  → Azure AD did not auto-complete SSO (no shared session)")
        return None

    # Step 3: POST SAMLResponse to SAP
    acs_url = saml_resp_form["action"]
    if not acs_url.startswith("http"):
        acs_url = urljoin(SAP_BASE, acs_url)
    print(f"  → POST SAMLResponse to SAP ACS...")
    resp = session.post(acs_url, data=saml_resp_form["fields"], allow_redirects=True)

    # Check for SAP session cookies
    sap_cookies = [c for c in session.cookies if "sap" in c.name.lower() or "MYSAPSSO2" in c.name]
    if sap_cookies:
        print(f"  \033[92m→ SAP session established via SAML!\033[0m")
        for c in sap_cookies:
            print(f"    {c.name} = {c.value[:30]}...")
        return session

    return None


# ── Test OData endpoints ──────────────────────────────────────────────────────
def test_odata(session):
    """Probe OData endpoints using the authenticated session."""
    print("\n\033[1mOData Endpoint Testing\033[0m")
    print("=" * 60)

    success = 0
    for path, desc in ODATA_ENDPOINTS:
        url = urljoin(SAP_BASE, path.format(client=SAP_CLIENT))
        try:
            resp = session.get(url, timeout=15, allow_redirects=False)
            code = resp.status_code
            ct = resp.headers.get("Content-Type", "")
            size = len(resp.content)

            if 200 <= code < 300:
                icon = "\033[92m OK \033[0m"
                success += 1
            elif 300 <= code < 400:
                icon = "\033[93m 3xx\033[0m"
            else:
                icon = f"\033[91m{code}\033[0m"

            print(f"  {icon}  {desc:<25}  [{ct[:30]}] {size:>6}B")

            if code == 200 and "json" in ct.lower():
                try:
                    data = resp.json()
                    d = data.get("d", data)
                    if isinstance(d, dict) and "results" in d:
                        results = d["results"]
                        print(f"        \033[92m↳ {len(results)} entries\033[0m")
                        for svc in results[:10]:
                            title = svc.get("Title") or svc.get("TechnicalServiceName") or svc.get("ServiceName") or "?"
                            svc_url = svc.get("ServiceUrl") or svc.get("TechnicalServiceUrl") or ""
                            print(f"          • {title:<40} {svc_url[:50]}")
                        if len(results) > 10:
                            print(f"          ... and {len(results) - 10} more")
                    elif isinstance(d, dict) and "EntitySets" in d:
                        sets = d["EntitySets"]
                        print(f"        ↳ EntitySets: {', '.join(sets[:8])}")
                except Exception:
                    pass

        except requests.exceptions.Timeout:
            print(f"  \033[93m T/O\033[0m  {desc:<25}  Timeout (15s)")
        except Exception as e:
            print(f"  \033[91m ERR\033[0m  {desc:<25}  {type(e).__name__}: {e}")

    return success


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="SAP SSO via Azure AD — authenticate & probe OData endpoints")
    parser.add_argument("-u", "--user", help="Azure AD username (email)")
    parser.add_argument("-p", "--password", help="Password (prompted if omitted with -u)")
    parser.add_argument("--discover", action="store_true", help="Just show SAML metadata (no auth)")
    parser.add_argument("--ropc-only", action="store_true", help="Only try ROPC (no browser)")
    parser.add_argument("--browser", action="store_true", help="Skip ROPC, go straight to browser")
    parser.add_argument("--selenium", action="store_true", help="Use selenium for full SAML flow")
    args = parser.parse_args()

    print(f"\n{'=' * 60}")
    print(f"  SAP API Authentication — {SAP_BASE}")
    print(f"  Tenant: {TENANT_ID}")
    print(f"  SP Entity ID: {SAP_ENTITY_ID}")
    print(f"{'=' * 60}")

    if args.discover:
        print(f"\n  SAP SAML configuration:")
        print(f"    Entity ID (Issuer): {SAP_ENTITY_ID}")
        print(f"    Azure AD Tenant: {TENANT_ID}")
        print(f"    SAML Endpoint: {AUTHORITY}/saml2")
        print(f"    Trigger URL: {SAP_TRIGGER_URL}")
        return

    sap_session = None

    # ── Strategy 1: ROPC ──
    if args.user and not args.browser and not args.selenium:
        password = args.password or getpass.getpass("  Password: ")
        result = try_ropc(args.user, password)

        if result and "access_token" in result:
            sap_session = try_bearer_auth(result)
        elif result and result.get("error") == "invalid_credentials":
            print("\n\033[91mInvalid credentials. Check username/password.\033[0m")
            return
        elif result and result.get("error") == "mfa_required":
            print("\n  MFA blocks ROPC. Falling back to browser...")
        # else: ROPC failed, try next strategy

    # ── Strategy 2: MSAL interactive ──
    if not sap_session and not args.ropc_only and not args.selenium:
        result = try_msal_interactive()
        if result and "access_token" in result:
            sap_session = try_bearer_auth(result)

    # ── Strategy 3: Selenium ──
    if not sap_session and (args.selenium or not args.ropc_only):
        sap_session = try_saml_browser_flow()

    # ── Test endpoints ──
    if sap_session:
        ok = test_odata(sap_session)
        print(f"\n{'=' * 60}")
        if ok > 0:
            print(f"  \033[92m{ok}/{len(ODATA_ENDPOINTS)} endpoints accessible!\033[0m")
        else:
            print(f"  \033[91mNo endpoints returned 200. Session may not be valid for OData.\033[0m")
        print(f"{'=' * 60}\n")
    else:
        print(f"\n{'=' * 60}")
        print(f"  \033[91mAll authentication strategies failed.\033[0m")
        print(f"  Options:")
        print(f"    1. Try: python scripts/sap_sso_auth.py --selenium")
        print(f"       (requires: pip install selenium + Chrome)")
        print(f"    2. Ask SAP Basis team for a technical user with Basic Auth")
        print(f"    3. Ask IT to register an Azure AD app with API permissions for SAP")
        print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
