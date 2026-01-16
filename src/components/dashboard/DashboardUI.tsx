import React from "react";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export const Chip: React.FC<{
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}> = ({ children, tone = "neutral" }) => {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--tertiary-color)] text-[var(--primary-color)]",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[var(--text-mini)] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

export const KpiCard: React.FC<{
  title: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
}> = ({ title, value, helper, icon }) => (
  <div className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-lg">
    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#af9150]/10 blur-2xl transition-all group-hover:bg-[#af9150]/20" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-black/50 tracking-wide">
          {title}
        </p>
        <h3
          className="mt-3 text-3xl font-bold"
          style={{ color: "var(--primary-color)" }}
        >
          {value}
        </h3>
      </div>
      <div className="rounded-xl bg-white/50 p-3 text-[#af9150] shadow-sm ring-1 ring-black/5 backdrop-blur-md">
        {icon}
      </div>
    </div>
    {helper && (
      <div className="mt-4 flex items-center gap-1 text-xs font-medium text-black/40">
        {helper}
      </div>
    )}
  </div>
);

export const TaskRow: React.FC<{
  idx: number;
  title: string;
  owner: string;
  status: "En curso" | "Completada" | "Bloqueada";
  due: string;
}> = ({ idx, title, owner, status, due }) => {
  const tone =
    status === "Completada"
      ? "success"
      : status === "Bloqueada"
      ? "danger"
      : "warning";

  const Icon =
    status === "Completada"
      ? CheckCircle2
      : status === "Bloqueada"
      ? AlertTriangle
      : Clock;

  return (
    <tr className="border-b last:border-b-0">
      <td className="py-3 px-3 text-black/70">
        #{idx.toString().padStart(3, "0")}
      </td>
      <td className="py-3 px-3">
        <div className="font-medium" style={{ color: "var(--primary-color)" }}>
          {title}
        </div>
        <div className="text-xs text-black/50">Responsable: {owner}</div>
      </td>
      <td className="py-3 px-3">
        <Chip tone={tone}>
          <Icon size={14} /> {status}
        </Chip>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="text-sm text-black/70">{due}</span>
      </td>
    </tr>
  );
};
