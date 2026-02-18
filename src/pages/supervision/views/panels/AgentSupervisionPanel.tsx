// src/pages/supervision/panels/AgentSupervisionPanel.tsx
import React, { useMemo, useState } from "react";
import type { ResumenAgente, TareaFull } from "../../../../lib/api";
import type { Periodo } from "../../../../components/supervision/usePeriodo";
import type { GlobalFilters } from "../../../../utils/supervisionMetrics";

import DashboardView from "../../views/DashboardView";
import EmpresasView from "../../views/EmpresasView";
import ComparativaView from "../../views/ComparativaView";
import TareaImpactoView from "../../views/TareaImpactoView";

type AgentView = "dashboard" | "empresas" | "impacto" | "comparativa";

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

const BackButton: React.FC<{ onClick: () => void; loading?: boolean }> = ({
  onClick,
  loading,
}) => (
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

function round0(n: number) {
  return Math.round(n);
}
function pct(num: number, den: number) {
  return den > 0 ? round0((num / den) * 100) : 0;
}

function dayKey(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

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
  onBack,
}: Props) {
  // UI state Empresas view
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [empresaPage, setEmpresaPage] = useState(1);
  const [empresaSeleccionadaRut, setEmpresaSeleccionadaRut] = useState<string | null>(null);
  const EMPRESAS_PAGE_SIZE = 12;

  const isComparativa = agentView === "comparativa";
  const loadingAny = agentLoading || globalLoading;

  const canShowTabs = selectedAgentId !== null;

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

  // =========================
  // ✅ KPIs para DashboardView (desde tareasAgenteFiltradas)
  // =========================
  const dashboardKpis = useMemo(() => {
    const total = tareasAgenteFiltradas.length;

    let pendientes = 0;
    let enProceso = 0;
    let vencidas = 0;
    let completadas = 0;

    for (const t of tareasAgenteFiltradas) {
      if (t.estado === "PENDIENTE") pendientes++;
      else if (t.estado === "EN_PROCESO") enProceso++;
      else if (t.estado === "VENCIDA") vencidas++;
      else if (t.estado === "COMPLETADA") completadas++;
    }

    const backlog = pendientes + enProceso;
    const cierrePct = pct(completadas, total);

    // Promedio cierre días (si viene fechaComplecion)
    const cierres = tareasAgenteFiltradas
      .filter((t: any) => t.estado === "COMPLETADA" && (t as any).fechaComplecion && t.fechaProgramada)
      .map((t: any) => {
        const a = new Date(t.fechaProgramada);
        const b = new Date(t.fechaComplecion);
        if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
        const diff = b.getTime() - a.getTime();
        return diff >= 0 ? diff / (1000 * 60 * 60 * 24) : null;
      })
      .filter((x): x is number => x !== null);

    const avgCierreDias =
      cierres.length > 0 ? round0(cierres.reduce((a, b) => a + b, 0) / cierres.length) : 0;

    // Riesgo simple (alineado a tu backend)
    const risk = total > 0 ? round0(((vencidas * 1.5 + pendientes) / total) * 100) : 0;

    return {
      total,
      backlog,
      venc: vencidas,
      porVencer: empresasStats.reduce((acc, e) => acc + (e.porVencer || 0), 0),
      comp: completadas,
      cierrePct,
      avgCierreDias,
      risk,
      pendientes,
      enProceso,
      vencidas,
      completadas,
    };
  }, [tareasAgenteFiltradas, empresasStats]);

  const donutSeries = useMemo(() => {
    // si tu DashboardView espera 5 valores, dejamos el 5to como 0 (No aplica)
    return [
      dashboardKpis.pendientes,
      dashboardKpis.enProceso,
      dashboardKpis.vencidas,
      dashboardKpis.completadas,
      0,
    ];
  }, [dashboardKpis]);

  const donutOptions = useMemo(() => {
    return {
      labels: ["Pendiente", "En proceso", "Vencida", "Completada", "No aplica"],
      colors: ["#fbbf24", "#38bdf8", "#f97373", "#22c55e", "#cbd5e1"],
      legend: { position: "bottom" },
    };
  }, []);

  const lineData = useMemo(() => {
    // serie simple últimos 14 días (conteo por fechaProgramada)
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

    for (const t of tareasAgenteFiltradas) {
      if (!t.fechaProgramada) continue;
      const d = new Date(t.fechaProgramada);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      if (!counts.has(k)) continue;
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    return {
      categories: keys.map((k) => k.slice(5)), // MM-DD
      series: [{ name: "Tareas programadas", data: keys.map((k) => counts.get(k) || 0) }],
    };
  }, [tareasAgenteFiltradas]);

  const procesoAgentes = useMemo(() => {
    return [];
  }, []);

  return (
    <div className="space-y-6">
      {/* Header modo + back (más notorio) */}
      <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] text-black/50">Modo</div>
            <div className="text-sm font-semibold text-[#1d1e1c]">Por agente</div>
          </div>

          <div className="flex items-center gap-3">
            {loadingAny && <SpinnerSmall label="Cargando datos..." />}
            <BackButton onClick={onBack} loading={loadingAny} />
          </div>
        </div>
      </div>

      {/* Selector agente */}
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
        <TareaImpactoView
          empresasStats={empresasCarteraAgente}
          tareasSeleccionadas={tareasAgenteFiltradas}
          formatFecha={formatFecha}
        />
      ) : agentView === "empresas" ? (
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
          tareasSeleccionadas={tareasAgenteFiltradas}
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
          comparativaAgentes={[] as any}
          comparativaTotals={{} as any}
          comparativaStacked={{} as any}
          comparativaRendimiento={{} as any}
          onOpenAgenteDetalle={() => {}}
        />
      )}
    </div>
  );
}
