import React from "react";
import { MoreVertical } from "lucide-react";
import AccessibleDropdown from "./AccessibleDropdown";
import type { AutomationRule } from "../types/automation";

function formatRelative(isoDate: string) {
  const value = new Date(isoDate).getTime();
  if (Number.isNaN(value)) return "fecha invalida";

  const diffMs = Date.now() - value;
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `hace ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `hace ${months} meses`;
  const years = Math.floor(months / 12);
  return `hace ${years} anios`;
}

function Switch({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30 ${
        checked ? "bg-emerald-500" : "bg-black/15"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
          checked ? "translate-x-5" : "translate-x-1"
        }`}
      />
    </button>
  );
}

type RuleCardProps = {
  index: number;
  rule: AutomationRule;
  onToggle: () => void;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
};

export default function RuleCard({
  index,
  rule,
  onToggle,
  onEdit,
  onClone,
  onDelete,
}: RuleCardProps) {
  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-[var(--primary-color)]">
            {index + 1}. {rule.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-black/60">
            {rule.description || "Sin descripcion"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch checked={rule.enabled} onToggle={onToggle} />
          <AccessibleDropdown
            triggerLabel="Acciones de regla"
            align="right"
            hideChevron
            triggerContent={<MoreVertical size={16} />}
            triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-black/70 hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            menuClassName="w-44"
            items={[
              { id: "edit", label: "Editar", onSelect: onEdit },
              { id: "clone", label: "Clonar", onSelect: onClone },
              { id: "delete", label: "Eliminar", danger: true, onSelect: onDelete },
            ]}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2 border-t border-black/10 pt-3 text-xs text-black/55 sm:grid-cols-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-black/40">Ultima modificacion</p>
          <p className="mt-1">{formatRelative(rule.updatedAt)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-black/40">Por</p>
          <p className="mt-1">{rule.updatedBy}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-black/40">
            Tickets impactados (ultimos 7 dias)
          </p>
          <p className="mt-1">{rule.impactedLast7Days}</p>
        </div>
      </div>
    </article>
  );
}

