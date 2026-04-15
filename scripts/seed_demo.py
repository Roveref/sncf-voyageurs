#!/usr/bin/env python3
"""
Seed the demo database with dummy data.

Usage:
    python scripts/seed_demo.py            # seed if empty
    python scripts/seed_demo.py --force    # clear + reseed

Prerequisites:
    python scripts/init_db.py              # create tables first
    npm install (in api/)                  # for tsx + better-sqlite3
"""

import sys
import os
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
API_DIR = os.path.join(SCRIPT_DIR, "..", "api")


def main():
    print("=" * 60)
    print("  Seed Demo Database")
    print("=" * 60)

    cmd = ["npx", "tsx", "src/scripts/seedDemo.ts"]

    result = subprocess.run(cmd, cwd=API_DIR)

    if result.returncode != 0:
        print(f"\n✗ Seed failed (exit code {result.returncode})")
        sys.exit(1)
    else:
        print(f"\n✓ Demo database seeded")


if __name__ == "__main__":
    main()
