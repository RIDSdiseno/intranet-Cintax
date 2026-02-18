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
  hint?: string;
  tone?: "ok" | "warn" | "bad" | "neutral";
}> = ({ label, value, hint, tone = "neutral" }) => {
  const cls =
    tone === "bad"
      ? "bg-rose-50 border-rose-100"
      : tone === "warn"
      ? "bg-amber-50 border-amber-100"
      : tone === "ok"
      ? "bg-emerald-50 border-emerald-100"
      : "bg-white border-black/10";

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cls}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-black/50">{label}</div>
          <div className="text-2xl font-semibold text-[#1d1e1c] leading-tight">{value}</div>
          {hint ? <div className="text-[11px] text-black/50 mt-1">{hint}</div> : null}
        </div>
      </div>
    </div>
  );
};

const TableBadge: React.FC<{
  value: number | string;
  kind?: "venc" | "comp" | "warn" | "neutral";
}> = ({ value, kind = "neutral" }) => {
  const cls =
    kind === "venc"
      ? "bg-rose-50 text-rose-700 border-rose-100"
      : kind === "comp"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : kind === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : "bg-slate-50 text-slate-700 border-slate-100";
  return <span className={`px-2 py-1 rounded-full text-[11px] border ${cls}`}>{value}</span>;
};

const ProgressPill: React.FC<{ pct: number }> = ({ pct }) => {
  const tone =
    pct >= 70 ? "bg-emerald-100 text-emerald-800" : pct >= 40 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";

  return (
    <div className="inline-flex items-center gap-2">
      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${tone}`}>{pct}%</span>
      <div className="w-24 h-2 rounded-full bg-black/5 overflow-hidden">
        <div className="h-full bg-black/30" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
};

const SkeletonRow: React.FC<{ compact?: boolean }> = ({ compact }) => (
  <tr className="border-t border-black/5">
    <td className={`py-3 px-4 ${compact ? "w-[360px]" : ""}`}>
      <div className="h-3 w-44 bg-black/10 rounded animate-pulse" />
      <div className="h-3 w-28 bg-black/5 rounded mt-2 animate-pulse" />
    </td>
    {Array.from({ length: 6 }).map((_, i) => (
      <td key={i} className="py-3 text-center">
        <div className="h-6 w-10 bg-black/10 rounded-full mx-auto animate-pulse" />
      </td>
    ))}
    <td className="py-3 text-center">
      <div className="h-8 w-20 bg-black/10 rounded-full mx-auto animate-pulse" />
    </td>
  </tr>
);

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const ComparativaView: React.FC<Props> = ({
  loading = false,

  comparativaAgentes = [],
  comparativaTotals = {
    totalAgentes: 0,
    totalTareas: 0,
    backlog: 0,
    tasaGlobal: 0,
    promedioCierre: 0,
    top: null,
  },
  comparativaStacked = { categories: [], series: [] },
  comparativaRendimiento = { categories: [], data: [] },

  onOpenAgenteDetalle,
}) => {
  const [rankMetric, setRankMetric] = useState<RankMetric>("completadas");
  const [topN, setTopN] = useState(10);
  const [q, setQ] = useState("");

  const canOpenDetalle = typeof onOpenAgenteDetalle === "function";

  const topLabel = comparativaTotals.top
    ? `${comparativaTotals.top.nombre} (${comparativaTotals.top.cierre}%)`
    : "-";

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
        return a.vencidas * 2 + a.abiertas;
      default:
        return 0;
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return comparativaAgentes || [];
    return (comparativaAgentes || []).filter((a) => {
      const s = `${a.nombre} ${a.email}`.toLowerCase();
      return s.includes(term);
    });
  }, [comparativaAgentes, q]);

  const rankingByMetric = useMemo(() => {
    const arr = (filtered || []).slice();

    arr.sort((a, b) => {
      const av = metricValue(a, rankMetric);
      const bv = metricValue(b, rankMetric);
      if (rankMetric === "cierre") return bv - av || b.total - a.total || a.nombre.localeCompare(b.nombre);
      return bv - av || b.total - a.total || a.nombre.localeCompare(b.nombre);
    });

    return arr.slice(0, topN);
  }, [filtered, rankMetric, topN]);

  const rankingByCierre = useMemo(() => {
    return (filtered || [])
      .slice()
      .sort((a, b) => b.cierre - a.cierre || b.total - a.total || a.nombre.localeCompare(b.nombre));
  }, [filtered]);

  const stackedSeriesLen = comparativaStacked?.series?.length ?? 0;
  const rendimientoLen = comparativaRendimiento?.data?.length ?? 0;

  const saludTone =
    comparativaTotals.tasaGlobal >= 70 ? "ok" : comparativaTotals.tasaGlobal >= 40 ? "warn" : "bad";

  // quick deltas for first table: simple “who is best” helper
  const bestInMetric = useMemo(() => {
    const arr = (filtered || []).slice();
    if (arr.length === 0) return null;
    arr.sort((a, b) => metricValue(b, rankMetric) - metricValue(a, rankMetric));
    return arr[0];
  }, [filtered, rankMetric]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-[#1d1e1c]">Comparativa</h2>
            <p className="text-xs text-black/60 mt-1">
              Resumen global por agente (usa el periodo seleccionado).{" "}
              {loading ? <span className="text-black/50">Cargando datos…</span> : null}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar agente (nombre o email)…"
              className="w-full md:w-72 text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150]"
            />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Agentes" value={comparativaTotals.totalAgentes} hint="Activos en el periodo" />
        <StatCard label="Tareas" value={comparativaTotals.totalTareas} hint="Total agregadas" />
        <StatCard
          label="Backlog"
          value={comparativaTotals.backlog}
          hint="Pendientes + en proceso"
          tone={comparativaTotals.backlog > 0 ? "warn" : "ok"}
        />
        <StatCard
          label="Cierre global"
          value={`${comparativaTotals.tasaGlobal}%`}
          hint="Completadas / total"
          tone={saludTone}
        />
        <StatCard label="Top cierre" value={topLabel} hint="Mejor % cierre" tone="neutral" />
      </div>

      {/* Datasets info */}
      <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold text-[#1d1e1c]">Datos listos para gráficos</div>
            <div className="text-[11px] text-black/60">
              Stacked: {stackedSeriesLen} series · Rendimiento: {rendimientoLen} valores
            </div>
          </div>
          <div className="text-[11px] text-black/50">
            (Si usas ApexCharts/Recharts, conecto estos datasets directo)
          </div>
        </div>
      </div>

      {/* Ranking Top */}
      <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold text-[#1d1e1c]">Ranking</div>
            <div className="text-[11px] text-black/60">
              Top {topN} · {metricLabel}
              {bestInMetric ? (
                <span className="text-black/50">
                  {" "}
                  · líder: <span className="font-semibold text-[#1d1e1c]">{bestInMetric.nombre}</span>
                </span>
              ) : null}
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
                <th className="text-center px-3 py-3">Backlog</th>
                <th className="text-center px-3 py-3">Venc</th>
                <th className="text-center px-3 py-3">Comp</th>
                <th className="text-center px-3 py-3">% Cierre</th>
                <th className="text-center px-4 py-3">Métrica</th>
                <th className="text-center px-4 py-3">Acción</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <>
                  {Array.from({ length: Math.min(6, topN) }).map((_, i) => (
                    <SkeletonRow key={i} compact />
                  ))}
                </>
              ) : (
                rankingByMetric.map((a, idx) => {
                  const metric = metricValue(a, rankMetric);
                  const metricKind =
                    rankMetric === "vencidas" || rankMetric === "riesgo"
                      ? "venc"
                      : rankMetric === "completadas"
                      ? "comp"
                      : rankMetric === "abiertas"
                      ? "warn"
                      : "neutral";

                  return (
                    <tr key={a.trabajadorId} className="border-t border-black/5 hover:bg-black/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-black/40 w-6 text-right">{idx + 1}.</span>
                          <div className="min-w-0">
                            <div className="font-semibold text-[#1d1e1c] truncate">{a.nombre}</div>
                            <div className="text-[11px] text-black/50 truncate">{a.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="text-center px-3 py-3">
                        <TableBadge value={a.total} />
                      </td>
                      <td className="text-center px-3 py-3">
                        <TableBadge value={a.abiertas} kind="warn" />
                      </td>
                      <td className="text-center px-3 py-3">
                        <TableBadge value={a.vencidas} kind="venc" />
                      </td>
                      <td className="text-center px-3 py-3">
                        <TableBadge value={a.completadas} kind="comp" />
                      </td>

                      <td className="text-center px-3 py-3">
                        <ProgressPill pct={clamp(a.cierre, 0, 100)} />
                      </td>

                      <td className="text-center px-4 py-3">
                        <TableBadge value={rankMetric === "cierre" ? `${a.cierre}%` : metric} kind={metricKind as any} />
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
                  );
                })
              )}
            </tbody>
          </table>

          {!loading && rankingByMetric.length === 0 && (
            <div className="p-4 text-xs text-black/60">No hay datos para el periodo seleccionado.</div>
          )}
        </div>
      </div>

      {/* Tabla completa */}
      <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold text-[#1d1e1c]">Comparativa detallada</div>
            <div className="text-[11px] text-black/60">Ordenado por % cierre (y total como desempate)</div>
          </div>

          <div className="text-[11px] text-black/50">
            Mostrando: <span className="font-semibold text-[#1d1e1c]">{filtered.length}</span>
          </div>
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
                <th className="text-center px-4 py-3">% Cierre</th>
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
                rankingByCierre.map((a) => (
                  <tr key={a.trabajadorId} className="border-t border-black/5 hover:bg-black/[0.02]">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#1d1e1c]">{a.nombre}</div>
                      <div className="text-[11px] text-black/50">{a.email}</div>
                    </td>

                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.pendientes} />
                    </td>
                    <td className="text-center px-3 py-3">
                      <TableBadge value={a.enProceso} kind="warn" />
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
                      <ProgressPill pct={clamp(a.cierre, 0, 100)} />
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

          {!loading && rankingByCierre.length === 0 && (
            <div className="p-4 text-xs text-black/60">No hay datos para el periodo seleccionado.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComparativaView;
