import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { SlaMetric, TicketsSummary } from "../types";

const STORAGE_KEY = "tickets.summary.collapsed";

function leerColapsado(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function guardarColapsado(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // sin storage: solo se pierde la preferencia
  }
}

function formatNumber(n: number) {
  return n.toLocaleString("es-CL");
}

function formatDuracion(minutes: number | null) {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const totalHours = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (totalHours < 48) return `${totalHours}h ${m}m`;
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  return `${d}d ${h}h`;
}

/** Rojo < 70%, ambar < 90%, verde >= 90%. */
function slaTone(percent: number | null) {
  if (percent === null) return { text: "text-black/40", bar: "bg-black/20" };
  if (percent < 70) return { text: "text-rose-600", bar: "bg-rose-500" };
  if (percent < 90) return { text: "text-amber-600", bar: "bg-amber-500" };
  return { text: "text-emerald-600", bar: "bg-emerald-500" };
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: string;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm text-black/60">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${tone ?? "text-black/85"}`}>
          {formatNumber(value)}
        </p>
      </div>
      <Icon size={18} className="text-black/45" />
    </div>
  );
}

function SlaCard({
  label,
  metric,
  icon: Icon,
}: {
  label: string;
  metric: SlaMetric;
  icon: LucideIcon;
}) {
  const tone = slaTone(metric.percent);
  const width = metric.percent ?? 0;

  return (
    <div
      className="rounded-xl border border-black/10 bg-white p-4 shadow-sm"
      title={`Plazo objetivo: ${metric.targetHours}h`}
    >
      <div className="flex items-start justify-between">
        <p className="text-xs text-black/60">{label}</p>
        <Icon size={18} className="text-black/45" />
      </div>
      <p className={`mt-1 text-3xl font-bold ${tone.text}`}>
        {metric.percent === null ? "—" : `${metric.percent}%`}
      </p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10">
        <div
          className={`h-full rounded-full ${tone.bar} transition-all`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-black/50">
        {formatNumber(metric.evaluated)} tickets evaluados
      </p>
      <p className="text-[11px] font-semibold text-black/75">
        {formatNumber(metric.breached)} vencidos · {formatNumber(metric.pending)} pendientes
      </p>
      <p className="text-[11px] text-black/50">
        Promedio:{" "}
        <span className="font-semibold text-black/75">
          {formatDuracion(metric.avgMinutes)}
        </span>
      </p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs text-black/70">
      {children}
    </span>
  );
}

export default function TicketsSummaryPanel({
  summary,
  loading,
}: {
  summary: TicketsSummary | null;
  loading?: boolean;
}) {
  const [collapsed, setCollapsed] = React.useState<boolean>(leerColapsado);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      guardarColapsado(next);
      return next;
    });
  };

  const pct = (m?: SlaMetric) =>
    m?.percent === null || m?.percent === undefined ? "—" : `${m.percent}%`;

  return (
    <section className="mb-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm transition hover:border-black/20"
        >
          {collapsed ? "Mostrar resumen" : "Ocultar resumen"}
        </button>

        {collapsed && summary && (
          <div className="flex flex-wrap items-center gap-2">
            <Chip>Total: {formatNumber(summary.total)}</Chip>
            <Chip>Abiertos: {formatNumber(summary.abiertos)}</Chip>
            <Chip>Cerrados: {formatNumber(summary.cerrados)}</Chip>
            <Chip>Urgentes: {formatNumber(summary.urgentes)}</Chip>
            <Chip>SLA global 1ra resp: {pct(summary.slaFirstResponse)}</Chip>
            <Chip>SLA global cierre: {pct(summary.slaResolution)}</Chip>
          </div>
        )}
      </div>

      {!collapsed &&
        (loading && !summary ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-black/5" />
            ))}
          </div>
        ) : summary ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Total" value={summary.total} icon={MessageCircle} />
              <StatCard label="Abiertos" value={summary.abiertos} icon={Clock} />
              <StatCard label="Cerrados" value={summary.cerrados} icon={CheckCircle2} />
              <StatCard
                label="Urgentes"
                value={summary.urgentes}
                icon={AlertCircle}
                tone={summary.urgentes > 0 ? "text-rose-600" : undefined}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SlaCard
                label="SLA global 1ra respuesta"
                metric={summary.slaFirstResponse}
                icon={Clock}
              />
              <SlaCard
                label="SLA global cierre"
                metric={summary.slaResolution}
                icon={CheckCircle2}
              />
            </div>
          </div>
        ) : null)}
    </section>
  );
}
