#!/usr/bin/env python3
"""
Seed the real database with source data (Excel files + CRM).

Usage:
    python scripts/seed_db.py              # import Excel files from data/ + CRM
    python scripts/seed_db.py --excel      # import Excel files only
    python scripts/seed_db.py --crm        # refresh CRM only

Prerequisites:
    pip install openpyxl msal requests
    python scripts/init_db.py              # create tables first
"""

import sys
import os
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def run(cmd, label):
    """Run a subprocess and print status."""
    print(f"\n{'─' * 60}")
    print(f"  {label}")
    print(f"{'─' * 60}\n")
    result = subprocess.run(cmd, cwd=os.path.join(SCRIPT_DIR, ".."))
    if result.returncode != 0:
        print(f"\n✗ {label} failed (exit code {result.returncode})")
    else:
        print(f"\n✓ {label} done")
    return result.returncode


def main():
    do_excel = "--excel" in sys.argv or len(sys.argv) == 1
    do_crm = "--crm" in sys.argv or len(sys.argv) == 1

    print("=" * 60)
    print("  Seed Real Database")
    print("=" * 60)

    errors = 0

    if do_excel:
        errors += run(
            [sys.executable, os.path.join(SCRIPT_DIR, "import_files.py")],
            "Import Excel files (MDS, SAP, Skills) from data/",
        )

    if do_crm:
        errors += run(
            [sys.executable, os.path.join(SCRIPT_DIR, "refresh_crm.py"), "--all", "--push"],
            "Refresh CRM from Dynamics 365",
        )

    print(f"\n{'=' * 60}")
    if errors:
        print(f"  Done with {errors} error(s)")
    else:
        print("  All done!")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
