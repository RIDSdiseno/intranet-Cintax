import { AlertTriangle } from "lucide-react";
import React from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45" onClick={onCancel} />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-xl">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <AlertTriangle size={16} />
        </div>

        <h3 className="text-base font-semibold text-[var(--primary-color)]">{title}</h3>
        <p className="mt-2 text-sm text-black/65">{description}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/70 hover:border-black/20"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2 text-sm text-white shadow-sm ${
              variant === "danger"
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-[var(--primary-color)] hover:opacity-95"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
