import { Loader2, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { TicketRow } from "../types";
import type { CreateTicketErrors, CreateTicketFormValues } from "../types/createTicket";
import { createTicket } from "../services/ticketsApi";
import { validateCreateTicket } from "../utils/validators";
import { esAdminOSoporte } from "../../../lib/auth";
import ConfirmDialog from "./ConfirmDialog";

type ToastTone = "success" | "error" | "warning";

type CreateTicketModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (ticket: TicketRow) => void;
  onNotify?: (tone: ToastTone, text: string) => void;
};

const INITIAL_FORM: CreateTicketFormValues = {
  subject: "",
  requesterEmail: "",
  area: "",
  type: "",
  priority: "",
  description: "",
  attachments: [],
};

function prioridadToNumero(
  value: CreateTicketFormValues["priority"]
): number | null {
  if (value === "Baja") return 1;
  if (value === "Media") return 2;
  if (value === "Alta") return 3;
  return null;
}

function areaToDetected(value: CreateTicketFormValues["area"]) {
  if (value === "Contabilidad") return "CONTABLE" as const;
  if (value === "Tributaria") return "TRIBUTARIA" as const;
  if (value === "Laboral") return "LABORAL" as const;
  return null;
}

export default function CreateTicketModal({
  open,
  onClose,
  onCreated,
  onNotify,
}: CreateTicketModalProps) {
  const [form, setForm] = useState<CreateTicketFormValues>(INITIAL_FORM);
  const [errors, setErrors] = useState<CreateTicketErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const isAdmin = esAdminOSoporte();

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setErrors({});
      setIsSubmitting(false);
      setShowDiscardConfirm(false);
      return;
    }
  }, [open]);

  const isDirty = useMemo(() => {
    return (
      form.subject.trim().length > 0 ||
      form.requesterEmail.trim().length > 0 ||
      Boolean(form.area) ||
      Boolean(form.type) ||
      Boolean(form.priority) ||
      form.description.trim().length > 0
    );
  }, [form]);

  const setField = <K extends keyof CreateTicketFormValues>(
    key: K,
    value: CreateTicketFormValues[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const closeNow = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setIsSubmitting(false);
    setShowDiscardConfirm(false);
    onClose();
  };

  const attemptClose = () => {
    if (isSubmitting) return;
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    closeNow();
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (!isAdmin) {
      onNotify?.("error", "Sin permisos para crear tickets.");
      return;
    }

    const nextErrors = validateCreateTicket(form);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      onNotify?.("error", "Revisa los campos obligatorios.");
      return;
    }

    try {
      setIsSubmitting(true);
      const areaDetected = areaToDetected(form.area);
      const prioridad = prioridadToNumero(form.priority);
      const categoria = form.type ? `${form.area} - ${form.type}` : form.area;

      const response = await createTicket({
        subject: form.subject.trim(),
        description: form.description.trim(),
        requesterEmail: form.requesterEmail.trim() || undefined,
        areaDetected: areaDetected ?? undefined,
        prioridad: prioridad ?? undefined,
        categoria: categoria || undefined,
      });

      if (!response.ok || !response.data) {
        onNotify?.("error", response.error || "No se pudo crear el ticket.");
        return;
      }

      onCreated?.(response.data);
      onNotify?.("success", `Ticket #${response.data.number} creado.`);
      closeNow();
    } catch (error) {
      console.error("Error creando ticket:", error);
      onNotify?.("error", "No se pudo crear el ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !isAdmin) return null;

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={attemptClose} />

        <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-black/10 bg-white shadow-xl">
          <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4">
            <div>
              <h3 className="text-xl font-semibold text-[var(--primary-color)]">Crear ticket</h3>
              <p className="mt-1 text-sm text-black/60">
                Crea una solicitud real en la ticketera Helpdesk.
              </p>
            </div>

            <button
              type="button"
              onClick={attemptClose}
              className="rounded-lg border border-black/10 p-2 text-black/60 hover:text-black"
              aria-label="Cerrar modal crear ticket"
            >
              <X size={16} />
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--primary-color)]">
                Asunto
              </label>
              <input
                value={form.subject}
                onChange={(event) => setField("subject", event.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
                placeholder="Ej: Consulta por F29"
              />
              {errors.subject && <p className="mt-1 text-xs text-rose-600">{errors.subject}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--primary-color)]">
                Solicitante (correo)
              </label>
              <input
                type="email"
                value={form.requesterEmail}
                onChange={(event) => setField("requesterEmail", event.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
                placeholder="cliente@example.com"
              />
              {errors.requesterEmail && (
                <p className="mt-1 text-xs text-rose-600">{errors.requesterEmail}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--primary-color)]">
                  Área
                </label>
                <select
                  value={form.area}
                  onChange={(event) =>
                    setField("area", event.target.value as CreateTicketFormValues["area"])
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
                >
                  <option value="">--</option>
                  <option value="Contabilidad">Contabilidad</option>
                  <option value="Tributaria">Tributaria</option>
                  <option value="Laboral">Laboral</option>
                </select>
                {errors.area && <p className="mt-1 text-xs text-rose-600">{errors.area}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--primary-color)]">
                  Tipo
                </label>
                <select
                  value={form.type}
                  onChange={(event) =>
                    setField("type", event.target.value as CreateTicketFormValues["type"])
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
                >
                  <option value="">--</option>
                  <option value="Solicitud">Solicitud</option>
                  <option value="Problema">Problema</option>
                  <option value="Whatsapp">Whatsapp</option>
                  <option value="Llamada telefonica">Llamada telefonica</option>
                </select>
                {errors.type && <p className="mt-1 text-xs text-rose-600">{errors.type}</p>}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--primary-color)]">
                  Prioridad
                </label>
                <select
                  value={form.priority}
                  onChange={(event) =>
                    setField("priority", event.target.value as CreateTicketFormValues["priority"])
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
                >
                  <option value="">--</option>
                  <option value="Baja">Baja</option>
                  <option value="Media">Media</option>
                  <option value="Alta">Alta</option>
                </select>
                {errors.priority && <p className="mt-1 text-xs text-rose-600">{errors.priority}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--primary-color)]">
                Descripción
              </label>
              <textarea
                value={form.description}
                onChange={(event) => setField("description", event.target.value)}
                rows={6}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
                placeholder="Describe el requerimiento con contexto."
              />
              {errors.description && (
                <p className="mt-1 text-xs text-rose-600">{errors.description}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-black/10 pt-4">
              <button
                type="button"
                onClick={attemptClose}
                className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/70 hover:border-black/20"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-sm text-white shadow-sm disabled:opacity-70"
              >
                {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                {isSubmitting ? "Creando..." : "Crear ticket"}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={showDiscardConfirm}
        title="Descartar cambios?"
        description="Tienes cambios sin guardar. Si cierras ahora, se perderan."
        cancelText="Cancelar"
        confirmText="Descartar"
        variant="danger"
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          closeNow();
        }}
      />
    </>
  );
}
