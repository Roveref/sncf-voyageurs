#!/usr/bin/env python3
"""Quick inspection of what SAP returns for the Web GUI and OData URLs."""

import requests
import re
from html.parser import HTMLParser

SAP_BASE = "https://ess-be.bearingpoint.com"
URLS = [
    f"{SAP_BASE}/sap/bc/gui/sap/its/webgui?~sap-client=006&sap-language=EN",
    f"{SAP_BASE}/sap/opu/odata/IWFND/CATALOGSERVICE;v=2/ServiceCollection?$format=json&sap-client=006",
    f"{SAP_BASE}/sap/public/info",
]


class FormParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.forms = []
        self._cur = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "form":
            self._cur = {"action": a.get("action", ""), "method": a.get("method", ""), "inputs": []}
        elif tag == "input" and self._cur is not None:
            self._cur["inputs"].append({"name": a.get("name", ""), "type": a.get("type", ""), "value": a.get("value", "")[:50]})

    def handle_endtag(self, tag):
        if tag == "form" and self._cur:
            self.forms.append(self._cur)
            self._cur = None


session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/json,*/*",
})

for url in URLS:
    label = url.replace(SAP_BASE, "")[:70]
    print(f"\n{'=' * 70}")
    print(f"GET {label}")
    print(f"{'=' * 70}")

    resp = session.get(url, allow_redirects=True, timeout=15)
    print(f"  Status:       {resp.status_code}")
    print(f"  Final URL:    {resp.url[:80]}")
    print(f"  Content-Type: {resp.headers.get('Content-Type', 'N/A')}")
    print(f"  Size:         {len(resp.content)} bytes")

    # Show relevant headers
    for h in ("WWW-Authenticate", "X-SAP-Login", "SAP-System", "Set-Cookie", "Location"):
        val = resp.headers.get(h)
        if val:
            print(f"  {h}: {val[:100]}")

    # Show cookies set
    for c in resp.cookies:
        print(f"  Cookie set: {c.name} = {c.value[:40]}...")

    ct = resp.headers.get("Content-Type", "")

    if "html" in ct:
        html = resp.text
        # Look for forms
        p = FormParser()
        p.feed(html)
        if p.forms:
            for i, form in enumerate(p.forms):
                print(f"\n  Form #{i + 1}: action={form['action'][:60]}  method={form['method']}")
                for inp in form["inputs"]:
                    print(f"    <input name={inp['name']!r} type={inp['type']!r} value={inp['value']!r}>")

        # Look for meta refresh / JS redirect
        meta = re.findall(r'<meta[^>]*http-equiv=["\']refresh["\'][^>]*content=["\']([^"\']*)', html, re.I)
        for m in meta:
            print(f"\n  Meta refresh: {m[:80]}")

        js_redir = re.findall(r'(?:window\.location|location\.href|document\.location)\s*=\s*["\']([^"\']+)', html)
        for j in js_redir:
            print(f"\n  JS redirect: {j[:80]}")

        # Show first 2000 chars of HTML (trimmed)
        preview = html[:2000].strip()
        print(f"\n  HTML preview ({len(html)} chars total):")
        print("  " + "-" * 50)
        for line in preview.split("\n")[:50]:
            stripped = line.strip()
            if stripped:
                print(f"  | {stripped[:100]}")
        print("  " + "-" * 50)

    elif "json" in ct:
        print(f"\n  JSON: {resp.text[:500]}")
    else:
        print(f"\n  Body: {resp.text[:500]}")
