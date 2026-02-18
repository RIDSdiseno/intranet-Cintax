// src/pages/supervision/panels/TaskSupervisionPanel.tsx
import React, { useMemo, useState } from "react";
import type { ResumenAgente, TareaFull } from "../../../../lib/api";
import type { Periodo } from "../../../../components/supervision/usePeriodo";
import type { GlobalFilters } from "../../../../utils/supervisionMetrics";

import ExportTaskExcelButton from "../../ExportTaskExcelButton";

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

type Tone = "ok" | "warn" | "bad" | "neutral";
type EstadoEmpresa = "VENCIDA" | "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "NO_INICIADA";

const SpinnerSmall: React.FC<{ label?: string }> = ({ label = "Cargando..." }) => (
  <div className="flex items-center gap-2 text-xs text-black/60">
    <div className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full rounded-full bg-sky-200 opacity-60 animate-ping" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
    </div>
    <span className="animate-pulse">{label}</span>
  </div>
);


const Badge: React.FC<{ children: React.ReactNode; tone?: Tone }> = ({ children, tone = "neutral" }) => {
  const cls =
    tone === "bad"
      ? "bg-rose-50 text-rose-700 border-rose-100"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-slate-50 text-slate-700 border-slate-100";
  return <span className={`px-2 py-1 rounded-full text-[11px] border ${cls}`}>{children}</span>;
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

function getTaskKey(t: TareaFull) {
  const pid = (t as any)?.tareaPlantilla?.id ?? (t as any)?.tareaPlantilla?.id_tarea_plantilla;
  const codigo = t.tareaPlantilla?.codigoDocumento || "SIN_CODIGO";
  const nombre = t.tareaPlantilla?.nombre || `Tarea #${(t as any)?.id_tarea_asignada ?? "-"}`;
  return String(pid ?? `${codigo}__${nombre}`);
}
function getTaskLabel(t: TareaFull) {
  const nombre = t.tareaPlantilla?.nombre || `Tarea #${(t as any)?.id_tarea_asignada ?? "-"}`;
  const codigo = t.tareaPlantilla?.codigoDocumento || "-";
  const area = t.tareaPlantilla?.area || "-";
  return { nombre, codigo, area };
}

function pickFechaMasProxima(isoList: Array<string | null | undefined>): string | null {
  const fechas = isoList
    .filter(Boolean)
    .map((iso) => new Date(String(iso)))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return fechas[0] ? fechas[0].toISOString() : null;
}
function calcAtrasoDias(iso: string | null): number | null {
  if (!iso) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() >= hoy.getTime()) return 0;
  const diff = hoy.getTime() - d.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
function toneEstado(st: EstadoEmpresa): Tone {
  if (st === "VENCIDA") return "bad";
  if (st === "PENDIENTE" || st === "NO_INICIADA") return "warn";
  if (st === "COMPLETADA") return "ok";
  return "neutral";
}
function labelEstado(st: EstadoEmpresa) {
  if (st === "NO_INICIADA") return "No iniciada";
  if (st === "EN_PROCESO") return "En proceso";
  if (st === "PENDIENTE") return "Pendiente";
  if (st === "VENCIDA") return "Vencida";
  if (st === "COMPLETADA") return "Completada";
  return st;
}
function getFechaComplecion(t: any): string | null {
  return t?.fechaComplecion || t?.fechaCompletada || t?.fechaCierre || t?.updatedAt || null;
}

type RowEmpresa = {
  rut: string;
  razonSocial: string;
  estado: EstadoEmpresa;
  fechaComprometida: string | null;
  atrasoDias: number | null;
  abiertas: number;
  agentes: Array<{ trabajadorId: number; nombre: string; abiertas: number }>;
  tareas: TareaFull[];
};

function PeriodoLabel(periodo: Periodo, mes: number, anio: number) {
  if (periodo === "anio-especifico") return `Año ${anio}`;
  if (periodo === "hist") return "Histórico";
  return `Mes ${mes} / ${anio}`;
}

/** ✅ chips EXACTOS como tu imagen */
const EstadoChips: React.FC<{
  counters: { venc: number; pend: number; proc: number; noini: number; comp: number };
  value: "ALL" | EstadoEmpresa;
  onChange: (v: "ALL" | EstadoEmpresa) => void;
}> = ({ counters, value, onChange }) => {
  const Chip = ({
    k,
    label,
    count,
    clsIdle,
    clsActive,
  }: {
    k: EstadoEmpresa;
    label: string;
    count: number;
    clsIdle: string;
    clsActive: string;
  }) => {
    const active = value === k;
    return (
      <button
        type="button"
        onClick={() => onChange(active ? "ALL" : k)}
        className={`
          px-3 py-1 rounded-full text-[11px] font-semibold border
          transition
          ${active ? clsActive : clsIdle}
        `}
        title={active ? "Quitar filtro" : `Filtrar por ${label}`}
      >
        {label} {count}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Chip
        k="VENCIDA"
        label="Venc"
        count={counters.venc}
        clsIdle="bg-rose-50 text-rose-700 border-rose-100 hover:border-rose-300"
        clsActive="bg-rose-600 text-white border-rose-600"
      />
      <Chip
        k="PENDIENTE"
        label="Pend"
        count={counters.pend}
        clsIdle="bg-amber-50 text-amber-800 border-amber-100 hover:border-amber-300"
        clsActive="bg-amber-600 text-white border-amber-600"
      />
      <Chip
        k="EN_PROCESO"
        label="Proc"
        count={counters.proc}
        clsIdle="bg-slate-50 text-slate-700 border-slate-100 hover:border-slate-300"
        clsActive="bg-slate-700 text-white border-slate-700"
      />
      <Chip
        k="NO_INICIADA"
        label="No inic"
        count={counters.noini}
        clsIdle="bg-amber-50 text-amber-800 border-amber-100 hover:border-amber-300"
        clsActive="bg-amber-600 text-white border-amber-600"
      />
      <Chip
        k="COMPLETADA"
        label="Comp"
        count={counters.comp}
        clsIdle="bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300"
        clsActive="bg-emerald-600 text-white border-emerald-600"
      />
    </div>
  );
};

export default function TaskSupervisionPanel({
  resumen,
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
  // UI
  const [taskSearch, setTaskSearch] = useState("");
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);

  const [empresaSearch, setEmpresaSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"ALL" | EstadoEmpresa>("ALL");
  const [selectedRut, setSelectedRut] = useState<string | null>(null);

  const agentesMap = useMemo(() => {
    const m = new Map<number, { nombre: string; email?: string }>();
    (resumen || []).forEach((r) => m.set(r.trabajadorId, { nombre: r.nombre, email: r.email }));
    return m;
  }, [resumen]);

  // catálogo tareas
  const taskCatalog = useMemo(() => {
    const map = new Map<string, { key: string; nombre: string; codigo: string; area: string; total: number }>();

    for (const t of tareasGlobalesFiltradas) {
      const key = getTaskKey(t);
      const meta = getTaskLabel(t);
      const prev = map.get(key);
      if (!prev) map.set(key, { key, ...meta, total: 1 });
      else prev.total += 1;
    }

    const arr = Array.from(map.values()).sort((a, b) => {
      const c = a.area.localeCompare(b.area);
      if (c !== 0) return c;
      return a.nombre.localeCompare(b.nombre);
    });

    return { map, arr };
  }, [tareasGlobalesFiltradas]);

  const tasksFiltered = useMemo(() => {
    const term = norm(taskSearch);
    if (!term) return taskCatalog.arr;
    return taskCatalog.arr.filter((t) => norm(`${t.nombre} ${t.codigo} ${t.area}`).includes(term));
  }, [taskCatalog, taskSearch]);

  const selectedTaskMeta = useMemo(() => {
    if (!selectedTaskKey) return null;
    return taskCatalog.map.get(selectedTaskKey) || null;
  }, [selectedTaskKey, taskCatalog]);

  // empresas + agentes para tarea seleccionada
  const empresasPorTarea = useMemo<RowEmpresa[]>(() => {
    if (!selectedTaskKey) return [];

    const byRut = new Map<string, TareaFull[]>();
    for (const t of tareasGlobalesFiltradas) {
      if (getTaskKey(t) !== selectedTaskKey) continue;
      const rut = (t.rutCliente || "SIN_RUT") as string;
      if (!byRut.has(rut)) byRut.set(rut, []);
      byRut.get(rut)!.push(t);
    }

    const out: RowEmpresa[] = [];

    for (const e of carteraGlobal) {
      const inst = byRut.get(e.rut) || [];
      if (inst.length === 0) {
        out.push({
          rut: e.rut,
          razonSocial: e.razonSocial,
          estado: "NO_INICIADA",
          fechaComprometida: null,
          atrasoDias: null,
          abiertas: 0,
          agentes: [],
          tareas: [],
        });
        continue;
      }

      const abiertasList = inst.filter((x) => x.estado !== "COMPLETADA");
      const completadasList = inst.filter((x) => x.estado === "COMPLETADA");

      const agentesCount = new Map<number, number>();
      for (const t of abiertasList as any[]) {
        const tid = t.trabajadorId;
        if (!tid) continue;
        agentesCount.set(tid, (agentesCount.get(tid) || 0) + 1);
      }

      const agentes = Array.from(agentesCount.entries())
        .map(([trabajadorId, abiertas]) => ({
          trabajadorId,
          abiertas,
          nombre: agentesMap.get(trabajadorId)?.nombre || `Agente #${trabajadorId}`,
        }))
        .sort((a, b) => b.abiertas - a.abiertas || a.nombre.localeCompare(b.nombre));

      if (abiertasList.length === 0 && completadasList.length > 0) {
        out.push({
          rut: e.rut,
          razonSocial: e.razonSocial,
          estado: "COMPLETADA",
          fechaComprometida: null,
          atrasoDias: 0,
          abiertas: 0,
          agentes,
          tareas: inst,
        });
        continue;
      }

      const estado: EstadoEmpresa =
        abiertasList.some((x) => x.estado === "VENCIDA")
          ? "VENCIDA"
          : abiertasList.some((x) => x.estado === "EN_PROCESO")
          ? "EN_PROCESO"
          : "PENDIENTE";

      const fecha = pickFechaMasProxima(abiertasList.map((x) => x.fechaProgramada));

      out.push({
        rut: e.rut,
        razonSocial: e.razonSocial,
        estado,
        fechaComprometida: fecha,
        atrasoDias: calcAtrasoDias(fecha),
        abiertas: abiertasList.length,
        agentes,
        tareas: inst,
      });
    }

    const rank: Record<EstadoEmpresa, number> = {
      VENCIDA: 0,
      PENDIENTE: 1,
      EN_PROCESO: 2,
      NO_INICIADA: 3,
      COMPLETADA: 4,
    };

    return out.sort((a, b) => {
      const r = rank[a.estado] - rank[b.estado];
      if (r !== 0) return r;
      const da = a.atrasoDias ?? -1;
      const db = b.atrasoDias ?? -1;
      if (db !== da) return db - da;
      return a.razonSocial.localeCompare(b.razonSocial);
    });
  }, [selectedTaskKey, tareasGlobalesFiltradas, carteraGlobal, agentesMap]);

  const counters = useMemo(() => {
    const base = empresasPorTarea;
    return {
      venc: base.filter((x) => x.estado === "VENCIDA").length,
      pend: base.filter((x) => x.estado === "PENDIENTE").length,
      proc: base.filter((x) => x.estado === "EN_PROCESO").length,
      noini: base.filter((x) => x.estado === "NO_INICIADA").length,
      comp: base.filter((x) => x.estado === "COMPLETADA").length,
    };
  }, [empresasPorTarea]);

  const empresasFiltradas = useMemo(() => {
    const term = norm(empresaSearch);
    let base = empresasPorTarea;
    if (estadoFilter !== "ALL") base = base.filter((r) => r.estado === estadoFilter);
    if (!term) return base;
    return base.filter((r) => norm(`${r.razonSocial} ${r.rut}`).includes(term));
  }, [empresasPorTarea, empresaSearch, estadoFilter]);

  const selectedEmpresa = useMemo(() => {
    if (!selectedRut) return null;
    return empresasPorTarea.find((x) => x.rut === selectedRut) || null;
  }, [selectedRut, empresasPorTarea]);

  const groupedByAgente = useMemo(() => {
    if (!selectedEmpresa) return [];
    const map = new Map<number, TareaFull[]>();
    (selectedEmpresa.tareas as any[]).forEach((t) => {
      const tid = t.trabajadorId || 0;
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(t);
    });

    return Array.from(map.entries())
      .map(([trabajadorId, tareas]) => ({
        trabajadorId,
        nombre: trabajadorId
          ? agentesMap.get(trabajadorId)?.nombre || `Agente #${trabajadorId}`
          : "Sin agente",
        tareas: tareas.slice().sort((a, b) => {
          const fa = a.fechaProgramada ? new Date(a.fechaProgramada).getTime() : 0;
          const fb = b.fechaProgramada ? new Date(b.fechaProgramada).getTime() : 0;
          return fb - fa;
        }),
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [selectedEmpresa, agentesMap]);

  const periodoLabel = useMemo(() => PeriodoLabel(periodo, mesSelect, anioSelect), [periodo, mesSelect, anioSelect]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-xs text-black/50">Módulo</div>
          <div className="text-sm font-semibold text-[#1d1e1c]">Consolidado por tarea</div>
          <div className="text-xs text-black/60 mt-1">Tarea → Empresas (con agente) → Detalle por empresa</div>
        </div>

        <div className="flex items-center gap-2">
          {globalLoading && <SpinnerSmall label="Cargando datos..." />}

          {/* ✅ Botón exporta SOLO lo filtrado */}
          <ExportTaskExcelButton
            disabled={globalLoading || !selectedTaskKey}
            periodoLabel={periodoLabel}
            selectedTaskMeta={selectedTaskMeta as any}
            estadoFilter={estadoFilter}
            empresaSearch={empresaSearch}
            empresasFiltradas={empresasFiltradas as any}
            detalleEmpresa={selectedEmpresa as any}
            groupedByAgente={groupedByAgente as any}
            formatFecha={formatFecha}
          />

          <button
            onClick={onBack}
            className="px-4 py-2 rounded-full text-xs font-semibold border border-black/10 bg-[#1d1e1c] text-white hover:bg-black transition shadow-sm"
            title="Volver a selección de módulo"
          >
            Cambiar módulo
          </button>
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

      {/* Layout 2 columnas */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Col: selector tarea */}
        <div className="xl:col-span-4 bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-black/5">
            <div className="text-xs font-semibold text-[#1d1e1c]">1) Selecciona tarea</div>
            <input
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Buscar tarea (nombre / código / área)..."
              className="mt-2 w-full text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
            />
          </div>

          <div className="max-h-[640px] overflow-auto">
            {tasksFiltered.map((t) => {
              const selected = selectedTaskKey === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setSelectedTaskKey(t.key);
                    setSelectedRut(null);
                    setEmpresaSearch("");
                    setEstadoFilter("ALL");
                  }}
                  className={`w-full text-left px-4 py-3 border-b border-black/5 transition ${
                    selected ? "bg-sky-50" : "bg-white hover:bg-black/[0.02]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1d1e1c] truncate">{t.nombre}</div>
                      <div className="text-[11px] text-black/50">
                        {t.area} · {t.codigo}
                      </div>
                      <div className="text-[11px] text-black/50 mt-0.5">Instancias: {t.total}</div>
                    </div>
                    <div className="shrink-0 text-[11px] text-sky-600 font-semibold">Ver →</div>
                  </div>
                </button>
              );
            })}

            {!tasksFiltered.length && <div className="p-4 text-xs text-black/60">No se encontraron tareas.</div>}
          </div>
        </div>

        {/* Col: empresas + detalle */}
        <div className="xl:col-span-8 space-y-4">
          {!selectedTaskKey || !selectedTaskMeta ? (
            <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-6 text-sm text-black/60">
              Selecciona una tarea para ver empresas y el agente ligado.
            </div>
          ) : (
            <>
              {/* Header tarea + filtros empresa */}
              <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-xs text-black/50">Tarea seleccionada</div>
                    <div className="text-sm font-semibold text-[#1d1e1c]">{selectedTaskMeta.nombre}</div>
                    <div className="text-[11px] text-black/50">
                      {selectedTaskMeta.area} · {selectedTaskMeta.codigo}
                    </div>
                  </div>

                  {/* ✅ CHIPS como tu imagen => FILTRO */}
                  <EstadoChips counters={counters} value={estadoFilter} onChange={setEstadoFilter} />
                </div>

                <div className="mt-3 flex gap-2 flex-wrap items-center">
                  <input
                    value={empresaSearch}
                    onChange={(e) => setEmpresaSearch(e.target.value)}
                    placeholder="2) Buscar empresa (rut o razón social)..."
                    className="w-full md:w-80 text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
                  />

                  <button
                    onClick={() => {
                      setEmpresaSearch("");
                      setEstadoFilter("ALL");
                      setSelectedRut(null);
                    }}
                    className="px-3 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150]"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Empresas table */}
              <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#1d1e1c]">2) Empresas</div>
                  <Badge tone="neutral">{empresasFiltradas.length}</Badge>
                </div>

                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-black/60 bg-white">
                        <th className="text-left px-4 py-2">Empresa</th>
                        <th className="text-left px-4 py-2">Agente(s)</th>
                        <th className="text-center px-4 py-2">Estado</th>
                        <th className="text-center px-4 py-2">Fecha</th>
                        <th className="text-center px-4 py-2">Atraso</th>
                        <th className="text-center px-4 py-2">Abiertas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empresasFiltradas.map((e) => (
                        <tr
                          key={e.rut}
                          className={`border-t border-black/5 cursor-pointer hover:bg-black/[0.02] ${
                            selectedRut === e.rut ? "bg-sky-50" : "bg-white"
                          }`}
                          onClick={() => setSelectedRut((prev) => (prev === e.rut ? null : e.rut))}
                        >
                          <td className="px-4 py-2">
                            <div className="font-semibold text-[#1d1e1c] truncate">{e.razonSocial}</div>
                            <div className="text-[11px] text-black/50">{e.rut}</div>
                          </td>

                          <td className="px-4 py-2">
                            {e.agentes.length === 0 ? (
                              <span className="text-[11px] text-black/40">-</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {e.agentes.slice(0, 2).map((a) => (
                                  <Badge key={a.trabajadorId} tone="neutral">
                                    {a.nombre} · {a.abiertas}
                                  </Badge>
                                ))}
                                {e.agentes.length > 2 && <Badge tone="neutral">+{e.agentes.length - 2}</Badge>}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-2 text-center">
                            <Badge tone={toneEstado(e.estado)}>{labelEstado(e.estado)}</Badge>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {e.fechaComprometida ? formatFecha(e.fechaComprometida) : "-"}
                          </td>
                          <td className="px-4 py-2 text-center">{e.atrasoDias === null ? "-" : String(e.atrasoDias)}</td>
                          <td className="px-4 py-2 text-center">{e.abiertas}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!empresasFiltradas.length && (
                    <div className="p-4 text-xs text-black/60">No hay empresas para esos filtros.</div>
                  )}
                </div>
              </div>

              {/* Detalle empresa */}
              {selectedEmpresa && (
                <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#1d1e1c]">3) Detalle</div>
                      <div className="text-[11px] text-black/50">
                        {selectedEmpresa.razonSocial} · {selectedEmpresa.rut}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedRut(null)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150]"
                    >
                      Cerrar
                    </button>
                  </div>

                  <div className="p-4 space-y-4">
                    {groupedByAgente.map((g) => (
                      <div key={g.trabajadorId} className="rounded-2xl border border-black/5 overflow-hidden">
                        <div className="px-4 py-2 bg-white border-b border-black/5 flex items-center justify-between">
                          <div className="text-xs font-semibold text-[#1d1e1c]">{g.nombre}</div>
                          <Badge tone="neutral">{g.tareas.length}</Badge>
                        </div>

                        <div className="overflow-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-black/60 bg-white">
                                <th className="text-left px-4 py-2">Código</th>
                                <th className="text-left px-4 py-2">Tarea</th>
                                <th className="text-center px-4 py-2">Estado</th>
                                <th className="text-center px-4 py-2">Programada</th>
                                <th className="text-center px-4 py-2">Completada</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.tareas.map((t: any) => (
                                <tr
                                  key={t.id_tarea_asignada ?? `${t.rutCliente}-${t.fechaProgramada}-${Math.random()}`}
                                  className="border-t border-black/5"
                                >
                                  <td className="px-4 py-2 text-black/70">{t.tareaPlantilla?.codigoDocumento || "-"}</td>
                                  <td className="px-4 py-2">
                                    <div className="font-semibold text-[#1d1e1c]">
                                      {t.tareaPlantilla?.nombre || `Tarea #${t.id_tarea_asignada ?? "-"}`}
                                    </div>
                                    <div className="text-[11px] text-black/50">{t.tareaPlantilla?.area || "-"}</div>
                                  </td>
                                  <td className="px-4 py-2 text-center">
                                    <Badge
                                      tone={
                                        t.estado === "VENCIDA"
                                          ? "bad"
                                          : t.estado === "COMPLETADA"
                                          ? "ok"
                                          : t.estado === "EN_PROCESO"
                                          ? "warn"
                                          : "neutral"
                                      }
                                    >
                                      {t.estado}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2 text-center">{formatFecha(t.fechaProgramada)}</td>
                                  <td className="px-4 py-2 text-center">{formatFecha(getFechaComplecion(t))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}

                    {groupedByAgente.length === 0 && (
                      <div className="text-xs text-black/60">No hay instancias para este cliente.</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="text-[11px] text-black/50">
        Nota: si la columna “Agente(s)” sale “-”, revisa que tu API esté devolviendo{" "}
        <span className="font-semibold">trabajadorId</span> en cada tarea.
      </div>
    </div>
  );
}
