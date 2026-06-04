import { XMLParser } from "fast-xml-parser";
import {
  type AdapterResult,
  fetchWithTimeout,
  failed,
  ok,
  unavailable,
} from "./types";

/**
 * Catastro Consulta_CPMRC — coordinates (lat/lon, EPSG:4326) from a parcel
 * cadastral reference. Free, official, no key. Coordinates feed the amenity
 * and natural-risk lookups (which are geographic).
 */
const OVC =
  "https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC/OVCCoordenadas.asmx/Consulta_CPMRC";

export interface Coordinates {
  lat: number;
  lon: number;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
});

export async function geocodeRef(
  cadastralRef: string,
): Promise<AdapterResult<Coordinates>> {
  const parcelRef = cadastralRef.replace(/\s+/g, "").toUpperCase().slice(0, 14);
  try {
    const res = await fetchWithTimeout(
      `${OVC}?Provincia=&Municipio=&SRS=EPSG:4326&RC=${encodeURIComponent(parcelRef)}`,
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const root = (parser.parse(await res.text()) as Record<string, unknown>)
      .consulta_coordenadas as Record<string, unknown> | undefined;
    const coord = (
      (root?.coordenadas as Record<string, unknown>)?.coord as
        | Record<string, unknown>
        | Record<string, unknown>[]
    );
    const first = Array.isArray(coord) ? coord[0] : coord;
    const geo = first?.geo as Record<string, unknown> | undefined;
    const lon = Number(geo?.xcen);
    const lat = Number(geo?.ycen);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return unavailable<Coordinates>(
        "catastro",
        "Catastro returned no coordinates for this reference.",
      );
    }
    return ok<Coordinates>("catastro", { lat, lon });
  } catch (e) {
    return failed<Coordinates>("catastro", `Geocode failed: ${(e as Error).message}`);
  }
}
