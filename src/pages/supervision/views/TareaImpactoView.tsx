// src/pages/supervision/views/TareaImpactoView.tsx
import React, { useMemo, useState } from "react";
import type { TareaFull } from "../../../lib/api";
type EmpresaStat = {
  rut: string;
  razonSocial: string;
};

type Props = {
  empresasStats: EmpresaStat[]; // cartera (rut + razonSocial)
  tareasSeleccionadas: TareaFull[]; // YA filtradas por agente/periodo/filtros globales
  formatFecha: (iso?: string | null) => string;
};

type Tone = "ok" | "warn" | "bad" | "neutral";

const Badge: React.FC<{ children: React.ReactNode; tone?: Tone }> = ({
  children,
  tone = "neutral",
}) => {
  const cls =
    tone === "bad"
      ? "bg-rose-50 text-rose-700 border-rose-100"
      : tone === "warn"
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : tone === "ok"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-slate-50 text-slate-700 border-slate-100";
  return (
    <span className={`px-2 py-1 rounded-full text-[11px] border ${cls}`}>
      {children}
    </span>
  );
};

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

/** 🔑 Misma idea que tu getTaskKeyForFilter: estable (id plantilla si existe, sino codigo+nombre) */
function getTaskKey(t: TareaFull) {
  const pid = (t as any)?.tareaPlantilla?.id;
  const codigo = t.tareaPlantilla?.codigoDocumento || "SIN_CODIGO";
  const nombre =
    t.tareaPlantilla?.nombre || `Tarea #${(t as any)?.id_tarea_asignada ?? "-"}`;
  return String(pid ?? `${codigo}__${nombre}`);
}

function getTaskLabel(t: TareaFull) {
  const nombre =
    t.tareaPlantilla?.nombre || `Tarea #${(t as any)?.id_tarea_asignada ?? "-"}`;
  const codigo = t.tareaPlantilla?.codigoDocumento || "-";
  const area = t.tareaPlantilla?.area || "-";
  return { nombre, codigo, area };
}

type EstadoEmpresa =
  | "COMPLETADA"
  | "PENDIENTE"
  | "EN_PROCESO"
  | "VENCIDA"
  | "NO_INICIADA";

type RowEmpresa = {
  rut: string;
  razonSocial: string;
  estado: EstadoEmpresa;
  fechaComprometida: string | null; // ISO string o null
  atrasoDias: number | null;
  valor: number; // conteo de instancias abiertas (impacto simple)
  tareas: TareaFull[]; // instancias (para detalle)
};

const toneEstado = (st: EstadoEmpresa): Tone => {
  if (st === "VENCIDA") return "bad";
  if (st === "PENDIENTE" || st === "NO_INICIADA") return "warn";
  if (st === "COMPLETADA") return "ok";
  if (st === "EN_PROCESO") return "neutral";
  return "neutral";
};

const labelEstado = (st: EstadoEmpresa) => {
  if (st === "NO_INICIADA") return "No iniciada";
  if (st === "EN_PROCESO") return "En proceso";
  if (st === "PENDIENTE") return "Pendiente";
  if (st === "VENCIDA") return "Vencida";
  if (st === "COMPLETADA") return "Completada";
  return st;
};

function pickFechaMasProxima(
  isoList: Array<string | null | undefined>
): string | null {
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

/** ✅ Getter robusto para fecha de completitud (a veces viene con nombres distintos) */
function getFechaComplecion(t: any): string | null {
  return (
    t?.fechaComplecion ||
    t?.fechaCompletada ||
    t?.fechaCompleta ||
    t?.fechaCierre ||
    t?.updatedAt ||
    null
  );
}

export default function TareaImpactoView({
  empresasStats,
  tareasSeleccionadas,
  formatFecha,
}: Props) {
  const [taskSearch, setTaskSearch] = useState("");
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);

  const [empresaSearch, setEmpresaSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"ALL" | EstadoEmpresa>("ALL");
  const [selectedRut, setSelectedRut] = useState<string | null>(null);

  // 1) catálogo de tareas disponibles (desde las tareas ya filtradas globalmente)
  const taskCatalog = useMemo(() => {
    const map = new Map<
      string,
      { key: string; nombre: string; codigo: string; area: string; total: number }
    >();

    for (const t of tareasSeleccionadas) {
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
  }, [tareasSeleccionadas]);

  const tasksFiltered = useMemo(() => {
    const term = norm(taskSearch);
    if (!term) return taskCatalog.arr;
    return taskCatalog.arr.filter((t) =>
      norm(`${t.nombre} ${t.codigo} ${t.area}`).includes(term)
    );
  }, [taskCatalog, taskSearch]);

  // 2) empresas con status completada/no completada para la tarea seleccionada
  const empresasPorTarea = useMemo<RowEmpresa[]>(() => {
    if (!selectedTaskKey) return [];

    // index instancias por empresa (solo de la tarea seleccionada)
    const byRut = new Map<string, TareaFull[]>();
    for (const t of tareasSeleccionadas) {
      if (getTaskKey(t) !== selectedTaskKey) continue;
      const rut = (t.rutCliente || "SIN_RUT") as string;
      if (!byRut.has(rut)) byRut.set(rut, []);
      byRut.get(rut)!.push(t);
    }

    const out: RowEmpresa[] = [];

    // 👇 IMPORTANTÍSIMO: recorremos cartera => así aparecen también NO_INICIADA
    for (const e of empresasStats) {
      const inst = byRut.get(e.rut) || [];

      // 2.1 NO INICIADA (nunca aparece una instancia de esa tarea en esa empresa)
      if (inst.length === 0) {
        out.push({
          rut: e.rut,
          razonSocial: e.razonSocial,
          estado: "NO_INICIADA",
          fechaComprometida: null,
          atrasoDias: null,
          valor: 0,
          tareas: [],
        });
        continue;
      }

      const abiertas = inst.filter((x) => x.estado !== "COMPLETADA");
      const completadas = inst.filter((x) => x.estado === "COMPLETADA");

      // 2.2 COMPLETADA (hay instancias, y todas están completadas)
      if (abiertas.length === 0 && completadas.length > 0) {
        out.push({
          rut: e.rut,
          razonSocial: e.razonSocial,
          estado: "COMPLETADA",
          fechaComprometida: null,
          atrasoDias: 0,
          valor: 0,
          tareas: inst,
        });
        continue;
      }

      // 2.3 Hay abiertas => definir peor estado
      const estado: EstadoEmpresa =
        abiertas.some((x) => x.estado === "VENCIDA")
          ? "VENCIDA"
          : abiertas.some((x) => x.estado === "EN_PROCESO")
          ? "EN_PROCESO"
          : "PENDIENTE";

      // fecha comprometida: la MÁS PRÓXIMA de las abiertas (fechaProgramada)
      const fecha = pickFechaMasProxima(abiertas.map((x) => x.fechaProgramada));

      out.push({
        rut: e.rut,
        razonSocial: e.razonSocial,
        estado,
        fechaComprometida: fecha,
        atrasoDias: calcAtrasoDias(fecha),
        valor: abiertas.length,
        tareas: inst,
      });
    }

    // ranking para ordenar (primero lo crítico)
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
  }, [selectedTaskKey, empresasStats, tareasSeleccionadas]);

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

  // KPIs simples para el header
  const impactoTotals = useMemo(() => {
    if (!selectedTaskKey) return null;
    const total = empresasPorTarea.length;
    const completada = empresasPorTarea.filter((x) => x.estado === "COMPLETADA").length;
    const vencida = empresasPorTarea.filter((x) => x.estado === "VENCIDA").length;
    const pendiente = empresasPorTarea.filter((x) => x.estado === "PENDIENTE").length;
    const proceso = empresasPorTarea.filter((x) => x.estado === "EN_PROCESO").length;
    const noIniciada = empresasPorTarea.filter((x) => x.estado === "NO_INICIADA").length;
    return { total, completada, vencida, pendiente, proceso, noIniciada };
  }, [selectedTaskKey, empresasPorTarea]);

  const selectedTaskMeta = useMemo(() => {
    if (!selectedTaskKey) return null;
    return taskCatalog.map.get(selectedTaskKey) || null;
  }, [selectedTaskKey, taskCatalog]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1e1c]">Impacto por tarea</h2>
          <p className="text-xs text-black/60">
            1) Elige una tarea · 2) Verás empresas con tarea completada / no completada · 3) Clic para detalle
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* IZQUIERDA: selector de tarea */}
        <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-black/5">
            <input
              value={taskSearch}
              onChange={(e) => setTaskSearch(e.target.value)}
              placeholder="Buscar tarea (nombre / código / área)..."
              className="w-full text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
            />
          </div>

          <div className="max-h-[610px] overflow-auto">
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
                      <div className="text-xs font-semibold text-[#1d1e1c] truncate">
                        {t.nombre}
                      </div>
                      <div className="text-[11px] text-black/50">
                        {t.area} · {t.codigo}
                      </div>
                      <div className="text-[11px] text-black/50 mt-0.5">
                        Instancias: {t.total}
                      </div>
                    </div>
                    <div className="shrink-0 text-[11px] text-sky-600 font-semibold">
                      Seleccionar →
                    </div>
                  </div>
                </button>
              );
            })}

            {!tasksFiltered.length && (
              <div className="p-4 text-xs text-black/60">No se encontraron tareas.</div>
            )}
          </div>
        </div>

        {/* DERECHA: empresas completada/no completada */}
        <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-4">
          {!selectedTaskKey || !selectedTaskMeta ? (
            <div className="h-full min-h-[640px] flex items-start justify-start text-sm text-black/60 pt-2">
              Selecciona una tarea a la izquierda para ver el impacto en empresas.
            </div>
          ) : (
            <div className="space-y-4">
              {/* header tarea */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-black/50">Tarea seleccionada</div>
                  <div className="text-sm font-semibold text-[#1d1e1c]">
                    {selectedTaskMeta.nombre}
                  </div>
                  <div className="text-[11px] text-black/50">
                    {selectedTaskMeta.area} · {selectedTaskMeta.codigo}
                  </div>
                </div>

                {impactoTotals && (
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Badge tone="bad">Vencida {impactoTotals.vencida}</Badge>
                    <Badge tone="warn">Pend {impactoTotals.pendiente}</Badge>
                    <Badge tone="neutral">Proc {impactoTotals.proceso}</Badge>
                    <Badge tone="warn">No iniciada {impactoTotals.noIniciada}</Badge>
                    <Badge tone="ok">Completada {impactoTotals.completada}</Badge>
                  </div>
                )}
              </div>

              {/* filtros empresas */}
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  value={empresaSearch}
                  onChange={(e) => setEmpresaSearch(e.target.value)}
                  placeholder="Buscar empresa (rut o razón social)..."
                  className="w-full md:w-80 text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
                />

                <select
                  value={estadoFilter}
                  onChange={(e) => setEstadoFilter(e.target.value as any)}
                  className="text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
                >
                  <option value="ALL">Todos</option>
                  <option value="VENCIDA">Vencida</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="NO_INICIADA">No iniciada</option>
                  <option value="COMPLETADA">Completada</option>
                </select>

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

              {/* tabla empresas */}
              <div className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between">
                  <div className="text-xs font-semibold text-[#1d1e1c]">
                    Empresas · Completada / No completada
                  </div>
                  <Badge tone="neutral">{empresasFiltradas.length}</Badge>
                </div>

                <div className="max-h-[320px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-black/60 bg-white">
                        <th className="text-left px-4 py-2">Empresa</th>
                        <th className="text-center px-4 py-2">Estado</th>
                        <th className="text-center px-4 py-2">Fecha</th>
                        <th className="text-center px-4 py-2">Atraso</th>
                        <th className="text-center px-4 py-2">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empresasFiltradas.map((e) => (
                        <tr
                          key={e.rut}
                          className={`border-t border-black/5 cursor-pointer hover:bg-black/[0.02] ${
                            selectedRut === e.rut ? "bg-sky-50" : "bg-white"
                          }`}
                          onClick={() =>
                            setSelectedRut((prev) => (prev === e.rut ? null : e.rut))
                          }
                        >
                          <td className="px-4 py-2">
                            <div className="font-semibold text-[#1d1e1c] truncate">
                              {e.razonSocial}
                            </div>
                            <div className="text-[11px] text-black/50">{e.rut}</div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Badge tone={toneEstado(e.estado)}>{labelEstado(e.estado)}</Badge>
                          </td>
                          <td className="px-4 py-2 text-center">
                            {e.fechaComprometida ? formatFecha(e.fechaComprometida) : "-"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {e.atrasoDias === null ? "-" : String(e.atrasoDias)}
                          </td>
                          <td className="px-4 py-2 text-center">{e.valor}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!empresasFiltradas.length && (
                    <div className="p-4 text-xs text-black/60">
                      No hay empresas para esos filtros.
                    </div>
                  )}
                </div>
              </div>

              {/* detalle instancias */}
              {selectedEmpresa && (
                <div className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#1d1e1c]">
                        {selectedEmpresa.razonSocial}
                      </div>
                      <div className="text-[11px] text-black/50">{selectedEmpresa.rut}</div>
                    </div>
                    <button
                      onClick={() => setSelectedRut(null)}
                      className="px-3 py-1.5 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150]"
                    >
                      Cerrar
                    </button>
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
                        {selectedEmpresa.tareas.map((t) => (
                          <tr
                            key={(t as any)?.id_tarea_asignada ?? crypto.randomUUID()}
                            className="border-t border-black/5"
                          >
                            <td className="px-4 py-2 text-black/70">
                              {t.tareaPlantilla?.codigoDocumento || "-"}
                            </td>
                            <td className="px-4 py-2">
                              <div className="font-semibold text-[#1d1e1c]">
                                {t.tareaPlantilla?.nombre ||
                                  `Tarea #${(t as any)?.id_tarea_asignada ?? "-"}`}
                              </div>
                              <div className="text-[11px] text-black/50">
                                {t.tareaPlantilla?.area || "-"}
                              </div>
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
                            <td className="px-4 py-2 text-center">
                              {formatFecha(t.fechaProgramada)}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {formatFecha(getFechaComplecion(t))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!selectedEmpresa.tareas.length && (
                      <div className="p-4 text-xs text-black/60">
                        No hay instancias para este cliente (probablemente “No iniciada”).
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
