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

export function useTickets({ areaActiva, filtros, isAdmin }: UseTicketsParams) {
  const [tickets, setTickets] = React.useState<TicketRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filtrosApi = React.useMemo(
    () =>
      normalizarFiltrosTicketsApi({
        area: areaActiva,
        filtros,
        isAdmin,
        page: 1,
        pageSize: 50,
      }),
    [areaActiva, filtros, isAdmin]
  );

  const [filtrosDebounced, setFiltrosDebounced] = React.useState(filtrosApi);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setFiltrosDebounced(filtrosApi);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [filtrosApi]);

  const cargarTickets = React.useCallback(async () => {
    if (!areaActiva) return;

    try {
      setLoading(true);
      setError(null);
      const res = await getTickets(filtrosDebounced);
      setTickets(res.data.items);
      setTotal(res.data.total);
      setPage(res.data.page);
      setPageSize(res.data.pageSize);
    } catch (err) {
      console.error("Error cargando tickets:", err);
      setError("Error al cargar tickets.");
    } finally {
      setLoading(false);
    }
  }, [areaActiva, filtrosDebounced]);

  React.useEffect(() => {
    cargarTickets();
  }, [cargarTickets]);

  return {
    tickets,
    setTickets,
    total,
    page,
    pageSize,
    loading,
    error,
    recargar: cargarTickets,
  };
}
