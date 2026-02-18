import React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { Group } from "./types";

type MultiSelectGroupsProps = {
  groups: Group[];
  selectedGroupIds: string[];
  onChange: (nextSelected: string[]) => void;
  error?: string | null;
};

export default function MultiSelectGroups({
  groups,
  selectedGroupIds,
  onChange,
  error,
}: MultiSelectGroupsProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const selectedGroups = React.useMemo(
    () => groups.filter((group) => selectedGroupIds.includes(group.id)),
    [groups, selectedGroupIds]
  );

  React.useEffect(() => {
    if (!isOpen) return;

    const onMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isOpen]);

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      onChange(selectedGroupIds.filter((id) => id !== groupId));
      return;
    }
    onChange([...selectedGroupIds, groupId]);
  };

  return (
    <div className="space-y-2" ref={rootRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2 text-left text-sm text-black/75 shadow-sm transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
      >
        <span>
          {selectedGroups.length > 0
            ? `${selectedGroups.length} grupo(s) seleccionado(s)`
            : "Seleccionar grupos"}
        </span>
        <ChevronDown size={16} className={`text-black/45 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="rounded-xl border border-black/10 bg-white p-1 shadow-xl">
          {groups.map((group) => {
            const selected = selectedGroupIds.includes(group.id);

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-black/80 transition hover:bg-black/5"
              >
                <span>{group.name}</span>
                {selected && <Check size={15} className="text-sky-600" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {selectedGroups.length === 0 && (
          <span className="text-xs text-black/55">No hay grupos seleccionados.</span>
        )}
        {selectedGroups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => toggleGroup(group.id)}
            className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700"
          >
            {group.name}
            <X size={12} />
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
