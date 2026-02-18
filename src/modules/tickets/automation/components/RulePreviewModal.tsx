import React, { useEffect } from "react";
import type { AutomationRuleDraft } from "../types/automation";

type RulePreviewModalProps = {
  open: boolean;
  draft: AutomationRuleDraft;
  onClose: () => void;
  onSave: () => void;
};

export default function RulePreviewModal({
  open,
  draft,
  onClose,
  onSave,
}: RulePreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-black/10 bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-[var(--primary-color)]">Vista previa de regla</h3>

        <div className="mt-4 grid gap-4 text-sm">
          <div>
            <p className="text-black/40">Nombre</p>
            <p className="font-medium text-black/80">{draft.name || "--"}</p>
          </div>

          <div>
            <p className="text-black/40">Tab</p>
            <p className="font-medium text-black/80">{draft.tab}</p>
          </div>

          <div>
            <p className="text-black/40">Evento</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-black/75">
              <li>Actor: {draft.event.actor}</li>
              {draft.event.triggers.map((trigger) => (
                <li key={trigger.id}>
                  {trigger.type}
                  {trigger.value ? `: ${trigger.value}` : ""}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-black/40">Condiciones ({draft.conditions.operator})</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-black/75">
              {draft.conditions.items.map((item) => (
                <li key={item.id}>
                  {item.scope} / {item.field} / {item.comparator} / "{item.value}"
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-black/40">Acciones</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-black/75">
              {draft.actions.items.map((action) => (
                <li key={action.id}>
                  {action.type}{" "}
                  {Object.keys(action.params).length > 0
                    ? `- ${Object.entries(action.params)
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(", ")}`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/70 hover:border-black/20"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-[var(--primary-color)] px-4 py-2 text-sm text-white shadow-sm hover:opacity-95"
          >
            Guardar regla
          </button>
        </div>
      </div>
    </div>
  );
}

