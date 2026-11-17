// Etiquetas visibles de las areas de tickets.
//
// El backend usa dos vocabularios para lo mismo: el enum de Prisma
// (CONTA / TRIBUTARIO / RRHH) y la etiqueta `areaDetected` que viaja en los
// DTOs (CONTABLE / TRIBUTARIA / LABORAL). Los nombres que ve el usuario salen
// de `AREA_UI_MAP` en `back/src/modules/tickets/routing/ticketRouting.ts`,
// y son los mismos que llegan en las pestanas (`GET /tickets/groups`).
//
// Sin este mapa la UI mezclaba ambos: la pestana decia "Comercial y Marketing"
// y el selector del detalle decia "TRIBUTARIA", para la misma area.

export type AreaDetected =
  | "CONTABLE"
  | "TRIBUTARIA"
  | "LABORAL"
  | "SIN_CLASIFICAR";

export const AREAS_DETECTADAS: AreaDetected[] = [
  "SIN_CLASIFICAR",
  "CONTABLE",
  "TRIBUTARIA",
  "LABORAL",
];

const ETIQUETAS: Record<AreaDetected, string> = {
  CONTABLE: "Contabilidad",
  TRIBUTARIA: "Comercial y Marketing",
  LABORAL: "Recursos Humanos",
  SIN_CLASIFICAR: "Sin clasificar",
};

/** Nombre legible de un `areaDetected`; devuelve el valor crudo si no calza. */
export function etiquetaArea(area?: string | null): string {
  const key = String(area ?? "").trim().toUpperCase() as AreaDetected;
  return ETIQUETAS[key] ?? (area ? String(area) : ETIQUETAS.SIN_CLASIFICAR);
}
