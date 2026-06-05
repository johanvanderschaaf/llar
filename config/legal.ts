import type { Localized } from "@/types/report";

/**
 * Maintained "get-before-you-offer" document checklist for a Catalonia resale.
 * Deterministic — never AI-invented, so the legal guidance is always reliable.
 */
export function buildLegal(): { intro: Localized; items: Localized[] } {
  return {
    intro: {
      en: "These are get-before-you-offer documents — not optional. Request them in writing and verify everything before committing.",
      es: "Estos son documentos que debes conseguir antes de ofertar, no opcionales. Pídelos por escrito y verifícalo todo antes de comprometerte.",
      ca: "Aquests són documents que has d'aconseguir abans d'ofertar, no són opcionals. Demana'ls per escrit i verifica-ho tot abans de comprometre't.",
    },
    items: [
      {
        en: "Updated nota simple — confirms ownership and any charges or mortgage on the property.",
        es: "Nota simple actualizada — confirma la titularidad y cualquier carga o hipoteca sobre el inmueble.",
        ca: "Nota simple actualitzada — confirma la titularitat i qualsevol càrrega o hipoteca sobre l'immoble.",
      },
      {
        en: "Cédula d'habitabilitat — mandatory to sell in Catalonia; check it's valid and unexpired.",
        es: "Cédula d'habitabilitat — obligatoria para vender en Cataluña; comprueba que es válida y no está caducada.",
        ca: "Cèdula d'habitabilitat — obligatòria per vendre a Catalunya; comprova que sigui vigent i no estigui caducada.",
      },
      {
        en: "Valid ITE certificate — the building's technical inspection report and any required works.",
        es: "Certificado ITE vigente — el informe de inspección técnica del edificio y las actuaciones requeridas.",
        ca: "Certificat ITE vigent — l'informe d'inspecció tècnica de l'edifici i les actuacions requerides.",
      },
      {
        en: "Community minutes (actas), last 2–3 years — reveal the reserve fund, votes and pending works.",
        es: "Actas de la comunidad, últimos 2–3 años — revelan el fondo de reserva, votaciones y obras pendientes.",
        ca: "Actes de la comunitat, últims 2–3 anys — revelen el fons de reserva, votacions i obres pendents.",
      },
      {
        en: "Pending or approved derrama — confirm there's no special levy for the façade/roof you'd inherit.",
        es: "Derrama pendiente o aprobada — confirma que no haya una derrama por fachada/cubierta que heredarías.",
        ca: "Derrama pendent o aprovada — confirma que no hi hagi una derrama per façana/coberta que heretaries.",
      },
      {
        en: "Updated energy certificate — confirm the registered class and date match the flat's current state.",
        es: "Certificado energético actualizado — confirma que la clase registrada y la fecha corresponden al estado actual del piso.",
        ca: "Certificat energètic actualitzat — confirma que la classe registrada i la data corresponen a l'estat actual del pis.",
      },
      {
        en: "Surface check — confirm the useful m² against the cadastral and registry records.",
        es: "Comprobación de superficie — confirma los m² útiles frente al Catastro y el Registro.",
        ca: "Comprovació de superfície — confirma els m² útils contra el Cadastre i el Registre.",
      },
      {
        en: "Up-to-date community-fee certificate — proof there are no outstanding community debts.",
        es: "Certificado de estar al corriente de la comunidad — prueba de que no hay deudas pendientes con la comunidad.",
        ca: "Certificat d'estar al corrent de la comunitat — prova que no hi ha deutes pendents amb la comunitat.",
      },
    ],
  };
}
