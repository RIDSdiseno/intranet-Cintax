import React, { useEffect } from "react";

type DrawerProps = {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
};

export default function Drawer({
  open,
  title,
  description,
  children,
  footer,
  onClose,
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <button
        type="button"
        aria-label="Cerrar panel"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-black/10 bg-white shadow-2xl"
      >
        <header className="border-b border-black/10 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-[var(--primary-color)]">{title}</h3>
              {description && <p className="mt-1 text-sm text-black/60">{description}</p>}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-black/10 px-2 py-1 text-xs text-black/70 hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            >
              Cerrar
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <footer className="border-t border-black/10 px-5 py-4">{footer}</footer>}
      </aside>
    </div>
  );
}
