// src/pages/supervision/views/DashboardView.tsx
import React, { useMemo, useState } from "react";
import ApexChart from "react-apexcharts";
import KpiGuideModal from "./KpiGuideModal";

type GlobalKpis = {
  total: number;
  pend: number;
  proc: number;
  venc: number;
  comp: number;
  porVencer: number;
  backlog: number;
  cierrePct: number;
  avgCierreDias: number;
  edadBacklogDias: number;
  riskScore: number;
  riskLabel: string;
};

type LineData = {
  categories: string[];
  series: Array<{ name: string; data: number[] }>;
};

type ProcesoRow = {
  trabajadorId: number;
  nombre: string;
  email: string;

  // backlog ya calculado
  pendientes: number;

  vencidas: number;
  porVencer?: number;
  proximoVenc?: string;
  estadoProceso?: string;
};

type Props = {
  agenteNombre: string;
  globalKpis: GlobalKpis;

  donutSeries: number[];
  donutOptions: any;

  lineData: LineData;

  procesoAgentes: ProcesoRow[];
  onOpenDetalle: (id: number) => void;
};

const KPI_DESCRIPTIONS: Record<string, string> = {
  total: "Cantidad total de tareas en el período seleccionado.",
  backlog: "Tareas pendientes acumuladas (backlog) que requieren atención.",
  venc: "Tareas que ya están vencidas.",
  porVencer: "Tareas que vencerán pronto (p. ej. próximos 7 días).",
  comp: "Tareas completadas en el período seleccionado.",
  cierrePct: "Porcentaje de tareas cerradas respecto al total.",
  avgCierreDias: "Tiempo promedio de cierre de tareas en días.",
  risk: "Indicador del nivel de riesgo del proceso (mayor = riesgo más alto).",
};

// ---------- utils seguros ----------
const toNum = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const formatNumber = (n: number) => new Intl.NumberFormat("es-ES").format(toNum(n, 0));
const formatPercent = (n: number) => `${toNum(n, 0)}%`;

const KpiCard: React.FC<{
  label: string;
  value: number | null | undefined;
  tone?: "ok" | "warn" | "bad";
  desc?: string;
  format?: "number" | "percent";
}> = ({ label, value, tone, desc, format = "number" }) => {
  const cls =
    tone === "bad"
      ? "bg-rose-50 border-rose-100"
      : tone === "warn"
      ? "bg-amber-50 border-amber-100"
      : "bg-emerald-50 border-emerald-100";

  const safe = toNum(value, 0);
  const display = format === "percent" ? formatPercent(safe) : formatNumber(safe);

  return (
    <div className={`rounded-2xl p-4 border ${cls} shadow-sm`}>
      <div className="flex items-center gap-2">
        <p className="text-xs text-black/60">{label}</p>
        {desc && (
          <span
            title={desc}
            role="img"
            aria-label={`${label} descripción`}
            className="ml-1 text-xs text-black/40"
          >
            ℹ
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-[#1d1e1c]">{display}</p>
      {desc && <p className="text-[11px] text-black/40 mt-1">{desc}</p>}
    </div>
  );
};

const DashboardView: React.FC<Props> = ({
  agenteNombre,
  globalKpis,
  donutSeries,
  donutOptions,
  lineData,
  procesoAgentes,
  onOpenDetalle,
}) => {
  const [guideOpen, setGuideOpen] = useState(false);

  // KPIs siempre seguros (evita NaN/undefined)
  const kpis = useMemo<GlobalKpis>(() => {
    const riskLabel =
      typeof globalKpis?.riskLabel === "string" && globalKpis.riskLabel.trim().length > 0
        ? globalKpis.riskLabel
        : "Normal";

    return {
      total: toNum(globalKpis?.total, 0),
      pend: toNum(globalKpis?.pend, 0),
      proc: toNum(globalKpis?.proc, 0),
      venc: toNum(globalKpis?.venc, 0),
      comp: toNum(globalKpis?.comp, 0),
      porVencer: toNum(globalKpis?.porVencer, 0),
      backlog: toNum(globalKpis?.backlog, 0),
      cierrePct: toNum(globalKpis?.cierrePct, 0),
      avgCierreDias: toNum(globalKpis?.avgCierreDias, 0),
      edadBacklogDias: toNum(globalKpis?.edadBacklogDias, 0),
      riskScore: toNum(globalKpis?.riskScore, 0),
      riskLabel,
    };
  }, [globalKpis]);

  const riesgoTone: "ok" | "warn" | "bad" =
    kpis.riskLabel === "Crítico" ? "bad" : kpis.riskLabel === "Riesgo" ? "warn" : "ok";

  // Charts con fallback (no romper Apex)
  const safeDonutSeries = useMemo(() => {
    const s = Array.isArray(donutSeries) ? donutSeries.map((x) => toNum(x, 0)) : [];
    // Apex donut con 0s igual dibuja; si no hay nada, forzamos 1 serie 0
    return s.length ? s : [0];
  }, [donutSeries]);

  const safeLineData = useMemo<LineData>(() => {
    const categories = Array.isArray(lineData?.categories) ? lineData.categories : [];
    const series = Array.isArray(lineData?.series)
      ? lineData.series.map((s) => ({
          name: String(s?.name ?? "Serie"),
          data: Array.isArray(s?.data) ? s.data.map((n) => toNum(n, 0)) : [],
        }))
      : [];

    // Si no hay series/categorías, poner algo mínimo para no crashear
    if (!categories.length || !series.length) {
      return {
        categories: categories.length ? categories : ["-"],
        series: series.length ? series : [{ name: "Sin datos", data: [0] }],
      };
    }

    // Asegurar que data tenga mismo largo de categories (o al menos 1)
    const len = categories.length || 1;
    const normalized = series.map((s) => {
      const d = s.data.slice(0, len);
      while (d.length < len) d.push(0);
      return { ...s, data: d };
    });

    return { categories, series: normalized };
  }, [lineData]);

  const lineOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false } },
      xaxis: { categories: safeLineData.categories },
      stroke: { width: 2, curve: "smooth" as const },
      legend: { position: "bottom" as const },
      dataLabels: { enabled: false },
    }),
    [safeLineData.categories]
  );

  const hasAnyData = useMemo(() => {
    const hasKpi = kpis.total > 0 || kpis.backlog > 0 || kpis.venc > 0 || kpis.comp > 0;
    const hasProceso = Array.isArray(procesoAgentes) && procesoAgentes.length > 0;
    const hasLine = safeLineData.series.some((s) => s.data.some((n) => toNum(n, 0) > 0));
    const hasDonut = safeDonutSeries.some((n) => toNum(n, 0) > 0);
    return hasKpi || hasProceso || hasLine || hasDonut;
  }, [kpis, procesoAgentes, safeLineData, safeDonutSeries]);

  const safeProcesoAgentes = useMemo(() => {
    return Array.isArray(procesoAgentes) ? procesoAgentes : [];
  }, [procesoAgentes]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1e1c]">
            Dashboard: {agenteNombre || "Agente"}
          </h2>
          <p className="text-xs text-black/60">
            KPIs y evolución de tareas según filtros seleccionados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setGuideOpen(true)}
            className="text-xs px-3 py-1.5 rounded-full border border-black/10 bg-white hover:border-[#af9150] flex items-center gap-2"
            aria-haspopup="dialog"
          >
            <span>Guía</span>
            <span className="text-black/40">ℹ</span>
          </button>
        </div>
      </div>

      {!hasAnyData && (
        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-semibold text-[#1d1e1c]">Sin datos</div>
          <div className="text-xs text-black/60 mt-1">
            No hay tareas para el agente/período seleccionado o los filtros están dejando 0 resultados.
          </div>
        </div>
      )}

      <p className="text-xs text-black/60 mb-2">
        Estos KPIs resumen el estado del proceso; pasa el cursor sobre ℹ para ver una breve explicación.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
        <KpiCard label="Total" value={kpis.total} desc={KPI_DESCRIPTIONS.total} />
        <KpiCard
          label="Backlog"
          value={kpis.backlog}
          desc={KPI_DESCRIPTIONS.backlog}
          tone={kpis.backlog > 0 ? "warn" : "ok"}
        />
        <KpiCard
          label="Vencidas"
          value={kpis.venc}
          desc={KPI_DESCRIPTIONS.venc}
          tone={kpis.venc > 0 ? "bad" : "ok"}
        />
        <KpiCard
          label="Por vencer"
          value={kpis.porVencer}
          desc={KPI_DESCRIPTIONS.porVencer}
          tone={kpis.porVencer > 0 ? "warn" : "ok"}
        />
        <KpiCard label="Completadas" value={kpis.comp} desc={KPI_DESCRIPTIONS.comp} tone="ok" />
        <KpiCard
          label="% Cierre"
          value={kpis.cierrePct}
          desc={KPI_DESCRIPTIONS.cierrePct}
          format="percent"
          tone={kpis.cierrePct >= 70 ? "ok" : kpis.cierrePct >= 40 ? "warn" : "bad"}
        />
        <KpiCard
          label="Prom. cierre (días)"
          value={kpis.avgCierreDias}
          desc={KPI_DESCRIPTIONS.avgCierreDias}
          tone="ok"
        />
        <KpiCard
          label={`Riesgo (${kpis.riskLabel})`}
          value={kpis.riskScore}
          desc={KPI_DESCRIPTIONS.risk}
          tone={riesgoTone}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#1d1e1c] mb-2">Distribución</p>
          <ApexChart type="donut" height={300} series={safeDonutSeries as any} options={donutOptions as any} />
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#1d1e1c] mb-2">Evolución</p>
          <ApexChart type="line" height={300} series={safeLineData.series as any} options={lineOptions as any} />
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm overflow-auto">
        <p className="text-xs font-semibold text-[#1d1e1c] mb-2">Proceso general</p>

        <table className="w-full text-xs">
          <thead>
            <tr className="text-black/60">
              <th className="text-left py-2">Agente</th>
              <th className="text-center py-2">Backlog</th>
              <th className="text-center py-2">Vencidas</th>
              <th className="text-center py-2">Por vencer</th>
              <th className="text-center py-2">Próximo venc.</th>
              <th className="text-center py-2">Estado</th>
              <th className="text-right py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {safeProcesoAgentes.map((r) => (
              <tr key={r.trabajadorId} className="border-t border-black/5">
                <td className="py-2">
                  <div className="font-semibold text-[#1d1e1c]">{r.nombre}</div>
                  <div className="text-[11px] text-black/50">{r.email}</div>
                </td>

                <td className="text-center font-semibold">{toNum(r.pendientes, 0)}</td>
                <td className="text-center font-semibold">{toNum(r.vencidas, 0)}</td>
                <td className="text-center">{toNum(r.porVencer ?? 0, 0)}</td>
                <td className="text-center">{r.proximoVenc ?? "-"}</td>

                <td className="text-center">
                  <span className="px-2 py-1 rounded-full text-[11px] border border-black/10 bg-slate-50">
                    {r.estadoProceso ?? "-"}
                  </span>
                </td>

                <td className="text-right">
                  <button
                    onClick={() => onOpenDetalle(r.trabajadorId)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold border border-black/10 bg-white hover:border-[#af9150]"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!safeProcesoAgentes.length && (
          <p className="text-xs text-black/50 mt-2">Sin datos para el agente/período.</p>
        )}
      </div>

      <KpiGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} items={KPI_DESCRIPTIONS} />
    </div>
  );
};

export default DashboardView;
