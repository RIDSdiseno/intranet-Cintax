// src/pages/TareasSupervisionPage.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { API_BASE_URL, fetchJSON, TareaFull, ResumenAgente } from "../lib/api";
import { filtrarPorPeriodo, Periodo } from "../components/supervision/usePeriodo";
import { applyFilters, type GlobalFilters } from "../utils/supervisionMetrics";

import AgentSupervisionPanel from "./supervision/views/panels/AgentSupervisionPanel";
import TaskSupervisionPanel from "./supervision/views/panels/TaskSupervisionPanel";

type RutCliente = { rut: string; razonSocial?: string | null };

// =========================
// Auth helpers (frontend)
// =========================
function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("jwt") ||
    ""
  );
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Wrapper para no “pisar” Authorization cuando pasas headers
async function fetchJSONAuth<T>(url: string, init?: RequestInit): Promise<T> {
  const mergedHeaders = {
    ...(init?.headers || {}),
    ...getAuthHeaders(),
  } as Record<string, string>;

  return fetchJSON<T>(url, {
    ...init,
    headers: mergedHeaders,
  });
}

async function fetchDataAgente(
  trabajadorId: number,
  opts?: { signal?: AbortSignal }
): Promise<{ tareas: TareaFull[]; ruts: RutCliente[] }> {
  // 1) RUTs del agente
  const ruts = await fetchJSONAuth<RutCliente[]>(
    `${API_BASE_URL}/tareas/mis-ruts?trabajadorId=${trabajadorId}`,
    { signal: opts?.signal }
  );

  const rutList = (ruts || []).map((r) => r.rut).filter(Boolean);
  if (rutList.length === 0) return { tareas: [], ruts: ruts || [] };

  // 2) Bulk tareas por ruts
  const resBulk = await fetchJSONAuth<{ tareas: TareaFull[] }>(
    `${API_BASE_URL}/tareas/por-ruts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: opts?.signal,
      body: JSON.stringify({ trabajadorId, ruts: rutList }),
    }
  );

  return { tareas: resBulk?.tareas ?? [], ruts: ruts || [] };
}

type MainMode = "agente" | "tarea";
type AgentView = "dashboard" | "empresas" | "impacto" | "comparativa";

const TareasSupervisionPage: React.FC = () => {
  // =========================
  // Estado base / data
  // =========================
  const [resumen, setResumen] = useState<ResumenAgente[]>([]);
  const [tareasCache, setTareasCache] = useState<Record<number, TareaFull[]>>({});
  const [rutsCache, setRutsCache] = useState<Record<number, RutCliente[]>>({});

  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // =========================
  // Nuevo flujo: primero modo
  // =========================
  const [mainMode, setMainMode] = useState<MainMode | null>(null);

  // Por agente
  const [agentView, setAgentView] = useState<AgentView>("dashboard");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  // Periodo
  const [periodo, setPeriodo] = useState<Periodo>("actual");
  const [mesSelect, setMesSelect] = useState<number>(new Date().getMonth() + 1);
  const [anioSelect, setAnioSelect] = useState<number>(new Date().getFullYear());

  // Filtros globales (se usan en ambos paneles)
  const [filters, setFilters] = useState<GlobalFilters>({
    estado: {
      PENDIENTE: true,
      EN_PROCESO: true,
      VENCIDA: true,
      COMPLETADA: true,
    },
    area: "ALL",
    search: "",
    dueMode: "ALL",
    dueDays: 3,
    onlyBacklog: false,
    onlyCompleted: false,
    taskKey: "ALL",
  });

  // Abort controllers
  const agentAbortRef = useRef<AbortController | null>(null);
  const globalAbortRef = useRef<AbortController | null>(null);

  // =========================
  // Load resumen (lista agentes)
  // =========================
  const loadResumen = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchJSONAuth<ResumenAgente[]>(
        `${API_BASE_URL}/tareas/supervision/resumen`
      );
      setResumen(res || []);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar supervisión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumen();
  }, [loadResumen]);

  // =========================
  // Carga global (para Por tarea y Comparativa)
  // =========================
  const needsGlobal = mainMode === "tarea" || (mainMode === "agente" && agentView === "comparativa");

  const missingGlobalIds = useMemo(() => {
    if (!needsGlobal) return [];
    if (!resumen.length) return [];
    return resumen
      .map((r) => r.trabajadorId)
      .filter((id) => !tareasCache[id] || !rutsCache[id]);
  }, [needsGlobal, resumen, tareasCache, rutsCache]);

  useEffect(() => {
    if (!needsGlobal) return;
    if (resumen.length === 0) return;
    if (missingGlobalIds.length === 0) return;

    globalAbortRef.current?.abort();
    const ctrl = new AbortController();
    globalAbortRef.current = ctrl;

    setGlobalLoading(true);
    setError(null);

    (async () => {
      try {
        const tareasUpdates: Record<number, TareaFull[]> = {};
        const rutsUpdates: Record<number, RutCliente[]> = {};

        await Promise.all(
          missingGlobalIds.map(async (id) => {
            const { tareas, ruts } = await fetchDataAgente(id, { signal: ctrl.signal });
            tareasUpdates[id] = tareas;
            rutsUpdates[id] = ruts;
          })
        );

        setTareasCache((prev) => ({ ...prev, ...tareasUpdates }));
        setRutsCache((prev) => ({ ...prev, ...rutsUpdates }));
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        console.error("Error cargando datos globales", e);
        setError(e?.message || "Error cargando datos globales");
      } finally {
        setGlobalLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [needsGlobal, resumen.length, missingGlobalIds]);

  // =========================
  // Carga on-demand para Por agente (cuando ya eligió agente)
  // =========================
  const agentHasCache = useMemo(() => {
    if (selectedAgentId === null) return false;
    return Boolean(tareasCache[selectedAgentId] && rutsCache[selectedAgentId]);
  }, [selectedAgentId, tareasCache, rutsCache]);

  useEffect(() => {
    if (mainMode !== "agente") return;
    if (agentView === "comparativa") return; // comparativa usa global
    if (selectedAgentId === null) return;

    if (agentHasCache) {
      setAgentLoading(false);
      return;
    }

    agentAbortRef.current?.abort();
    const ctrl = new AbortController();
    agentAbortRef.current = ctrl;

    setAgentLoading(true);
    setError(null);

    fetchDataAgente(selectedAgentId, { signal: ctrl.signal })
      .then(({ tareas, ruts }) => {
        setTareasCache((prev) => ({ ...prev, [selectedAgentId]: tareas }));
        setRutsCache((prev) => ({ ...prev, [selectedAgentId]: ruts }));
      })
      .catch((e: any) => {
        if (e?.name === "AbortError") return;
        console.error("Error cargando datos del agente", e);
        setError(e?.message || "Error cargando datos del agente");
      })
      .finally(() => setAgentLoading(false));

    return () => ctrl.abort();
  }, [mainMode, agentView, selectedAgentId, agentHasCache]);

  // =========================
  // Dataset por agente (para panel Agente)
  // =========================
  const clienteOptions = useMemo(() => {
    if (selectedAgentId === null) return [];
    return rutsCache[selectedAgentId] || [];
  }, [selectedAgentId, rutsCache]);

  const tareasAgentePeriodo = useMemo(() => {
    if (selectedAgentId === null) return [];
    const base = tareasCache[selectedAgentId] || [];
    return filtrarPorPeriodo(base, periodo, mesSelect, anioSelect);
  }, [selectedAgentId, tareasCache, periodo, mesSelect, anioSelect]);

  const tareasAgenteFiltradas = useMemo(() => {
    return applyFilters(tareasAgentePeriodo, filters);
  }, [tareasAgentePeriodo, filters]);

  const empresasCarteraAgente = useMemo(() => {
    return (clienteOptions || []).map((c) => ({
      rut: c.rut,
      razonSocial: c.razonSocial || c.rut,
    }));
  }, [clienteOptions]);

  // =========================
  // Dataset global (para panel Tarea)
  // =========================
  const tareasGlobales = useMemo(() => {
    const out: TareaFull[] = [];
    Object.values(tareasCache).forEach((list) => out.push(...(list || [])));
    return out;
  }, [tareasCache]);

  const tareasGlobalesPeriodo = useMemo(() => {
    return filtrarPorPeriodo(tareasGlobales, periodo, mesSelect, anioSelect);
  }, [tareasGlobales, periodo, mesSelect, anioSelect]);

  const tareasGlobalesFiltradas = useMemo(() => {
    // En "Por tarea" no queremos que un toggle esconda completadas por accidente:
    const fixed: GlobalFilters = {
      ...filters,
      estado: { PENDIENTE: true, EN_PROCESO: true, VENCIDA: true, COMPLETADA: true },
      onlyBacklog: false,
      onlyCompleted: false,
    };
    return applyFilters(tareasGlobalesPeriodo, fixed);
  }, [tareasGlobalesPeriodo, filters]);

  const carteraGlobal = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(rutsCache).forEach((list) => {
      (list || []).forEach((c) => {
        if (!c?.rut) return;
        if (!map.has(c.rut)) map.set(c.rut, c.razonSocial || c.rut);
      });
    });
    return Array.from(map.entries()).map(([rut, razonSocial]) => ({ rut, razonSocial }));
  }, [rutsCache]);

  const formatFecha = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL");
  };

  const agenteSeleccionado = selectedAgentId
    ? resumen.find((r) => r.trabajadorId === selectedAgentId)
    : null;

  // =========================
  // UI states
  // =========================
  if (loading) return <div>Cargando supervisión...</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Step 1: elegir modo (obligatorio) */}
      {mainMode === null ? (
        <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-[#1d1e1c]">Supervisión de tareas</h2>
          <p className="text-xs text-black/60 mt-1">
            Primero elige qué quieres analizar: por agente o por tarea.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
            <button
              onClick={() => {
                setMainMode("agente");
                setAgentView("dashboard");
                setSelectedAgentId(null);
              }}
              className="text-left p-5 rounded-2xl border border-black/10 hover:border-[#af9150] bg-[#faf9f6] transition"
            >
              <div className="text-sm font-semibold text-[#1d1e1c]">Por agente</div>
              <div className="text-xs text-black/60 mt-1">
                Dashboards, empresas e impacto dentro de la cartera de un agente.
              </div>
            </button>

            <button
              onClick={() => {
                setMainMode("tarea");
                setSelectedAgentId(null);
              }}
              className="text-left p-5 rounded-2xl border border-black/10 hover:border-[#af9150] bg-[#faf9f6] transition"
            >
              <div className="text-sm font-semibold text-[#1d1e1c]">Por tarea</div>
              <div className="text-xs text-black/60 mt-1">
                Selecciona una tarea y mira su estado consolidado en todas las empresas.
              </div>
            </button>
          </div>
        </div>
      ) : mainMode === "agente" ? (
        <AgentSupervisionPanel
          resumen={resumen}
          agentView={agentView}
          setAgentView={setAgentView}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
          agenteNombre={agenteSeleccionado?.nombre || ""}

          periodo={periodo}
          setPeriodo={setPeriodo}
          mesSelect={mesSelect}
          setMesSelect={setMesSelect}
          anioSelect={anioSelect}
          setAnioSelect={setAnioSelect}

          filters={filters}
          setFilters={setFilters}

          agentLoading={agentLoading}
          globalLoading={globalLoading}

          clienteOptions={clienteOptions}
          empresasCarteraAgente={empresasCarteraAgente}
          tareasAgenteFiltradas={tareasAgenteFiltradas}
          formatFecha={formatFecha}

          onBack={() => {
            setMainMode(null);
            setSelectedAgentId(null);
          }}
        />
      ) : (
        <TaskSupervisionPanel
          resumen={resumen}

          periodo={periodo}
          setPeriodo={setPeriodo}
          mesSelect={mesSelect}
          setMesSelect={setMesSelect}
          anioSelect={anioSelect}
          setAnioSelect={setAnioSelect}

          filters={filters}
          setFilters={setFilters}

          globalLoading={globalLoading}
          carteraGlobal={carteraGlobal}
          tareasGlobalesFiltradas={tareasGlobalesFiltradas}
          formatFecha={formatFecha}

          onBack={() => {
            setMainMode(null);
            setSelectedAgentId(null);
          }}
        />
      )}
    </div>
  );
};

export default TareasSupervisionPage;
