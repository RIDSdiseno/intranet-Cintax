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
  const ruts = await fetchJSONAuth<RutCliente[]>(
    `${API_BASE_URL}/tareas/mis-ruts?trabajadorId=${trabajadorId}`,
    { signal: opts?.signal }
  );

  const rutList = (ruts || []).map((r) => r.rut).filter(Boolean);
  if (rutList.length === 0) return { tareas: [], ruts: ruts || [] };

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

type AgenteComparativa = {
  trabajadorId: number;
  nombre: string;
  email?: string;
  pendientes: number;
  enProceso: number;
  vencidas: number;
  completadas: number;
  total: number;
  abiertas: number;
  cierre: number;
  riesgo: number;
};

type ComparativaTotals = {
  totalAgentes: number;
  totalTareas: number;
  backlog: number;
  tasaGlobal: number;
  promedioCierre: number;
  top: AgenteComparativa | null;
};

type ChartSeries = Array<{ name: string; data: number[] }>;

function round0(n: number) {
  return Math.round(n);
}

function pct(num: number, den: number) {
  return den > 0 ? round0((num / den) * 100) : 0;
}

const TareasSupervisionPage: React.FC = () => {
  const [resumen, setResumen] = useState<ResumenAgente[]>([]);
  const [tareasCache, setTareasCache] = useState<Record<number, TareaFull[]>>({});
  const [rutsCache, setRutsCache] = useState<Record<number, RutCliente[]>>({});

  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mainMode, setMainMode] = useState<MainMode | null>(null);

  const [agentView, setAgentView] = useState<AgentView>("dashboard");
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);

  const [periodo, setPeriodo] = useState<Periodo>("actual");
  const [mesSelect, setMesSelect] = useState<number>(new Date().getMonth() + 1);
  const [anioSelect, setAnioSelect] = useState<number>(new Date().getFullYear());

  const [filters, setFilters] = useState<GlobalFilters>({
    estado: {
      PENDIENTE: true,
      EN_PROCESO: true,
      VENCIDA: true,
      COMPLETADA: true,
      NO_APLICA: true,
    },
    area: "ALL",
    search: "",
    dueMode: "ALL",
    dueDays: 3,
    onlyBacklog: false,
    onlyCompleted: false,
    taskKey: "ALL",
  });

  const agentAbortRef = useRef<AbortController | null>(null);
  const globalAbortRef = useRef<AbortController | null>(null);

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

  const needsGlobal =
    mainMode === "tarea" || (mainMode === "agente" && agentView === "comparativa");

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

  const agentHasCache = useMemo(() => {
    if (selectedAgentId === null) return false;
    return Boolean(tareasCache[selectedAgentId] && rutsCache[selectedAgentId]);
  }, [selectedAgentId, tareasCache, rutsCache]);

  useEffect(() => {
    if (mainMode !== "agente") return;
    if (agentView === "comparativa") return;
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

  const tareasGlobales = useMemo(() => {
    const out: TareaFull[] = [];
    Object.values(tareasCache).forEach((list) => out.push(...(list || [])));
    return out;
  }, [tareasCache]);

  const tareasGlobalesPeriodo = useMemo(() => {
    return filtrarPorPeriodo(tareasGlobales, periodo, mesSelect, anioSelect);
  }, [tareasGlobales, periodo, mesSelect, anioSelect]);

  const tareasGlobalesFiltradas = useMemo(() => {
    const fixed: GlobalFilters = {
      ...filters,
      estado: {
        PENDIENTE: true,
        EN_PROCESO: true,
        VENCIDA: true,
        COMPLETADA: true,
        NO_APLICA: true,
      },
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

  const comparativaAgentes = useMemo<AgenteComparativa[]>(() => {
    if (!resumen.length) return [];

    const byId = new Map<number, TareaFull[]>();
    for (const t of tareasGlobalesFiltradas) {
      const tid = (t as any)?.trabajadorId ?? 0;
      if (!tid) continue;
      if (!byId.has(tid)) byId.set(tid, []);
      byId.get(tid)!.push(t);
    }

    return resumen.map((r) => {
      const list = byId.get(r.trabajadorId) || [];
      let pendientes = 0,
        enProceso = 0,
        vencidas = 0,
        completadas = 0;

      for (const t of list) {
        if (t.estado === "PENDIENTE") pendientes++;
        else if (t.estado === "EN_PROCESO") enProceso++;
        else if (t.estado === "VENCIDA") vencidas++;
        else if (t.estado === "COMPLETADA") completadas++;
      }

      const total = list.length;
      const abiertas = pendientes + enProceso + vencidas;
      const cierre = pct(completadas, total);
      const riesgo =
        total > 0 ? round0(((vencidas * 1.5 + pendientes) / total) * 100) : 0;

      return {
        trabajadorId: r.trabajadorId,
        nombre: r.nombre,
        email: r.email,
        pendientes,
        enProceso,
        vencidas,
        completadas,
        total,
        abiertas,
        cierre,
        riesgo,
      };
    });
  }, [resumen, tareasGlobalesFiltradas]);

  const comparativaTotals = useMemo<ComparativaTotals>(() => {
    const totalAgentes = comparativaAgentes.length;

    const totalTareas = comparativaAgentes.reduce((acc, a) => acc + (a.total || 0), 0);
    const backlog = comparativaAgentes.reduce((acc, a) => acc + (a.abiertas || 0), 0);
    const totalCompletadas = comparativaAgentes.reduce(
      (acc, a) => acc + (a.completadas || 0),
      0
    );

    const tasaGlobal = pct(totalCompletadas, totalTareas);
    const promedioCierre =
      totalAgentes > 0
        ? round0(
            comparativaAgentes.reduce((acc, a) => acc + (a.cierre || 0), 0) /
              totalAgentes
          )
        : 0;

    let top: AgenteComparativa | null = null;
    for (const a of comparativaAgentes) {
      if (!top) top = a;
      else if ((a.cierre || 0) > (top.cierre || 0)) top = a;
      else if (
        (a.cierre || 0) === (top.cierre || 0) &&
        (a.total || 0) > (top.total || 0)
      ) {
        top = a;
      }
    }

    return {
      totalAgentes,
      totalTareas,
      backlog,
      tasaGlobal,
      promedioCierre,
      top,
    };
  }, [comparativaAgentes]);

  const comparativaStacked = useMemo(() => {
    const categories = comparativaAgentes.map((a) => a.nombre);
    const series: ChartSeries = [
      { name: "Pendiente", data: comparativaAgentes.map((a) => a.pendientes || 0) },
      { name: "En proceso", data: comparativaAgentes.map((a) => a.enProceso || 0) },
      { name: "Vencida", data: comparativaAgentes.map((a) => a.vencidas || 0) },
      { name: "Completada", data: comparativaAgentes.map((a) => a.completadas || 0) },
    ];
    return { categories, series };
  }, [comparativaAgentes]);

  const comparativaRendimiento = useMemo(() => {
    const categories = comparativaAgentes.map((a) => a.nombre);
    const series: ChartSeries = [
      { name: "Cierre %", data: comparativaAgentes.map((a) => a.cierre || 0) },
      { name: "Riesgo %", data: comparativaAgentes.map((a) => a.riesgo || 0) },
    ];
    return { categories, series };
  }, [comparativaAgentes]);

  if (loading) return <div>Cargando supervisión...</div>;
  if (error) return <div className="text-red-600 text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      {mainMode === null ? (
        <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-[#1d1e1c]">
                Supervisión de tareas
              </h2>
              <p className="text-sm text-black/60 mt-1">
                Elige el modo de análisis:
              </p>
            </div>

            <div className="text-xs text-black/50">
              Consejo: “Por tarea” sirve para ver el consolidado global; “Por agente” para analizar cartera.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <button
              onClick={() => {
                setMainMode("tarea");
                setSelectedAgentId(null);
              }}
              className="
                text-left
                p-6
                rounded-3xl
                border-2 border-black/10
                bg-[#faf9f6]
                shadow-sm
                hover:border-[#af9150]
                hover:shadow-md
                active:scale-[0.99]
                transition
                focus:outline-none focus:ring-2 focus:ring-[#af9150]/40 focus:ring-offset-2
              "
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-black/50">Modo</div>
                  <div className="text-lg font-semibold text-[#1d1e1c]">
                    Por tarea
                  </div>
                  <div className="text-sm text-black/60 mt-2">
                    Selecciona una tarea y revisa su estado consolidado en todas las empresas.
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-white border border-black/10 text-[#af9150] text-lg">
                    ✓
                  </span>
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#af9150]">
                Entrar
                <span className="text-base leading-none">→</span>
              </div>
            </button>

            <button
              onClick={() => {
                setMainMode("agente");
                setAgentView("dashboard");
                setSelectedAgentId(null);
              }}
              className="
                text-left
                p-6
                rounded-3xl
                border-2 border-black/10
                bg-[#faf9f6]
                shadow-sm
                hover:border-[#af9150]
                hover:shadow-md
                active:scale-[0.99]
                transition
                focus:outline-none focus:ring-2 focus:ring-[#af9150]/40 focus:ring-offset-2
              "
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs text-black/50">Modo</div>
                  <div className="text-lg font-semibold text-[#1d1e1c]">
                    Por agente
                  </div>
                  <div className="text-sm text-black/60 mt-2">
                    Dashboards, empresas e impacto dentro de la cartera de un agente.
                  </div>
                </div>

                <div className="shrink-0">
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-2xl bg-white border border-black/10 text-[#af9150] text-lg">
                    ◻
                  </span>
                </div>
              </div>

              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#af9150]">
                Entrar
                <span className="text-base leading-none">→</span>
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
          comparativaAgentes={comparativaAgentes as any}
          comparativaTotals={comparativaTotals as any}
          comparativaStacked={comparativaStacked as any}
          comparativaRendimiento={comparativaRendimiento as any}
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