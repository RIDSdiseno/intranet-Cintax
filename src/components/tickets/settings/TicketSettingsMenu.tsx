import React from "react";
import { Settings, Bot, UserRound, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Dropdown from "./Dropdown";

type TicketSettingsMenuProps = {
  isAdmin: boolean;
};

export default function TicketSettingsMenu({ isAdmin }: TicketSettingsMenuProps) {
  const navigate = useNavigate();

  if (!isAdmin) return null;

  return (
    <Dropdown
      triggerLabel="Configuracion de Tickets"
      align="right"
      hideChevron
      triggerContent={<Settings size={16} />}
      triggerClassName="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-black/10 bg-white text-black/70 shadow-sm transition hover:border-black/20 hover:text-black focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
      menuClassName="w-80"
      items={[
        {
          id: "automations",
          label: "Automatizaciones",
          description:
            "Elimine tareas repetitivas mediante creacion de reglas.",
          icon: <Bot size={16} />,
          onSelect: () => navigate("/tickets/settings/automations"),
        },
        {
          id: "agents",
          label: "Agentes",
          description: "Defina el tipo, idioma y alcance de sus agentes.",
          icon: <UserRound size={16} />,
          onSelect: () => navigate("/admin/agentes"),
        },
        {
          id: "groups",
          label: "Grupos",
          description:
            "Organice a los agentes y reciba notificaciones por equipo.",
          icon: <Users size={16} />,
          onSelect: () => navigate("/tickets/settings/groups"),
        },
      ]}
    />
  );
}
