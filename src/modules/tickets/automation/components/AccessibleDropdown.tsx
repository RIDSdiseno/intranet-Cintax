import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type DropdownItem = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
  hint?: string;
};

type AccessibleDropdownProps = {
  items: DropdownItem[];
  triggerLabel: string;
  align?: "left" | "right";
  menuClassName?: string;
  triggerClassName?: string;
  triggerContent: React.ReactNode;
  hideChevron?: boolean;
};

function findNextEnabled(
  current: number,
  enabledIndices: number[],
  direction: "next" | "prev"
) {
  if (enabledIndices.length === 0) return -1;
  const currentPos = enabledIndices.findIndex((index) => index === current);
  if (currentPos === -1) return enabledIndices[0];
  if (direction === "next") {
    return enabledIndices[(currentPos + 1) % enabledIndices.length];
  }
  return enabledIndices[(currentPos - 1 + enabledIndices.length) % enabledIndices.length];
}

export default function AccessibleDropdown({
  items,
  triggerLabel,
  align = "right",
  menuClassName,
  triggerClassName,
  triggerContent,
  hideChevron = false,
}: AccessibleDropdownProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const enabledIndices = useMemo(
    () =>
      items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.disabled)
        .map(({ index }) => index),
    [items]
  );

  useEffect(() => {
    if (!open) return;

    const onDocMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onDocKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onDocKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const openMenu = (first: "start" | "end" = "start") => {
    if (enabledIndices.length === 0) return;
    setOpen(true);
    setActiveIndex(
      first === "start"
        ? enabledIndices[0]
        : enabledIndices[enabledIndices.length - 1]
    );
  };

  const closeMenu = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const selectItem = (index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;
    item.onSelect();
    closeMenu();
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        title={triggerLabel}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) {
            closeMenu();
            return;
          }
          openMenu("start");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu("start");
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openMenu("end");
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) closeMenu();
            else openMenu("start");
          } else if (event.key === "Escape" && open) {
            event.preventDefault();
            closeMenu();
          }
        }}
        className={
          triggerClassName ??
          "inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
        }
      >
        {triggerContent}
        {!hideChevron && <ChevronDown size={14} className="text-black/50" />}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={triggerLabel}
          className={`absolute z-[70] mt-2 min-w-[220px] rounded-xl border border-black/10 bg-white p-1 shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          } ${menuClassName ?? ""}`}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) =>
                findNextEnabled(current, enabledIndices, "next")
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) =>
                findNextEnabled(current, enabledIndices, "prev")
              );
            } else if (event.key === "Home") {
              event.preventDefault();
              if (enabledIndices.length > 0) setActiveIndex(enabledIndices[0]);
            } else if (event.key === "End") {
              event.preventDefault();
              if (enabledIndices.length > 0) {
                setActiveIndex(enabledIndices[enabledIndices.length - 1]);
              }
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (activeIndex >= 0) {
                selectItem(activeIndex);
              }
            } else if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
              triggerRef.current?.focus();
            } else if (event.key === "Tab") {
              closeMenu();
            }
          }}
        >
          {items.map((item, index) => {
            const isActive = activeIndex === index;
            const disabled = Boolean(item.disabled);

            return (
              <button
                key={item.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                role={item.selected === undefined ? "menuitem" : "menuitemradio"}
                aria-checked={item.selected}
                tabIndex={-1}
                disabled={disabled}
                title={item.hint}
                onMouseEnter={() => {
                  if (!disabled) setActiveIndex(index);
                }}
                onClick={() => selectItem(index)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  disabled
                    ? "cursor-not-allowed text-black/35"
                    : item.danger
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-black/80 hover:bg-black/5"
                } ${isActive && !disabled ? "bg-black/5" : ""}`}
              >
                <span>{item.label}</span>
                {item.selected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
