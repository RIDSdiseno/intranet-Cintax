import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ConfirmDialog from "../../components/ConfirmDialog";
import AutomationToast, { useAutomationToast } from "../components/AutomationToast";
import RulePreviewModal from "../components/RulePreviewModal";
import { useAutomationRules } from "../store/AutomationRulesContext";
import type {
  ActorType,
  AutomationActionItem,
  AutomationConditionItem,
  AutomationRule,
  AutomationRuleDraft,
  AutomationTab,
} from "../types/automation";
import {
  ACTION_OPTIONS,
  ACTOR_OPTIONS,
  AUTOMATION_TAB_OPTIONS,
  COMPARATOR_OPTIONS,
  CONDITION_SCOPE_OPTIONS,
  EVENT_TYPE_OPTIONS,
  FIELD_OPTIONS_BY_SCOPE,
} from "../types/automation";

type RuleEditorMode = "new" | "edit" | "clone";

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function getDefaultAction(type = "assign_group"): AutomationActionItem {
  if (type === "assign_group") return { id: createId(), type, params: { group: "Contabilidad" } };
  if (type === "assign_agent") return { id: createId(), type, params: { agent: "" } };
  if (type === "change_priority") return { id: createId(), type, params: { priority: "Media" } };
  if (type === "change_status") return { id: createId(), type, params: { status: "Abierto" } };
  if (type === "send_email") return { id: createId(), type, params: { subject: "", body: "" } };
  return { id: createId(), type, params: { tag: "" } };
}

function getDefaultCondition(scope: AutomationConditionItem["scope"] = "TICKETS") {
  const field = FIELD_OPTIONS_BY_SCOPE[scope][0]?.value ?? "subject";
  return { id: createId(), scope, field, comparator: "contains", value: "" } satisfies AutomationConditionItem;
}

function getDefaultDraft(tab: AutomationTab): AutomationRuleDraft {
  return {
    tab,
    name: "",
    description: "",
    enabled: true,
    runMode: "FIRST_MATCH",
    event: {
      actor: "AGENT",
      triggers: [{ id: createId(), type: EVENT_TYPE_OPTIONS[0] }],
    },
    conditions: { operator: "ANY", items: [getDefaultCondition("TICKETS")] },
    actions: { items: [getDefaultAction("assign_group")] },
  };
}

function toDraftFromRule(rule: AutomationRule): AutomationRuleDraft {
  return {
    tab: rule.tab,
    name: rule.name,
    description: rule.description ?? "",
    enabled: rule.enabled,
    runMode: rule.runMode,
    event: {
      actor: rule.event.actor,
      triggers: rule.event.triggers.map((t) => ({ ...t })),
    },
    conditions: {
      operator: rule.conditions.operator,
      items: rule.conditions.items.map((c) => ({ ...c })),
    },
    actions: {
      items: rule.actions.items.map((a) => ({ ...a, params: { ...a.params } })),
    },
  };
}

function isAutomationTab(value: string | null): value is AutomationTab {
  return value === "CREATION" || value === "UPDATES" || value === "SCHEDULES";
}

function validateDraft(draft: AutomationRuleDraft): string | null {
  if (draft.name.trim().length < 3) return "El nombre de la regla debe tener al menos 3 caracteres.";
  if (!draft.event.triggers.some((trigger) => trigger.type.trim())) return "Debes agregar al menos un evento.";
  if (draft.conditions.items.length === 0) return "Debes agregar al menos una condicion.";
  if (draft.conditions.items.some((item) => !item.field.trim() || !item.comparator.trim() || !item.value.trim())) {
    return "Todas las condiciones deben tener campo, comparador y valor.";
  }
  if (draft.actions.items.length === 0) return "Debes agregar al menos una accion.";
  if (draft.actions.items.some((item) => !item.type.trim())) return "Todas las acciones deben tener un tipo valido.";
  return null;
}

function getEditorTitle(mode: RuleEditorMode, tab: AutomationTab) {
  if (mode === "edit") return "Editar regla";
  if (mode === "clone") return "Clonar regla";
  if (tab === "UPDATES") return "Nueva regla de actualizacion de tickets";
  if (tab === "SCHEDULES") return "Nuevo activador por horas";
  return "Nueva regla de creacion de tickets";
}

export default function RuleEditorPage({ mode }: { mode: RuleEditorMode }) {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { toast, showToast } = useAutomationToast();
  const { getRuleById, createRule, updateRule, executionMode, setTabFilter } = useAutomationRules();

  const requestedTab = searchParams.get("tab");
  const initialTab = isAutomationTab(requestedTab) ? requestedTab : "UPDATES";

  const [draft, setDraft] = useState<AutomationRuleDraft>(() => ({
    ...getDefaultDraft(initialTab),
    runMode: executionMode,
  }));
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);

  const sourceRule = useMemo(() => {
    if (mode === "new") return null;
    if (!params.id) return null;
    return getRuleById(params.id);
  }, [getRuleById, mode, params.id]);

  useEffect(() => {
    if (mode === "new") {
      setDraft({ ...getDefaultDraft(initialTab), runMode: executionMode });
      return;
    }
    if (!sourceRule) return;
    const sourceDraft = toDraftFromRule(sourceRule);
    if (mode === "clone") {
      sourceDraft.name = `Copia de ${sourceRule.name}`;
      sourceDraft.enabled = true;
    }
    setDraft(sourceDraft);
  }, [executionMode, initialTab, mode, sourceRule]);

  const saveRule = () => {
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      showToast("error", validationError);
      return false;
    }

    if (mode === "edit") {
      if (!params.id) return false;
      const updated = updateRule(params.id, { ...draft, updatedBy: "Administrador Cintax" });
      if (!updated) {
        showToast("error", "No se pudo actualizar la regla.");
        return false;
      }
    } else {
      createRule({ ...draft, updatedBy: "Administrador Cintax" });
    }

    setTabFilter(draft.tab);
    navigate("/tickets/automatizaciones", {
      replace: true,
      state: { toast: { tone: "success", text: "Regla guardada." } },
    });
    return true;
  };

  if ((mode === "edit" || mode === "clone") && !sourceRule) {
    return (
      <section className="mt-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold text-[var(--primary-color)]">Regla no encontrada</h2>
        <p className="mt-2 text-sm text-black/60">La regla solicitada no existe o fue eliminada.</p>
        <button
          type="button"
          onClick={() => navigate("/tickets/automatizaciones")}
          className="mt-4 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-sm text-white shadow-sm"
        >
          Volver a automatizaciones
        </button>
      </section>
    );
  }

  const updateActionType = (id: string, type: string) => {
    setDraft((prev) => ({
      ...prev,
      actions: {
        items: prev.actions.items.map((item) =>
          item.id === id ? getDefaultAction(type) : item
        ),
      },
    }));
  };

  return (
    <section className="mt-5 space-y-4">
      <AutomationToast toast={toast} />

      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-semibold text-[var(--primary-color)]">
          {getEditorTitle(mode, draft.tab)}
        </h2>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
          <input
            value={draft.name}
            onChange={(event) => {
              setError(null);
              setDraft((prev) => ({ ...prev, name: event.target.value }));
            }}
            placeholder="Introduzca el nombre de la regla"
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
          />
          <button
            type="button"
            onClick={() => setTemplatesDialogOpen(true)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
          >
            Utilizar plantillas
          </button>
        </div>

        <textarea
          value={draft.description ?? ""}
          onChange={(event) =>
            setDraft((prev) => ({ ...prev, description: event.target.value }))
          }
          placeholder="Toque para agregar una descripcion"
          rows={2}
          className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
        />

        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-[var(--primary-color)]">
            Tipo de automatizacion
          </label>
          <select
            value={draft.tab}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, tab: event.target.value as AutomationTab }))
            }
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
          >
            {AUTOMATION_TAB_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--secondary-color)] text-xs font-semibold text-white">
            1
          </span>
          <h3 className="text-sm font-semibold text-[var(--primary-color)]">Evento</h3>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {ACTOR_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm"
            >
              <input
                type="radio"
                name="actor"
                className="h-4 w-4 accent-[var(--secondary-color)]"
                checked={draft.event.actor === option.value}
                onChange={() =>
                  setDraft((prev) => ({
                    ...prev,
                    event: { ...prev.event, actor: option.value as ActorType },
                  }))
                }
              />
              {option.label}
            </label>
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {draft.event.triggers.map((trigger, index) => (
            <div key={trigger.id} className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <select
                value={trigger.type}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    event: {
                      ...prev.event,
                      triggers: prev.event.triggers.map((item) =>
                        item.id === trigger.id ? { ...item, type: event.target.value } : item
                      ),
                    },
                  }))
                }
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-2 focus:ring-[var(--secondary-color)]/20"
              >
                {EVENT_TYPE_OPTIONS.map((eventOption) => (
                  <option key={eventOption} value={eventOption}>
                    {eventOption}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={draft.event.triggers.length <= 1}
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    event: {
                      ...prev.event,
                      triggers: prev.event.triggers.filter((item) => item.id !== trigger.id),
                    },
                  }))
                }
                className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {index === 0 ? "Evento principal" : "Quitar"}
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              event: {
                ...prev.event,
                triggers: [...prev.event.triggers, { id: createId(), type: EVENT_TYPE_OPTIONS[0] }],
              },
            }))
          }
          className="mt-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
        >
          + Agregar un nuevo evento
        </button>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--secondary-color)] text-xs font-semibold text-white">
            2
          </span>
          <h3 className="text-sm font-semibold text-[var(--primary-color)]">Condicion</h3>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              className="h-4 w-4 accent-[var(--secondary-color)]"
              checked={draft.conditions.operator === "ANY"}
              onChange={() =>
                setDraft((prev) => ({
                  ...prev,
                  conditions: { ...prev.conditions, operator: "ANY" },
                }))
              }
            />
            Coincide con CUALQUIERA
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              className="h-4 w-4 accent-[var(--secondary-color)]"
              checked={draft.conditions.operator === "ALL"}
              onChange={() =>
                setDraft((prev) => ({
                  ...prev,
                  conditions: { ...prev.conditions, operator: "ALL" },
                }))
              }
            />
            Coincide con TODO
          </label>
        </div>

        <div className="space-y-2">
          {draft.conditions.items.map((condition) => {
            const fields = FIELD_OPTIONS_BY_SCOPE[condition.scope];
            return (
              <div
                key={condition.id}
                className="grid gap-2 rounded-xl border border-black/10 bg-black/[0.015] p-3 sm:grid-cols-2 lg:grid-cols-[180px_220px_170px_1fr_auto]"
              >
                <select
                  value={condition.scope}
                  onChange={(event) => {
                    const scope = event.target.value as AutomationConditionItem["scope"];
                    const defaultField = FIELD_OPTIONS_BY_SCOPE[scope][0]?.value ?? "";
                    setDraft((prev) => ({
                      ...prev,
                      conditions: {
                        ...prev.conditions,
                        items: prev.conditions.items.map((item) =>
                          item.id === condition.id
                            ? { ...item, scope, field: defaultField }
                            : item
                        ),
                      },
                    }));
                  }}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  {CONDITION_SCOPE_OPTIONS.map((scopeOption) => (
                    <option key={scopeOption.value} value={scopeOption.value}>
                      {scopeOption.label}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.field}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      conditions: {
                        ...prev.conditions,
                        items: prev.conditions.items.map((item) =>
                          item.id === condition.id ? { ...item, field: event.target.value } : item
                        ),
                      },
                    }))
                  }
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  {fields.map((fieldOption) => (
                    <option key={fieldOption.value} value={fieldOption.value}>
                      {fieldOption.label}
                    </option>
                  ))}
                </select>

                <select
                  value={condition.comparator}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      conditions: {
                        ...prev.conditions,
                        items: prev.conditions.items.map((item) =>
                          item.id === condition.id
                            ? { ...item, comparator: event.target.value }
                            : item
                        ),
                      },
                    }))
                  }
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  {COMPARATOR_OPTIONS.map((comparatorOption) => (
                    <option key={comparatorOption.value} value={comparatorOption.value}>
                      {comparatorOption.label}
                    </option>
                  ))}
                </select>

                <input
                  value={condition.value}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      conditions: {
                        ...prev.conditions,
                        items: prev.conditions.items.map((item) =>
                          item.id === condition.id ? { ...item, value: event.target.value } : item
                        ),
                      },
                    }))
                  }
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  placeholder="Valor"
                />

                <button
                  type="button"
                  disabled={draft.conditions.items.length <= 1}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      conditions: {
                        ...prev.conditions,
                        items: prev.conditions.items.filter((item) => item.id !== condition.id),
                      },
                    }))
                  }
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                conditions: {
                  ...prev.conditions,
                  items: [...prev.conditions.items, getDefaultCondition("TICKETS")],
                },
              }))
            }
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
          >
            + Agregar nueva condicion
          </button>

          <button
            type="button"
            onClick={() =>
              setDraft((prev) => ({
                ...prev,
                conditions: {
                  ...prev.conditions,
                  items: [...prev.conditions.items, getDefaultCondition("TICKETS")],
                },
              }))
            }
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
          >
            + Agregar nuevo filtro
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--secondary-color)] text-xs font-semibold text-white">
            3
          </span>
          <h3 className="text-sm font-semibold text-[var(--primary-color)]">Accion</h3>
        </div>

        <div className="space-y-2">
          {draft.actions.items.map((action) => (
            <div
              key={action.id}
              className="rounded-xl border border-black/10 bg-black/[0.015] p-3"
            >
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <select
                  value={action.type}
                  onChange={(event) => updateActionType(action.id, event.target.value)}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  {ACTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={draft.actions.items.length <= 1}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      actions: {
                        items: prev.actions.items.filter((item) => item.id !== action.id),
                      },
                    }))
                  }
                  className="rounded-xl border border-black/10 px-3 py-2 text-sm text-black/70 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Quitar
                </button>
              </div>

              <div className="mt-2 grid gap-2">
                {action.type === "assign_group" && (
                  <select
                    value={action.params.group ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        actions: {
                          items: prev.actions.items.map((item) =>
                            item.id === action.id
                              ? { ...item, params: { ...item.params, group: event.target.value } }
                              : item
                          ),
                        },
                      }))
                    }
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Recursos Humanos">Recursos Humanos</option>
                    <option value="Comercial y Marketing">Comercial y Marketing</option>
                  </select>
                )}

                {action.type === "assign_agent" && (
                  <input
                    value={action.params.agent ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        actions: {
                          items: prev.actions.items.map((item) =>
                            item.id === action.id
                              ? { ...item, params: { ...item.params, agent: event.target.value } }
                              : item
                          ),
                        },
                      }))
                    }
                    placeholder="Id o nombre de agente"
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                )}

                {action.type === "change_priority" && (
                  <select
                    value={action.params.priority ?? "Media"}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        actions: {
                          items: prev.actions.items.map((item) =>
                            item.id === action.id
                              ? {
                                  ...item,
                                  params: { ...item.params, priority: event.target.value },
                                }
                              : item
                          ),
                        },
                      }))
                    }
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                  </select>
                )}

                {action.type === "change_status" && (
                  <select
                    value={action.params.status ?? "Abierto"}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        actions: {
                          items: prev.actions.items.map((item) =>
                            item.id === action.id
                              ? { ...item, params: { ...item.params, status: event.target.value } }
                              : item
                          ),
                        },
                      }))
                    }
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    <option value="Abierto">Abierto</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Resuelto">Resuelto</option>
                    <option value="Cerrado">Cerrado</option>
                  </select>
                )}

                {action.type === "send_email" && (
                  <>
                    <input
                      value={action.params.subject ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          actions: {
                            items: prev.actions.items.map((item) =>
                              item.id === action.id
                                ? {
                                    ...item,
                                    params: { ...item.params, subject: event.target.value },
                                  }
                                : item
                            ),
                          },
                        }))
                      }
                      placeholder="Asunto del correo"
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                    <textarea
                      value={action.params.body ?? ""}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          actions: {
                            items: prev.actions.items.map((item) =>
                              item.id === action.id
                                ? { ...item, params: { ...item.params, body: event.target.value } }
                                : item
                            ),
                          },
                        }))
                      }
                      rows={3}
                      placeholder="Cuerpo del correo"
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                    />
                  </>
                )}

                {action.type === "add_tag" && (
                  <input
                    value={action.params.tag ?? ""}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        actions: {
                          items: prev.actions.items.map((item) =>
                            item.id === action.id
                              ? { ...item, params: { ...item.params, tag: event.target.value } }
                              : item
                          ),
                        },
                      }))
                    }
                    placeholder="Etiqueta"
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setDraft((prev) => ({
              ...prev,
              actions: { items: [...prev.actions.items, getDefaultAction("assign_group")] },
            }))
          }
          className="mt-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
        >
          + Agregar nueva accion
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            const validationError = validateDraft(draft);
            if (validationError) {
              setError(validationError);
              showToast("error", validationError);
              return;
            }
            setPreviewOpen(true);
          }}
          className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/75 hover:border-black/20"
        >
          Vista previa
        </button>
        <button
          type="button"
          onClick={() => navigate("/tickets/automatizaciones")}
          className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/75 hover:border-black/20"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={saveRule}
          className="rounded-xl bg-[var(--primary-color)] px-4 py-2 text-sm text-white shadow-sm hover:opacity-95"
        >
          Guardar
        </button>
      </div>

      <RulePreviewModal
        open={previewOpen}
        draft={draft}
        onClose={() => setPreviewOpen(false)}
        onSave={saveRule}
      />

      <ConfirmDialog
        open={templatesDialogOpen}
        title="Utilizar plantillas"
        description="Las plantillas avanzadas estaran disponibles pronto. Quieres ir al listado de plantillas?"
        confirmText="Ir a plantillas"
        cancelText="Cerrar"
        variant="primary"
        onCancel={() => setTemplatesDialogOpen(false)}
        onConfirm={() => {
          setTemplatesDialogOpen(false);
          navigate("/tickets/automatizaciones/templates");
        }}
      />
    </section>
  );
}
