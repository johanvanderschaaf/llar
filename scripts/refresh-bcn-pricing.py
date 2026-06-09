#!/usr/bin/env python3
"""
Refresh the Barcelona barri-level pricing dataset and polygons.

Pulls two public sources:

1. Generalitat Habitatge — quarterly XLSX of registered second-hand
   compraventa prices for Barcelona city, broken down by barri.
   Source: https://habitatge.gencat.cat/.../compravendes-habitatges-Barcelona/

2. Ajuntament BCN Open Data — official polygons of the 73 barris.
   Source: https://opendata-ajuntament.barcelona.cat/data/.../20170706-districtes-barris

Outputs (committed to git):

- data/bcn-barri-prices.json  — quarterly; refresh ~4× per year.
- data/bcn-barris.json     — annual at most; rarely changes.

Run from the project root:

    python3 scripts/refresh-bcn-pricing.py

Requires: pandas, openpyxl, pyproj  (pip install pandas openpyxl pyproj)
"""

from __future__ import annotations

import datetime as dt
import io
import json
import sys
import urllib.request
import zipfile
from pathlib import Path

import pandas as pd
from pyproj import Transformer

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


# ---------- 1. Gencat XLSX → barri prices ----------

GENCAT_BASE = (
    "https://habitatge.gencat.cat/web/.content/home/dades/estadistiques/"
    "01_Estadistiques_de_construccio_i_mercat_immobiliari/"
    "02_Compravenda_i_preu_de_venda/"
    "02_Compravendes_d_habitatges_registrades_i_el_preu_de_venda"
)


def latest_gencat_url() -> str:
    """Pick the most recent 'usat acum1any' file we can find."""
    today = dt.date.today()
    # The portal publishes Q4 files in May of year+1, so try year, then year-1.
    for year in (today.year, today.year - 1):
        url = f"{GENCAT_BASE}/{year}/BCN_usat_acum1any_{year}.xlsx"
        req = urllib.request.Request(url, method="HEAD")
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status == 200:
                    return url
        except Exception:  # noqa: BLE001 — best-effort probe
            continue
    raise SystemExit("Could not find a Gencat usat_acum1any file for recent years.")


def fetch_gencat_prices() -> dict:
    url = latest_gencat_url()
    print(f"[gencat] {url}")
    with urllib.request.urlopen(url, timeout=60) as r:
        buf = r.read()
    xl = pd.ExcelFile(io.BytesIO(buf), engine="openpyxl")

    # Sheets are like '4t25acum_1any', '3t25acum_1any', … — latest one first
    # is the most recent calendar-quarter rolling-12-month view.
    sheet = sorted(xl.sheet_names, reverse=True)[0]
    print(f"[gencat] latest sheet: {sheet}")
    df = pd.read_excel(xl, sheet_name=sheet, header=None)

    # Row 1 holds the period label, e.g. "Període: gener 2025 - desembre 2025"
    period_raw = str(df.iat[1, 0])
    period = period_raw.replace("Període:", "").strip()

    # Find the "Barris de Barcelona" section marker and slurp from there.
    barri_header_row = df.index[df[1].astype(str).str.strip() == "Barris de Barcelona"]
    if not len(barri_header_row):
        raise RuntimeError("Could not locate 'Barris de Barcelona' row in the sheet.")
    start = int(barri_header_row[0]) + 1

    def num(v):
        """Cast cell to float, treating 'n.d.' (low-volume barris) as None."""
        if pd.isna(v) or (isinstance(v, str) and v.strip() in {"n.d.", "n.d", "-"}):
            return None
        try:
            return float(v)
        except (TypeError, ValueError):
            return None

    rows: dict[str, dict] = {}
    for _, r in df.iloc[start:].iterrows():
        codi = r[0]
        nom = r[1]
        if pd.isna(codi) or pd.isna(nom):
            continue
        code = f"{int(codi):02d}"
        tx = num(r[2])
        surf = num(r[3])
        ppm = num(r[5])
        rows[code] = {
            "name": str(nom).strip(),
            "transactions": int(tx) if tx is not None else None,
            "avgSurfaceM2": round(surf, 1) if surf is not None else None,
            "pricePerM2": round(ppm) if ppm is not None else None,
        }
    print(f"[gencat] parsed {len(rows)} barris")
    return {
        "asOf": period,
        "source": "Generalitat de Catalunya — Habitatge (registered notarial sales, second-hand homes, rolling 12 months)",
        "sourceUrl": url,
        "byBarri": rows,
    }


# ---------- 2. BCN polygons → barri GeoJSON (WGS84, simplified) ----------

POLYGON_URL = (
    "https://opendata-ajuntament.barcelona.cat/data/dataset/"
    "808daafa-d9ce-48c0-925a-fa5afdb1ed41/"
    "resource/cd800462-f326-429f-a67a-c69b7fc4c50a/download"
)


def reproject_ring(ring: list, tf: Transformer) -> list:
    """Reproject a single ring [[x,y],...] from EPSG:25831 → 4326 (lng, lat)."""
    out = []
    last = None
    for x, y, *_ in ring:
        lng, lat = tf.transform(x, y)
        # Tiny precision is enough for point-in-polygon at barri scale.
        coord = [round(lng, 6), round(lat, 6)]
        if coord != last:
            out.append(coord)
            last = coord
    return out


def fetch_barri_polygons() -> dict:
    print(f"[bcn] {POLYGON_URL}")
    with urllib.request.urlopen(POLYGON_URL, timeout=60) as r:
        buf = r.read()
    with zipfile.ZipFile(io.BytesIO(buf)) as z:
        name = next(n for n in z.namelist() if "POLIGONS" in n)
        with z.open(name) as f:
            full = json.load(f)

    tf = Transformer.from_crs("EPSG:25831", "EPSG:4326", always_xy=True)
    out = {"type": "FeatureCollection", "features": []}
    for feat in full["features"]:
        p = feat["properties"]
        if p.get("TIPUS_UA") != "BARRI":
            continue
        code = p.get("BARRI", "").lstrip("0") or "0"
        # Reproject the geometry (Polygon or MultiPolygon).
        geom = feat["geometry"]
        if geom["type"] == "Polygon":
            geom["coordinates"] = [reproject_ring(r, tf) for r in geom["coordinates"]]
        elif geom["type"] == "MultiPolygon":
            geom["coordinates"] = [
                [reproject_ring(r, tf) for r in poly] for poly in geom["coordinates"]
            ]
        out["features"].append({
            "type": "Feature",
            "properties": {
                "code": f"{int(code):02d}",
                "name": p.get("NOM"),
                "districtCode": p.get("DISTRICTE"),
            },
            "geometry": geom,
        })
    print(f"[bcn] {len(out['features'])} barri polygons reprojected to WGS84")
    return out


# ---------- main ----------

def main() -> None:
    DATA.mkdir(exist_ok=True)
    prices = fetch_gencat_prices()
    (DATA / "bcn-barri-prices.json").write_text(
        json.dumps(prices, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    polys = fetch_barri_polygons()
    (DATA / "bcn-barris.json").write_text(
        json.dumps(polys, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print("\nWrote:")
    print(f"  {DATA / 'bcn-barri-prices.json'}")
    print(f"  {DATA / 'bcn-barris.json'}")


if __name__ == "__main__":
    sys.exit(main())
