import React from "react";
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AccessibleDropdown from "../automation/components/AccessibleDropdown";

type TicketSettingsDropdownProps = {
  onNotify?: (
    tone: "success" | "error" | "warning" | "info",
    text: string
  ) => void;
};

export default function TicketSettingsDropdown({
  onNotify,
}: TicketSettingsDropdownProps) {
  const navigate = useNavigate();

  return (
    <AccessibleDropdown
      triggerLabel="Configuracion de tickets"
      align="right"
      hideChevron
      menuClassName="w-56"
      triggerClassName="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-black/10 bg-white text-black/70 shadow-sm transition hover:border-black/20 hover:text-black focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
      triggerContent={<Settings size={16} />}
      items={[
        {
          id: "automations",
          label: "Automatizaciones",
          onSelect: () => navigate("/tickets/automatizaciones"),
        },
        {
          id: "templates",
          label: "Plantillas",
          onSelect: () => navigate("/tickets/automatizaciones/templates"),
        },
        {
          id: "settings-disabled",
          label: "Configuracion",
          disabled: true,
          hint: "Proximamente",
          onSelect: () => {
            onNotify?.("info", "Proximamente");
          },
        },
      ]}
    />
  );
}

