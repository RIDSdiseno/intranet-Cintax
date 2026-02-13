import React from "react";
import type { TicketGroup } from "../types";

export default function TicketsTabs({
  groups,
  totalAll: _totalAll,
  active,
  onChange,
  loading,
}: {
  groups: TicketGroup[];
  totalAll: number;
  active: string;
  onChange: (slug: string) => void;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-8 w-28 rounded-full bg-black/5 animate-pulse"
          />
        ))}
      </div>
    );
  }

  const items: Array<{ slug: string; name: string; count: number }> = groups.map((g) => ({
    slug: g.slug,
    name: g.name,
    count: g.count,
  }));

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      {items.map((item) => (
        <button
          key={item.slug}
          onClick={() => onChange(item.slug)}
          className={`rounded-full px-3 py-1.5 text-sm border transition ${
            active === item.slug
              ? "bg-[var(--secondary-color)] text-white border-[var(--secondary-color)]"
              : "bg-white text-[var(--primary-color)] border-black/10 hover:border-black/20"
          }`}
        >
          {item.name}
          <span className="ml-1 text-xs opacity-80">({item.count})</span>
        </button>
      ))}
    </div>
  );
}
