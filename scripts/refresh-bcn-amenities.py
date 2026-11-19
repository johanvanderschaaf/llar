#!/usr/bin/env python3
"""
Refresh the Barcelona amenities dataset behind adapters/amenities.ts.

Replaces the live OpenStreetMap (Overpass) lookup, which by November 2026
refused or timed out on every request. All sources are official Ajuntament de
Barcelona Open Data (CC BY 4.0), found through the portal's CKAN API by
dataset id, so a moved download link doesn't break the script:

  metro        transports                              Metro + urban FGC entrances
  health       equipament-sanitat                      hospitals/clinics, CAPs, CUAPs
  schools      equipament-educacio                     infant (3-6), primary, secondary
  market       equipament-mercats-i-centres-comercials municipal markets
  supermarket  cens-locals-planta-baixa-act-economica  ground-floor shop census, chains only
  green        espais-verds-publics                    public parks > 0.5 ha (outlines)

Output (committed to git): data/bcn-amenities.json

Safety: the script refuses to write a file whose category counts look broken
(below a floor, or more than 25% smaller than the current file), so a bad
download can never silently replace good data.

Run from the project root (standard library only, no pip installs):

    python3 scripts/refresh-bcn-amenities.py
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import json
import math
import re
import sqlite3
import struct
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "bcn-amenities.json"
CKAN = "https://opendata-ajuntament.barcelona.cat/data/api/3/action"
UA = "pisowise-data-refresh/1.0"

# Smallest believable count per category; anything lower means a broken source.
FLOORS = {"metro": 100, "health": 50, "schools": 300, "market": 30, "supermarket": 300, "green": 100}
# Largest allowed drop versus the current file before refusing to write.
MAX_DROP = 0.25

# Supermarket chains, matched as whole words in the shop's name. The census
# files every "Autoservei / Supermercat" together, corner shops included; the
# buyer's "nearest supermarket" should be a real one.
CHAINS = [
    ("Mercadona", r"MERCADONA"), ("Caprabo", r"CAPRABO"), ("Condis", r"CONDIS"),
    ("Consum", r"CONSUM"), ("Bonpreu", r"BON ?PREU"), ("Esclat", r"ESCLAT"),
    ("bonÀrea", r"BON ?AREA"), ("Ametller Origen", r"AMETLLER"), ("Lidl", r"LIDL"),
    ("Aldi", r"ALDI"), ("Dia", r"DIA"), ("Carrefour", r"CARREFOUR"),
    ("Alcampo", r"ALCAMPO"), ("Sorli", r"SORLI"), ("Veritas", r"VERITAS"),
    ("Coviran", r"COVIRAN"), ("Coaliment", r"COALIMENT"), ("Suma", r"SUMA"),
    ("Supercor", r"SUPERCOR"), ("Spar", r"SPAR"), ("Proxim", r"PROXIM"),
    ("Tradys", r"TRADYS"), ("Keisy", r"KEISY"), ("Charter", r"CHARTER"),
    ("Molsa", r"MOLSA"), ("Eroski", r"EROSKI"), ("Supeco", r"SUPECO"),
    ("Plusfresc", r"PLUSFRESC"), ("Hipercor", r"HIPERCOR"),
]
CHAIN_RE = [(name, re.compile(rf"\b{pat}\b")) for name, pat in CHAINS]


# ── download ────────────────────────────────────────────────────────────────

def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def resource(dataset: str, name_prefix: str) -> tuple[bytes, dict]:
    """Download the dataset's file whose name starts with `name_prefix`."""
    meta = json.loads(get(f"{CKAN}/package_show?id={dataset}"))["result"]
    res = next(r for r in meta["resources"] if (r.get("name") or "").startswith(name_prefix))
    print(f"[{dataset}] {res['name']}", file=sys.stderr)
    source = {
        "dataset": dataset,
        "title": meta.get("title"),
        "page": f"https://opendata-ajuntament.barcelona.cat/data/dataset/{dataset}",
        "file": res.get("name"),
        "modified": (res.get("last_modified") or meta.get("metadata_modified") or "")[:10],
        "licence": meta.get("license_title"),
    }
    return get(res["url"]), source


def read_csv(raw: bytes) -> list[dict]:
    for enc in ("utf-8-sig", "utf-16"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("latin-1")
    first = text.split("\n", 1)[0]
    delim = max(",;\t", key=first.count)
    rows = list(csv.DictReader(io.StringIO(text), delimiter=delim))
    # Some exports put a BOM on the first column name.
    return [{k.lstrip("﻿"): (v or "") for k, v in r.items() if k} for r in rows]


def pt(lat: str, lon: str) -> list[float] | None:
    try:
        la, lo = float(lat), float(lon)
    except ValueError:
        return None
    # Barcelona's bounding box (with margin): rejects zero/garbage coordinates.
    if not (41.25 < la < 41.55 and 1.95 < lo < 2.35):
        return None
    return [round(la, 5), round(lo, 5)]


# ── per-category parsers ────────────────────────────────────────────────────

def parse_metro(rows: list[dict]) -> list[list]:
    """Entrances of metro + urban FGC lines, named by their station."""
    out = []
    for r in rows:
        if not r["NOM_CAPA"].startswith("Metro"):
            continue
        p = pt(r["LATITUD"], r["LONGITUD"])
        # Two shapes in the same file:
        #   entrances: "Fabra i Puig (Avinguda Meridiana)-" → "Fabra i Puig"
        #   stations:  "METRO (L1) - Urgell-"              → "Urgell"
        raw = r["EQUIPAMENT"].strip()
        m = re.match(r"^METRO\s*\([^)]*\)\s*-\s*(.+)$", raw, re.I)
        name = (m.group(1) if m else raw.split(" (")[0]).strip(" -")
        if p and name:
            out.append([*p, name])
    return out


def parse_facilities(rows: list[dict], filters: set[str]) -> list[list]:
    """Ajuntament facility lists: one row per attribute, so dedupe by id."""
    seen: dict[str, list] = {}
    for r in rows:
        if r.get("secondary_filters_name") not in filters:
            continue
        rid = r["register_id"].lstrip("﻿")
        if rid in seen:
            continue
        p = pt(r["geo_epgs_4326_lat"], r["geo_epgs_4326_lon"])
        if p:
            seen[rid] = [*p, r["name"].strip()]
    return list(seen.values())


def parse_supermarkets(rows: list[dict]) -> list[list]:
    out = []
    for r in rows:
        if r["Nom_Activitat"] not in ("Autoservei / Supermercat", "Grans magatzems i hipermercats"):
            continue
        name = r["Nom_Local"].upper()
        chain = next((c for c, rx in CHAIN_RE if rx.search(name)), None)
        p = pt(r["Latitud"], r["Longitud"])
        if chain and p:
            out.append([*p, chain])
    return out


def utm31_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """ETRS89 / UTM zone 31N (EPSG:25831) → lat/lon. Accurate to < 1 m here."""
    a, f, k0 = 6378137.0, 1 / 298.257222101, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    x -= 500000.0
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
            + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
            + (151 * e1**3 / 96) * math.sin(6 * mu))
    n1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    t1 = math.tan(phi1) ** 2
    c1 = ep2 * math.cos(phi1) ** 2
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * k0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d**2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720)
    lon = (d - (1 + 2 * t1 + c1) * d**3 / 6
           + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120) / math.cos(phi1)
    return math.degrees(lat), 3 + math.degrees(lon)


def wkb_rings(wkb: bytes) -> list[list[tuple[float, float]]]:
    """Rings of a (Multi)Polygon in WKB, as lists of (x, y)."""
    rings: list[list[tuple[float, float]]] = []

    def geom(off: int) -> int:
        bo = "<" if wkb[off] == 1 else ">"
        gtype = struct.unpack_from(bo + "I", wkb, off + 1)[0] % 1000
        off += 5
        if gtype == 3:  # Polygon
            (nr,) = struct.unpack_from(bo + "I", wkb, off)
            off += 4
            for _ in range(nr):
                (npts,) = struct.unpack_from(bo + "I", wkb, off)
                off += 4
                ring = [struct.unpack_from(bo + "dd", wkb, off + 16 * i) for i in range(npts)]
                off += 16 * npts
                rings.append(ring)
        elif gtype == 6:  # MultiPolygon
            (ng,) = struct.unpack_from(bo + "I", wkb, off)
            off += 4
            for _ in range(ng):
                off = geom(off)
        else:
            raise ValueError(f"unexpected geometry type {gtype}")
        return off

    geom(0)
    return rings


def parse_parks(raw: bytes) -> list[dict]:
    """Park outlines (outer rings), thinned to vertices ≥ 10 m apart."""
    with tempfile.NamedTemporaryFile(suffix=".gpkg") as tmp:
        tmp.write(raw)
        tmp.flush()
        db = sqlite3.connect(tmp.name)
        table = db.execute("select table_name from gpkg_contents").fetchone()[0]
        srs = db.execute("select srs_id from gpkg_geometry_columns where table_name=?", (table,)).fetchone()[0]
        if srs != 25831:
            raise ValueError(f"parks: expected EPSG:25831, got {srs}")
        rows = db.execute(f'select nom, geom from "{table}"').fetchall()
    parks = []
    for name, blob in rows:
        # GeoPackage header: 'GP', version, flags, srs_id, then an envelope
        # whose size is given by flag bits 1-3; WKB follows.
        flags = blob[3]
        env = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[(flags >> 1) & 0b111]
        rings = wkb_rings(blob[8 + env:])
        outline: list[list[float]] = []
        for ring in rings:
            last = None
            for x, y in ring:
                if last and math.hypot(x - last[0], y - last[1]) < 10:
                    continue
                last = (x, y)
                lat, lon = utm31_to_wgs84(x, y)
                outline.append([round(lat, 5), round(lon, 5)])
            # Mark the end of each ring so edges aren't drawn between rings.
            outline.append([])
        if any(outline):
            parks.append({"name": (name or "").strip(), "ring": outline})
    return parks


# ── main ────────────────────────────────────────────────────────────────────

def main() -> int:
    sources = []

    raw, s = resource("transports", "Transports.csv"); sources.append(s)
    metro = parse_metro(read_csv(raw))

    raw, s = resource("equipament-sanitat", "opendatabcn_llista-equipaments_sanitat-csv"); sources.append(s)
    health = parse_facilities(read_csv(raw), {"Hospitals i clíniques", "CAPs", "Centres urgències (CUAPs)"})

    raw, s = resource("equipament-educacio", "opendatabcn_llista-equipaments_educacio-csv"); sources.append(s)
    schools = parse_facilities(read_csv(raw), {"Ensenyament infantil (3-6 anys)", "Educació primària", "Educació secundària"})

    raw, s = resource("equipament-mercats-i-centres-comercials", "opendatabcn_llista-equipaments_mercats-i-centres-c"); sources.append(s)
    market = parse_facilities(read_csv(raw), {"Mercats municipals"})

    # Newest yearly shop census (file names start with the year).
    meta = json.loads(get(f"{CKAN}/package_show?id=cens-locals-planta-baixa-act-economica"))["result"]
    newest = max((r["name"] for r in meta["resources"] if re.match(r"^\d{4}_CensComercial", r.get("name") or "") and (r.get("format") or "").upper() == "CSV"))
    raw, s = resource("cens-locals-planta-baixa-act-economica", newest); sources.append(s)
    supermarket = parse_supermarkets(read_csv(raw))

    raw, s = resource("espais-verds-publics", "2019_pev_parcs_od"); sources.append(s)
    green = parse_parks(raw)

    data = {
        "asOf": dt.date.today().isoformat(),
        "sources": sources,
        "metro": metro,
        "health": health,
        "schools": schools,
        "market": market,
        "supermarket": supermarket,
        "green": green,
    }

    counts = {k: len(data[k]) for k in FLOORS}
    print("counts:", counts, file=sys.stderr)
    problems = [f"{k}: {n} < floor {FLOORS[k]}" for k, n in counts.items() if n < FLOORS[k]]
    if OUT.exists():
        old = json.loads(OUT.read_text())
        for k, n in counts.items():
            prev = len(old.get(k, []))
            if prev and n < prev * (1 - MAX_DROP):
                problems.append(f"{k}: {n} vs {prev} in the current file (> {int(MAX_DROP * 100)}% drop)")
    if problems:
        print("REFUSING TO WRITE, counts look wrong:\n  " + "\n  ".join(problems), file=sys.stderr)
        return 1

    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
