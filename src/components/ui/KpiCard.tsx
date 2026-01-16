import React from "react";

export default function KpiCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-lg">
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#af9150]/10 blur-2xl transition-all group-hover:bg-[#af9150]/20" />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-black/50 tracking-wide">{title}</p>
          <h3 className="mt-3 text-3xl font-bold" style={{ color: "var(--primary-color)" }}>
            {value}
          </h3>
        </div>
        <div className="rounded-xl bg-white/50 p-3 text-[#af9150] shadow-sm ring-1 ring-black/5 backdrop-blur-md">
          {icon}
        </div>
      </div>
      {helper && (
        <div className="mt-4 flex items-center gap-1 text-xs font-medium text-black/40">
          {helper}
        </div>
      )}
    </div>
  );
}
