import type { TicketsQuery } from "../types";

export type VistaTickets = "mine" | "all";

export type FiltrosHudTickets = {
  busqueda: string;
  keywords: string;
  vista: VistaTickets;
  agente: string;
  solicitante: string;
  estado: string;
  prioridad: string;
};

export const FILTROS_HUD_INICIALES: FiltrosHudTickets = {
  busqueda: "",
  keywords: "",
  vista: "all",
  agente: "all",
  solicitante: "",
  estado: "Todos",
  prioridad: "Todas",
};

/**
 * Valores validos de los dos selectores.
 *
 * Viven aca y no en `BarraFiltrosTickets` porque ahora hay dos lectores: el
 * selector que los pinta y el parser de la URL que los valida. Con la lista
 * duplicada, agregar un estado en un lado y olvidarlo en el otro daria un
 * filtro que la barra ofrece y la URL descarta en silencio.
 */
export const ESTADOS_TICKET = [
  "Todos",
  "Abierto",
  "Pendiente",
  "Resuelto",
  "Cerrado",
] as const;

export const PRIORIDADES_TICKET = [
  "Todas",
  "Baja",
  "Media",
  "Alta",
  "Urgente",
] as const;

/** Nombres de los parametros en la URL. Son los de `FiltrosHudTickets`. */
const PARAMS = [
  "busqueda",
  "keywords",
  "vista",
  "agente",
  "solicitante",
  "estado",
  "prioridad",
] as const;

/** `agente` es "all", "none" o el id de un trabajador. Nada mas. */
function agenteValido(valor: string): boolean {
  return valor === "all" || valor === "none" || /^\d+$/.test(valor);
}

/**
 * Filtros a partir de la URL.
 *
 * Todo lo que venga raro cae al valor por defecto en vez de propagarse: la
 * URL la puede escribir cualquiera (el usuario editando la barra de
 * direcciones, un enlace pegado en un chat, el boton del asistente), asi que
 * aca se trata como entrada no confiable. Un `?estado=loquesea` deja el
 * filtro en "Todos", no rompe la pantalla ni viaja a la API.
 *
 * `vistaPorDefecto` depende del rol, por eso se recibe y no se asume.
 */
export function leerFiltrosDeUrl(
  params: URLSearchParams,
  vistaPorDefecto: VistaTickets
): FiltrosHudTickets {
  const texto = (clave: string) => (params.get(clave) ?? "").slice(0, 200);

  const vista = params.get("vista");
  const estado = params.get("estado") ?? "";
  const prioridad = params.get("prioridad") ?? "";
  const agente = params.get("agente") ?? "";

  return {
    busqueda: texto("busqueda"),
    keywords: texto("keywords"),
    solicitante: texto("solicitante"),
    vista: vista === "mine" || vista === "all" ? vista : vistaPorDefecto,
    estado: (ESTADOS_TICKET as readonly string[]).includes(estado)
      ? estado
      : FILTROS_HUD_INICIALES.estado,
    prioridad: (PRIORIDADES_TICKET as readonly string[]).includes(prioridad)
      ? prioridad
      : FILTROS_HUD_INICIALES.prioridad,
    agente: agenteValido(agente) ? agente : FILTROS_HUD_INICIALES.agente,
  };
}

/**
 * Deja los filtros en la URL, encima de los parametros que ya estaban.
 *
 * Solo escribe lo que difiere del valor por defecto y **borra** el resto, asi
 * una pantalla sin filtrar queda con la URL limpia (`/tickets?area=all`) en
 * vez de arrastrar siete parametros vacios. Los parametros ajenos, como
 * `area`, se conservan: por eso se parte de `previos`.
 */
export function escribirFiltrosEnUrl(
  previos: URLSearchParams,
  filtros: FiltrosHudTickets,
  vistaPorDefecto: VistaTickets
): URLSearchParams {
  const siguiente = new URLSearchParams(previos);

  const porDefecto: FiltrosHudTickets = {
    ...FILTROS_HUD_INICIALES,
    vista: vistaPorDefecto,
  };

  for (const clave of PARAMS) {
    const valor = String(filtros[clave] ?? "").trim();
    if (valor && valor !== porDefecto[clave]) {
      siguiente.set(clave, valor);
    } else {
      siguiente.delete(clave);
    }
  }

  return siguiente;
}

export function normalizarFiltrosTicketsApi(params: {
  area: string;
  filtros: FiltrosHudTickets;
  isAdmin: boolean;
  page?: number;
  pageSize?: number;
}): TicketsQuery {
  const { area, filtros, isAdmin, page = 1, pageSize = 20 } = params;

  return {
    area,
    // La vista la elige cualquier agente, no solo admin: forzarla a "mine"
    // dejaba invisibles los tickets sin asignar de su propia area, que es
    // justamente como nacen los que llegan por correo. El alcance real lo
    // sigue imponiendo el backend (solo ve su area).
    view: filtros.vista,
    q: filtros.busqueda.trim() || undefined,
    keywords: filtros.keywords.trim() || undefined,
    status: filtros.estado === "Todos" ? undefined : filtros.estado,
    priority: filtros.prioridad === "Todas" ? undefined : filtros.prioridad,
    // El filtro por agente es solo para admin. Antes se limpiaba ademas con un
    // efecto en la pagina; ahora que los filtros vienen de la URL, cualquiera
    // puede pegar un enlace con `?agente=7`, asi que este descarte es el unico
    // que vale: es el que decide lo que se le pide a la API.
    asignado: isAdmin ? filtros.agente : undefined,
    solicitante: filtros.solicitante.trim() || undefined,
    page,
    pageSize,
  };
}
