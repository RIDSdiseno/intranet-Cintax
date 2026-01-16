import React from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  items: Record<string, string>;
};

const KpiGuideModal: React.FC<Props> = ({ open, onClose, items }) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative max-w-2xl w-full bg-white rounded-2xl p-6 shadow-lg z-10">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-sm font-semibold">Guía rápida de métricas</h3>
          <button
            aria-label="Cerrar guía"
            onClick={onClose}
            className="text-sm text-black/50 hover:text-black"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-black/60 mt-2 mb-4">Explicación breve de cada KPI y recomendaciones rápidas.</p>

        <div className="space-y-3 max-h-72 overflow-auto">
          {Object.entries(items).map(([key, desc]) => (
            <div key={key} className="">
              <div className="text-[13px] font-semibold text-[#1d1e1c]">{formatTitle(key)}</div>
              <div className="text-[12px] text-black/60 mt-1">{desc}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-full bg-[#f3f4f6] text-sm border border-black/5"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

function formatTitle(key: string) {
  // friendly titles for known keys
  const map: Record<string, string> = {
    total: "Total",
    backlog: "Backlog",
    venc: "Vencidas",
    porVencer: "Por vencer",
    comp: "Completadas",
    cierrePct: "% Cierre",
    avgCierreDias: "Prom. cierre (días)",
    risk: "Riesgo",
  };
  return map[key] ?? key;
}

export default KpiGuideModal;
