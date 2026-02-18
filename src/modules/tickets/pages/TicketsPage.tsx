import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tickets } from "lucide-react";

import TicketsTabs from "../components/TicketsTabs";
import TicketsTable from "../components/TicketsTable";
import CreateTicketModal from "../components/CreateTicketModal";
import ConfirmDialog from "../components/ConfirmDialog";
import BarraFiltrosTickets from "../components/BarraFiltrosTickets";
import TicketSettingsMenu from "../../../components/tickets/settings/TicketSettingsMenu";
import { useTickets } from "../hooks/useTickets";
import {
  getGroups,
  getInboxDiagnostic,
  getTicketAgents,
  syncTickets,
  updateTicket,
} from "../services/ticketsApi";
import type {
  InboxDiagnosticData,
  TicketAgent,
  TicketGroup,
  TicketRow,
  TicketsGroupsData,
} from "../types";
import { esAdminOSoporte, getAuthPayload } from "../../../lib/auth";
import {
  FILTROS_HUD_INICIALES,
  type FiltrosHudTickets,
} from "../utils/normalizarFiltros";

type ToastTone = "success" | "error" | "warning" | "info";

function isClosedStatus(status: string) {
  const key = String(status || "").trim().toLowerCase();
  return key === "cerrado" || key === "closed";
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const usuarioAuth = getAuthPayload();
  const esAdmin = esAdminOSoporte();
  const emailUsuario = usuarioAuth?.email ?? "";

  const [groupsData, setGroupsData] = React.useState<TicketsGroupsData | null>(null);
  const [agentes, setAgentes] = React.useState<TicketAgent[]>([]);
  const [loadingGroups, setLoadingGroups] = React.useState(false);
  const [loadingAgentes, setLoadingAgentes] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [actionLoadingId, setActionLoadingId] = React.useState<number | null>(null);
  const [errorGlobal, setErrorGlobal] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ tone: ToastTone; text: string } | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  const [diagnosticOpen, setDiagnosticOpen] = React.useState(false);
  const [diagnosticLoading, setDiagnosticLoading] = React.useState(false);
  const [diagnosticError, setDiagnosticError] = React.useState<string | null>(null);
  const [diagnosticData, setDiagnosticData] = React.useState<InboxDiagnosticData | null>(
    null
  );
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const [ticketPendienteCerrar, setTicketPendienteCerrar] = React.useState<TicketRow | null>(
    null
  );

  const [filtrosHud, setFiltrosHud] = React.useState<FiltrosHudTickets>({
    ...FILTROS_HUD_INICIALES,
    vista: esAdmin ? "all" : "mine",
  });

  const activeArea = searchParams.get("area") || "";
  const visibleGroups: TicketGroup[] = React.useMemo(
    () => groupsData?.groups ?? [],
    [groupsData]
  );
  const totalAll = groupsData?.totalAll ?? 0;

  const {
    tickets,
    setTickets,
    total,
    loading: loadingTickets,
    error: errorTickets,
    recargar: recargarTickets,
  } = useTickets({
    areaActiva: activeArea,
    filtros: filtrosHud,
    isAdmin: esAdmin,
  });

  const sugerenciasSolicitante = React.useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((ticket) => {
      if (ticket.requesterEmail) set.add(ticket.requesterEmail);
    });
    return Array.from(set).slice(0, 25);
  }, [tickets]);

  const showToast = React.useCallback((tone: ToastTone, text: string) => {
    setToast({ tone, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!esAdmin) {
      setFiltrosHud((current) => ({
        ...current,
        vista: "mine",
        agente: "all",
      }));
      setIsCreateOpen(false);
    }
  }, [esAdmin]);

  const cargarGrupos = React.useCallback(async () => {
    try {
      setLoadingGroups(true);
      const res = await getGroups();
      setGroupsData(res.data);
    } catch (err) {
      console.error("Error cargando grupos:", err);
      setErrorGlobal("Error al cargar grupos.");
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  const cargarAgentes = React.useCallback(async () => {
    if (!esAdmin) {
      setAgentes([]);
      return;
    }

    try {
      setLoadingAgentes(true);
      const res = await getTicketAgents();
      setAgentes(res.data);
    } catch (err) {
      console.error("Error cargando agentes:", err);
    } finally {
      setLoadingAgentes(false);
    }
  }, [esAdmin]);

  React.useEffect(() => {
    cargarGrupos();
    cargarAgentes();
  }, [cargarAgentes, cargarGrupos]);

  React.useEffect(() => {
    if (!groupsData) return;
    const allowed = visibleGroups.map((group) => group.slug);
    if (allowed.length === 0) return;

    const fallback = allowed.includes("all")
      ? "all"
      : allowed.includes("mine")
      ? "mine"
      : allowed[0];

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
      await Promise.all([cargarGrupos(), recargarTickets()]);
      const processed = (res as any)?.data?.processed ?? (res as any)?.processed ?? 0;
      showToast(
        "success",
        `Sincronizacion completada (${processed} correos procesados).`
      );
    } catch (err) {
      console.error("Error al sincronizar:", err);
      showToast("error", "Error al sincronizar.");
    } finally {
      setSyncing(false);
    }
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

  const confirmarCierre = (ticket: TicketRow) => {
    if (isClosedStatus(ticket.status)) return;
    setTicketPendienteCerrar(ticket);
  };

  const runCerrarTicket = async () => {
    if (!ticketPendienteCerrar || isClosedStatus(ticketPendienteCerrar.status)) {
      setTicketPendienteCerrar(null);
      return;
    }

    try {
      setActionLoadingId(ticketPendienteCerrar.id);
      await updateTicket(ticketPendienteCerrar.id, { estado: "CERRADO" });
      await Promise.all([recargarTickets(), cargarGrupos()]);
      showToast("success", `Ticket #${ticketPendienteCerrar.number} cerrado.`);
    } catch (err) {
      console.error("Error cerrando ticket:", err);
      showToast("error", "No se pudo cerrar el ticket.");
    } finally {
      setActionLoadingId(null);
      setTicketPendienteCerrar(null);
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
                : toast.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : toast.tone === "info"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: "var(--primary-color)" }}>
            <span className="inline-flex items-center gap-2">
              <Tickets size={20} /> Tickets
            </span>
          </h2>
          <p className="text-sm text-black/60">Helpdesk sincronizado por correo</p>
          <p className="text-xs text-black/45">
            Mostrando {tickets.length} de {total} tickets
            {loadingAgentes && esAdmin ? " | Cargando agentes..." : ""}
          </p>
          {(errorGlobal || errorTickets) && (
            <p className="mt-1 text-xs text-rose-600">{errorGlobal || errorTickets}</p>
          )}
        </div>

        <div className="flex gap-2">
          {esAdmin && (
            <button
              onClick={handleSync}
              disabled={syncing || loadingTickets}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm transition hover:border-black/20"
            >
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
          )}
          {esAdmin && (
            <button
              onClick={handleOpenDiagnostic}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm transition hover:border-black/20"
            >
              Ver inbox diagnostico
            </button>
          )}
          {esAdmin && (
            <button
              className="rounded-xl px-3 py-2 text-sm text-white shadow-md shadow-black/30 active:scale-95"
              style={{ background: "var(--secondary-color)" }}
              onClick={() => setIsCreateOpen(true)}
            >
              Crear ticket
            </button>
          )}
          <TicketSettingsMenu isAdmin={esAdmin} />
        </div>
      </div>

      <BarraFiltrosTickets
        filtros={filtrosHud}
        onCambiar={setFiltrosHud}
        isAdmin={esAdmin}
        agentes={agentes}
        emailUsuario={emailUsuario}
        sugerenciasSolicitante={sugerenciasSolicitante}
      />

      <TicketsTabs
        groups={visibleGroups}
        totalAll={totalAll}
        active={activeArea}
        onChange={handleTabChange}
        loading={loadingGroups}
      />

      <TicketsTable
        tickets={tickets}
        loading={loadingTickets}
        actionLoadingId={actionLoadingId}
        onView={(id) => navigate(`/tickets/${id}`)}
        onReply={(id) => navigate(`/tickets/${id}?modo=reply`)}
        onNote={(id) => navigate(`/tickets/${id}?modo=note`)}
        onForward={(id) => navigate(`/tickets/${id}?modo=forward`)}
        onClose={(id) => {
          const ticket = tickets.find((item) => item.id === id);
          if (!ticket) return;
          confirmarCierre(ticket);
        }}
      />

      {esAdmin && (
        <CreateTicketModal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onNotify={showToast}
          onCreated={(ticketCreated) => {
            setTickets((prev) => [ticketCreated, ...prev]);
            void cargarGrupos();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(ticketPendienteCerrar)}
        title="Cerrar ticket"
        description="Esta accion marcara el ticket como CERRADO."
        confirmText="Cerrar ticket"
        cancelText="Cancelar"
        variant="danger"
        onCancel={() => setTicketPendienteCerrar(null)}
        onConfirm={runCerrarTicket}
      />

      {diagnosticOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDiagnosticOpen(false)} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
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
                className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs hover:border-black/20"
              >
                Cerrar
              </button>
            </div>

            {diagnosticLoading && <p className="text-sm text-black/50">Cargando inbox...</p>}
            {diagnosticError && <p className="text-sm text-rose-600">{diagnosticError}</p>}

            {!diagnosticLoading && diagnosticData && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/5 bg-gray-50 text-left text-xs uppercase tracking-wider text-black/50">
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Solicitante</th>
                      <th className="px-3 py-2 font-semibold">Asunto</th>
                      <th className="px-3 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 text-right font-semibold">Accion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnosticData.latest.map((item) => (
                      <tr key={item.id_ticket} className="border-b border-black/5">
                        <td className="px-3 py-2 font-mono text-black/70">#{item.id_ticket}</td>
                        <td className="px-3 py-2 text-black/70">{item.requesterEmail}</td>
                        <td className="px-3 py-2">{item.subject}</td>
                        <td className="px-3 py-2 text-xs text-black/60">
                          {new Date(item.createdAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => navigate(`/tickets/${item.id_ticket}`)}
                            className="rounded border border-black/10 bg-white px-2 py-1 text-xs hover:border-black/20"
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
