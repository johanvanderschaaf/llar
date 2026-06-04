import type { Localized, Panel } from "@/types/report";

/**
 * Deterministic Building & condition content derived from the Catastro year.
 * The key obligations (ITE inspection, possible asbestos) are facts of the
 * build year — not AI guesses. Qualitative "is the kitchen nice" judgements are
 * out of scope (no source); we state what's verifiable and what to check.
 */
export function buildBuilding(yearBuilt?: number): {
  panels: Panel[];
  keyline: Localized;
} {
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : undefined;
  const iteDue = age != null && age >= 45;
  const asbestos = yearBuilt != null && yearBuilt < 2002;

  const buildingBody: Localized = yearBuilt
    ? {
        en: `Built in ${yearBuilt} (${age} years old). ${
          iteDue
            ? "Buildings over 45 years old must hold a valid ITE technical inspection — demand the current certificate."
            : "Not yet subject to a mandatory ITE inspection by age, but ask whether one has been done."
        }`,
        es: `Construido en ${yearBuilt} (${age} años). ${
          iteDue
            ? "Los edificios de más de 45 años deben tener una ITE vigente — exige el certificado actual."
            : "Aún no obligado a ITE por antigüedad, pero pregunta si se ha hecho."
        }`,
      }
    : {
        en: "Construction year unknown — confirm it and the building's ITE status with the seller.",
        es: "Año de construcción desconocido — confírmalo y el estado de la ITE con el vendedor.",
      };

  const checkBody: Localized = {
    en: `${
      asbestos ? "Pre-2002 build → possible asbestos in legacy pipes/elements. " : ""
    }Check the community reserve fund and any pending or approved derramas (special levies) in the last meeting minutes (actas). On a top floor, inspect the roof for damp and who pays its upkeep.`,
    es: `${
      asbestos
        ? "Construcción anterior a 2002 → posible amianto en tuberías/elementos antiguos. "
        : ""
    }Revisa el fondo de reserva de la comunidad y cualquier derrama pendiente o aprobada en las últimas actas. En una última planta, inspecciona la cubierta por humedades y quién paga su mantenimiento.`,
  };

  return {
    panels: [
      {
        heading: { en: "The building", es: "El edificio" },
        body: buildingBody,
      },
      {
        heading: { en: "What to check", es: "Qué revisar" },
        body: checkBody,
      },
    ],
    keyline: {
      en: "Reform ≠ structure. A new kitchen doesn't fix a tired façade or roof. Verify the building's collective health — reserve fund, pending derramas — in the community minutes before you commit.",
      es: "Reforma ≠ estructura. Una cocina nueva no arregla una fachada o cubierta cansadas. Verifica la salud colectiva del edificio —fondo de reserva, derramas pendientes— en las actas antes de comprometerte.",
    },
  };
}
