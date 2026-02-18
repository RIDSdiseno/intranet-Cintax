import React from "react";
import {
  AUTOMATION_TAB_OPTIONS,
  type AutomationTab,
} from "../types/automation";

type AutomationTabsProps = {
  activeTab: AutomationTab;
  onChange: (tab: AutomationTab) => void;
};

export default function AutomationTabs({ activeTab, onChange }: AutomationTabsProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-white p-1 shadow-sm">
      {AUTOMATION_TAB_OPTIONS.map((tab) => {
        const selected = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`rounded-lg px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30 ${
              selected
                ? "bg-[var(--secondary-color)] text-white"
                : "text-black/70 hover:bg-black/5 hover:text-black"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

