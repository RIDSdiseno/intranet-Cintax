import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tickets } from "lucide-react";

import TicketsTabs from "../components/TicketsTabs";
import TicketsTable from "../components/TicketsTable";
import CreateTicketModal from "../components/CreateTicketModal";
import ConfirmDialog from "../components/ConfirmDialog";
import BarraFiltrosTickets from "../components/BarraFiltrosTickets";
import TicketsSummaryPanel from "../components/TicketsSummaryPanel";
import TicketSettingsMenu from "../../../components/tickets/settings/TicketSettingsMenu";
import { useTickets } from "../hooks/useTickets";
import {
  getGroups,
  getInboxDiagnostic,
  getTicketAgents,
  getTicketsSummary,
  syncTickets,
  updateTicket,
} from "../services/ticketsApi";
import type {
  InboxDiagnosticData,
  TicketAgent,
  TicketGroup,
  TicketRow,
  TicketsGroupsData,
  TicketsSummary,
} from "../types";
import { esAdminEstricto, esAdminOSoporte, getAuthPayload } from "../../../lib/auth";
import {
  escribirFiltrosEnUrl,
  leerFiltrosDeUrl,
  type FiltrosHudTickets,
  type VistaTickets,
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
  // Sincronizar y el inbox diagnostico exigen ADMIN en el backend. Un
  // SUPERVISOR pasa `esAdminOSoporte` pero recibe 403, asi que esos dos
  // botones van con la verificacion estricta.
  const esAdminReal = esAdminEstricto();
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
  const [confirmarSync, setConfirmarSync] = React.useState(false);

  /**
   * Los filtros viven en la URL, no en estado local.
   *
   * Se eligio una sola fuente en vez de sincronizar dos: con `useState` mas
   * un efecto que copia hacia la URL y otro que copia de vuelta, cada cambio
   * dispara al otro y hay que inventar guardas para cortar el ciclo. Leyendo
   * de la URL y escribiendo en la URL no existe el ciclo.
   *
   * De paso la pantalla gana dos cosas que antes no tenia: recargar no borra
   * los filtros, y el enlace se puede pegar en un chat y abre lo mismo. El
   * boton del asistente aprovecha justamente eso.
   */
  const vistaPorDefecto: VistaTickets = esAdmin ? "all" : "mine";

  // La clave es el texto de la URL, no el objeto: `useSearchParams` puede
  // devolver una instancia nueva en cada render, y memorizar contra ella
  // recalcularia los filtros siempre, reiniciando el debounce de `useTickets`
  // una y otra vez (la tabla no alcanzaria a cargar nunca).
  const claveParams = searchParams.toString();

  const filtrosHud: FiltrosHudTickets = React.useMemo(
    () => leerFiltrosDeUrl(new URLSearchParams(claveParams), vistaPorDefecto),
    [claveParams, vistaPorDefecto]
  );

  /**
   * Abre un ticket llevandose los filtros actuales.
   *
   * Van en el `state` de la navegacion y no en la URL del ticket porque no
   * son suyos: `/tickets/8?estado=Abierto` sugiere que el detalle esta
   * filtrado por algo, cuando solo es la memoria de donde venias. El detalle
   * los usa para que "Volver a tickets" devuelva a la misma lista y no a
   * todos los tickets sin filtrar.
   *
   * Si alguien entra por un enlace directo no hay `state`, y el boton vuelve
   * al listado por defecto. Es lo correcto: no habia lista de donde venir.
   */
  const abrirTicket = React.useCallback(
    (id: number | string, sufijo = "") => {
      navigate(`/tickets/${id}${sufijo}`, {
        state: claveParams ? { listado: claveParams } : undefined,
      });
    },
    [navigate, claveParams]
  );

  const setFiltrosHud = React.useCallback(
    (next: FiltrosHudTickets) => {
      // `replace` para que escribir en el buscador no deje una entrada de
      // historial por letra: volver atras tiene que salir de la pantalla, no
      // deshacer la busqueda caracter por caracter.
      setSearchParams(
        (prev) => escribirFiltrosEnUrl(prev, next, vistaPorDefecto),
        { replace: true }
      );
    },
    [setSearchParams, vistaPorDefecto]
  );

  /**
   * Cambia el area SIN borrar el resto de la URL.
   *
   * Antes esto era `setSearchParams({ area })`, que con un objeto reemplaza
   * la query entera. Mientras los filtros vivian en estado de React daba
   * igual; desde que viven en la URL, eso los borraba. Se notaba al entrar
   * con un enlace filtrado (el del asistente, por ejemplo): la pagina
   * arrancaba sin `area`, este efecto ponia la de por defecto y de paso se
   * llevaba puestos los filtros, asi que la tabla mostraba todo.
   *
   * La forma funcional parte de los parametros actuales y toca solo `area`.
   */
  const ponerArea = React.useCallback(
    (slug: string) => {
      setSearchParams(
        (prev) => {
          const siguiente = new URLSearchParams(prev);
          siguiente.set("area", slug);
          return siguiente;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

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
    page,
    pageSize,
    totalPaginas,
    irAPagina,
    loading: loadingTickets,
    error: errorTickets,
    recargar: recargarTickets,
  } = useTickets({
    areaActiva: activeArea,
    filtros: filtrosHud,
    isAdmin: esAdmin,
  });

  const primerVisible = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const ultimoVisible = Math.min(page * pageSize, total);

  const encabezadoRef = React.useRef<HTMLDivElement | null>(null);
  const esPrimeraCarga = React.useRef(true);

  /**
   * Subir al cambiar de pagina.
   *
   * Los botones del paginador estan al final de la tabla, asi que al apretar
   * "Siguiente" la lista se reemplaza entera pero el scroll se queda abajo: el
   * usuario termina mirando el pie de una pagina cuyo primer ticket nunca vio.
   *
   * Se sube al encabezado y no al tope absoluto para que queden a la vista las
   * pestanas y los filtros, que es el contexto de lo que esta leyendo.
   */
  React.useEffect(() => {
    if (esPrimeraCarga.current) {
      esPrimeraCarga.current = false;
      return;
    }

    encabezadoRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page]);

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
    if (!esAdmin) setIsCreateOpen(false);
  }, [esAdmin]);

  const vistaActual = filtrosHud.vista;

  const cargarGrupos = React.useCallback(async () => {
    try {
      setLoadingGroups(true);
      const res = await getGroups({ view: vistaActual });
      setGroupsData(res.data);
    } catch (err) {
      console.error("Error cargando grupos:", err);
      setErrorGlobal("Error al cargar grupos.");
    } finally {
      setLoadingGroups(false);
    }
  }, [vistaActual]);

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

  // Resumen (totales + SLA global) del area activa.
  const [summary, setSummary] = React.useState<TicketsSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = React.useState(false);
  const vistaResumen = filtrosHud.vista === "mine" ? "mine" : undefined;

  const cargarResumen = React.useCallback(async () => {
    if (!activeArea) return;
    try {
      setLoadingSummary(true);
      const res = await getTicketsSummary({ area: activeArea, view: vistaResumen });
      setSummary(res.data);
    } catch (err) {
      console.error("Error cargando resumen:", err);
    } finally {
      setLoadingSummary(false);
    }
  }, [activeArea, vistaResumen]);

  React.useEffect(() => {
    cargarResumen();
  }, [cargarResumen]);

  React.useEffect(() => {
    if (!groupsData) return;
    const allowed = visibleGroups.map((group) => group.slug);
    if (allowed.length === 0) return;

    const fallback = allowed.includes("all")
      ? "all"
      : allowed.includes("mine")
      ? "mine"
      : allowed[0];

    if (!activeArea || !allowed.includes(activeArea)) {
      ponerArea(fallback);
    }
  }, [activeArea, groupsData, ponerArea, visibleGroups]);

  const handleTabChange = (slug: string) => ponerArea(slug);

  const runSync = async () => {
    setConfirmarSync(false);
    try {
      setSyncing(true);
      const res = await syncTickets();
      if (!res.ok) {
        showToast("error", res.message || "Error al sincronizar.");
        return;
      }
      await Promise.all([cargarGrupos(), recargarTickets(), cargarResumen()]);
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
      await Promise.all([recargarTickets(), cargarGrupos(), cargarResumen()]);
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

      <div
        ref={encabezadoRef}
        className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <h2 className="text-2xl font-semibold" style={{ color: "var(--primary-color)" }}>
            <span className="inline-flex items-center gap-2">
              <Tickets size={20} /> Tickets
            </span>
          </h2>
          <p className="text-sm text-black/60">Helpdesk sincronizado por correo</p>
          <p className="text-xs text-black/45">
            {total === 0
              ? "Sin tickets"
              : `Mostrando ${primerVisible}-${ultimoVisible} de ${total} tickets`}
            {loadingAgentes && esAdmin ? " | Cargando agentes..." : ""}
          </p>
          {(errorGlobal || errorTickets) && (
            <p className="mt-1 text-xs text-rose-600">{errorGlobal || errorTickets}</p>
          )}
        </div>

        <div className="flex gap-2">
          {esAdminReal && (
            <button
              onClick={() => setConfirmarSync(true)}
              disabled={syncing || loadingTickets}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm transition hover:border-black/20"
            >
              {syncing ? "Sincronizando..." : "Sincronizar"}
            </button>
          )}
          {esAdminReal && (
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

      <TicketsSummaryPanel summary={summary} loading={loadingSummary} />

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
        onView={(id) => abrirTicket(id)}
        onReply={(id) => abrirTicket(id, "?modo=reply")}
        onNote={(id) => abrirTicket(id, "?modo=note")}
        onForward={(id) => abrirTicket(id, "?modo=forward")}
        onClose={(id) => {
          const ticket = tickets.find((item) => item.id === id);
          if (!ticket) return;
          confirmarCierre(ticket);
        }}
      />

      {totalPaginas > 1 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-black/55">
            Página {page} de {totalPaginas}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => irAPagina(page - 1)}
              disabled={page <= 1 || loadingTickets}
              className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black/70 transition hover:border-black/20 disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => irAPagina(page + 1)}
              disabled={page >= totalPaginas || loadingTickets}
              className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black/70 transition hover:border-black/20 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {esAdmin && (
        <CreateTicketModal
          open={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onNotify={showToast}
          onCreated={(ticketCreated) => {
            setTickets((prev) => [ticketCreated, ...prev]);
            void cargarGrupos();
            void cargarResumen();
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

      <ConfirmDialog
        open={confirmarSync}
        title="Sincronizar correo"
        description="Se revisarán los correos recientes de soporte@cintax.cl y se crearán los tickets que falten. La casilla no se modifica: ningún correo queda marcado como leído."
        confirmText="Sincronizar"
        cancelText="Cancelar"
        variant="primary"
        onCancel={() => setConfirmarSync(false)}
        onConfirm={runSync}
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
                            onClick={() => abrirTicket(item.id_ticket)}
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
