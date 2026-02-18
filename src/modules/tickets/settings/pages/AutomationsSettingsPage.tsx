import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../../../components/tickets/settings/ConfirmDialog";
import Drawer from "../../../../components/tickets/settings/Drawer";
import Dropdown from "../../../../components/tickets/settings/Dropdown";
import Modal from "../../../../components/tickets/settings/Modal";
import RuleCard from "../../../../components/tickets/settings/RuleCard";
import SettingsLayout from "../../../../components/tickets/settings/SettingsLayout";
import Tabs from "../../../../components/tickets/settings/Tabs";
import {
  mockRulesCreation,
  mockRulesTimeTriggers,
  mockRulesUpdates,
  type TicketSettingsRule,
} from "../../../../features/tickets/settings/mocks";

const AUTOMATION_TABS = [
  { id: "creation", label: "Creacion de Tickets" },
  { id: "updates", label: "Actualizaciones Del Ticket" },
  { id: "schedules", label: "Activadores Por Horas" },
] as const;

type AutomationTabId = (typeof AUTOMATION_TABS)[number]["id"];

type EventRow = {
  id: string;
  value: string;
};

type ConditionRow = {
  id: string;
  field: string;
  operator: string;
  value: string;
};

type ActionRow = {
  id: string;
  type: string;
  target: string;
};

type RuleFormState = {
  name: string;
  description: string;
  events: EventRow[];
  conditions: ConditionRow[];
  actions: ActionRow[];
};

type DrawerMode = "new" | "edit" | "clone";

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `rule-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function createEmptyForm(): RuleFormState {
  return {
    name: "",
    description: "",
    events: [{ id: createId(), value: "Ticket creado" }],
    conditions: [
      {
        id: createId(),
        field: "Asunto",
        operator: "Contiene",
        value: "",
      },
    ],
    actions: [{ id: createId(), type: "Asignar grupo", target: "" }],
  };
}

function createFormFromRule(rule: TicketSettingsRule): RuleFormState {
  return {
    ...createEmptyForm(),
    name: rule.name,
    description: rule.description,
  };
}

function drawerTitle(mode: DrawerMode) {
  if (mode === "edit") return "Editar regla";
  if (mode === "clone") return "Clonar regla";
  return "Nueva regla";
}

export default function AutomationsSettingsPage() {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AutomationTabId>("creation");
  const [executionMode, setExecutionMode] = useState<"FIRST_MATCH" | "ALL_MATCH">(
    "FIRST_MATCH"
  );
  const [rulesByTab, setRulesByTab] = useState<Record<AutomationTabId, TicketSettingsRule[]>>({
    creation: mockRulesCreation.map((item) => ({ ...item })),
    updates: mockRulesUpdates.map((item) => ({ ...item })),
    schedules: mockRulesTimeTriggers.map((item) => ({ ...item })),
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("new");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(() => createEmptyForm());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<TicketSettingsRule | null>(null);

  const activeRules = useMemo(() => rulesByTab[activeTab], [activeTab, rulesByTab]);

  const executionLabel =
    executionMode === "FIRST_MATCH"
      ? "Ejecutando primera regla coincidente"
      : "Ejecutando todas las reglas coincidentes";

  const updateRulesForActiveTab = (
    updater: (rules: TicketSettingsRule[]) => TicketSettingsRule[]
  ) => {
    setRulesByTab((prev) => ({
      ...prev,
      [activeTab]: updater(prev[activeTab]),
    }));
  };

  const openNewRule = () => {
    setDrawerMode("new");
    setEditingRuleId(null);
    setRuleForm(createEmptyForm());
    setDrawerOpen(true);
  };

  const openEditRule = (rule: TicketSettingsRule) => {
    setDrawerMode("edit");
    setEditingRuleId(rule.id);
    setRuleForm(createFormFromRule(rule));
    setDrawerOpen(true);
  };

  const openCloneRule = (rule: TicketSettingsRule) => {
    setDrawerMode("clone");
    setEditingRuleId(rule.id);
    setRuleForm({
      ...createFormFromRule(rule),
      name: `Copia de ${rule.name}`,
    });
    setDrawerOpen(true);
  };

  const buildDescriptionFromForm = () => {
    if (ruleForm.description.trim()) return ruleForm.description.trim();

    const firstCondition = ruleForm.conditions[0];
    const firstAction = ruleForm.actions[0];

    if (!firstCondition || !firstAction) return "Regla creada desde configuracion.";

    return `${firstCondition.field} ${firstCondition.operator.toLowerCase()} ${
      firstCondition.value || "valor"
    }. ${firstAction.type} ${firstAction.target || "destino"}.`;
  };

  const saveRule = () => {
    const baseRule: TicketSettingsRule = {
      id: createId(),
      name: ruleForm.name.trim() || "Regla sin nombre",
      description: buildDescriptionFromForm(),
      enabled: true,
      updatedAt: new Date().toISOString(),
      updatedBy: "Admin Cintax",
      impactedLast7Days: 0,
    };

    if (drawerMode === "edit" && editingRuleId) {
      updateRulesForActiveTab((currentRules) =>
        currentRules.map((rule) =>
          rule.id === editingRuleId
            ? {
                ...rule,
                name: baseRule.name,
                description: baseRule.description,
                updatedAt: baseRule.updatedAt,
                updatedBy: baseRule.updatedBy,
              }
            : rule
        )
      );
    } else {
      updateRulesForActiveTab((currentRules) => [baseRule, ...currentRules]);
    }

    setPreviewOpen(false);
    setDrawerOpen(false);
    setEditingRuleId(null);
    setRuleForm(createEmptyForm());
  };

  return (
    <SettingsLayout
      breadcrumb="Automatizaciones"
      title="Automatizaciones"
      description="Cree reglas para eliminar tareas repetitivas en creacion, actualizacion y seguimiento de tickets."
    >
      <section className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <Tabs
          tabs={[...AUTOMATION_TABS]}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as AutomationTabId)}
        />

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Dropdown
            triggerLabel="Modo de ejecucion"
            triggerContent={<span className="text-sm">{executionLabel}</span>}
            items={[
              {
                id: "first",
                label: "Ejecutar la primera regla coincidente",
                selected: executionMode === "FIRST_MATCH",
                onSelect: () => setExecutionMode("FIRST_MATCH"),
              },
              {
                id: "all",
                label: "Ejecutar todas las reglas coincidentes",
                selected: executionMode === "ALL_MATCH",
                onSelect: () => setExecutionMode("ALL_MATCH"),
              },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/tickets/settings/automations/templates")}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 shadow-sm transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            >
              Plantillas
            </button>
            <button
              type="button"
              onClick={openNewRule}
              className="rounded-xl px-4 py-2 text-sm text-white shadow-md shadow-black/20 transition active:scale-[0.98]"
              style={{ background: "var(--secondary-color)" }}
            >
              + Nueva regla
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {activeRules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-black/55">No hay reglas en esta seccion.</p>
            <button
              type="button"
              onClick={openNewRule}
              className="mt-3 rounded-xl px-4 py-2 text-sm text-white shadow-sm"
              style={{ background: "var(--secondary-color)" }}
            >
              + Nueva regla
            </button>
          </div>
        )}

        {activeRules.map((rule, index) => (
          <RuleCard
            key={rule.id}
            index={index}
            rule={rule}
            onToggle={(next) =>
              updateRulesForActiveTab((currentRules) =>
                currentRules.map((item) =>
                  item.id === rule.id
                    ? {
                        ...item,
                        enabled: next,
                        updatedAt: new Date().toISOString(),
                      }
                    : item
                )
              )
            }
            onEdit={() => openEditRule(rule)}
            onClone={() => openCloneRule(rule)}
            onDelete={() => setRuleToDelete(rule)}
          />
        ))}
      </section>

      <Drawer
        open={drawerOpen}
        title={drawerTitle(drawerMode)}
        description="Defina evento, condicion y accion para su automatizacion."
        onClose={() => {
          setDrawerOpen(false);
          setPreviewOpen(false);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/75 hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            >
              Vista previa
            </button>
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                setPreviewOpen(false);
              }}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/75 hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveRule}
              className="rounded-xl px-4 py-2 text-sm text-white shadow-sm"
              style={{ background: "var(--secondary-color)" }}
            >
              Guardar regla
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-black/75">Nombre de la regla</label>
            <input
              value={ruleForm.name}
              onChange={(event) =>
                setRuleForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
              placeholder="Ingrese un nombre"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black/75">Descripcion</label>
            <textarea
              rows={3}
              value={ruleForm.description}
              onChange={(event) =>
                setRuleForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              placeholder="Describa la regla"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            />
          </div>

          <section className="rounded-xl border border-black/10 bg-black/[0.015] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--secondary-color)] text-xs font-semibold text-white">
                1
              </span>
              <h3 className="text-sm font-semibold text-[var(--primary-color)]">Evento</h3>
            </div>

            <div className="space-y-2">
              {ruleForm.events.map((eventRow) => (
                <select
                  key={eventRow.id}
                  value={eventRow.value}
                  onChange={(event) =>
                    setRuleForm((prev) => ({
                      ...prev,
                      events: prev.events.map((item) =>
                        item.id === eventRow.id ? { ...item, value: event.target.value } : item
                      ),
                    }))
                  }
                  className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option>Ticket creado</option>
                  <option>Ticket actualizado</option>
                  <option>Cambio de prioridad</option>
                  <option>Activador por horas</option>
                </select>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setRuleForm((prev) => ({
                  ...prev,
                  events: [...prev.events, { id: createId(), value: "Ticket creado" }],
                }))
              }
              className="mt-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
            >
              Agregar evento
            </button>
          </section>

          <section className="rounded-xl border border-black/10 bg-black/[0.015] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--secondary-color)] text-xs font-semibold text-white">
                2
              </span>
              <h3 className="text-sm font-semibold text-[var(--primary-color)]">Condicion</h3>
            </div>

            <div className="space-y-2">
              {ruleForm.conditions.map((conditionRow) => (
                <div key={conditionRow.id} className="grid gap-2 sm:grid-cols-[160px_170px_1fr]">
                  <select
                    value={conditionRow.field}
                    onChange={(event) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        conditions: prev.conditions.map((item) =>
                          item.id === conditionRow.id
                            ? { ...item, field: event.target.value }
                            : item
                        ),
                      }))
                    }
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    <option>Asunto</option>
                    <option>Descripcion</option>
                    <option>Prioridad</option>
                    <option>Solicitante</option>
                  </select>

                  <select
                    value={conditionRow.operator}
                    onChange={(event) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        conditions: prev.conditions.map((item) =>
                          item.id === conditionRow.id
                            ? { ...item, operator: event.target.value }
                            : item
                        ),
                      }))
                    }
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    <option>Contiene</option>
                    <option>No contiene</option>
                    <option>Es igual a</option>
                  </select>

                  <input
                    value={conditionRow.value}
                    onChange={(event) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        conditions: prev.conditions.map((item) =>
                          item.id === conditionRow.id
                            ? { ...item, value: event.target.value }
                            : item
                        ),
                      }))
                    }
                    placeholder="Valor"
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setRuleForm((prev) => ({
                  ...prev,
                  conditions: [
                    ...prev.conditions,
                    {
                      id: createId(),
                      field: "Asunto",
                      operator: "Contiene",
                      value: "",
                    },
                  ],
                }))
              }
              className="mt-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
            >
              Agregar condicion
            </button>
          </section>

          <section className="rounded-xl border border-black/10 bg-black/[0.015] p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--secondary-color)] text-xs font-semibold text-white">
                3
              </span>
              <h3 className="text-sm font-semibold text-[var(--primary-color)]">Accion</h3>
            </div>

            <div className="space-y-2">
              {ruleForm.actions.map((actionRow) => (
                <div key={actionRow.id} className="grid gap-2 sm:grid-cols-[200px_1fr]">
                  <select
                    value={actionRow.type}
                    onChange={(event) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        actions: prev.actions.map((item) =>
                          item.id === actionRow.id ? { ...item, type: event.target.value } : item
                        ),
                      }))
                    }
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  >
                    <option>Asignar grupo</option>
                    <option>Asignar agente</option>
                    <option>Cambiar prioridad</option>
                    <option>Enviar correo</option>
                  </select>

                  <input
                    value={actionRow.target}
                    onChange={(event) =>
                      setRuleForm((prev) => ({
                        ...prev,
                        actions: prev.actions.map((item) =>
                          item.id === actionRow.id
                            ? { ...item, target: event.target.value }
                            : item
                        ),
                      }))
                    }
                    placeholder="Destino o valor"
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setRuleForm((prev) => ({
                  ...prev,
                  actions: [...prev.actions, { id: createId(), type: "Asignar grupo", target: "" }],
                }))
              }
              className="mt-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
            >
              Agregar accion
            </button>
          </section>
        </div>
      </Drawer>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Vista previa de regla"
        description="Resumen rapido antes de guardar"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/75 hover:border-black/20"
            >
              Volver
            </button>
            <button
              type="button"
              onClick={saveRule}
              className="rounded-xl px-4 py-2 text-sm text-white shadow-sm"
              style={{ background: "var(--secondary-color)" }}
            >
              Guardar regla
            </button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-black/70">
          <div className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-black/45">Nombre</p>
            <p className="mt-1 font-medium text-black/80">
              {ruleForm.name.trim() || "Regla sin nombre"}
            </p>
          </div>

          <div className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-black/45">Descripcion</p>
            <p className="mt-1">{buildDescriptionFromForm()}</p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-black/45">Eventos</p>
              <p className="mt-1">{ruleForm.events.length}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-black/45">Condiciones</p>
              <p className="mt-1">{ruleForm.conditions.length}</p>
            </div>
            <div className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-black/45">Acciones</p>
              <p className="mt-1">{ruleForm.actions.length}</p>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(ruleToDelete)}
        title="Eliminar regla"
        description="Esta accion no se puede deshacer. Desea continuar?"
        confirmText="Eliminar"
        cancelText="Cancelar"
        onCancel={() => setRuleToDelete(null)}
        onConfirm={() => {
          if (!ruleToDelete) return;

          updateRulesForActiveTab((currentRules) =>
            currentRules.filter((rule) => rule.id !== ruleToDelete.id)
          );
          setRuleToDelete(null);
        }}
      />
    </SettingsLayout>
  );
}
