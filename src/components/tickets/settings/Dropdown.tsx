import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type DropdownItem = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
};

type DropdownProps = {
  items: DropdownItem[];
  triggerLabel: string;
  triggerContent: React.ReactNode;
  align?: "left" | "right";
  menuClassName?: string;
  triggerClassName?: string;
  hideChevron?: boolean;
  closeOnSelect?: boolean;
};

function findNextEnabled(
  current: number,
  enabledIndices: number[],
  direction: "next" | "prev"
) {
  if (enabledIndices.length === 0) return -1;

  const currentPos = enabledIndices.findIndex((idx) => idx === current);
  if (currentPos === -1) return enabledIndices[0];

  if (direction === "next") {
    return enabledIndices[(currentPos + 1) % enabledIndices.length];
  }

  return enabledIndices[(currentPos - 1 + enabledIndices.length) % enabledIndices.length];
}

export default function Dropdown({
  items,
  triggerLabel,
  triggerContent,
  align = "right",
  menuClassName,
  triggerClassName,
  hideChevron = false,
  closeOnSelect = true,
}: DropdownProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [isOpen, setIsOpen] = useState(false);
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
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;
    itemRefs.current[activeIndex]?.focus();
  }, [activeIndex, isOpen]);

  const openMenu = (first: "start" | "end" = "start") => {
    if (enabledIndices.length === 0) return;
    setIsOpen(true);
    setActiveIndex(
      first === "start"
        ? enabledIndices[0]
        : enabledIndices[enabledIndices.length - 1]
    );
  };

  const closeMenu = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const selectItem = (index: number) => {
    const item = items[index];
    if (!item || item.disabled) return;

    item.onSelect();

    if (closeOnSelect) {
      closeMenu();
      triggerRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        title={triggerLabel}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          if (isOpen) {
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
            if (isOpen) closeMenu();
            else openMenu("start");
          }
        }}
        className={
          triggerClassName ??
          "inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/80 shadow-sm transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
        }
      >
        {triggerContent}
        {!hideChevron && <ChevronDown size={14} className="text-black/50" />}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={triggerLabel}
          className={`absolute z-[80] mt-2 min-w-[240px] rounded-xl border border-black/10 bg-white p-1 shadow-xl ${
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
              if (activeIndex >= 0) selectItem(activeIndex);
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
                onMouseEnter={() => {
                  if (!disabled) setActiveIndex(index);
                }}
                onClick={() => selectItem(index)}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition ${
                  disabled
                    ? "cursor-not-allowed text-black/35"
                    : item.danger
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-black/80 hover:bg-black/5"
                } ${isActive && !disabled ? "bg-black/5" : ""}`}
              >
                {item.icon && (
                  <span className="mt-0.5 shrink-0 text-black/60">{item.icon}</span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {item.label}
                    {item.selected && <Check size={14} className="text-[var(--secondary-color)]" />}
                  </span>
                  {item.description && (
                    <span className="mt-0.5 block text-xs text-black/55">{item.description}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
