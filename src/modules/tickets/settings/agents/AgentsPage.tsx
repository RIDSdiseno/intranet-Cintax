import React from "react";
import { Search, UserPlus } from "lucide-react";
import Dropdown from "../../../../components/tickets/settings/Dropdown";
import SettingsLayout from "../../../../components/tickets/settings/SettingsLayout";
import NewAgentModal from "./NewAgentModal";
import SimpleToast, { useSimpleToast } from "./SimpleToast";
import {
  AGENT_GROUPS,
  getAgentFunctionLabel,
  useAgentsStore,
} from "./useAgentsStore";
import type { AgentDirectoryFilter, AgentOrderBy, AgentTab } from "./types";

const AGENT_TABS: Array<{ id: AgentTab; label: string }> = [
  { id: "support", label: "Agentes de soporte" },
  { id: "field", label: "Tecnicos de campo" },
  { id: "disabled", label: "Agentes desactivados" },
];

const ORDER_OPTIONS: Array<{ id: AgentOrderBy; label: string }> = [
  { id: "name_asc", label: "Nombre (A-Z)" },
  { id: "name_desc", label: "Nombre (Z-A)" },
];

const DIRECTORY_OPTIONS: Array<{ id: AgentDirectoryFilter; label: string }> = [
  { id: "all", label: "Todos los agentes" },
  { id: "administrators", label: "Administradores de soporte" },
  { id: "agents_only", label: "Rol Agent" },
];

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "AG";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export default function AgentsPage() {
  const {
    activeTab,
    orderBy,
    directoryFilter,
    search,
    tabCounts,
    directoryCounts,
    visibleAgents,
    setActiveTab,
    setOrderBy,
    setDirectoryFilter,
    setSearch,
    createAgent,
  } = useAgentsStore();
  const [modalOpen, setModalOpen] = React.useState(false);
  const { toast, showToast } = useSimpleToast();

  const selectedOrderLabel =
    ORDER_OPTIONS.find((option) => option.id === orderBy)?.label ?? ORDER_OPTIONS[0].label;

  const selectedDirectoryLabel = React.useMemo(() => {
    const current = DIRECTORY_OPTIONS.find((option) => option.id === directoryFilter);
    if (!current) return `Todos los agentes (${directoryCounts.all})`;
    return `${current.label} (${directoryCounts[directoryFilter]})`;
  }, [directoryCounts, directoryFilter]);

  return (
    <SettingsLayout
      breadcrumb="Agentes"
      title="Agentes"
      description="Cree, organize y gestione el acceso de su equipo de soporte."
      rightActions={
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--secondary-color)] px-4 py-2 text-sm font-medium text-white shadow-md shadow-black/10 transition hover:opacity-95"
        >
          <UserPlus size={16} />
          Nuevo agente
        </button>
      }
    >
      <SimpleToast toast={toast} />

      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="space-y-3 border-b border-black/10 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex w-full items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 lg:max-w-lg">
              <Search size={16} className="text-black/45" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar agentes"
                aria-label="Buscar agentes"
                className="w-full bg-transparent text-sm text-black/80 outline-none placeholder:text-black/45"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <Dropdown
                triggerLabel="Ordenar por"
                triggerContent={
                  <span className="text-sm text-black/75">Ordenar por: {selectedOrderLabel}</span>
                }
                triggerClassName="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 shadow-sm transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                menuClassName="w-56"
                items={ORDER_OPTIONS.map((option) => ({
                  id: option.id,
                  label: option.label,
                  selected: option.id === orderBy,
                  onSelect: () => setOrderBy(option.id),
                }))}
              />

              <Dropdown
                triggerLabel="Filtro de agentes"
                triggerContent={<span className="text-sm text-black/75">{selectedDirectoryLabel}</span>}
                triggerClassName="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 shadow-sm transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                menuClassName="w-64"
                items={DIRECTORY_OPTIONS.map((option) => ({
                  id: option.id,
                  label: `${option.label} (${directoryCounts[option.id]})`,
                  selected: option.id === directoryFilter,
                  onSelect: () => setDirectoryFilter(option.id),
                }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 pt-1">
            {AGENT_TABS.map((tab) => {
              const isActive = tab.id === activeTab;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px border-b-2 pb-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-sky-500/35 ${
                    isActive
                      ? "border-sky-600 text-[var(--primary-color)]"
                      : "border-transparent text-black/60 hover:text-black/80"
                  }`}
                >
                  {tab.label} ({tabCounts[tab.id]})
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.03] text-left text-xs uppercase tracking-wide text-black/45">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Funciones</th>
                <th className="px-4 py-3 font-semibold">Grupos</th>
                <th className="px-4 py-3 font-semibold">Visto por ultima vez</th>
              </tr>
            </thead>
            <tbody>
              {visibleAgents.map((agent) => (
                <tr key={agent.id} className="border-b border-black/5 last:border-b-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                        {initials(agent.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-black/80">{agent.name}</p>
                        <p className="truncate text-xs text-black/55">{agent.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-black/70">{getAgentFunctionLabel(agent)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {agent.groups.length === 0 && (
                        <span className="text-xs text-black/45">Sin grupos</span>
                      )}
                      {agent.groups.map((group) => (
                        <span
                          key={`${agent.id}-${group.id}`}
                          className="inline-flex rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-xs text-black/65"
                        >
                          {group.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-black/65">{agent.lastSeenLabel}</td>
                </tr>
              ))}

              {visibleAgents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-black/55">
                    No hay agentes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <NewAgentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        groups={AGENT_GROUPS}
        onCreate={(payload) => {
          createAgent(payload);
          setModalOpen(false);
          showToast("success", "Agente creado (demo)");
        }}
      />
    </SettingsLayout>
  );
}
