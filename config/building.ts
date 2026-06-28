import type { Localized, TermDef } from "@/types/report";

/**
 * Deterministic Building & condition content derived from the Catastro year.
 * The key obligations (ITE inspection, possible asbestos) are facts of the
 * build year, not AI guesses. Qualitative "is the kitchen nice" judgements are
 * out of scope (no source); we state what's verifiable and what to check.
 *
 * Shape mirrors the report-page design: a definition list ("The building") +
 * a bullet checklist ("What to check") + a keyline. The renderer turns
 * `facts` into a `<dl>` and `checks` into a checkmark list.
 */
export function buildBuilding(yearBuilt?: number): {
  facts: TermDef[];
  checks: Localized[];
  keyline: Localized;
} {
  const age = yearBuilt ? new Date().getFullYear() - yearBuilt : undefined;
  const iteDue = age != null && age >= 45;
  const asbestos = yearBuilt != null && yearBuilt < 2002;
  // Reinforced-concrete era: aluminous cement risk lived in ~1955–1980 blocks.
  const aluminousEra =
    yearBuilt != null && yearBuilt >= 1955 && yearBuilt <= 1980;

  const facts: TermDef[] = [];

  // Age
  facts.push({
    term: { en: "Age", es: "Antigüedad", ca: "Antiguitat" },
    def: yearBuilt
      ? {
          en: `Completed ${yearBuilt}, so ${age} years old.${
            iteDue ? " Inside the window where the ITE is obligatory." : " Not yet within the ITE-obligatory age window."
          }`,
          es: `Terminado en ${yearBuilt}, ${age} años.${
            iteDue ? " Dentro del periodo en que la ITE es obligatoria." : " Aún fuera del periodo de ITE obligatoria por antigüedad."
          }`,
          ca: `Acabat el ${yearBuilt}, ${age} anys.${
            iteDue ? " Dins del període en què la ITE és obligatòria." : " Encara fora del període d'ITE obligatòria per antiguitat."
          }`,
        }
      : {
          en: "Construction year unknown. Confirm with the seller.",
          es: "Año de construcción desconocido. Confírmalo con el vendedor.",
          ca: "Any de construcció desconegut. Confirma'l amb el venedor.",
        },
  });

  // Structure era (only flag aluminous-cement-era blocks)
  if (aluminousEra) {
    facts.push({
      term: { en: "Structure era", es: "Época estructural", ca: "Època estructural" },
      def: {
        en: "Reinforced concrete typical of the period. Worth ruling out aluminous cement, used in some blocks of these years.",
        es: "Hormigón armado típico de la época. Conviene descartar el cemento aluminoso, usado en algunos bloques de esos años.",
        ca: "Formigó armat típic de l'època. Convé descartar el ciment aluminós, usat en alguns blocs d'aquells anys.",
      },
    });
  }

  // ITE
  facts.push({
    term: { en: "ITE", es: "ITE", ca: "ITE" },
    def: iteDue
      ? {
          en: "No passed inspecció tècnica on record. Pending works are possible — ask for the certificate.",
          es: "No consta ninguna inspección técnica favorable. Puede haber obras pendientes; pide el certificado.",
          ca: "No consta cap inspecció tècnica favorable. Hi pot haver obres pendents; demana el certificat.",
        }
      : {
          en: "Not yet subject to a mandatory ITE by age. Ask whether one has been done.",
          es: "Aún no obligado a ITE por antigüedad. Pregunta si se ha hecho.",
          ca: "Encara no obligat a ITE per antiguitat. Pregunta si se n'ha fet alguna.",
        },
  });

  // Asbestos (only flag for pre-2002 builds)
  if (asbestos) {
    facts.push({
      term: { en: "Asbestos", es: "Amianto", ca: "Amiant" },
      def: {
        en: "Construction predates the 2002 ban on fibrocement. Possible in common areas or old installations.",
        es: "La construcción es anterior a la prohibición del fibrocemento (2002). Posible en zonas comunes o instalaciones antiguas.",
        ca: "La construcció és anterior a la prohibició del fibrociment (2002). Possible a zones comunes o instal·lacions antigues.",
      },
    });
  }

  const checks: Localized[] = [
    iteDue
      ? {
          en: "Request the passed ITE certificate, or the works plan if it failed.",
          es: "Pide el certificado de ITE favorable o el plan de obras si fue desfavorable.",
          ca: "Demana el certificat d'ITE favorable o el pla d'obres si va ser desfavorable.",
        }
      : {
          en: "Ask whether a voluntary ITE has been done, even if not yet obligatory.",
          es: "Pregunta si se ha hecho una ITE voluntaria, aunque aún no sea obligatoria.",
          ca: "Pregunta si s'ha fet una ITE voluntària, encara que no sigui obligatòria.",
        },
    {
      en: "Ask for the last two actes de la comunitat and any derrama (special levy).",
      es: "Pide las dos últimas actas de la comunidad y cualquier derrama (cuota extraordinaria).",
      ca: "Demana les dues últimes actes de la comunitat i qualsevol derrama (quota extraordinària).",
    },
    {
      en: "Inspect façade, light wells and stairwell for damp and movement.",
      es: "Revisa la fachada, los patios de luz y la escalera en busca de humedades y movimientos.",
      ca: "Revisa la façana, els patis de llum i l'escala per detectar humitats i moviments.",
    },
    {
      en: "Confirm whether a lift exists and how it is maintained.",
      es: "Confirma si hay ascensor y cómo se mantiene.",
      ca: "Confirma si hi ha ascensor i com es manté.",
    },
  ];

  return {
    facts,
    checks,
    keyline: {
      en: "All building facts here are derived from the construction year and official records.",
      es: "Todos los datos del edificio se derivan del año de construcción y de los registros oficiales.",
      ca: "Totes les dades de l'edifici es deriven de l'any de construcció i dels registres oficials.",
    },
  };
}
