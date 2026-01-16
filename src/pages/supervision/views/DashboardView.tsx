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

  // en esta tabla usaremos "pendientes" como backlog ya calculado
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

const formatNumber = (n: number) => new Intl.NumberFormat("es-ES").format(n);
const formatPercent = (n: number) => `${n}%`;

const KpiCard: React.FC<{
  label: string;
  value: number;
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

  const display = format === "percent" ? formatPercent(value) : formatNumber(value);

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
  const lineOptions = useMemo(
    () => ({
      chart: { toolbar: { show: false } },
      xaxis: { categories: lineData.categories },
      stroke: { width: 2, curve: "smooth" as const },
      legend: { position: "bottom" as const },
      dataLabels: { enabled: false },
    }),
    [lineData.categories]
  );

  const riesgoTone: "ok" | "warn" | "bad" =
    globalKpis.riskLabel === "Crítico" ? "bad" : globalKpis.riskLabel === "Riesgo" ? "warn" : "ok";

  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1e1c]">
            Dashboard: {agenteNombre || "Agente"}
          </h2>
          <p className="text-xs text-black/60">KPIs y evolución de tareas según filtros seleccionados.</p>
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

      {/* KPIs claros */}
      <p className="text-xs text-black/60 mb-2">Estos KPIs resumen el estado del proceso; pasa el cursor sobre ℹ para ver una breve explicación.</p>
      <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
        <KpiCard label="Total" value={globalKpis.total} desc={KPI_DESCRIPTIONS.total} />
        <KpiCard label="Backlog" value={globalKpis.backlog} desc={KPI_DESCRIPTIONS.backlog} tone={globalKpis.backlog > 0 ? "warn" : "ok"} />
        <KpiCard label="Vencidas" value={globalKpis.venc} desc={KPI_DESCRIPTIONS.venc} tone={globalKpis.venc > 0 ? "bad" : "ok"} />
        <KpiCard label="Por vencer" value={globalKpis.porVencer} desc={KPI_DESCRIPTIONS.porVencer} tone={globalKpis.porVencer > 0 ? "warn" : "ok"} />
        <KpiCard label="Completadas" value={globalKpis.comp} desc={KPI_DESCRIPTIONS.comp} tone="ok" />
        <KpiCard
          label="% Cierre"
          value={globalKpis.cierrePct}
          desc={KPI_DESCRIPTIONS.cierrePct}
          format="percent"
          tone={globalKpis.cierrePct >= 70 ? "ok" : globalKpis.cierrePct >= 40 ? "warn" : "bad"}
        />
        <KpiCard label="Prom. cierre (días)" value={globalKpis.avgCierreDias} desc={KPI_DESCRIPTIONS.avgCierreDias} tone="ok" />
        <KpiCard label={`Riesgo (${globalKpis.riskLabel})`} value={globalKpis.riskScore} desc={KPI_DESCRIPTIONS.risk} tone={riesgoTone} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#1d1e1c] mb-2">Distribución</p>
          <ApexChart type="donut" height={300} series={donutSeries as any} options={donutOptions as any} />
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-[#1d1e1c] mb-2">Evolución</p>
          <ApexChart type="line" height={300} series={lineData.series as any} options={lineOptions as any} />
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
            {procesoAgentes.map((r) => (
              <tr key={r.trabajadorId} className="border-t border-black/5">
                <td className="py-2">
                  <div className="font-semibold text-[#1d1e1c]">{r.nombre}</div>
                  <div className="text-[11px] text-black/50">{r.email}</div>
                </td>

                <td className="text-center font-semibold">{r.pendientes}</td>
                <td className="text-center font-semibold">{r.vencidas}</td>
                <td className="text-center">{r.porVencer ?? 0}</td>
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

        {!procesoAgentes.length && <p className="text-xs text-black/50 mt-2">Sin datos para el agente/periodo.</p>}
      </div>

      <KpiGuideModal open={guideOpen} onClose={() => setGuideOpen(false)} items={KPI_DESCRIPTIONS} />
    </div>
  );
};

export default DashboardView;
