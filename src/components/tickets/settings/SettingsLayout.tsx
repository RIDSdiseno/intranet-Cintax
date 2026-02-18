import React from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

type SettingsLayoutProps = {
  breadcrumb: string;
  title: string;
  description?: string;
  rightActions?: React.ReactNode;
  children: React.ReactNode;
};

export default function SettingsLayout({
  breadcrumb,
  title,
  description,
  rightActions,
  children,
}: SettingsLayoutProps) {
  return (
    <div className="mt-4 space-y-4 px-2 sm:px-0">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-sm text-black/60"
      >
        <Link
          to="/tickets"
          className="rounded-md px-1 py-0.5 hover:text-black focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
        >
          Tickets
        </Link>
        <ChevronRight size={14} className="text-black/35" />
        <span className="font-medium text-black/75">{breadcrumb}</span>
      </nav>

      <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--primary-color)]">{title}</h1>
            {description && <p className="mt-2 max-w-3xl text-sm text-black/60">{description}</p>}
          </div>
          {rightActions && <div className="shrink-0">{rightActions}</div>}
        </div>
      </section>

      {children}
    </div>
  );
}
