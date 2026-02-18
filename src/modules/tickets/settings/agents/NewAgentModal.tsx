import React from "react";
import { X } from "lucide-react";
import MultiSelectGroups from "./MultiSelectGroups";
import type {
  AgentLevel,
  AgentRole,
  AgentType,
  AgentWorkday,
  Group,
  NewAgentPayload,
  TicketVisibilityScope,
} from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_OPTIONS: AgentRole[] = ["Agent", "Administrador de soporte"];
const LEVEL_OPTIONS: AgentLevel[] = ["Beginner", "Intermediate", "Senior"];

type FormState = {
  type: AgentType;
  workday: AgentWorkday;
  email: string;
  level: AgentLevel;
  signature: string;
  role: AgentRole;
  visibilityScope: TicketVisibilityScope;
  groupIds: string[];
};

type NewAgentModalProps = {
  open: boolean;
  groups: Group[];
  onClose: () => void;
  onCreate: (payload: NewAgentPayload) => void;
};

function defaultFormState(): FormState {
  return {
    type: "support",
    workday: "occasional",
    email: "",
    level: "Beginner",
    signature: "",
    role: "Agent",
    visibilityScope: "all",
    groupIds: [],
  };
}

const SIGNATURE_TOOLS = [
  { id: "bold", label: "B", snippet: "**texto**" },
  { id: "italic", label: "I", snippet: "_texto_" },
  { id: "underline", label: "U", snippet: "<u>texto</u>" },
  { id: "link", label: "Link", snippet: "[texto](https://)" },
  { id: "list", label: "Lista", snippet: "- item" },
] as const;

export default function NewAgentModal({
  open,
  groups,
  onClose,
  onCreate,
}: NewAgentModalProps) {
  const [form, setForm] = React.useState<FormState>(() => defaultFormState());
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [groupsError, setGroupsError] = React.useState<string | null>(null);
  const emailInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    setForm(defaultFormState());
    setEmailError(null);
    setGroupsError(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      emailInputRef.current?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const appendSignatureSnippet = (snippet: string) => {
    setForm((current) => ({
      ...current,
      signature: current.signature
        ? `${current.signature}\n${snippet}`
        : snippet,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = form.email.trim();
    let hasError = false;

    if (!normalizedEmail) {
      hasError = true;
      setEmailError("El email es obligatorio.");
    } else if (!EMAIL_REGEX.test(normalizedEmail)) {
      hasError = true;
      setEmailError("Ingresa un email valido.");
    } else {
      setEmailError(null);
    }

    if (form.visibilityScope === "group" && form.groupIds.length === 0) {
      hasError = true;
      setGroupsError("Selecciona al menos 1 grupo");
    } else {
      setGroupsError(null);
    }

    if (hasError) return;

    onCreate({
      email: normalizedEmail,
      type: form.type,
      workday: form.workday,
      level: form.level,
      signature: form.signature,
      roles: [form.role],
      visibilityScope: form.visibilityScope,
      groupIds: form.groupIds,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        onClick={onClose}
        aria-label="Cerrar modal"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo agente"
        className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-6 py-4">
          <h3 className="text-xl font-semibold text-[var(--primary-color)]">Nuevo agente</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-black/70 transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[72vh] space-y-6 overflow-y-auto px-6 py-5">
            <section className="grid gap-4 rounded-xl border border-black/10 bg-black/[0.015] p-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-black/75">Tipo de agente</label>
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      type: event.target.value as AgentType,
                    }))
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-500/30"
                >
                  <option value="support">Agente de soporte</option>
                  <option value="field">Tecnico de campo</option>
                </select>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-black/75">Jornada</p>
                <div className="space-y-2">
                  <label className="flex cursor-not-allowed items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    <input
                      type="radio"
                      name="workday"
                      value="full_time"
                      disabled
                      checked={form.workday === "full_time"}
                      onChange={() => undefined}
                    />
                    <span>
                      Tiempo completo
                      <span className="ml-2 text-xs font-medium text-rose-600">
                        Cupos agotados
                      </span>
                    </span>
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80">
                    <input
                      type="radio"
                      name="workday"
                      value="occasional"
                      checked={form.workday === "occasional"}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          workday: "occasional",
                        }))
                      }
                    />
                    Ocasional
                  </label>
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-black/10 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-black/55">
                Informacion del agente
              </h4>

              <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-black/75">Cargar foto</p>
                  <div
                    className="mx-auto h-24 w-24 rounded-full border border-black/15"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                      backgroundSize: "16px 16px",
                      backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
                    }}
                  />
                  <button
                    type="button"
                    className="w-full rounded-xl border border-black/10 bg-white px-2 py-1.5 text-xs text-black/60"
                  >
                    Subir foto (demo)
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-black/75">Email*</label>
                    <input
                      ref={emailInputRef}
                      type="email"
                      value={form.email}
                      onChange={(event) => {
                        setEmailError(null);
                        setForm((current) => ({ ...current, email: event.target.value }));
                      }}
                      placeholder="nombre@cintax.cl"
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-500/30"
                    />
                    {emailError && <p className="mt-1 text-xs text-rose-600">{emailError}</p>}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-black/75">Nivel</label>
                    <select
                      value={form.level}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          level: event.target.value as AgentLevel,
                        }))
                      }
                      className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-500/30"
                    >
                      {LEVEL_OPTIONS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-black/75">Firma</label>
                <div className="rounded-xl border border-black/10">
                  <div className="flex flex-wrap gap-2 border-b border-black/10 p-2">
                    {SIGNATURE_TOOLS.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        onClick={() => appendSignatureSnippet(tool.snippet)}
                        className="rounded-lg border border-black/10 bg-white px-2.5 py-1 text-xs text-black/70 transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={6}
                    value={form.signature}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        signature: event.target.value,
                      }))
                    }
                    placeholder="Escribe la firma del agente..."
                    className="w-full resize-y rounded-b-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/25"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-black/10 p-4">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-black/55">
                Configuracion
              </h4>

              <div>
                <label className="mb-1 block text-sm font-medium text-black/75">Roles</label>
                <select
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as AgentRole,
                    }))
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-500/30"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700">
                    {form.role}
                  </span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-black/75">
                  Alcance de visibilidad del ticket
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80">
                    <input
                      type="radio"
                      name="visibility"
                      value="all"
                      checked={form.visibilityScope === "all"}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          visibilityScope: "all",
                          groupIds: [],
                        }))
                      }
                    />
                    Todos los tickets
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80">
                    <input
                      type="radio"
                      name="visibility"
                      value="group"
                      checked={form.visibilityScope === "group"}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          visibilityScope: "group",
                        }))
                      }
                    />
                    Tickets de un grupo
                  </label>

                  <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80">
                    <input
                      type="radio"
                      name="visibility"
                      value="assigned"
                      checked={form.visibilityScope === "assigned"}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          visibilityScope: "assigned",
                          groupIds: [],
                        }))
                      }
                    />
                    Tickets asignados
                  </label>
                </div>
              </div>

              {form.visibilityScope === "group" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-black/75">Grupos</label>
                  <MultiSelectGroups
                    groups={groups}
                    selectedGroupIds={form.groupIds}
                    onChange={(nextSelected) => {
                      setGroupsError(null);
                      setForm((current) => ({ ...current, groupIds: nextSelected }));
                    }}
                    error={groupsError}
                  />
                </div>
              )}
            </section>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-black/10 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/75 transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[var(--secondary-color)] px-4 py-2 text-sm font-medium text-white shadow-md shadow-black/10 transition hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            >
              Crear agente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
