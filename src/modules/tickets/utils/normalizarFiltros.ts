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
    view: isAdmin ? filtros.vista : "mine",
    q: filtros.busqueda.trim() || undefined,
    keywords: filtros.keywords.trim() || undefined,
    status: filtros.estado === "Todos" ? undefined : filtros.estado,
    priority: filtros.prioridad === "Todas" ? undefined : filtros.prioridad,
    asignado: isAdmin ? filtros.agente : undefined,
    solicitante: filtros.solicitante.trim() || undefined,
    page,
    pageSize,
  };
}
