import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type {
  AutomationActionItem,
  AutomationConditionItem,
  AutomationRule,
  AutomationRuleDraft,
  AutomationTab,
  ExecutionMode,
} from "../types/automation";

const STORAGE_KEY = "cintax_ticket_automation_rules_v1";

type AutomationPersistedState = {
  rules: AutomationRule[];
  executionMode: ExecutionMode;
};

type AutomationRulesContextValue = {
  rules: AutomationRule[];
  tabFilter: AutomationTab;
  searchTerm: string;
  executionMode: ExecutionMode;
  setTabFilter: (tab: AutomationTab) => void;
  setSearchTerm: (term: string) => void;
  setExecutionMode: (mode: ExecutionMode) => void;
  getRuleById: (id: string) => AutomationRule | null;
  createRule: (draft: AutomationRuleDraft) => AutomationRule;
  updateRule: (
    id: string,
    patch: Partial<AutomationRuleDraft> & { updatedBy?: string }
  ) => AutomationRule | null;
  cloneRuleFrom: (id: string) => AutomationRule | null;
  deleteRule: (id: string) => void;
  toggleRule: (id: string, enabled?: boolean) => AutomationRule | null;
};

const AutomationRulesContext = createContext<AutomationRulesContextValue | null>(null);

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `auto-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function copyConditions(items: AutomationConditionItem[]) {
  return items.map((item) => ({ ...item, id: createId() }));
}

function copyActions(items: AutomationActionItem[]) {
  return items.map((item) => ({ ...item, id: createId(), params: { ...item.params } }));
}

function makeSeedRules(): AutomationRule[] {
  const now = Date.now();
  return [
    {
      id: createId(),
      tab: "CREATION",
      name: "RRHH",
      description:
        "Si asunto o descripcion contiene liquidaciones, liquidacion, contrato, sueldo o finiquito.",
      enabled: true,
      updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 90).toISOString(),
      updatedBy: "Soporte Consult...",
      impactedLast7Days: 14,
      runMode: "FIRST_MATCH",
      event: {
        actor: "SYSTEM",
        triggers: [{ id: createId(), type: "Ticket creado" }],
      },
      conditions: {
        operator: "ANY",
        items: [
          {
            id: createId(),
            scope: "TICKETS",
            field: "subject",
            comparator: "contains",
            value: "liquidaciones",
          },
          {
            id: createId(),
            scope: "TICKETS",
            field: "description",
            comparator: "contains",
            value: "finiquito",
          },
        ],
      },
      actions: {
        items: [
          {
            id: createId(),
            type: "assign_group",
            params: { group: "Recursos Humanos" },
          },
          {
            id: createId(),
            type: "send_email",
            params: { subject: "Ticket RRHH", body: "Notificacion automatica" },
          },
        ],
      },
    },
    {
      id: createId(),
      tab: "UPDATES",
      name: "Automatically reopen tickets when the customer responds",
      description:
        "Reabre un ticket cuando el solicitante responde despues de haberse marcado como resuelto.",
      enabled: true,
      updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 60).toISOString(),
      updatedBy: "Administrador Cintax",
      impactedLast7Days: 5,
      runMode: "FIRST_MATCH",
      event: {
        actor: "REQUESTER",
        triggers: [{ id: createId(), type: "Se cambio el estado" }],
      },
      conditions: {
        operator: "ALL",
        items: [
          {
            id: createId(),
            scope: "TICKETS",
            field: "status",
            comparator: "equals",
            value: "Resuelto",
          },
        ],
      },
      actions: {
        items: [
          {
            id: createId(),
            type: "change_status",
            params: { status: "Abierto" },
          },
        ],
      },
    },
    {
      id: createId(),
      tab: "SCHEDULES",
      name: "Automatically close resolved tickets after 48 hours",
      description:
        "Cierra tickets en estado resuelto si no tienen actividad durante las siguientes 48 horas.",
      enabled: false,
      updatedAt: new Date(now - 1000 * 60 * 60 * 24 * 30).toISOString(),
      updatedBy: "Soporte Consult...",
      impactedLast7Days: 8,
      runMode: "ALL_MATCH",
      event: {
        actor: "SYSTEM",
        triggers: [{ id: createId(), type: "Activador por horas", value: "48" }],
      },
      conditions: {
        operator: "ALL",
        items: [
          {
            id: createId(),
            scope: "TICKETS",
            field: "status",
            comparator: "equals",
            value: "Resuelto",
          },
        ],
      },
      actions: {
        items: [
          {
            id: createId(),
            type: "change_status",
            params: { status: "Cerrado" },
          },
        ],
      },
    },
  ];
}

function sortRules(rules: AutomationRule[]) {
  return [...rules].sort((a, b) => {
    const aTs = new Date(a.updatedAt).getTime();
    const bTs = new Date(b.updatedAt).getTime();
    return bTs - aTs;
  });
}

function loadPersisted(): AutomationPersistedState {
  if (typeof window === "undefined") {
    return {
      rules: sortRules(makeSeedRules()),
      executionMode: "FIRST_MATCH",
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        rules: sortRules(makeSeedRules()),
        executionMode: "FIRST_MATCH",
      };
    }

    const parsed = JSON.parse(raw) as Partial<AutomationPersistedState> | null;
    const rules = Array.isArray(parsed?.rules) ? (parsed?.rules as AutomationRule[]) : [];
    const executionMode =
      parsed?.executionMode === "ALL_MATCH" ? "ALL_MATCH" : "FIRST_MATCH";

    return {
      rules: rules.length > 0 ? sortRules(rules) : sortRules(makeSeedRules()),
      executionMode,
    };
  } catch {
    return {
      rules: sortRules(makeSeedRules()),
      executionMode: "FIRST_MATCH",
    };
  }
}

export function AutomationRulesProvider({ children }: { children: React.ReactNode }) {
  const initial = useMemo(() => loadPersisted(), []);
  const [rules, setRules] = useState<AutomationRule[]>(initial.rules);
  const [tabFilter, setTabFilter] = useState<AutomationTab>("CREATION");
  const [searchTerm, setSearchTerm] = useState("");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(initial.executionMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: AutomationPersistedState = {
      rules,
      executionMode,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [rules, executionMode]);

  const getRuleById = (id: string) => rules.find((rule) => rule.id === id) ?? null;

  const createRule = (draft: AutomationRuleDraft) => {
    const created: AutomationRule = {
      ...draft,
      id: createId(),
      updatedAt: nowIso(),
      updatedBy: draft.updatedBy ?? "Administrador Cintax",
      impactedLast7Days: draft.impactedLast7Days ?? 0,
      conditions: {
        ...draft.conditions,
        items: copyConditions(draft.conditions.items),
      },
      actions: {
        items: copyActions(draft.actions.items),
      },
      event: {
        ...draft.event,
        triggers: draft.event.triggers.map((trigger) => ({
          ...trigger,
          id: createId(),
        })),
      },
    };
    setRules((prev) => sortRules([created, ...prev]));
    return created;
  };

  const updateRule = (
    id: string,
    patch: Partial<AutomationRuleDraft> & { updatedBy?: string }
  ) => {
    let updated: AutomationRule | null = null;
    setRules((prev) =>
      sortRules(
        prev.map((rule) => {
          if (rule.id !== id) return rule;

          const next: AutomationRule = {
            ...rule,
            ...patch,
            event: patch.event
              ? {
                  ...patch.event,
                  triggers: patch.event.triggers.map((trigger) => ({
                    ...trigger,
                    id: trigger.id || createId(),
                  })),
                }
              : rule.event,
            conditions: patch.conditions
              ? {
                  ...patch.conditions,
                  items: patch.conditions.items.map((item) => ({
                    ...item,
                    id: item.id || createId(),
                  })),
                }
              : rule.conditions,
            actions: patch.actions
              ? {
                  items: patch.actions.items.map((item) => ({
                    ...item,
                    id: item.id || createId(),
                    params: { ...item.params },
                  })),
                }
              : rule.actions,
            updatedBy: patch.updatedBy ?? "Administrador Cintax",
            updatedAt: nowIso(),
          };
          updated = next;
          return next;
        })
      )
    );
    return updated;
  };

  const cloneRuleFrom = (id: string) => {
    const source = getRuleById(id);
    if (!source) return null;
    const cloned = createRule({
      ...source,
      name: `Copia de ${source.name}`,
      enabled: source.enabled,
      event: {
        ...source.event,
        triggers: source.event.triggers.map((trigger) => ({ ...trigger })),
      },
      conditions: {
        ...source.conditions,
        items: source.conditions.items.map((item) => ({ ...item })),
      },
      actions: {
        items: source.actions.items.map((item) => ({
          ...item,
          params: { ...item.params },
        })),
      },
    });
    return cloned;
  };

  const deleteRule = (id: string) => {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  };

  const toggleRule = (id: string, enabled?: boolean) => {
    let updated: AutomationRule | null = null;
    setRules((prev) =>
      sortRules(
        prev.map((rule) => {
          if (rule.id !== id) return rule;
          const next: AutomationRule = {
            ...rule,
            enabled: typeof enabled === "boolean" ? enabled : !rule.enabled,
            updatedAt: nowIso(),
          };
          updated = next;
          return next;
        })
      )
    );
    return updated;
  };

  const value = useMemo<AutomationRulesContextValue>(
    () => ({
      rules,
      tabFilter,
      searchTerm,
      executionMode,
      setTabFilter,
      setSearchTerm,
      setExecutionMode,
      getRuleById,
      createRule,
      updateRule,
      cloneRuleFrom,
      deleteRule,
      toggleRule,
    }),
    [rules, tabFilter, searchTerm, executionMode]
  );

  return (
    <AutomationRulesContext.Provider value={value}>
      {children}
    </AutomationRulesContext.Provider>
  );
}

export function useAutomationRules() {
  const ctx = useContext(AutomationRulesContext);
  if (!ctx) {
    throw new Error("useAutomationRules must be used within AutomationRulesProvider");
  }
  return ctx;
}

export function resetAutomationRulesStorage() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

