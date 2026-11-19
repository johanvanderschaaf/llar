#!/usr/bin/env python3
"""
Summarise how the data files changed since the last commit, as Markdown for
the monthly refresh pull request (.github/workflows/refresh-data.yml).

Also checks freshness: if the barri closing prices cover a period that ended
more than STALE_MONTHS ago, it says so in the summary and writes `stale=true`
to $GITHUB_OUTPUT so the workflow fails and GitHub emails the owner. That
catches a source that silently stopped updating (e.g. a renamed file).

Usage: python3 scripts/data-summary.py > summary.md   (standard library only)
"""

from __future__ import annotations

import datetime as dt
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STALE_MONTHS = 7
MONTHS_CA = ["gener", "febrer", "març", "abril", "maig", "juny", "juliol",
             "agost", "setembre", "octubre", "novembre", "desembre"]
AMENITY_KEYS = ["metro", "health", "schools", "market", "supermarket", "green"]


def committed(path: str) -> dict | None:
    try:
        raw = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=ROOT,
                             capture_output=True, check=True).stdout
        return json.loads(raw)
    except (subprocess.CalledProcessError, json.JSONDecodeError):
        return None


def current(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def period_end(as_of: str) -> dt.date | None:
    """'gener 2025 - desembre 2025' → 2025-12-01."""
    parts = as_of.lower().split()
    for i in range(len(parts) - 1, 0, -1):
        if parts[i].isdigit() and parts[i - 1] in MONTHS_CA:
            return dt.date(int(parts[i]), MONTHS_CA.index(parts[i - 1]) + 1, 1)
    return None


def main() -> None:
    lines = ["Automatic monthly refresh of the data files. "
             "The tests passed on this data; merge to deploy it.", ""]

    new_p, old_p = current("data/bcn-barri-prices.json"), committed("data/bcn-barri-prices.json")
    lines.append("### Barri closing prices (Generalitat Habitatge)")
    if old_p and old_p.get("asOf") == new_p.get("asOf") and old_p == new_p:
        lines.append(f"No change, still **{new_p['asOf']}**.")
    else:
        lines.append(f"Period: {old_p.get('asOf') if old_p else '(none)'} → **{new_p['asOf']}**")
        if old_p:
            moved = []
            for code, r in new_p["byBarri"].items():
                before = old_p["byBarri"].get(code, {}).get("pricePerM2")
                after = r.get("pricePerM2")
                if before and after and abs(after - before) / before >= 0.10:
                    moved.append(f"{r['name']}: {before} → {after} €/m²")
            if moved:
                lines.append("Barris that moved 10% or more (worth a glance):")
                lines += [f"- {m}" for m in moved[:15]]

    end = period_end(new_p.get("asOf", ""))
    today = dt.date.today()
    stale = bool(end) and (today.year - end.year) * 12 + today.month - end.month > STALE_MONTHS
    if stale:
        lines += ["", f"> ⚠ The newest prices end **{end:%B %Y}**, more than {STALE_MONTHS} months ago. "
                  "Gencat may have renamed or moved the file; check `latest_gencat_url()` "
                  "in scripts/refresh-bcn-pricing.py."]

    new_a, old_a = current("data/bcn-amenities.json"), committed("data/bcn-amenities.json")
    lines += ["", "### Amenities (Ajuntament de Barcelona open data)", "",
              "| Category | Before | After |", "|---|---|---|"]
    for k in AMENITY_KEYS:
        before = len(old_a.get(k, [])) if old_a else "-"
        lines.append(f"| {k} | {before} | {len(new_a.get(k, []))} |")
    lines.append("")
    lines.append("Source files: " + ", ".join(
        f"[{s['dataset']}]({s['page']}) ({s['modified']})" for s in new_a.get("sources", [])))

    print("\n".join(lines))
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"stale={'true' if stale else 'false'}\n")


if __name__ == "__main__":
    main()
