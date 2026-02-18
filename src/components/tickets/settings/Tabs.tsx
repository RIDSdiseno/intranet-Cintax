import React from "react";

export type TabOption = {
  id: string;
  label: string;
};

type TabsProps = {
  tabs: TabOption[];
  activeTab: string;
  onChange: (id: string) => void;
};

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="border-b border-black/10">
      <div className="flex flex-wrap gap-4">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30 ${
                isActive
                  ? "border-[var(--secondary-color)] text-[var(--primary-color)]"
                  : "border-transparent text-black/60 hover:text-black/80"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
