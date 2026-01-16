// src/pages/supervision/views/ComparativaView.tsx
import React, { useMemo, useState } from "react";

type AgenteComparativa = {
  trabajadorId: number;
  nombre: string;
  email: string;

  pendientes: number;
  enProceso: number;
  vencidas: number;
  completadas: number;

  total: number;
  abiertas: number;
  cierre: number; // %
};

type RankMetric = "completadas" | "total" | "cierre" | "abiertas" | "vencidas" | "riesgo";

type Props = {
  loading?: boolean;

  comparativaAgentes: AgenteComparativa[];
  comparativaTotals: {
    totalAgentes: number;
    totalTareas: number;
    backlog: number;
    tasaGlobal: number;
    promedioCierre: number;
    top: AgenteComparativa | null;
  };
  comparativaStacked: {
    categories: string[];
    series: Array<{ name: string; data: number[] }>;
  };
  comparativaRendimiento: {
    categories: string[];
    data: number[];
  };

  onOpenAgenteDetalle?: (id: number) => void;
};

const StatCard: React.FC<{
  label: string;
  value: string | number;
  tone?: "ok" | "warn" | "bad" | "neutral";
}> = ({ label, value, tone = "neutral" }) => {
  const cls =
    tone === "bad"
      ? "bg-rose-50 border-rose-100"
      : tone === "warn"
      ? "bg-amber-50 border-amber-100"
      : tone === "ok"
      ? "bg-emerald-50 border-emerald-100"
      : "bg-[#f5f4f0] border-black/5";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="text-xs text-black/60">{label}</div>
      <div className="text-2xl font-semibold text-[#1d1e1c]">{value}</div>
    </div>
  );
};

const TableBadge: React.FC<{ value: number; kind?: "venc" | "comp" | "neutral" }> = ({
  value,
  kind = "neutral",
}) => {
  const cls =
    kind === "venc"
      ? "bg-rose-50 text-rose-700 border-rose-100"
      : kind === "comp"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-slate-50 text-slate-700 border-slate-100";
  return <span className={`px-2 py-1 rounded-full text-[11px] border ${cls}`}>{value}</span>;
};

const SkeletonRow: React.FC = () => (
  <tr className="border-t border-black/5">
    <td className="py-3 px-4">
      <div className="h-3 w-40 bg-black/10 rounded animate-pulse" />
      <div className="h-3 w-28 bg-black/5 rounded mt-2 animate-pulse" />
    </td>
    <td className="py-3 text-center">
      <div className="h-6 w-10 bg-black/10 rounded-full mx-auto animate-pulse" />
    </td>
    <td className="py-3 text-center">
      <div className="h-6 w-10 bg-black/10 rounded-full mx-auto animate-pulse" />
    </td>
    <td className="py-3 text-center">
      <div className="h-6 w-10 bg-black/10 rounded-full mx-auto animate-pulse" />
    </td>
    <td className="py-3 text-center">
      <div className="h-6 w-10 bg-black/10 rounded-full mx-auto animate-pulse" />
    </td>
    <td className="py-3 text-center">
      <div className="h-6 w-10 bg-black/10 rounded-full mx-auto animate-pulse" />
    </td>
    <td className="py-3 text-center">
      <div className="h-6 w-16 bg-black/10 rounded-full mx-auto animate-pulse" />
    </td>
    <td className="py-3 text-center">
      <div className="h-8 w-20 bg-black/10 rounded-full mx-auto animate-pulse" />
    </td>
  </tr>
);

const ComparativaView: React.FC<Props> = ({
  loading = false,
  comparativaAgentes,
  comparativaTotals,
  comparativaStacked,
  comparativaRendimiento,
  onOpenAgenteDetalle,
}) => {
  const ranking = useMemo(() => {
    return comparativaAgentes
      .slice()
      .sort((a, b) => b.cierre - a.cierre || b.total - a.total || a.nombre.localeCompare(b.nombre));
  }, [comparativaAgentes]);

  const topLabel = comparativaTotals.top
    ? `${comparativaTotals.top.nombre} (${comparativaTotals.top.cierre}%)`
    : "-";

  const [rankMetric, setRankMetric] = useState<RankMetric>("completadas");
  const [topN, setTopN] = useState(10);

  const metricLabel =
    rankMetric === "completadas"
      ? "Más completadas"
      : rankMetric === "total"
      ? "Más tareas"
      : rankMetric === "cierre"
      ? "Mejor % cierre"
      : rankMetric === "abiertas"
      ? "Más backlog"
      : rankMetric === "vencidas"
      ? "Más vencidas"
      : "Más riesgo";

  const metricValue = (a: AgenteComparativa, m: RankMetric) => {
    switch (m) {
      case "completadas":
        return a.completadas;
      case "total":
        return a.total;
      case "cierre":
        return a.cierre;
      case "abiertas":
        return a.abiertas;
      case "vencidas":
        return a.vencidas;
      case "riesgo":
        return a.vencidas * 2 + a.abiertas; // simple y entendible
      default:
        return 0;
    }
  };

  const rankingByMetric = useMemo(() => {
    const arr = comparativaAgentes.slice();

    arr.sort((a, b) => {
      const av = metricValue(a, rankMetric);
      const bv = metricValue(b, rankMetric);
      if (rankMetric === "cierre") return bv - av || b.total - a.total;
      return bv - av || b.total - a.total;
    });

    return arr.slice(0, topN);
  }, [comparativaAgentes, rankMetric, topN]);

  const canOpenDetalle = typeof onOpenAgenteDetalle === "function";

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#1d1e1c]">Comparativa</h2>
        <p className="text-xs text-black/60">
          Resumen global por agente (usa el periodo seleccionado). {loading ? "Cargando datos..." : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Agentes" value={comparativaTotals.totalAgentes} />
        <StatCard label="Tareas" value={comparativaTotals.totalTareas} />
        <StatCard
          label="Backlog (abiertas)"
          value={comparativaTotals.backlog}
          tone={comparativaTotals.backlog > 0 ? "warn" : "ok"}
        />
        <StatCard
          label="Tasa global cierre"
          value={`${comparativaTotals.tasaGlobal}%`}
          tone={comparativaTotals.tasaGlobal >= 70 ? "ok" : comparativaTotals.tasaGlobal >= 40 ? "warn" : "bad"}
        />
        <StatCard label="Top cierre" value={topLabel} />
      </div>

      <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold text-[#1d1e1c]">Datasets listos para gráficos</div>
            <div className="text-[11px] text-black/60">
              Stacked: {comparativaStacked.series.length} series · Rendimiento:{" "}
              {comparativaRendimiento.data.length} valores
            </div>
          </div>
          <div className="text-[11px] text-black/50">(Si ya usas ApexCharts/Recharts, lo conectamos rápido)</div>
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold text-[#1d1e1c]">Ranking (Top)</div>
            <div className="text-[11px] text-black/60">
              Top {topN} · {metricLabel}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              className="text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150]"
              value={rankMetric}
              onChange={(e) => setRankMetric(e.target.value as RankMetric)}
            >
              <option value="completadas">Más completadas</option>
              <option value="total">Más tareas</option>
              <option value="cierre">Mejor % cierre</option>
              <option value="abiertas">Más backlog</option>
              <option value="vencidas">Más vencidas</option>
              <option value="riesgo">Más riesgo</option>
            </select>

            <select
              className="text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150]"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
            >
              {[5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-black/60">
                <th className="text-left px-4 py-3">Agente</th>
                <th className="text-center px-3 py-3">Total</th>
                <th className="text-center px-3 py-3">Abiertas</th>
                <th className="text-center px-3 py-3">Venc</th>
                <th className="text-center px-3 py-3">Comp</th>
                <th className="text-center px-3 py-3">Cierre</th>
                <th className="text-center px-4 py-3">Métrica</th>
                <th className="text-center px-4 py-3">Acción</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <>
                  {Array.from({ length: Math.min(6, topN) }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </>
              ) : (
                rankingByMetric.map((a) => (
                  <tr key={a.trabajadorId} className="border-t border-black/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1d1e1c]">{a.nombre}</div>
                      <div className="text-[11px] text-black/50">{a.email}</div>
                    </td>

                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.total} />
                    </td>
                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.abiertas} />
                    </td>
                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.vencidas} kind="venc" />
                    </td>
                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.completadas} kind="comp" />
                    </td>

                    <td className="text-center px-3 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] border ${
                          a.cierre >= 70
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : a.cierre >= 40
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}
                      >
                        {a.cierre}%
                      </span>
                    </td>

                    <td className="text-center px-4 py-3 font-semibold text-[#1d1e1c]">
                      {rankMetric === "cierre" ? `${a.cierre}%` : String(metricValue(a, rankMetric))}
                    </td>

                    <td className="text-center px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenAgenteDetalle?.(a.trabajadorId)}
                        disabled={!canOpenDetalle}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                          canOpenDetalle
                            ? "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
                            : "bg-slate-50 text-black/40 border-black/5 cursor-not-allowed"
                        }`}
                        title={canOpenDetalle ? "Abrir detalle del agente" : "Acción no disponible"}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && rankingByMetric.length === 0 && (
            <div className="p-4 text-xs text-black/60">No hay datos para el periodo seleccionado.</div>
          )}
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5">
          <div className="text-xs font-semibold text-[#1d1e1c]">Comparativa detallada</div>
          <div className="text-[11px] text-black/60">Ordenado por % cierre (y total como desempate)</div>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-black/60">
                <th className="text-left px-4 py-3">Agente</th>
                <th className="text-center px-3 py-3">Pend</th>
                <th className="text-center px-3 py-3">Proc</th>
                <th className="text-center px-3 py-3">Venc</th>
                <th className="text-center px-3 py-3">Comp</th>
                <th className="text-center px-3 py-3">Total</th>
                <th className="text-center px-4 py-3">Cierre</th>
                <th className="text-center px-4 py-3">Acción</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonRow key={i} />
                  ))}
                </>
              ) : (
                ranking.map((a) => (
                  <tr key={a.trabajadorId} className="border-t border-black/5">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1d1e1c]">{a.nombre}</div>
                      <div className="text-[11px] text-black/50">{a.email}</div>
                    </td>

                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.pendientes} />
                    </td>
                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.enProceso} />
                    </td>
                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.vencidas} kind="venc" />
                    </td>
                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.completadas} kind="comp" />
                    </td>
                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.total} />
                    </td>
                    <td className="text-center px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-[11px] border ${
                          a.cierre >= 70
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : a.cierre >= 40
                            ? "bg-amber-50 text-amber-700 border-amber-100"
                            : "bg-rose-50 text-rose-700 border-rose-100"
                        }`}
                      >
                        {a.cierre}%
                      </span>
                    </td>

                    <td className="text-center px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenAgenteDetalle?.(a.trabajadorId)}
                        disabled={!canOpenDetalle}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition ${
                          canOpenDetalle
                            ? "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
                            : "bg-slate-50 text-black/40 border-black/5 cursor-not-allowed"
                        }`}
                        title={canOpenDetalle ? "Abrir detalle del agente" : "Acción no disponible"}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {!loading && ranking.length === 0 && (
            <div className="p-4 text-xs text-black/60">No hay datos para el periodo seleccionado.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparativaView;
