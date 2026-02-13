import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tickets } from "lucide-react";

import TicketsTabs from "../components/TicketsTabs";
import TicketsFilters from "../components/TicketsFilters";
import TicketsTable from "../components/TicketsTable";
import {
  getGroups,
  getInboxDiagnostic,
  getTickets,
  syncTickets,
  updateTicket,
} from "../services/ticketsApi";
import type {
  InboxDiagnosticData,
  TicketGroup,
  TicketRow,
  TicketsGroupsData,
} from "../types";
import { getAuthPayload } from "../../../lib/auth";

type ToastTone = "success" | "error";

function isClosedStatus(status: string) {
  const key = String(status || "").trim().toLowerCase();
  return key === "cerrado" || key === "closed";
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [groupsData, setGroupsData] = useState<TicketsGroupsData | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: ToastTone; text: string } | null>(
    null
  );
  const toastTimerRef = useRef<number | null>(null);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<InboxDiagnosticData | null>(
    null
  );

  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const [priority, setPriority] = useState("Media");
  const [priorityTouched, setPriorityTouched] = useState(false);

  const activeArea = searchParams.get("area") || "";

  const showToast = (tone: ToastTone, text: string) => {
    setToast({ tone, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  const visibleGroups: TicketGroup[] = useMemo(
    () => groupsData?.groups ?? [],
    [groupsData]
  );

  const totalAll = groupsData?.totalAll ?? 0;

  const isAdmin = useMemo(() => {
    const payload = getAuthPayload() as { role?: string } | null;
    return payload?.role === "ADMIN";
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(rawQuery.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        setLoadingGroups(true);
        const res = await getGroups();
        setGroupsData(res.data);
      } catch (err) {
        console.error("Error cargando grupos:", err);
        setError("Error al cargar grupos.");
      } finally {
        setLoadingGroups(false);
      }
    };

    loadGroups();
  }, []);

  const loadTickets = async () => {
    try {
      setLoadingTickets(true);
      setError(null);
      const res = await getTickets({
        area: activeArea,
        q: query || undefined,
        status: status === "Todos" ? undefined : status,
        priority: priorityTouched ? priority : undefined,
      });
      setTickets(res.data);
    } catch (err) {
      console.error("Error cargando tickets:", err);
      setError("Error al cargar tickets.");
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (!activeArea) return;
    loadTickets();
  }, [activeArea, query, status, priority, priorityTouched]);

  useEffect(() => {
    if (!groupsData) return;
    const allowed = visibleGroups.map((g) => g.slug);
    if (allowed.length === 0) return;

    const fallback = allowed.includes("all") ? "all" : allowed[0];

    if (!activeArea) {
      setSearchParams({ area: fallback }, { replace: true });
      return;
    }

    if (!allowed.includes(activeArea)) {
      setSearchParams({ area: fallback }, { replace: true });
    }
  }, [activeArea, groupsData, setSearchParams, visibleGroups]);

  const handleTabChange = (slug: string) => {
    setSearchParams({ area: slug }, { replace: true });
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const res = await syncTickets();
      if (!res.ok) {
        showToast("error", res.message || "Error al sincronizar.");
        return;
      }
      const groupsRes = await getGroups();
      setGroupsData(groupsRes.data);
      await loadTickets();
      showToast("success", "Sincronizacion completada.");
    } catch (err) {
      console.error("Error al sincronizar:", err);
      showToast("error", "Error al sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickClose = async (ticketId: number) => {
    const row = tickets.find((item) => item.id === ticketId);
    if (!row || isClosedStatus(row.status)) return;
    const confirmed = window.confirm(
      "¿Estas seguro? Esta accion marcara el ticket como CERRADO."
    );
    if (!confirmed) return;

    try {
      setActionLoadingId(ticketId);
      await updateTicket(ticketId, { estado: "CERRADO" });
      await Promise.all([loadTickets(), getGroups().then((res) => setGroupsData(res.data))]);
      showToast("success", `Ticket #${row.number} cerrado.`);
    } catch (err) {
      console.error("Error cerrando ticket:", err);
      showToast("error", "No se pudo cerrar el ticket.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handlePriorityChange = (value: string) => {
    setPriority(value);
    setPriorityTouched(true);
  };

  const handleOpenDiagnostic = async () => {
    setDiagnosticOpen(true);
    if (diagnosticData || diagnosticLoading) return;
    try {
      setDiagnosticLoading(true);
      setDiagnosticError(null);
      const res = await getInboxDiagnostic();
      setDiagnosticData(res.data);
    } catch (err) {
      console.error("Error cargando inbox diagnostico:", err);
      setDiagnosticError("No se pudo cargar el inbox diagnostico.");
    } finally {
      setDiagnosticLoading(false);
    }
  };

  return (
    <div className="mt-4 px-2 sm:px-0">
      {toast && (
        <div className="fixed right-4 top-4 z-[60]">
          <div
            className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-semibold"
            style={{ color: "var(--primary-color)" }}
          >
            <span className="inline-flex items-center gap-2">
              <Tickets size={20} /> Tickets
            </span>
          </h2>
          <p className="text-sm text-black/60">
            Sincronizado con Freshdesk (Grupos)
          </p>
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing || loadingTickets}
            className="rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20 transition"
          >
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
          {isAdmin && (
            <button
              onClick={handleOpenDiagnostic}
              className="rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20 transition"
            >
              Ver inbox diagnostico
            </button>
          )}
          <button
            className="rounded-xl px-3 py-2 text-sm text-white shadow-md shadow-black/30 active:scale-95"
            style={{ background: "var(--secondary-color)" }}
            onClick={() => navigate("/tickets/nuevo")}
          >
            Crear ticket
          </button>
        </div>
      </div>

      <TicketsTabs
        groups={visibleGroups}
        totalAll={totalAll}
        active={activeArea}
        onChange={handleTabChange}
        loading={loadingGroups}
      />

      <TicketsFilters
        query={rawQuery}
        onQueryChange={setRawQuery}
        status={status}
        onStatusChange={setStatus}
        priority={priority}
        onPriorityChange={handlePriorityChange}
      />

      <TicketsTable
        tickets={tickets}
        loading={loadingTickets}
        actionLoadingId={actionLoadingId}
        onView={(id) => navigate(`/tickets/${id}`)}
        onReply={(id) => navigate(`/tickets/${id}?mode=reply`)}
        onNote={(id) => navigate(`/tickets/${id}?mode=note`)}
        onForward={(id) => navigate(`/tickets/${id}?mode=forward`)}
        onClose={handleQuickClose}
      />

      {diagnosticOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDiagnosticOpen(false)}
          />
          <div className="relative w-full max-w-4xl bg-white rounded-2xl p-4 shadow-lg z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-lg font-medium">Inbox diagnostico</h3>
                {diagnosticData && (
                  <p className="text-xs text-black/50">
                    Total tickets: {diagnosticData.totalTickets}
                  </p>
                )}
              </div>
              <button
                onClick={() => setDiagnosticOpen(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-black/10 bg-white hover:border-black/20"
              >
                Cerrar
              </button>
            </div>

            {diagnosticLoading && (
              <p className="text-sm text-black/50">Cargando inbox...</p>
            )}

            {diagnosticError && (
              <p className="text-sm text-rose-600">{diagnosticError}</p>
            )}

            {!diagnosticLoading && diagnosticData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-black/50 text-xs border-b border-black/5 uppercase tracking-wider bg-gray-50">
                      <th className="py-2 px-3 font-semibold">#</th>
                      <th className="py-2 px-3 font-semibold">Solicitante</th>
                      <th className="py-2 px-3 font-semibold">Asunto</th>
                      <th className="py-2 px-3 font-semibold">Fecha</th>
                      <th className="py-2 px-3 font-semibold text-right">
                        Accion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosticData.latest.map((item) => (
                      <tr key={item.id_ticket} className="border-b border-black/5">
                        <td className="py-2 px-3 text-black/70 font-mono">
                          #{item.id_ticket}
                        </td>
                        <td className="py-2 px-3 text-black/70">
                          {item.requesterEmail}
                        </td>
                        <td className="py-2 px-3">{item.subject}</td>
                        <td className="py-2 px-3 text-black/60 text-xs">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() =>
                              navigate(`/tickets/${item.id_ticket}`)
                            }
                            className="px-2 py-1 text-xs rounded border border-black/10 bg-white hover:border-black/20"
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
