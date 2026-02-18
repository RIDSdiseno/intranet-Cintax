// src/pages/supervision/panels/AgentSupervisionPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { ResumenAgente, TareaFull } from "../../../../lib/api";
import type { Periodo } from "../../../../components/supervision/usePeriodo";
import type { GlobalFilters } from "../../../../utils/supervisionMetrics";

import DashboardView from "../../views/DashboardView";
import EmpresasView from "../../views/EmpresasView";
import ComparativaView from "../../views/ComparativaView";
import TareaImpactoView from "../../views/TareaImpactoView";

import ExportTaskExcelButton from "../../ExportTaskExcelButton";

type AgentView = "dashboard" | "empresas" | "impacto" | "comparativa";

type EstadoEmpresa = "VENCIDA" | "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "NO_INICIADA";
type Tone = "ok" | "warn" | "bad" | "neutral";

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
  cierre: number; // %
  riesgo: number; // %
};

type Props = {
  resumen: ResumenAgente[];

  agentView: AgentView;
  setAgentView: (v: AgentView) => void;

  selectedAgentId: number | null;
  setSelectedAgentId: (id: number | null) => void;

  agenteNombre: string;

  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  mesSelect: number;
  setMesSelect: (m: number) => void;
  anioSelect: number;
  setAnioSelect: (a: number) => void;

  filters: GlobalFilters;
  setFilters: React.Dispatch<React.SetStateAction<GlobalFilters>>;

  agentLoading: boolean;
  globalLoading: boolean;

  clienteOptions: Array<{ rut: string; razonSocial?: string | null }>;
  empresasCarteraAgente: Array<{ rut: string; razonSocial: string }>;
  tareasAgenteFiltradas: TareaFull[];
  formatFecha: (iso?: string | null) => string;

  comparativaAgentes: AgenteComparativa[];
  comparativaTotals: {
    totalAgentes: number;
    totalTareas: number;
    backlog: number;
    tasaGlobal: number;
    promedioCierre: number;
    top: AgenteComparativa | null;
  };
  comparativaStacked: { categories: string[]; series: Array<{ name: string; data: number[] }> };
  comparativaRendimiento: { categories: string[]; series: Array<{ name: string; data: number[] }> };

  onBack: () => void;
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

const BackButton: React.FC<{ onClick: () => void; loading?: boolean }> = ({ onClick, loading }) => (
  <button
    onClick={onClick}
    type="button"
    className="
      inline-flex items-center gap-2
      px-4 py-2.5
      rounded-full
      text-xs font-semibold
      bg-[#af9150] text-white
      shadow-sm
      border border-[#af9150]
      hover:brightness-95
      active:scale-[0.99]
      focus:outline-none focus:ring-2 focus:ring-[#af9150]/40 focus:ring-offset-2
      transition
    "
    aria-label="Cambiar modo"
    title="Volver para cambiar el modo de análisis"
    disabled={!!loading}
  >
    <span className="text-base leading-none">←</span>
    <span>Cambiar modo</span>
  </button>
);

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function pickFechaMasProxima(isoList: Array<string | null | undefined>): string | null {
  const fechas = isoList
    .filter(Boolean)
    .map((iso) => new Date(String(iso)))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return fechas[0] ? fechas[0].toISOString() : null;
}

function calcAtrasoDias(iso: string | null): number | null {
  if (!iso) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() >= hoy.getTime()) return 0;
  const diff = hoy.getTime() - d.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function PeriodoLabel(periodo: Periodo, mes: number, anio: number) {
  if (periodo === "anio-especifico") return `Año ${anio}`;
  if (periodo === "hist") return "Histórico";
  return `Mes ${mes} / ${anio}`;
}

type RowEmpresa = {
  rut: string;
  razonSocial: string;
  estado: EstadoEmpresa;
  fechaComprometida: string | null;
  atrasoDias: number | null;
  abiertas: number;
  agentes: Array<{ trabajadorId: number; nombre: string; abiertas: number }>;
  tareas: TareaFull[];
};

/** chips filtro estado (como en TaskSupervisionPanel, pero aquí aplican a EMPRESAS del agente) */
const EstadoChips: React.FC<{
  counters: { venc: number; pend: number; proc: number; comp: number };
  value: "ALL" | Exclude<EstadoEmpresa, "NO_INICIADA">;
  onChange: (v: "ALL" | Exclude<EstadoEmpresa, "NO_INICIADA">) => void;
}> = ({ counters, value, onChange }) => {
  const Chip = ({
    k,
    label,
    count,
    clsIdle,
    clsActive,
  }: {
    k: Exclude<EstadoEmpresa, "NO_INICIADA">;
    label: string;
    count: number;
    clsIdle: string;
    clsActive: string;
  }) => {
    const active = value === k;
    return (
      <button
        type="button"
        onClick={() => onChange(active ? "ALL" : k)}
        className={`
          px-3 py-1 rounded-full text-[11px] font-semibold border transition
          ${active ? clsActive : clsIdle}
        `}
        title={active ? "Quitar filtro" : `Filtrar por ${label}`}
      >
        {label} {count}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Chip
        k="VENCIDA"
        label="Venc"
        count={counters.venc}
        clsIdle="bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-300"
        clsActive="bg-rose-600 text-white border-rose-600"
      />
      <Chip
        k="PENDIENTE"
        label="Pend"
        count={counters.pend}
        clsIdle="bg-amber-50 text-amber-800 border-amber-100 hover:border-amber-300"
        clsActive="bg-amber-600 text-white border-amber-600"
      />
      <Chip
        k="EN_PROCESO"
        label="Proc"
        count={counters.proc}
        clsIdle="bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-300"
        clsActive="bg-slate-700 text-white border-slate-700"
      />
      <Chip
        k="COMPLETADA"
        label="Comp"
        count={counters.comp}
        clsIdle="bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300"
        clsActive="bg-emerald-600 text-white border-emerald-600"
      />
    </div>
  );
};

export default function AgentSupervisionPanel({
  resumen,
  agentView,
  setAgentView,
  selectedAgentId,
  setSelectedAgentId,
  agenteNombre,
  periodo,
  setPeriodo,
  mesSelect,
  setMesSelect,
  anioSelect,
  setAnioSelect,
  filters,
  setFilters,
  agentLoading,
  globalLoading,
  empresasCarteraAgente,
  tareasAgenteFiltradas,
  formatFecha,

  comparativaAgentes,
  comparativaTotals,
  comparativaStacked,
  comparativaRendimiento,

  onBack,
}: Props) {
  // UI state Empresas view
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [empresaPage, setEmpresaPage] = useState(1);
  const [empresaSeleccionadaRut, setEmpresaSeleccionadaRut] = useState<string | null>(null);
  const EMPRESAS_PAGE_SIZE = 12;

  // ✅ filtro por estado (empresas)
  const [estadoEmpresaFilter, setEstadoEmpresaFilter] =
    useState<"ALL" | Exclude<EstadoEmpresa, "NO_INICIADA">>("ALL");

  const isComparativa = agentView === "comparativa";
  const loadingAny = agentLoading || globalLoading;

  const canShowTabs = selectedAgentId !== null;

  const periodoLabel = useMemo(() => PeriodoLabel(periodo, mesSelect, anioSelect), [periodo, mesSelect, anioSelect]);

  // =========================
  // Empresas stats (para EmpresasView)
  // =========================
  const empresasStats = useMemo(() => {
    if (!selectedAgentId) return [];

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

    empresasCarteraAgente.forEach((c) => {
      mapa.set(c.rut, {
        rut: c.rut,
        razonSocial: c.razonSocial,
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

    tareasAgenteFiltradas.forEach((t) => {
      const rut = (t.rutCliente || "SIN_RUT") as string;

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
        const fv = t.fechaProgramada ? new Date(t.fechaProgramada) : null;
        if (fv && fv.getTime() >= hoy.getTime() && fv.getTime() <= limite.getTime()) {
          m.porVencer += 1;
        }
      }

      m.total += 1;
    });

    return Array.from(mapa.values()).sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
  }, [selectedAgentId, empresasCarteraAgente, tareasAgenteFiltradas, filters.dueDays]);

  // =========================
  // Dataset RowEmpresa (estado por empresa)
  // =========================
  const empresasPorEstado = useMemo<RowEmpresa[]>(() => {
    if (!selectedAgentId) return [];

    const byRut = new Map<string, TareaFull[]>();
    for (const t of tareasAgenteFiltradas) {
      const rut = (t.rutCliente || "SIN_RUT") as string;
      if (!byRut.has(rut)) byRut.set(rut, []);
      byRut.get(rut)!.push(t);
    }

    const out: RowEmpresa[] = [];

    // 1) cartera
    for (const e of empresasCarteraAgente) {
      const inst = byRut.get(e.rut) || [];

      if (inst.length === 0) {
        out.push({
          rut: e.rut,
          razonSocial: e.razonSocial,
          estado: "NO_INICIADA",
          fechaComprometida: null,
          atrasoDias: null,
          abiertas: 0,
          agentes: selectedAgentId
            ? [{ trabajadorId: selectedAgentId, nombre: agenteNombre || `Agente #${selectedAgentId}`, abiertas: 0 }]
            : [],
          tareas: [],
        });
        continue;
      }

      const abiertasList = inst.filter((x) => x.estado !== "COMPLETADA");
      const completadasList = inst.filter((x) => x.estado === "COMPLETADA");

      if (abiertasList.length === 0 && completadasList.length > 0) {
        out.push({
          rut: e.rut,
          razonSocial: e.razonSocial,
          estado: "COMPLETADA",
          fechaComprometida: null,
          atrasoDias: 0,
          abiertas: 0,
          agentes: selectedAgentId
            ? [{ trabajadorId: selectedAgentId, nombre: agenteNombre || `Agente #${selectedAgentId}`, abiertas: 0 }]
            : [],
          tareas: inst,
        });
        continue;
      }

      const estado: EstadoEmpresa =
        abiertasList.some((x) => x.estado === "VENCIDA")
          ? "VENCIDA"
          : abiertasList.some((x) => x.estado === "EN_PROCESO")
          ? "EN_PROCESO"
          : "PENDIENTE";

      const fecha = pickFechaMasProxima(abiertasList.map((x) => x.fechaProgramada));

      out.push({
        rut: e.rut,
        razonSocial: e.razonSocial,
        estado,
        fechaComprometida: fecha,
        atrasoDias: calcAtrasoDias(fecha),
        abiertas: abiertasList.length,
        agentes: selectedAgentId
          ? [
              {
                trabajadorId: selectedAgentId,
                nombre: agenteNombre || `Agente #${selectedAgentId}`,
                abiertas: abiertasList.length,
              },
            ]
          : [],
        tareas: inst,
      });
    }

    // 2) ruts que aparezcan en tareas pero no estén en cartera
    for (const [rut, inst] of byRut.entries()) {
      if (out.some((x) => x.rut === rut)) continue;

      const abiertasList = inst.filter((x) => x.estado !== "COMPLETADA");
      const completadasList = inst.filter((x) => x.estado === "COMPLETADA");

      if (inst.length === 0) continue;

      if (abiertasList.length === 0 && completadasList.length > 0) {
        out.push({
          rut,
          razonSocial: rut,
          estado: "COMPLETADA",
          fechaComprometida: null,
          atrasoDias: 0,
          abiertas: 0,
          agentes: selectedAgentId
            ? [{ trabajadorId: selectedAgentId, nombre: agenteNombre || `Agente #${selectedAgentId}`, abiertas: 0 }]
            : [],
          tareas: inst,
        });
        continue;
      }

      const estado: EstadoEmpresa =
        abiertasList.some((x) => x.estado === "VENCIDA")
          ? "VENCIDA"
          : abiertasList.some((x) => x.estado === "EN_PROCESO")
          ? "EN_PROCESO"
          : "PENDIENTE";

      const fecha = pickFechaMasProxima(abiertasList.map((x) => x.fechaProgramada));

      out.push({
        rut,
        razonSocial: rut,
        estado,
        fechaComprometida: fecha,
        atrasoDias: calcAtrasoDias(fecha),
        abiertas: abiertasList.length,
        agentes: selectedAgentId
          ? [
              {
                trabajadorId: selectedAgentId,
                nombre: agenteNombre || `Agente #${selectedAgentId}`,
                abiertas: abiertasList.length,
              },
            ]
          : [],
        tareas: inst,
      });
    }

    return out.sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
  }, [selectedAgentId, tareasAgenteFiltradas, empresasCarteraAgente, agenteNombre]);

  const countersEstado = useMemo(() => {
    const base = empresasPorEstado;
    return {
      venc: base.filter((x) => x.estado === "VENCIDA").length,
      pend: base.filter((x) => x.estado === "PENDIENTE").length,
      proc: base.filter((x) => x.estado === "EN_PROCESO").length,
      comp: base.filter((x) => x.estado === "COMPLETADA").length,
    };
  }, [empresasPorEstado]);

  const empresasFiltradas = useMemo(() => {
    const term = norm(empresaSearch);

    let base = empresasStats;

    if (estadoEmpresaFilter !== "ALL") {
      const estadoByRut = new Map(empresasPorEstado.map((e) => [e.rut, e.estado] as const));
      base = base.filter((e) => estadoByRut.get(e.rut) === estadoEmpresaFilter);
    }

    if (!term) return base;
    return base.filter((e) => norm(`${e.rut} ${e.razonSocial}`).includes(term));
  }, [empresasStats, empresaSearch, estadoEmpresaFilter, empresasPorEstado]);

  // ✅ reset page cuando cambia filtro/búsqueda
  useEffect(() => {
    setEmpresaPage(1);
  }, [estadoEmpresaFilter, empresaSearch]);

  const empresasPageData = useMemo(() => {
    const start = (empresaPage - 1) * EMPRESAS_PAGE_SIZE;
    return empresasFiltradas.slice(start, start + EMPRESAS_PAGE_SIZE);
  }, [empresasFiltradas, empresaPage]);

  const totalEmpresas = empresasFiltradas.length;
  const totalTareasEmpresas = empresasFiltradas.reduce((acc, e) => acc + e.total, 0);

  // =========================
  // Scope para que chips afecten TODAS las vistas
  // =========================
  const rutsVisibles = useMemo(() => new Set(empresasFiltradas.map((e) => e.rut)), [empresasFiltradas]);

  const tareasScope = useMemo(() => {
    const hasSearch = norm(empresaSearch).length > 0;
    const hasEstado = estadoEmpresaFilter !== "ALL";
    if (!hasSearch && !hasEstado) return tareasAgenteFiltradas;

    return tareasAgenteFiltradas.filter((t) => {
      const rut = (t.rutCliente || "SIN_RUT") as string;
      return rutsVisibles.has(rut);
    });
  }, [tareasAgenteFiltradas, rutsVisibles, empresaSearch, estadoEmpresaFilter]);

  const empresasCarteraScope = useMemo(() => {
    const hasSearch = norm(empresaSearch).length > 0;
    const hasEstado = estadoEmpresaFilter !== "ALL";
    if (!hasSearch && !hasEstado) return empresasCarteraAgente;

    const set = rutsVisibles;
    return empresasCarteraAgente.filter((e) => set.has(e.rut));
  }, [empresasCarteraAgente, rutsVisibles, empresaSearch, estadoEmpresaFilter]);

  const empresasStatsScope = useMemo(() => {
    const hasSearch = norm(empresaSearch).length > 0;
    const hasEstado = estadoEmpresaFilter !== "ALL";
    if (!hasSearch && !hasEstado) return empresasStats;
    return empresasFiltradas;
  }, [empresasStats, empresasFiltradas, empresaSearch, estadoEmpresaFilter]);

  // =========================
  // ✅ BOTÓN RESET (nuevo)
  // =========================
  const hasActiveFilters = useMemo(() => {
    return estadoEmpresaFilter !== "ALL" || norm(empresaSearch).length > 0 || empresaSeleccionadaRut !== null;
  }, [estadoEmpresaFilter, empresaSearch, empresaSeleccionadaRut]);

  const resetFilters = () => {
    setEstadoEmpresaFilter("ALL");
    setEmpresaSearch("");
    setEmpresaPage(1);
    setEmpresaSeleccionadaRut(null);
  };

  // =========================
  // Export
  // =========================
  const empresasFiltradasParaExcel = useMemo(() => {
    const term = norm(empresaSearch);

    let base = empresasPorEstado.filter((e) => e.estado !== "NO_INICIADA");
    if (estadoEmpresaFilter !== "ALL") base = base.filter((e) => e.estado === estadoEmpresaFilter);
    if (!term) return base;
    return base.filter((e) => norm(`${e.razonSocial} ${e.rut}`).includes(term));
  }, [empresasPorEstado, empresaSearch, estadoEmpresaFilter]);

  const detalleEmpresa = useMemo(() => {
    if (!empresaSeleccionadaRut) return null;
    return empresasPorEstado.find((e) => e.rut === empresaSeleccionadaRut) || null;
  }, [empresaSeleccionadaRut, empresasPorEstado]);

  const groupedByAgente = useMemo(() => {
    if (!detalleEmpresa) return [];
    return [
      {
        trabajadorId: selectedAgentId || 0,
        nombre: agenteNombre || (selectedAgentId ? `Agente #${selectedAgentId}` : "Sin agente"),
        tareas: (detalleEmpresa.tareas || []).slice().sort((a, b) => {
          const fa = a.fechaProgramada ? new Date(a.fechaProgramada).getTime() : 0;
          const fb = b.fechaProgramada ? new Date(b.fechaProgramada).getTime() : 0;
          return fb - fa;
        }),
      },
    ];
  }, [detalleEmpresa, selectedAgentId, agenteNombre]);

  // =========================
  // Dashboard KPIs
  // =========================
  function pct2(num: number, den: number) {
    return den > 0 ? Math.round((num / den) * 100) : 0;
  }

  const dashboardKpis = useMemo(() => {
    const total = tareasScope.length;

    let pendientes = 0;
    let enProceso = 0;
    let vencidas = 0;
    let completadas = 0;

    for (const t of tareasScope) {
      if (t.estado === "PENDIENTE") pendientes++;
      else if (t.estado === "EN_PROCESO") enProceso++;
      else if (t.estado === "VENCIDA") vencidas++;
      else if (t.estado === "COMPLETADA") completadas++;
    }

    const backlog = pendientes + enProceso;
    const cierrePct = pct2(completadas, total);

    const cierres = tareasScope
      .filter((t: any) => t.estado === "COMPLETADA" && (t as any).fechaComplecion && t.fechaProgramada)
      .map((t: any) => {
        const a = new Date(t.fechaProgramada);
        const b = new Date((t as any).fechaComplecion);
        if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
        const diff = b.getTime() - a.getTime();
        return diff >= 0 ? diff / (1000 * 60 * 60 * 24) : null;
      })
      .filter((x): x is number => x !== null);

    const avgCierreDias = cierres.length > 0 ? Math.round(cierres.reduce((a, b) => a + b, 0) / cierres.length) : 0;

    const risk = total > 0 ? Math.round(((vencidas * 1.5 + pendientes) / total) * 100) : 0;

    return {
      total,
      backlog,
      venc: vencidas,
      porVencer: empresasStatsScope.reduce((acc, e: any) => acc + (e.porVencer || 0), 0),
      comp: completadas,
      cierrePct,
      avgCierreDias,
      risk,
      pendientes,
      enProceso,
      vencidas,
      completadas,
    };
  }, [tareasScope, empresasStatsScope]);

  const donutSeries = useMemo(() => {
    return [dashboardKpis.pendientes, dashboardKpis.enProceso, dashboardKpis.vencidas, dashboardKpis.completadas, 0];
  }, [dashboardKpis]);

  const donutOptions = useMemo(() => {
    return {
      labels: ["Pendiente", "En proceso", "Vencida", "Completada", "No aplica"],
      colors: ["#fbbf24", "#38bdf8", "#f97373", "#22c55e", "#cbd5e1"],
      legend: { position: "bottom" },
    };
  }, []);

  function dayKey(d: Date) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  }

  const lineData = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const keys: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      keys.push(dayKey(d));
    }

    const counts = new Map<string, number>();
    keys.forEach((k) => counts.set(k, 0));

    for (const t of tareasScope) {
      if (!t.fechaProgramada) continue;
      const d = new Date(t.fechaProgramada);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!counts.has(k)) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    return {
      categories: keys.map((k) => k.slice(5)),
      series: [{ name: "Tareas programadas", data: keys.map((k) => counts.get(k) || 0) }],
    };
  }, [tareasScope]);

  const procesoAgentes = useMemo(() => {
    return [];
  }, []);

  const selectedTaskMeta = useMemo(() => {
    return {
      nombre: `Cartera Agente: ${agenteNombre || "-"}`,
      codigo: selectedAgentId ? String(selectedAgentId) : "-",
      area: "Agente",
      total: tareasScope.length,
      key: selectedAgentId ? String(selectedAgentId) : "AGENTE",
    };
  }, [agenteNombre, selectedAgentId, tareasScope.length]);

  return (
    <div className="space-y-6">
      {/* Header modo + back */}
      <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] text-black/50">Modo</div>
            <div className="text-sm font-semibold text-[#1d1e1c]">Por agente</div>
          </div>

          <div className="flex items-center gap-3">
            {loadingAny && <SpinnerSmall label="Cargando datos..." />}

            {/* ✅ Reset filtros */}
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters || loadingAny}
              className={`
                inline-flex items-center gap-2
                px-3 py-2
                rounded-full
                text-xs font-semibold
                border
                transition
                ${
                  !hasActiveFilters || loadingAny
                    ? "bg-white text-black/30 border-black/10 cursor-not-allowed"
                    : "bg-white text-[#1d1e1c] border-black/15 hover:border-[#af9150] hover:text-[#af9150]"
                }
              `}
              title="Resetear chips, búsqueda y selección"
            >
              Reset filtros
            </button>

            {/* Exportar Excel */}
            <ExportTaskExcelButton
              disabled={loadingAny || !selectedAgentId}
              periodoLabel={periodoLabel}
              selectedTaskMeta={selectedTaskMeta as any}
              estadoFilter={estadoEmpresaFilter === "ALL" ? "ALL" : (estadoEmpresaFilter as any)}
              empresaSearch={empresaSearch}
              empresasFiltradas={empresasFiltradasParaExcel as any}
              detalleEmpresa={detalleEmpresa as any}
              groupedByAgente={groupedByAgente as any}
              formatFecha={formatFecha}
            />

            <BackButton onClick={onBack} loading={loadingAny} />
          </div>
        </div>
      </div>

      {/* Selector agente + periodo + chips filtro estado */}
      <div className="bg-[#f5f4f0] border border-black/5 rounded-2xl px-3 py-3 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
            value={selectedAgentId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedAgentId(val ? Number(val) : null);
              setEmpresaSearch("");
              setEmpresaPage(1);
              setEmpresaSeleccionadaRut(null);
              setEstadoEmpresaFilter("ALL");
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
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[11px] text-black/50">Filtros por estado (empresas)</div>
          <EstadoChips counters={countersEstado} value={estadoEmpresaFilter} onChange={setEstadoEmpresaFilter} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap items-center mt-3">
          {(["dashboard", "empresas", "impacto"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setAgentView(k)}
              disabled={!canShowTabs}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                agentView === k
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              } ${!canShowTabs ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {k === "dashboard" ? "Dashboards" : k === "empresas" ? "Empresas" : "Impacto por tarea"}
            </button>
          ))}

          <button
            onClick={() => setAgentView("comparativa")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
              agentView === "comparativa"
                ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
            }`}
            title="Comparativa no requiere agente"
          >
            Comparativa
          </button>
        </div>
      </div>

      {/* Contenido */}
      {selectedAgentId === null && !isComparativa ? (
        <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-6 text-sm text-black/60">
          Selecciona un agente para ver dashboards, empresas e impacto.
        </div>
      ) : agentView === "impacto" ? (
        <TareaImpactoView empresasStats={empresasCarteraScope} tareasSeleccionadas={tareasScope} formatFecha={formatFecha} />
      ) : agentView === "empresas" ? (
        <EmpresasView
          selectedAgentId={selectedAgentId}
          empresasStats={empresasStatsScope}
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
          tareasSeleccionadas={tareasScope}
          formatFecha={formatFecha}
        />
      ) : agentView === "dashboard" ? (
        <DashboardView
          agenteNombre={agenteNombre}
          globalKpis={dashboardKpis as any}
          donutSeries={donutSeries}
          donutOptions={donutOptions as any}
          lineData={lineData as any}
          procesoAgentes={procesoAgentes as any}
          onOpenDetalle={() => {}}
        />
      ) : (
        <ComparativaView
          loading={globalLoading}
          comparativaAgentes={comparativaAgentes as any}
          comparativaTotals={comparativaTotals as any}
          comparativaStacked={comparativaStacked as any}
          comparativaRendimiento={comparativaRendimiento as any}
          onOpenAgenteDetalle={() => {}}
        />
      )}

      {agentView !== "comparativa" && (
        <div className="text-[11px] text-black/50">
          Nota: los chips filtran <span className="font-semibold">empresas</span> según el estado de tareas del agente en el período.
        </div>
      )}
    </div>
  );
}
