/**
 * Scout candidate test flats — NOT part of the app.
 *
 * For each "street|number" below, finds a flat's cadastral reference, then asks
 * the planning (affectation), heritage and flood services what applies there,
 * and which barri it falls in. Used to pick the fixed test set in
 * scripts/reliability-run.mts so it covers every hard case. Read-only: writes
 * nothing to the database.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/scout-test-flats.mts
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/scout-test-flats.mts "Carrer de Verdi|50"
 */
import { searchStreets, locateUnits } from "@/adapters/catastro-search";
import { geocodeRef, fetchParcelPolygon } from "@/adapters/geo";
import { fetchHeritage } from "@/adapters/heritage";
import { fetchFlood } from "@/adapters/flood";
import { fetchAffectation } from "@/adapters/affectation";
import { fetchGencatBarri } from "@/adapters/gencat-barri";

const CANDIDATES = [
  // Ciutat Vella
  "Joaquín Costa|30", "Palla|10", "Sant Carles|20", "Montcada|20",
  // Eixample (heritage, ensemble)
  "Provença|261", "Passeig de Sant Joan|108", "Girona|20", "Rambla de Catalunya|78", "Aribau|100", "Consell de Cent|300",
  // Sants-Montjuïc
  "Sants|100", "Blai|20",
  // Les Corts, Sarrià-Sant Gervasi
  "Travessera de les Corts|200", "Major de Sarrià|50", "Queralbs|5",
  // Gràcia, Horta-Guinardó, Nou Barris
  "Verdi|50", "Passeig de Maragall|200", "Via Júlia|100", "Vallbona|20",
  // Sant Andreu (Besòs side)
  "Gran de Sant Andreu|200", "Sant Adrià|100", "Ciutat d'Asunción|20",
  // Sant Martí (Besòs mouth, newer builds)
  "Rambla del Poblenou|50", "Guipúscoa|150", "Llull|400", "Cristóbal de Moura|200", "Rambla de Prim|100",
];

const args = process.argv.slice(2);
const list = args.length ? args : CANDIDATES;

const norm = (x: string) =>
  x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/** The street whose name is exactly the query's last words, else the first. */
function pickStreet<T extends { nombre: string }>(streets: T[], q: string): T | undefined {
  const words = norm(q).split(" ").filter((w) => !["CARRER", "DE", "DEL", "D", "LA", "LES", "PASSEIG", "RAMBLA", "AVINGUDA", "VIA", "TRAVESSERA"].includes(w));
  const key = words.join(" ");
  return streets.find((s) => norm(s.nombre) === key) ?? streets.find((s) => norm(s.nombre).endsWith(key)) ?? streets[0];
}

/** Prefer an upper-floor flat; fall back to whatever unit exists. */
function pickUnit<T extends { floor?: string }>(units: T[]): T | undefined {
  const upper = units.filter((u) => u.floor && /^\d+$/.test(u.floor) && Number(u.floor) >= 1);
  return upper[Math.floor(upper.length / 2)] ?? units[0];
}

for (const c of list) {
  const [street, number] = c.split("|");
  try {
    const streets = await searchStreets(street);
    const s = pickStreet(streets, street);
    if (!s) { console.log(`${c.padEnd(30)} no street match`); continue; }
    // Catastro registers some buildings under one number of a range (18-20),
    // so try nearby numbers on the same side of the street.
    let units: Awaited<ReturnType<typeof locateUnits>> = [];
    for (const d of [0, 2, -2, 4, -4, 1, -1]) {
      units = await locateUnits(s.tipo, s.nombre, String(Number(number) + d));
      if (units.length) break;
    }
    const u = pickUnit(units);
    if (!u) { console.log(`${c.padEnd(30)} no units (${s.tipo} ${s.nombre})`); continue; }
    const geo = await geocodeRef(u.ref, 10_000);
    const coords = geo.status === "ok" ? geo.data : undefined;
    const [aff, her, fl] = await Promise.all([
      fetchAffectation(u.ref),
      coords ? fetchHeritage(coords, { polygon: await fetchParcelPolygon(u.ref) }) : Promise.resolve(undefined),
      coords ? fetchFlood(coords) : Promise.resolve(undefined),
    ]);
    const barri = fetchGencatBarri(coords);
    const cols = [
      c.padEnd(30),
      u.ref,
      `fl ${u.floor ?? "?"}`.padEnd(6),
      `units ${units.length}`.padEnd(9),
      `aff ${aff.status === "ok" ? aff.data!.category : aff.status}`.padEnd(10),
      `her ${her?.status === "ok" ? (her.data!.level ?? (her.data!.inEnsemble ? "ens" : "-")) : her?.status ?? "no-coords"}`.padEnd(9),
      `flood ${fl?.status === "ok" ? fl.data!.level : fl?.status ?? "no-coords"}`.padEnd(12),
      barri.status === "ok" ? `${barri.data!.name} (${barri.data!.transactions ?? "?"} sales)` : "no barri",
    ];
    console.log(cols.join(" "));
  } catch (e) {
    console.log(`${c.padEnd(30)} error: ${(e as Error).message}`);
  }
}
