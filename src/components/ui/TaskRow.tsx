import React from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const Chip: React.FC<{
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
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[var(--text-mini)] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
};

export default function TaskRow({
  idx,
  title,
  owner,
  status,
  due,
}: {
  idx: number;
  title: string;
  owner: string;
  status: "En curso" | "Completada" | "Bloqueada";
  due: string;
}) {
  const tone =
    status === "Completada" ? "success" : status === "Bloqueada" ? "danger" : "warning";

  const Icon =
    status === "Completada" ? CheckCircle2 : status === "Bloqueada" ? AlertTriangle : Clock;

  return (
    <tr className="border-b last:border-b-0">
      <td className="py-3 px-3 text-black/70">#{idx.toString().padStart(3, "0")}</td>
      <td className="py-3 px-3">
        <div className="font-medium" style={{ color: "var(--primary-color)" }}>{title}</div>
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
}
