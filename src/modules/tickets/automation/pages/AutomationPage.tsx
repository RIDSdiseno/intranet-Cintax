import React, { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import AutomationTabs from "../components/AutomationTabs";
import RuleCard from "../components/RuleCard";
import AccessibleDropdown from "../components/AccessibleDropdown";
import AutomationToast, { useAutomationToast } from "../components/AutomationToast";
import {
  EXECUTION_MODE_OPTIONS,
  type AutomationTab,
} from "../types/automation";
import { useAutomationRules } from "../store/AutomationRulesContext";
import ConfirmDialog from "../../components/ConfirmDialog";

const TAB_DESCRIPTION: Record<AutomationTab, string> = {
  CREATION:
    "Estas reglas se ejecutan cuando se crea un ticket y ayudan a enrutarlo, clasificarlo o priorizarlo automaticamente.",
  UPDATES:
    "Estas reglas se ejecutan cuando un ticket se actualiza y automatizan flujos para estado, asignacion y seguimiento.",
  SCHEDULES:
    "Estos activadores se ejecutan por horario para mantener tu bandeja ordenada y aplicar acciones en tickets inactivos.",
};

type NavigationState = {
  toast?: { tone: "success" | "error" | "warning" | "info"; text: string };
};

export default function AutomationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, showToast } = useAutomationToast();
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null);

  const {
    rules,
    tabFilter,
    searchTerm,
    executionMode,
    setTabFilter,
    setSearchTerm,
    setExecutionMode,
    getRuleById,
    deleteRule,
    toggleRule,
  } = useAutomationRules();

  useEffect(() => {
    const state = location.state as NavigationState | null;
    if (state?.toast) {
      showToast(state.toast.tone, state.toast.text);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate, showToast]);

  const filteredRules = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rules.filter((rule) => {
      if (rule.tab !== tabFilter) return false;
      if (!query) return true;
      return (
        rule.name.toLowerCase().includes(query) ||
        String(rule.description || "")
          .toLowerCase()
          .includes(query)
      );
    });
  }, [rules, searchTerm, tabFilter]);

  const selectedModeLabel =
    EXECUTION_MODE_OPTIONS.find((mode) => mode.value === executionMode)?.label ??
    EXECUTION_MODE_OPTIONS[0].label;

  return (
    <section className="mt-5 space-y-4">
      <AutomationToast toast={toast} />

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <h2 className="text-3xl font-semibold text-[var(--primary-color)]">
              Automatizaciones
            </h2>
            <AutomationTabs activeTab={tabFilter} onChange={setTabFilter} />
            <p className="max-w-4xl text-sm text-black/65">{TAB_DESCRIPTION[tabFilter]}</p>
          </div>

          <label className="inline-flex w-full items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm lg:w-[320px]">
            <Search size={16} className="text-black/45" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full bg-transparent outline-none placeholder:text-black/40"
              placeholder="Buscar reglas..."
              aria-label="Buscar reglas de automatizacion"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-black/65">Reglas que se ejecutan en:</span>
            <AccessibleDropdown
              triggerLabel="Seleccionar modo de ejecucion"
              triggerContent={<span>{selectedModeLabel}</span>}
              items={EXECUTION_MODE_OPTIONS.map((option) => ({
                id: option.value,
                label: option.label,
                selected: executionMode === option.value,
                onSelect: () => {
                  setExecutionMode(option.value);
                  showToast("info", "Modo de ejecucion actualizado.");
                },
              }))}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/tickets/automatizaciones/templates")}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 hover:border-black/20"
            >
              Plantillas
            </button>
            <button
              type="button"
              onClick={() => navigate(`/tickets/automatizaciones/new?tab=${tabFilter}`)}
              className="rounded-xl bg-[var(--primary-color)] px-4 py-2 text-sm text-white shadow-sm hover:opacity-95"
            >
              + Nueva regla
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredRules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center">
            <p className="text-sm text-black/55">No hay reglas todavia.</p>
            <button
              type="button"
              onClick={() => navigate(`/tickets/automatizaciones/new?tab=${tabFilter}`)}
              className="mt-3 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-sm text-white shadow-sm hover:opacity-95"
            >
              + Nueva regla
            </button>
          </div>
        )}

        {filteredRules.map((rule, index) => (
          <RuleCard
            key={rule.id}
            index={index}
            rule={rule}
            onToggle={() => {
              const updated = toggleRule(rule.id);
              if (!updated) return;
              showToast(
                "success",
                updated.enabled ? "Regla activada." : "Regla desactivada."
              );
            }}
            onEdit={() => navigate(`/tickets/automatizaciones/${rule.id}/edit`)}
            onClone={() => navigate(`/tickets/automatizaciones/${rule.id}/clone`)}
            onDelete={() => setRuleToDelete(rule.id)}
          />
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(ruleToDelete)}
        title="Eliminar regla"
        description="Seguro que deseas eliminar esta regla? Esta accion no se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onCancel={() => setRuleToDelete(null)}
        onConfirm={() => {
          if (!ruleToDelete) return;
          const target = getRuleById(ruleToDelete);
          deleteRule(ruleToDelete);
          setRuleToDelete(null);
          showToast(
            "success",
            target ? `Regla "${target.name}" eliminada.` : "Regla eliminada."
          );
        }}
      />
    </section>
  );
}

