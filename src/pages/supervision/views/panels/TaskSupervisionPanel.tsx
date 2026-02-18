// src/pages/supervision/panels/TaskSupervisionPanel.tsx
import React from "react";
import type { ResumenAgente, TareaFull } from "../../../../lib/api";
import type { Periodo } from "../../../../components/supervision/usePeriodo";
import type { GlobalFilters } from "../../../../utils/supervisionMetrics";

import TareaImpactoView from "../../views/TareaImpactoView";

type Props = {
  resumen: ResumenAgente[];

  periodo: Periodo;
  setPeriodo: (p: Periodo) => void;
  mesSelect: number;
  setMesSelect: (m: number) => void;
  anioSelect: number;
  setAnioSelect: (a: number) => void;

  filters: GlobalFilters;
  setFilters: React.Dispatch<React.SetStateAction<GlobalFilters>>;

  globalLoading: boolean;

  carteraGlobal: Array<{ rut: string; razonSocial: string }>;
  tareasGlobalesFiltradas: TareaFull[];

  formatFecha: (iso?: string | null) => string;

  onBack: () => void;
};

const SpinnerSmall: React.FC<{ label?: string }> = ({ label = "Cargando..." }) => (
  <div className="flex items-center gap-2 text-xs text-black/60">
    <div className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full rounded-full bg-sky-200 opacity-60 animate-ping" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
    </div>
    <span className="animate-pulse">{label}</span>
  </div>
);

const BackButton: React.FC<{ onClick: () => void; loading?: boolean }> = ({
  onClick,
  loading,
}) => (
  <button
    onClick={onClick}
    type="button"
    className="
      inline-flex items-center gap-2
      px-4 py-2.5
      rounded-full
      text-xs font-semibold
      bg-[#af9150] text-white
      shadow-sm
      border border-[#af9150]
      hover:brightness-95
      active:scale-[0.99]
      focus:outline-none focus:ring-2 focus:ring-[#af9150]/40 focus:ring-offset-2
      transition
    "
    aria-label="Cambiar modo"
    title="Volver para cambiar el modo de análisis"
    disabled={!!loading}
  >
    <span className="text-base leading-none">←</span>
    <span>Cambiar modo</span>
  </button>
);

export default function TaskSupervisionPanel({
  periodo,
  setPeriodo,
  mesSelect,
  setMesSelect,
  anioSelect,
  setAnioSelect,
  globalLoading,
  carteraGlobal,
  tareasGlobalesFiltradas,
  formatFecha,
  onBack,
}: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-[11px] text-black/50">Modo</div>
            <div className="text-sm font-semibold text-[#1d1e1c]">Por tarea</div>
            <div className="text-xs text-black/60 mt-1">
              Selecciona una tarea y revisa su estado consolidado en todas las empresas.
            </div>
          </div>

          <div className="flex items-center gap-3">
            {globalLoading && <SpinnerSmall label="Cargando datos..." />}
            <BackButton onClick={onBack} loading={globalLoading} />
          </div>
        </div>
      </div>

      {/* Periodo */}
      <div className="bg-[#f5f4f0] border border-black/5 rounded-2xl px-3 py-3 shadow-sm">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 text-xs">
            <select
              className="bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
              value={mesSelect}
              onChange={(e) => {
                setPeriodo("mes-especifico");
                setMesSelect(Number(e.target.value));
              }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Mes {i + 1}
                </option>
              ))}
            </select>

            <input
              type="number"
              className="bg-white border border-black/10 rounded-xl px-3 py-2 w-24 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
              value={anioSelect}
              onChange={(e) => {
                setPeriodo("anio-especifico");
                setAnioSelect(Number(e.target.value));
              }}
            />
          </div>
        </div>
      </div>

      {/* Contenido: Impacto por tarea global */}
      <TareaImpactoView
        empresasStats={carteraGlobal}
        tareasSeleccionadas={tareasGlobalesFiltradas}
        formatFecha={formatFecha}
      />
    </div>
  );
}
