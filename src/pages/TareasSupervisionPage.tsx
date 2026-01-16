// src/pages/TareasSupervisionPage.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";

import { API_BASE_URL, fetchJSON, TareaFull, ResumenAgente } from "../lib/api";
import AgenteModal from "../components/supervision/AgenteModal";
import { filtrarPorPeriodo, Periodo } from "../components/supervision/usePeriodo";

// ✅ RUTAS CORRECTAS (tu carpeta real es src/pages/supervision/views/)
import DashboardView from "./supervision/views/DashboardView";
import EmpresasView from "./supervision/views/EmpresasView";
import ComparativaView from "./supervision/views/ComparativaView";

// ✅ NUEVO: vista “Impacto por tarea”
import TareaImpactoView from "./supervision/views/TareaImpactoView";

// ✅ NUEVO: métricas + filtros unificados
import {
  applyFilters,
  computeKpis,
  getTaskKeyForFilter,
  safeDate,
  type Estado,
  type DueMode,
  type GlobalFilters,
} from "../utils/supervisionMetrics";

type RutCliente = { rut: string; razonSocial?: string | null };

type AgenteComparativa = ResumenAgente & {
  total: number;
  abiertas: number;
  cierre: number;
  pendientes: number;
  enProceso: number;
  vencidas: number;
  completadas: number;
};

const SpinnerSmall: React.FC<{ label?: string }> = ({ label = "Cargando..." }) => (
  <div className="flex items-center gap-2 text-xs text-black/60">
    <div className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full rounded-full bg-sky-200 opacity-60 animate-ping" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
    </div>
    <span className="animate-pulse">{label}</span>
  </div>
);

async function fetchDataAgente(trabajadorId: number): Promise<{
  tareas: TareaFull[];
  ruts: RutCliente[];
}> {
  const ruts = await fetchJSON<RutCliente[]>(
    `${API_BASE_URL}/tareas/mis-ruts?trabajadorId=${trabajadorId}`
  );

  const all: TareaFull[] = [];
  for (const item of ruts) {
    const rut = encodeURIComponent(item.rut);
    const tareas = await fetchJSON<TareaFull[]>(
      `${API_BASE_URL}/tareas/por-rut/${rut}?trabajadorId=${trabajadorId}`
    );
    all.push(...tareas);
  }
  return { tareas: all, ruts };
}

const TareasSupervisionPage: React.FC = () => {
  const [resumen, setResumen] = useState<ResumenAgente[]>([]);
  const [tareasCache, setTareasCache] = useState<Record<number, TareaFull[]>>({});
  const [rutsCache, setRutsCache] = useState<Record<number, RutCliente[]>>({});

  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedClientRut, setSelectedClientRut] = useState<string>("ALL");

  const [periodo, setPeriodo] = useState<Periodo>("actual");
  const [mesSelect, setMesSelect] = useState<number>(new Date().getMonth() + 1);
  const [anioSelect, setAnioSelect] = useState<number>(new Date().getFullYear());

  const [agenteDetalle, setAgenteDetalle] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [comparativaLoading, setComparativaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ +impacto
  const [viewMode, setViewMode] = useState<"dashboard" | "empresas" | "comparativa" | "impacto">(
    "dashboard"
  );

  // =================================
  // ✅ FILTROS GLOBALES
  // =================================
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

  // Empresas UI state
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [empresaPage, setEmpresaPage] = useState(1);
  const [empresaSeleccionadaRut, setEmpresaSeleccionadaRut] = useState<string | null>(null);
  const EMPRESAS_PAGE_SIZE = 12;

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelection, setExportSelection] = useState<{
    target: "dashboard" | "empresas" | "comparativa" | "impacto";
    format: "excel" | "pdf";
  }>({
    target: "comparativa",
    format: "excel",
  });

  const loadResumen = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resResumen = await fetchJSON<ResumenAgente[]>(`${API_BASE_URL}/tareas/supervision/resumen`);
      setResumen(resResumen);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar supervisión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumen();
  }, [loadResumen]);

  // ✅ Pre-carga comparativa (todos los agentes) cuando entramos a comparativa
  useEffect(() => {
    if (viewMode !== "comparativa") return;

    const missing = resumen.map((r) => r.trabajadorId).filter((id) => !tareasCache[id]);
    if (missing.length === 0) return;

    setComparativaLoading(true);
    Promise.all(
      missing.map(async (id) => {
        try {
          const { tareas, ruts } = await fetchDataAgente(id);
          setTareasCache((prev) => ({ ...prev, [id]: tareas }));
          setRutsCache((prev) => ({ ...prev, [id]: ruts }));
        } catch (e) {
          console.error("Error cargando datos de agente para comparativa", e);
        }
      })
    ).finally(() => setComparativaLoading(false));
  }, [viewMode, resumen, tareasCache]);

  // ✅ Carga on-demand del agente seleccionado (dashboard/empresas/impacto)
  useEffect(() => {
    if (selectedAgentId === null) return;

    // reset UI de empresas al cambiar agente
    setEmpresaSearch("");
    setEmpresaPage(1);
    setEmpresaSeleccionadaRut(null);

    // ✅ en Empresas/Impacto dejamos el filtro cliente global en ALL (el view decide)
    if (viewMode === "empresas" || viewMode === "impacto") setSelectedClientRut("ALL");

    if (tareasCache[selectedAgentId] && rutsCache[selectedAgentId]) {
      setAgentLoading(false);
      return;
    }

    setAgentLoading(true);
    fetchDataAgente(selectedAgentId)
      .then(({ tareas, ruts }) => {
        setTareasCache((prev) => ({ ...prev, [selectedAgentId]: tareas }));
        setRutsCache((prev) => ({ ...prev, [selectedAgentId]: ruts }));
      })
      .catch((e) => console.error("Error cargando datos del agente", e))
      .finally(() => setAgentLoading(false));
  }, [selectedAgentId, tareasCache, rutsCache, viewMode]);

  const clienteOptions = useMemo(() => {
    if (selectedAgentId === null) return [];
    return rutsCache[selectedAgentId] || [];
  }, [selectedAgentId, rutsCache]);

  const isComparativa = viewMode === "comparativa";
  const isEmpresas = viewMode === "empresas";
  const isImpacto = viewMode === "impacto";

  // =========================
  // ✅ Base tareas del agente seleccionado (por periodo + (cliente solo en dashboard))
  // =========================
  const tareasBaseSeleccionadas = useMemo(() => {
    if (selectedAgentId === null) return [];
    const base = tareasCache[selectedAgentId] || [];
    const filtradasPeriodo = filtrarPorPeriodo(base, periodo, mesSelect, anioSelect);

    // ✅ En "Empresas" e "Impacto" NO aplicamos el filtro de cliente global.
    if (isEmpresas || isImpacto) return filtradasPeriodo;

    if (selectedClientRut === "ALL") return filtradasPeriodo;
    return filtradasPeriodo.filter((t) => t.rutCliente === selectedClientRut);
  }, [selectedAgentId, tareasCache, periodo, mesSelect, anioSelect, selectedClientRut, isEmpresas, isImpacto]);

  // =========================
  // ✅ Areas disponibles (dinámico)
  // =========================
  const areaOptions = useMemo(() => {
    const set = new Set<string>();
    tareasBaseSeleccionadas.forEach((t) => {
      const a = t.tareaPlantilla?.area?.trim();
      if (a) set.add(a);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [tareasBaseSeleccionadas]);

  // =========================
  // ✅ "Tipos de tarea" disponibles (para filtro)
  // =========================
  const taskOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    for (const t of tareasBaseSeleccionadas) {
      const key = getTaskKeyForFilter(t);
      if (!map.has(key)) {
        const codigo = t.tareaPlantilla?.codigoDocumento || "-";
        const nombre = t.tareaPlantilla?.nombre || `Tarea #${t.id_tarea_asignada}`;
        const area = t.tareaPlantilla?.area || "-";
        map.set(key, { key, label: `${nombre} · ${area} · ${codigo}` });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [tareasBaseSeleccionadas]);

  // =========================
  // ✅ Aplicación de filtros globales
  // =========================
  const tareasSeleccionadas = useMemo(() => {
    return applyFilters(tareasBaseSeleccionadas, filters);
  }, [tareasBaseSeleccionadas, filters]);

  // ✅ KPIs globales (dashboard)
  const globalKpis = useMemo(() => {
    if (selectedAgentId === null) {
      return {
        total: 0,
        pend: 0,
        proc: 0,
        venc: 0,
        comp: 0,
        porVencer: 0,
        backlog: 0,
        cierrePct: 0,
        avgCierreDias: 0,
        edadBacklogDias: 0,
        riskScore: 0,
        riskLabel: "-",
      };
    }
    return computeKpis(tareasSeleccionadas, filters);
  }, [selectedAgentId, tareasSeleccionadas, filters]);

  const donutSeries = useMemo(
    () => [globalKpis.pend, globalKpis.proc, globalKpis.venc, globalKpis.comp, globalKpis.porVencer],
    [globalKpis]
  );

  const donutOptions = useMemo(
    () => ({
      labels: ["Pendiente", "En proceso", "Vencida", "Completada", `Por vencer (<=${filters.dueDays}d)`],
      colors: ["#fbbf24", "#38bdf8", "#f97373", "#22c55e", "#fb923c"],
      legend: { position: "bottom" },
    }),
    [filters.dueDays]
  );

  // Linea avance por fecha
  const lineData = useMemo(() => {
    const bucket = new Map<
      string,
      { fecha: string; PENDIENTE: number; EN_PROCESO: number; VENCIDA: number; COMPLETADA: number }
    >();

    tareasSeleccionadas.forEach((t) => {
      const key = (t.fechaProgramada || t.createdAt).slice(0, 10);
      if (!bucket.has(key)) {
        bucket.set(key, { fecha: key, PENDIENTE: 0, EN_PROCESO: 0, VENCIDA: 0, COMPLETADA: 0 });
      }
      bucket.get(key)![t.estado as Estado] += 1;
    });

    const arr = Array.from(bucket.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return {
      categories: arr.map((d) => d.fecha),
      series: [
        { name: "Pendiente", data: arr.map((d) => d.PENDIENTE) },
        { name: "En proceso", data: arr.map((d) => d.EN_PROCESO) },
        { name: "Vencida", data: arr.map((d) => d.VENCIDA) },
        { name: "Completada", data: arr.map((d) => d.COMPLETADA) },
      ],
    };
  }, [tareasSeleccionadas]);

  // Proceso general (tabla)
  const procesoAgentes = useMemo(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + Math.max(0, filters.dueDays));

    if (selectedAgentId === null) return [];

    return resumen
      .filter((r) => r.trabajadorId === selectedAgentId)
      .map((r) => {
        const tareas = tareasSeleccionadas;

        const backlog = tareas.filter((t) => t.estado === "PENDIENTE" || t.estado === "EN_PROCESO");
        const vencidas = tareas.filter((t) => t.estado === "VENCIDA");

        const porVencer = backlog.filter((t) => {
          const fv = safeDate(t.fechaProgramada);
          return !!fv && fv.getTime() >= hoy.getTime() && fv.getTime() <= limite.getTime();
        });

        const proximo =
          backlog
            .map((t) => safeDate(t.fechaProgramada))
            .filter(Boolean)
            .map((d) => d as Date)
            .filter((d) => d.getTime() >= hoy.getTime())
            .sort((a, b) => a.getTime() - b.getTime())[0] || null;

        const riesgoValor = vencidas.length * 2 + backlog.length;
        const estado = riesgoValor > 10 ? "Crítico" : vencidas.length > 0 ? "Riesgo" : "Normal";

        return {
          ...r,
          pendientes: backlog.length,
          vencidas: vencidas.length,
          porVencer: porVencer.length,
          proximoVenc: proximo ? proximo.toLocaleDateString("es-CL") : "-",
          estadoProceso: estado,
        };
      });
  }, [resumen, tareasSeleccionadas, selectedAgentId, filters.dueDays]);

  // Empresas stats (sobre tareasSeleccionadas filtradas)
  const empresasStats = useMemo(() => {
    if (selectedAgentId === null) return [];

    const mapa = new Map<
      string,
      {
        rut: string;
        razonSocial: string;
        pendientes: number;
        enProceso: number;
        vencidas: number;
        completadas: number;
        porVencer: number;
        total: number;
      }
    >();

    clienteOptions.forEach((c) => {
      mapa.set(c.rut, {
        rut: c.rut,
        razonSocial: c.razonSocial || c.rut,
        pendientes: 0,
        enProceso: 0,
        vencidas: 0,
        completadas: 0,
        porVencer: 0,
        total: 0,
      });
    });

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + Math.max(0, filters.dueDays));

    tareasSeleccionadas.forEach((t) => {
      const rut = t.rutCliente || "SIN_RUT";
      if (!mapa.has(rut)) {
        mapa.set(rut, {
          rut,
          razonSocial: rut,
          pendientes: 0,
          enProceso: 0,
          vencidas: 0,
          completadas: 0,
          porVencer: 0,
          total: 0,
        });
      }

      const m = mapa.get(rut)!;
      if (t.estado === "PENDIENTE") m.pendientes += 1;
      else if (t.estado === "EN_PROCESO") m.enProceso += 1;
      else if (t.estado === "VENCIDA") m.vencidas += 1;
      else if (t.estado === "COMPLETADA") m.completadas += 1;

      if (t.estado !== "COMPLETADA") {
        const fv = safeDate(t.fechaProgramada);
        if (fv && fv.getTime() >= hoy.getTime() && fv.getTime() <= limite.getTime()) m.porVencer += 1;
      }

      m.total += 1;
    });

    return Array.from(mapa.values()).sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
  }, [selectedAgentId, clienteOptions, tareasSeleccionadas, filters.dueDays]);

  const empresasFiltradas = useMemo(() => {
    const term = empresaSearch.trim().toLowerCase();
    if (!term) return empresasStats;
    return empresasStats.filter(
      (e) => e.rut.toLowerCase().includes(term) || e.razonSocial.toLowerCase().includes(term)
    );
  }, [empresasStats, empresaSearch]);

  const empresasPageData = useMemo(() => {
    const start = (empresaPage - 1) * EMPRESAS_PAGE_SIZE;
    return empresasFiltradas.slice(start, start + EMPRESAS_PAGE_SIZE);
  }, [empresasFiltradas, empresaPage]);

  const totalEmpresas = empresasStats.length;
  const totalTareasEmpresas = empresasStats.reduce((acc, e) => acc + e.total, 0);

  // Comparativa
  const periodoComparativa: Periodo =
    viewMode === "comparativa"
      ? periodo === "anio-especifico"
        ? "anio-especifico"
        : "mes-especifico"
      : periodo;

  const comparativaAgentes = useMemo<AgenteComparativa[]>(() => {
    return resumen.map((r) => {
      const tareas = tareasCache[r.trabajadorId] || [];
      const tareasPeriodo =
        tareas.length > 0 ? filtrarPorPeriodo(tareas, periodoComparativa, mesSelect, anioSelect) : [];

      const tareasFiltradas = applyFilters(tareasPeriodo, filters);

      const base =
        tareasFiltradas.length > 0
          ? tareasFiltradas.reduce(
              (acc, t) => {
                if (t.estado === "PENDIENTE") acc.pendientes += 1;
                else if (t.estado === "EN_PROCESO") acc.enProceso += 1;
                else if (t.estado === "VENCIDA") acc.vencidas += 1;
                else if (t.estado === "COMPLETADA") acc.completadas += 1;
                return acc;
              },
              { pendientes: 0, enProceso: 0, vencidas: 0, completadas: 0 }
            )
          : { pendientes: 0, enProceso: 0, vencidas: 0, completadas: 0 };

      const total = base.pendientes + base.enProceso + base.vencidas + base.completadas;
      const abiertas = total - base.completadas;
      const cierre = total > 0 ? Math.round((base.completadas / total) * 100) : 0;

      return { ...r, ...base, total, abiertas, cierre };
    });
  }, [resumen, tareasCache, periodoComparativa, mesSelect, anioSelect, filters]);

  const comparativaTotals = useMemo(() => {
    const totalAgentes = comparativaAgentes.length;
    const totalTareas = comparativaAgentes.reduce((acc, a) => acc + a.total, 0);
    const totalCompletadas = comparativaAgentes.reduce((acc, a) => acc + a.completadas, 0);
    const backlog = comparativaAgentes.reduce((acc, a) => acc + a.abiertas, 0);

    const tasaGlobal = totalTareas > 0 ? Math.round((totalCompletadas / totalTareas) * 100) : 0;
    const promedioCierre =
      totalAgentes > 0 ? Math.round(comparativaAgentes.reduce((acc, a) => acc + a.cierre, 0) / totalAgentes) : 0;

    const top = comparativaAgentes.slice().sort((a, b) => b.cierre - a.cierre || b.total - a.total)[0] || null;

    return { totalAgentes, totalTareas, backlog, tasaGlobal, promedioCierre, top };
  }, [comparativaAgentes]);

  const comparativaStacked = useMemo(() => {
    return {
      categories: comparativaAgentes.map((a) => a.nombre),
      series: [
        { name: "Pendientes", data: comparativaAgentes.map((a) => a.pendientes) },
        { name: "En proceso", data: comparativaAgentes.map((a) => a.enProceso) },
        { name: "Vencidas", data: comparativaAgentes.map((a) => a.vencidas) },
        { name: "Completadas", data: comparativaAgentes.map((a) => a.completadas) },
      ],
    };
  }, [comparativaAgentes]);

  const comparativaRendimiento = useMemo(() => {
    return {
      categories: comparativaAgentes.map((a) => a.nombre),
      data: comparativaAgentes.map((a) => a.cierre),
    };
  }, [comparativaAgentes]);

  // =========================
  // Export helpers (SIN CAMBIOS)
  // =========================
  const exportExcelGeneric = async ({
    filename,
    sheetName,
    columns,
    rows,
    styleCell,
  }: {
    filename: string;
    sheetName: string;
    columns: Array<{ key: string; header: string; width?: number }>;
    rows: Array<Record<string, any>>;
    styleCell?: (params: { rowIndex: number; colKey: string; value: any; cell: ExcelJS.Cell }) => void;
  }) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);

    ws.columns = columns.map((c) => ({
      key: c.key,
      header: c.header,
      width: c.width || 18,
      style: {
        font: { color: { argb: "FF1D1E1C" } },
        border: {
          top: { style: "hair", color: { argb: "FFDDD9C3" } },
          bottom: { style: "hair", color: { argb: "FFDDD9C3" } },
        },
      },
    }));

    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF1D1E1C" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F4F0" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDD9C3" } },
        bottom: { style: "thin", color: { argb: "FFDDD9C3" } },
      };
    });

    rows.forEach((row, idx) => {
      const excelRow = ws.addRow(row);
      excelRow.eachCell((cell, colNumber) => {
        const colKey = columns[colNumber - 1]?.key;
        if (styleCell && colKey) styleCell({ rowIndex: idx + 1, colKey, value: cell.value, cell });
        if ((idx + 1) % 2 === 0) {
          cell.fill =
            cell.fill ||
            ({
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFAF8F2" },
            } as any);
        }
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename
    );
  };

  const formatFecha = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL");
  };

  const agenteSeleccionado = selectedAgentId ? resumen.find((r) => r.trabajadorId === selectedAgentId) : null;

  if (loading) return <div>Cargando supervisión...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Filtros superiores */}
      <div className="space-y-3 bg-[#f5f4f0] border border-black/5 rounded-2xl px-3 py-3 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          {!isComparativa && (
            <select
              className="text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
              value={selectedAgentId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAgentId(val ? Number(val) : null);
                setSelectedClientRut("ALL");
                setEmpresaSearch("");
                setEmpresaPage(1);
                setEmpresaSeleccionadaRut(null);
                setFilters((prev) => ({ ...prev, taskKey: "ALL" }));
              }}
            >
              <option value="">Selecciona un agente</option>
              {resumen.map((r) => (
                <option key={r.trabajadorId} value={r.trabajadorId}>
                  {r.nombre}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 text-xs">
            <select
              className="bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
              value={mesSelect}
              onChange={(e) => {
                setPeriodo("mes-especifico");
                setMesSelect(Number(e.target.value));
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Mes {i + 1}
                </option>
              ))}
            </select>

            <input
              type="number"
              className="bg-white border border-black/10 rounded-xl px-3 py-2 w-24 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
              value={anioSelect}
              onChange={(e) => {
                setPeriodo("anio-especifico");
                setAnioSelect(Number(e.target.value));
              }}
            />
          </div>

          {!isComparativa &&
            (["actual", "hist"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriodo(p);
                  if (p === "actual") {
                    const now = new Date();
                    setMesSelect(now.getMonth() + 1);
                    setAnioSelect(now.getFullYear());
                  }
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold border shadow-sm transition ${
                  periodo === p
                    ? "bg-[#af9150] text-white border-[#af9150]"
                    : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
                }`}
              >
                {p === "actual" ? "Actual" : "Histórico"}
              </button>
            ))}

          {/* ✅ Cliente global SOLO en Dashboard */}
          {selectedAgentId !== null && !isComparativa && viewMode === "dashboard" && (
            <div className="flex items-center gap-1 text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm">
              <span className="text-[#1d1e1c]/70">Cliente:</span>
              <select
                className="text-xs bg-transparent outline-none"
                value={selectedClientRut}
                onChange={(e) => setSelectedClientRut(e.target.value)}
              >
                <option value="ALL">Todos</option>
                {clienteOptions.map((c) => (
                  <option key={c.rut} value={c.rut}>
                    {c.razonSocial || c.rut}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(loading || agentLoading) && (
            <div className="ml-auto">
              <SpinnerSmall label="Cargando datos..." />
            </div>
          )}
        </div>

        {/* ✅ Filtros avanzados */}
        <div className="flex flex-wrap gap-2 items-center">
          {(["PENDIENTE", "EN_PROCESO", "VENCIDA", "COMPLETADA"] as const).map((st) => {
            const label =
              st === "PENDIENTE"
                ? "Pendiente"
                : st === "EN_PROCESO"
                ? "En proceso"
                : st === "VENCIDA"
                ? "Vencida"
                : "Completada";

            const active = filters.estado[st];

            return (
              <button
                key={st}
                onClick={() =>
                  setFilters((prev) => ({
                    ...prev,
                    estado: { ...prev.estado, [st]: !prev.estado[st] },
                  }))
                }
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                  active
                    ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                    : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
                }`}
              >
                {label}
              </button>
            );
          })}

          <div className="flex items-center gap-2 text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-[#1d1e1c]/70">Área:</span>
            <select
              className="text-xs bg-transparent outline-none"
              value={filters.area}
              onChange={(e) => setFilters((p) => ({ ...p, area: e.target.value }))}
              disabled={selectedAgentId === null}
              title={selectedAgentId === null ? "Selecciona un agente" : ""}
            >
              <option value="ALL">Todas</option>
              {areaOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-[#1d1e1c]/70">Tarea:</span>
            <select
              className="text-xs bg-transparent outline-none max-w-[420px]"
              value={filters.taskKey}
              onChange={(e) => setFilters((p) => ({ ...p, taskKey: e.target.value }))}
              disabled={selectedAgentId === null && viewMode !== "comparativa"}
            >
              <option value="ALL">Todas</option>
              {taskOptions.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <input
            value={filters.search}
            onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
            placeholder="Buscar tarea / área / código..."
            className="w-72 max-w-full text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
            disabled={selectedAgentId === null && viewMode !== "comparativa"}
          />

          <div className="flex items-center gap-2 text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-[#1d1e1c]/70">Vencimiento:</span>
            <select
              className="text-xs bg-transparent outline-none"
              value={filters.dueMode}
              onChange={(e) => setFilters((p) => ({ ...p, dueMode: e.target.value as DueMode }))}
            >
              <option value="ALL">Todos</option>
              <option value="OVERDUE">Vencidas</option>
              <option value="DUE_SOON">Por vencer</option>
              <option value="ON_TIME">Al día</option>
            </select>

            <span className="text-[#1d1e1c]/60">Días:</span>
            <input
              type="number"
              min={0}
              className="w-16 text-xs bg-transparent outline-none"
              value={filters.dueDays}
              onChange={(e) =>
                setFilters((p) => ({ ...p, dueDays: Math.max(0, Number(e.target.value || 0)) }))
              }
              title="Umbral para 'por vencer'"
            />
          </div>

          <button
            onClick={() =>
              setFilters((p) => ({
                ...p,
                onlyBacklog: !p.onlyBacklog,
                onlyCompleted: !p.onlyBacklog ? false : p.onlyCompleted,
              }))
            }
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              filters.onlyBacklog
                ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                : "bg-white text-[#1d1e1c] border-black/10 hover:border-sky-600"
            }`}
            title="Excluir completadas"
          >
            Solo backlog
          </button>

          <button
            onClick={() =>
              setFilters((p) => ({
                ...p,
                onlyCompleted: !p.onlyCompleted,
                onlyBacklog: !p.onlyCompleted ? false : p.onlyBacklog,
              }))
            }
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              filters.onlyCompleted
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-white text-[#1d1e1c] border-black/10 hover:border-emerald-600"
            }`}
            title="Mostrar solo completadas"
          >
            Solo completadas
          </button>

          <button
            onClick={() => {
              setFilters({
                estado: { PENDIENTE: true, EN_PROCESO: true, VENCIDA: true, COMPLETADA: true },
                area: "ALL",
                search: "",
                dueMode: "ALL",
                dueDays: 3,
                onlyBacklog: false,
                onlyCompleted: false,
                taskKey: "ALL",
              });
            }}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150]"
          >
            Reset filtros
          </button>
        </div>
      </div>

      {/* Tabs + export */}
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => setViewMode("dashboard")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
            viewMode === "dashboard"
              ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
              : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
          }`}
        >
          Dashboards
        </button>

        <button
          onClick={() => {
            setViewMode("empresas");
            setSelectedClientRut("ALL");
          }}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
            viewMode === "empresas"
              ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
              : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
          }`}
        >
          Empresas
        </button>

        {/* ✅ NUEVO TAB */}
        <button
          onClick={() => {
            setViewMode("impacto");
            setSelectedClientRut("ALL");
          }}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
            viewMode === "impacto"
              ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
              : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
          }`}
        >
          Impacto por tarea
        </button>

        <button
          onClick={() => {
            setViewMode("comparativa");
            setPeriodo("mes-especifico");
          }}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
            viewMode === "comparativa"
              ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
              : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
          }`}
        >
          Comparativa
        </button>

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => {
              setExportSelection({
                target: viewMode === "comparativa" ? "comparativa" : viewMode,
                format: "excel",
              });
              setShowExportModal(true);
            }}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150] shadow-sm"
          >
            Exportar
          </button>
        </div>
      </div>

      {/* Contenido */}
      {viewMode === "comparativa" ? (
        <ComparativaView
          loading={comparativaLoading || loading}
          comparativaAgentes={comparativaAgentes}
          comparativaTotals={comparativaTotals}
          comparativaStacked={comparativaStacked}
          comparativaRendimiento={comparativaRendimiento}
          onOpenAgenteDetalle={(id) => setAgenteDetalle(id)}
        />
      ) : selectedAgentId === null ? (
        <div className="text-sm text-black/60">Selecciona un agente para ver sus dashboards y tareas filtradas.</div>
      ) : viewMode === "dashboard" ? (
        <DashboardView
          agenteNombre={agenteSeleccionado?.nombre || ""}
          globalKpis={globalKpis as any}
          donutSeries={donutSeries}
          donutOptions={donutOptions}
          lineData={lineData}
          procesoAgentes={procesoAgentes}
          onOpenDetalle={(id) => setAgenteDetalle(id)}
        />
      ) : viewMode === "impacto" ? (
        <TareaImpactoView
          empresasStats={clienteOptions.map((c) => ({
            rut: c.rut,
            razonSocial: c.razonSocial || c.rut,
          }))}
          tareasSeleccionadas={tareasSeleccionadas}
          formatFecha={formatFecha}
        />
      ) : (
        <EmpresasView
          selectedAgentId={selectedAgentId}
          empresasStats={empresasStats}
          empresasFiltradas={empresasFiltradas}
          empresasPage={empresasPageData}
          empresaSearch={empresaSearch}
          setEmpresaSearch={(v) => {
            setEmpresaPage(1);
            setEmpresaSearch(v);
          }}
          empresaPageIndex={empresaPage}
          setEmpresaPageIndex={setEmpresaPage}
          pageSize={EMPRESAS_PAGE_SIZE}
          empresaSeleccionadaRut={empresaSeleccionadaRut}
          setEmpresaSeleccionadaRut={setEmpresaSeleccionadaRut}
          totalEmpresas={totalEmpresas}
          totalTareasEmpresas={totalTareasEmpresas}
          tareasSeleccionadas={tareasSeleccionadas}
          formatFecha={formatFecha}
        />
      )}

      {/* AgenteModal */}
      {agenteDetalle !== null && (
        <AgenteModal
          trabajadorId={agenteDetalle}
          onClose={() => setAgenteDetalle(null)}
          periodo={periodo}
          mes={mesSelect}
          anio={anioSelect}
          tareasIniciales={tareasCache[agenteDetalle]}
          clientes={rutsCache[agenteDetalle] || []}
          clienteFiltroRut={"ALL"}
        />
      )}
    </div>
  );
};

export default TareasSupervisionPage;
