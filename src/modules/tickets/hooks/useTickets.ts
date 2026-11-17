import React from "react";
import { getTickets } from "../services/ticketsApi";
import type { TicketRow } from "../types";
import type { FiltrosHudTickets } from "../utils/normalizarFiltros";
import { normalizarFiltrosTicketsApi } from "../utils/normalizarFiltros";

type UseTicketsParams = {
  areaActiva: string;
  filtros: FiltrosHudTickets;
  isAdmin: boolean;
};

const PAGE_SIZE_INICIAL = 25;

export function useTickets({ areaActiva, filtros, isAdmin }: UseTicketsParams) {
  const [tickets, setTickets] = React.useState<TicketRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_INICIAL);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Alcance y filtros, sin la pagina: cuando esto cambia hay que volver a la
  // primera, o se queda pidiendo una pagina que ya no existe.
  const filtrosBase = React.useMemo(
    () =>
      normalizarFiltrosTicketsApi({
        area: areaActiva,
        filtros,
        isAdmin,
        page: 1,
        pageSize,
      }),
    [areaActiva, filtros, isAdmin, pageSize]
  );

  const [filtrosDebounced, setFiltrosDebounced] = React.useState(filtrosBase);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setFiltrosDebounced(filtrosBase);
      setPage(1);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [filtrosBase]);

  const cargarTickets = React.useCallback(async () => {
    if (!areaActiva) return;

    try {
      setLoading(true);
      setError(null);
      const res = await getTickets({ ...filtrosDebounced, page });
      setTickets(res.data.items);
      setTotal(res.data.total);
      setPageSize(res.data.pageSize);

      // El backend recorta la pagina pedida contra el total real. Si quedo
      // fuera de rango (p. ej. se cerraron tickets mientras mirabas la ultima
      // pagina), se vuelve a la primera en vez de mostrar una tabla vacia.
      if (res.data.items.length === 0 && res.data.total > 0 && page > 1) {
        setPage(1);
      }
    } catch (err) {
      console.error("Error cargando tickets:", err);
      setError("Error al cargar tickets.");
    } finally {
      setLoading(false);
    }
  }, [areaActiva, filtrosDebounced, page]);

  React.useEffect(() => {
    cargarTickets();
  }, [cargarTickets]);

  const totalPaginas = Math.max(1, Math.ceil(total / (pageSize || PAGE_SIZE_INICIAL)));

  const irAPagina = React.useCallback(
    (destino: number) => {
      setPage((actual) => {
        const siguiente = Math.min(Math.max(1, destino), totalPaginas);
        return siguiente === actual ? actual : siguiente;
      });
    },
    [totalPaginas]
  );

  return {
    tickets,
    setTickets,
    total,
    page,
    pageSize,
    totalPaginas,
    irAPagina,
    loading,
    error,
    recargar: cargarTickets,
  };
}
