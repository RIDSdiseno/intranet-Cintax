import React, { useMemo, useState } from "react";
import Modal from "../../../../components/tickets/settings/Modal";
import SettingsLayout from "../../../../components/tickets/settings/SettingsLayout";

type GroupType = "support" | "service";

type GroupRow = {
  id: string;
  type: GroupType;
  name: string;
  description: string;
  activeAgents: number;
};

const GROUP_TABS: Array<{ id: GroupType; label: string }> = [
  { id: "support", label: "Grupo de soporte" },
  { id: "service", label: "Grupo de servicio" },
];

const INITIAL_GROUPS: GroupRow[] = [
  {
    id: "grp-support-1",
    type: "support",
    name: "Contabilidad",
    description: "Atiende consultas de facturacion, cobranzas y boletas.",
    activeAgents: 5,
  },
  {
    id: "grp-support-2",
    type: "support",
    name: "Recursos Humanos",
    description: "Gestiona contratos, remuneraciones y beneficios.",
    activeAgents: 4,
  },
  {
    id: "grp-service-1",
    type: "service",
    name: "Comercial y Marketing",
    description: "Escala solicitudes comerciales y coordinacion de campanas.",
    activeAgents: 6,
  },
  {
    id: "grp-service-2",
    type: "service",
    name: "Postventa",
    description: "Soporte de onboarding y seguimiento de implementaciones.",
    activeAgents: 3,
  },
];

function createGroupId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `group-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export default function GroupsSettingsPage() {
  const [activeTab, setActiveTab] = useState<GroupType>("support");
  const [groups, setGroups] = useState<GroupRow[]>(INITIAL_GROUPS);
  const [createOpen, setCreateOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    type: GroupType;
    name: string;
    description: string;
    addAgentsNextStep: boolean;
  }>({
    type: "support",
    name: "",
    description: "",
    addAgentsNextStep: true,
  });

  const counts = useMemo(
    () =>
      GROUP_TABS.reduce<Record<GroupType, number>>(
        (acc, tab) => {
          acc[tab.id] = groups.filter((group) => group.type === tab.id).length;
          return acc;
        },
        { support: 0, service: 0 }
      ),
    [groups]
  );

  const visibleGroups = useMemo(
    () => groups.filter((group) => group.type === activeTab),
    [activeTab, groups]
  );

  const closeCreateModal = () => {
    setCreateOpen(false);
    setNameError(null);
    setForm({
      type: "support",
      name: "",
      description: "",
      addAgentsNextStep: true,
    });
  };

  const handleCreateGroup = () => {
    const normalizedName = form.name.trim();
    if (!normalizedName) {
      setNameError("El nombre del grupo es obligatorio.");
      return;
    }

    const newGroup: GroupRow = {
      id: createGroupId(),
      type: form.type,
      name: normalizedName,
      description: form.description.trim() || "Sin descripcion",
      activeAgents: 0,
    };

    setGroups((prev) => [newGroup, ...prev]);
    setActiveTab(form.type);
    closeCreateModal();
  };

  return (
    <SettingsLayout
      breadcrumb="Grupos"
      title="Grupos"
      description="Organice equipos para distribuir tickets y notificaciones."
      rightActions={
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-xl bg-[var(--secondary-color)] px-4 py-2 text-sm text-white shadow-sm transition hover:opacity-95"
        >
          Grupo nuevo
        </button>
      }
    >
      <section className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
        <div className="border-b border-black/10 px-4 pt-3">
          <div className="flex flex-wrap gap-4">
            {GROUP_TABS.map((tab) => {
              const isActive = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30 ${
                    isActive
                      ? "border-[var(--secondary-color)] text-[var(--primary-color)]"
                      : "border-transparent text-black/60 hover:text-black/80"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-xs text-black/60">
                    {counts[tab.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-black/10 bg-black/[0.02] text-left text-xs uppercase tracking-wide text-black/45">
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Agentes activos</th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group) => (
                <tr key={group.id} className="border-b border-black/5 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-black/80">{group.name}</p>
                    <p className="mt-0.5 text-xs text-black/55">{group.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full border border-black/10 bg-black/[0.03] px-2.5 py-1 text-xs font-medium text-black/70">
                      {group.activeAgents}
                    </span>
                  </td>
                </tr>
              ))}

              {visibleGroups.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-sm text-black/55">
                    No hay grupos en esta categoria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={createOpen}
        onClose={closeCreateModal}
        title="Grupo nuevo"
        description="Defina el tipo de grupo y su informacion principal."
        maxWidthClassName="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={closeCreateModal}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/75 hover:border-black/20"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateGroup}
              className="rounded-xl bg-[var(--secondary-color)] px-4 py-2 text-sm text-white shadow-sm hover:opacity-95"
            >
              Crear
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-black/75">Tipo de grupo</label>
            <select
              value={form.type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, type: event.target.value as GroupType }))
              }
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            >
              <option value="support">Grupo de soporte</option>
              <option value="service">Grupo de servicio</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black/75">Nombre*</label>
            <input
              value={form.name}
              onChange={(event) => {
                setNameError(null);
                setForm((prev) => ({ ...prev, name: event.target.value }));
              }}
              placeholder="Ingrese un nombre de grupo"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            />
            {nameError && <p className="mt-1 text-xs text-rose-600">{nameError}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-black/75">Descripcion</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Describa para que se usara este grupo"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-black/70">
            <input
              type="checkbox"
              checked={form.addAgentsNextStep}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, addAgentsNextStep: event.target.checked }))
              }
              className="h-4 w-4 rounded border-black/20 text-[var(--secondary-color)] focus:ring-[var(--secondary-color)]/40"
            />
            Anadir agentes en el siguiente paso
          </label>
        </div>
      </Modal>
    </SettingsLayout>
  );
}
