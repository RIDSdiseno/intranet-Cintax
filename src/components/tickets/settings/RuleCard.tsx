import React from "react";
import { MoreHorizontal } from "lucide-react";
import type { TicketSettingsRule } from "../../../features/tickets/settings/mocks";
import Dropdown from "./Dropdown";
import Toggle from "./Toggle";

function formatDate(isoDate: string) {
  const value = new Date(isoDate);
  if (Number.isNaN(value.getTime())) return "Sin fecha";

  return value.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type RuleCardProps = {
  index: number;
  rule: TicketSettingsRule;
  onToggle: (next: boolean) => void;
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
          <p className="mt-1 line-clamp-2 text-sm text-black/60">{rule.description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Toggle
            checked={rule.enabled}
            onChange={onToggle}
            ariaLabel={`Activar o desactivar regla ${rule.name}`}
          />

          <Dropdown
            triggerLabel="Acciones de regla"
            triggerContent={<MoreHorizontal size={16} />}
            hideChevron
            align="right"
            menuClassName="w-44"
            triggerClassName="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-black/70 hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
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
          <p className="mt-1">{formatDate(rule.updatedAt)}</p>
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
