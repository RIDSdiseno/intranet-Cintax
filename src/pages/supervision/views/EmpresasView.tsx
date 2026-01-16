// src/pages/supervision/views/EmpresasView.tsx
import React, { useMemo, useState } from "react";
import type { TareaFull } from "../../../lib/api";
type EmpresaStat = {
  rut: string;
  razonSocial: string;
  pendientes: number;
  enProceso: number;
  vencidas: number;
  completadas: number;
  porVencer: number;
  total: number;
};

type Props = {
  selectedAgentId: number;

  empresasStats: EmpresaStat[];
  empresasFiltradas: EmpresaStat[];
  empresasPage: EmpresaStat[];

  empresaSearch: string;
  setEmpresaSearch: (v: string) => void;

  empresaPageIndex: number;
  setEmpresaPageIndex: (v: number) => void;

  pageSize: number;

  empresaSeleccionadaRut: string | null;
  setEmpresaSeleccionadaRut: (rut: string | null) => void;

  totalEmpresas: number;
  totalTareasEmpresas: number;

  tareasSeleccionadas: TareaFull[];
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

const PillBtn: React.FC<{
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
      active
        ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
        : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
    }`}
  >
    {children}
  </button>
);

// Normaliza para buscar sin errores por mayus/acentos básicos
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

function toneFromCounts(vencidas: number, porVencer: number, total: number): Tone {
  if (vencidas > 0) return "bad";
  if (porVencer > 0) return "warn";
  if (total === 0) return "ok";
  return "neutral";
}

const DonutMini: React.FC<{
  pend: number;
  proc: number;
  venc: number;
  comp: number;
  size?: number;
}> = ({ pend, proc, venc, comp, size = 200 }) => {
  const total = Math.max(1, pend + proc + venc + comp);
  const p1 = (pend / total) * 100;
  const p2 = (proc / total) * 100;
  const p3 = (venc / total) * 100;

  const cPend = "#fbbf24";
  const cProc = "#38bdf8";
  const cVenc = "#f97373";
  const cComp = "#22c55e";

  const bg = `conic-gradient(
    ${cPend} 0% ${p1}%,
    ${cProc} ${p1}% ${p1 + p2}%,
    ${cVenc} ${p1 + p2}% ${p1 + p2 + p3}%,
    ${cComp} ${p1 + p2 + p3}% 100%
  )`;

  const pct = Math.round((comp / total) * 100);

  return (
    <div className="w-full flex items-center justify-center">
      <div className="relative rounded-full" style={{ width: size, height: size, background: bg }} aria-label="donut">
        <div
          className="absolute inset-0 m-[22%] rounded-full bg-white"
          style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.06)" }}
        />
        <div className="absolute inset-0 flex items-end justify-center pb-6">
          <div className="text-[11px] font-semibold text-black/70">{pct}%</div>
        </div>
      </div>
    </div>
  );
};

function getTaskKey(t: TareaFull) {
  const pid = (t as any)?.tareaPlantilla?.id;
  const codigo = t.tareaPlantilla?.codigoDocumento || "SIN_CODIGO";
  const nombre = t.tareaPlantilla?.nombre || `Tarea #${t.id_tarea_asignada}`;
  return String(pid ?? `${codigo}__${nombre}`);
}

function getTaskLabel(t: TareaFull) {
  const nombre = t.tareaPlantilla?.nombre || `Tarea #${t.id_tarea_asignada}`;
  const codigo = t.tareaPlantilla?.codigoDocumento || "-";
  const area = t.tareaPlantilla?.area || "-";
  return { nombre, codigo, area };
}

const EmpresasView: React.FC<Props> = ({
  empresasStats,
  empresasFiltradas,
  empresasPage,
  empresaSearch,
  setEmpresaSearch,
  empresaPageIndex,
  setEmpresaPageIndex,
  pageSize,
  empresaSeleccionadaRut,
  setEmpresaSeleccionadaRut,
  totalEmpresas,
  totalTareasEmpresas,
  tareasSeleccionadas,
  formatFecha,
}) => {
  const [searchMode, setSearchMode] = useState<"cliente" | "tarea">("cliente");

  // =========================
  // MODO CLIENTE
  // =========================
  const totalPages = Math.max(1, Math.ceil(empresasFiltradas.length / pageSize));

  const empresaSeleccionada = useMemo(() => {
    if (!empresaSeleccionadaRut) return null;
    return empresasStats.find((e) => e.rut === empresaSeleccionadaRut) || null;
  }, [empresaSeleccionadaRut, empresasStats]);

  const tareasEmpresaSeleccionada = useMemo(() => {
    if (!empresaSeleccionadaRut) return [];
    return tareasSeleccionadas.filter((t) => (t.rutCliente || "SIN_RUT") === empresaSeleccionadaRut);
  }, [empresaSeleccionadaRut, tareasSeleccionadas]);

  // =========================
  // MODO TAREA
  // =========================
  const [taskSearch, setTaskSearch] = useState("");
  const [selectedTaskKey, setSelectedTaskKey] = useState<string | null>(null);
  const [selectedTaskClientRut, setSelectedTaskClientRut] = useState<string | null>(null);

  const taskIndex = useMemo(() => {
    type ClientRow = {
      rut: string;
      razonSocial: string;
      pendientes: number;
      enProceso: number;
      vencidas: number;
      completadas: number;
      total: number;
      tareas: TareaFull[];
    };

    type TaskRow = {
      key: string;
      nombre: string;
      codigo: string;
      area: string;
      pendientes: number;
      enProceso: number;
      vencidas: number;
      completadas: number;
      total: number;
      clients: Map<string, ClientRow>;
    };

    const empresasByRut = new Map<string, string>();
    empresasStats.forEach((e) => empresasByRut.set(e.rut, e.razonSocial));

    const mapa = new Map<string, TaskRow>();

    for (const t of tareasSeleccionadas) {
      const rut = (t.rutCliente || "SIN_RUT") as string;
      const razon = empresasByRut.get(rut) || rut;

      const key = getTaskKey(t);
      const meta = getTaskLabel(t);

      if (!mapa.has(key)) {
        mapa.set(key, {
          key,
          nombre: meta.nombre,
          codigo: meta.codigo,
          area: meta.area,
          pendientes: 0,
          enProceso: 0,
          vencidas: 0,
          completadas: 0,
          total: 0,
          clients: new Map(),
        });
      }

      const tr = mapa.get(key)!;

      if (!tr.clients.has(rut)) {
        tr.clients.set(rut, {
          rut,
          razonSocial: razon,
          pendientes: 0,
          enProceso: 0,
          vencidas: 0,
          completadas: 0,
          total: 0,
          tareas: [],
        });
      }

      const cr = tr.clients.get(rut)!;
      cr.tareas.push(t);

      if (t.estado === "PENDIENTE") {
        tr.pendientes += 1;
        cr.pendientes += 1;
      } else if (t.estado === "EN_PROCESO") {
        tr.enProceso += 1;
        cr.enProceso += 1;
      } else if (t.estado === "VENCIDA") {
        tr.vencidas += 1;
        cr.vencidas += 1;
      } else if (t.estado === "COMPLETADA") {
        tr.completadas += 1;
        cr.completadas += 1;
      }

      tr.total += 1;
      cr.total += 1;
    }

    const arr = Array.from(mapa.values()).sort(
      (a, b) => b.vencidas - a.vencidas || b.pendientes - a.pendientes || b.total - a.total
    );

    return { mapa, arr };
  }, [tareasSeleccionadas, empresasStats]);

  const tasksFiltered = useMemo(() => {
    const term = norm(taskSearch);
    if (!term) return taskIndex.arr;
    return taskIndex.arr.filter((t) => norm(`${t.nombre} ${t.codigo} ${t.area}`).includes(term));
  }, [taskIndex, taskSearch]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskKey) return null;
    return taskIndex.mapa.get(selectedTaskKey) || null;
  }, [selectedTaskKey, taskIndex]);

  const selectedTaskClients = useMemo(() => {
    if (!selectedTask) return [];
    return Array.from(selectedTask.clients.values()).sort(
      (a, b) => b.vencidas - a.vencidas || b.pendientes - a.pendientes || b.total - a.total
    );
  }, [selectedTask]);

  const selectedTaskClient = useMemo(() => {
    if (!selectedTask || !selectedTaskClientRut) return null;
    return selectedTask.clients.get(selectedTaskClientRut) || null;
  }, [selectedTask, selectedTaskClientRut]);

  const resetTaskSelection = () => {
    setSelectedTaskKey(null);
    setSelectedTaskClientRut(null);
  };

  const resetClientSelection = () => setEmpresaSeleccionadaRut(null);

  // =========================
  // ✅ NUEVO: Empresas afectadas (sin esta tarea completada)
  // =========================
  type AfectadaEstado = "NO_INICIADA" | "PENDIENTE" | "EN_PROCESO" | "VENCIDA";
  type EmpresaAfectada = {
    rut: string;
    razonSocial: string;
    estado: AfectadaEstado;
    fechaComprometida: string | null;
    atrasoDias: number | null;
    valor: number; // cuántas instancias abiertas (útil como “impacto”)
  };

  const empresasAfectadas = useMemo<EmpresaAfectada[]>(() => {
    if (!selectedTask) return [];

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const pickWorstEstado = (arr: TareaFull[]): AfectadaEstado => {
      // prioridad de “peor” a “mejor”
      if (arr.some((x) => x.estado === "VENCIDA")) return "VENCIDA";
      if (arr.some((x) => x.estado === "EN_PROCESO")) return "EN_PROCESO";
      return "PENDIENTE";
    };

    const pickFecha = (arr: TareaFull[]): string | null => {
      const fechas = arr
        .map((t) => (t.fechaProgramada ? new Date(t.fechaProgramada) : null))
        .filter((d): d is Date => !!d && !Number.isNaN(d.getTime()))
        .sort((a, b) => a.getTime() - b.getTime());
      return fechas[0] ? fechas[0].toISOString() : null;
    };

    const calcAtraso = (iso: string | null) => {
      if (!iso) return null;
      const d = new Date(iso);
      d.setHours(0, 0, 0, 0);
      if (Number.isNaN(d.getTime())) return null;
      if (d.getTime() >= hoy.getTime()) return 0;
      const diff = hoy.getTime() - d.getTime();
      return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    const out: EmpresaAfectada[] = [];

    for (const e of empresasStats) {
      const instancias = tareasSeleccionadas.filter(
        (t) => (t.rutCliente || "SIN_RUT") === e.rut && getTaskKey(t) === selectedTask.key
      );

      // Si tiene instancias pero TODAS completadas -> no afecta
      if (instancias.length > 0 && instancias.every((x) => x.estado === "COMPLETADA")) continue;

      if (instancias.length === 0) {
        out.push({
          rut: e.rut,
          razonSocial: e.razonSocial,
          estado: "NO_INICIADA",
          fechaComprometida: null,
          atrasoDias: null,
          valor: 0,
        });
        continue;
      }

      const abiertas = instancias.filter((x) => x.estado !== "COMPLETADA");
      const estado = pickWorstEstado(abiertas);
      const fecha = pickFecha(abiertas);
      const atraso = calcAtraso(fecha);

      out.push({
        rut: e.rut,
        razonSocial: e.razonSocial,
        estado,
        fechaComprometida: fecha,
        atrasoDias: atraso,
        valor: abiertas.length,
      });
    }

    // Orden: Vencida > No iniciada > En proceso > Pendiente, luego por atraso, luego por nombre
    const rank: Record<AfectadaEstado, number> = {
      VENCIDA: 0,
      NO_INICIADA: 1,
      EN_PROCESO: 2,
      PENDIENTE: 3,
    };

    return out.sort((a, b) => {
      const r = rank[a.estado] - rank[b.estado];
      if (r !== 0) return r;
      const da = a.atrasoDias ?? -1;
      const db = b.atrasoDias ?? -1;
      if (db !== da) return db - da;
      return a.razonSocial.localeCompare(b.razonSocial);
    });
  }, [selectedTask, empresasStats, tareasSeleccionadas]);

  const toneEstadoAfectada = (st: AfectadaEstado): Tone => {
    if (st === "VENCIDA") return "bad";
    if (st === "NO_INICIADA") return "warn";
    if (st === "EN_PROCESO") return "neutral";
    return "neutral";
  };

  const labelEstadoAfectada = (st: AfectadaEstado) => {
    if (st === "NO_INICIADA") return "No iniciada";
    if (st === "EN_PROCESO") return "En proceso";
    if (st === "VENCIDA") return "Vencida";
    return "Pendiente";
  };

  // =========================
  // Layout
  // =========================
  return (
    <div className="space-y-4">
      {/* Header + selector */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-[#1d1e1c]">Empresas</h2>
          <p className="text-xs text-black/60">
            Total empresas: {totalEmpresas} · Tareas filtradas: {totalTareasEmpresas}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <PillBtn
            active={searchMode === "cliente"}
            onClick={() => {
              setSearchMode("cliente");
              resetTaskSelection();
            }}
          >
            Clientes
          </PillBtn>
          <PillBtn
            active={searchMode === "tarea"}
            onClick={() => {
              setSearchMode("tarea");
              resetClientSelection();
            }}
          >
            Tareas
          </PillBtn>
        </div>
      </div>

      {/* CONTENIDO: 2 columnas */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* COLUMNA IZQUIERDA */}
        <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-3 border-b border-black/5 bg-white">
            {searchMode === "cliente" ? (
              <input
                value={empresaSearch}
                onChange={(e) => setEmpresaSearch(e.target.value)}
                placeholder="Buscar clientes (RUT o razón social)..."
                className="w-full text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
              />
            ) : (
              <div className="flex gap-2">
                <input
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Buscar tarea (nombre / código / área)..."
                  className="w-full text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
                />
                {selectedTaskKey && (
                  <button
                    onClick={resetTaskSelection}
                    className="px-3 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150]"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="max-h-[610px] overflow-auto">
            {searchMode === "cliente" ? (
              <>
                {empresasPage.map((e) => {
                  const selected = empresaSeleccionadaRut === e.rut;

                  return (
                    <button
                      key={e.rut}
                      onClick={() => setEmpresaSeleccionadaRut(selected ? null : e.rut)}
                      className={`w-full text-left px-4 py-3 border-b border-black/5 transition ${
                        selected ? "bg-sky-50" : "bg-white hover:bg-black/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#1d1e1c] truncate">{e.razonSocial}</div>
                          <div className="text-[11px] text-black/50">{e.rut}</div>
                          <div className="text-[11px] text-black/50 mt-0.5">
                            Pend {e.pendientes} · Proc {e.enProceso} · Venc {e.vencidas} · Comp {e.completadas}
                          </div>
                        </div>

                        <div className="shrink-0 text-[11px] text-sky-600 font-semibold">Ver detalle →</div>
                      </div>
                    </button>
                  );
                })}

                {!empresasPage.length && <div className="p-4 text-xs text-black/60">No hay clientes para el filtro actual.</div>}
              </>
            ) : (
              <>
                {tasksFiltered.map((t) => {
                  const selected = selectedTaskKey === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => {
                        setSelectedTaskKey(t.key);
                        setSelectedTaskClientRut(null);
                      }}
                      className={`w-full text-left px-4 py-3 border-b border-black/5 transition ${
                        selected ? "bg-sky-50" : "bg-white hover:bg-black/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#1d1e1c] truncate">{t.nombre}</div>
                          <div className="text-[11px] text-black/50">
                            {t.area} · {t.codigo}
                          </div>
                          <div className="text-[11px] text-black/50 mt-0.5">
                            Pend {t.pendientes} · Proc {t.enProceso} · Venc {t.vencidas} · Comp {t.completadas}
                          </div>
                        </div>

                        <div className="shrink-0 text-[11px] text-sky-600 font-semibold">Ver detalle →</div>
                      </div>
                    </button>
                  );
                })}

                {!tasksFiltered.length && (
                  <div className="p-4 text-xs text-black/60">No se encontraron tareas con ese criterio.</div>
                )}
              </>
            )}
          </div>

          {/* Paginación SOLO cliente */}
          {searchMode === "cliente" && (
            <div className="flex items-center justify-between gap-2 p-3 border-t border-black/5 bg-white">
              <div className="text-xs text-black/60">
                Página {empresaPageIndex} de {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEmpresaPageIndex(Math.max(1, empresaPageIndex - 1))}
                  disabled={empresaPageIndex <= 1}
                  className="px-3 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setEmpresaPageIndex(Math.min(totalPages, empresaPageIndex + 1))}
                  disabled={empresaPageIndex >= totalPages}
                  className="px-3 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA */}
        <div className="bg-white border border-black/5 rounded-2xl shadow-sm p-4">
          {searchMode === "cliente" ? (
            !empresaSeleccionada ? (
              <div className="h-full min-h-[640px] flex items-start justify-start text-sm text-black/60 pt-2">
                Selecciona un cliente para ver detalle.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header cliente + totals */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-black/50">Cliente</div>
                    <div className="text-sm font-semibold text-[#1d1e1c]">{empresaSeleccionada.razonSocial}</div>
                    <div className="text-[11px] text-black/50">{empresaSeleccionada.rut}</div>
                  </div>

                  <div className="text-right text-[11px] text-black/60">
                    <div>Pend {empresaSeleccionada.pendientes}</div>
                    <div>Proc {empresaSeleccionada.enProceso}</div>
                    <div>Venc {empresaSeleccionada.vencidas}</div>
                    <div>Comp {empresaSeleccionada.completadas}</div>
                  </div>
                </div>

                {/* mini-cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                    <div className="text-xs text-black/60">Pendientes</div>
                    <div className="text-2xl font-semibold text-[#f59e0b]">{empresaSeleccionada.pendientes}</div>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                    <div className="text-xs text-black/60">En proceso</div>
                    <div className="text-2xl font-semibold text-sky-600">{empresaSeleccionada.enProceso}</div>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                    <div className="text-xs text-black/60">Vencidas</div>
                    <div className="text-2xl font-semibold text-rose-600">{empresaSeleccionada.vencidas}</div>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                    <div className="text-xs text-black/60">Completadas</div>
                    <div className="text-2xl font-semibold text-emerald-600">{empresaSeleccionada.completadas}</div>
                  </div>
                </div>

                {/* Donut */}
                <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                  <DonutMini
                    pend={empresaSeleccionada.pendientes}
                    proc={empresaSeleccionada.enProceso}
                    venc={empresaSeleccionada.vencidas}
                    comp={empresaSeleccionada.completadas}
                    size={220}
                  />

                  <div className="mt-3 flex items-center justify-center gap-3 text-[11px] text-black/60 flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#fbbf24]" /> Pendiente
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#38bdf8]" /> En proceso
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#f97373]" /> Vencida
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> Completada
                    </span>
                  </div>
                </div>

                {/* Tabla tareas del cliente */}
                <div className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5">
                    <div className="text-xs font-semibold text-[#1d1e1c]">Tareas del cliente</div>
                  </div>

                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-black/60 bg-white">
                          <th className="text-left px-4 py-2">Código</th>
                          <th className="text-left px-4 py-2">Tarea</th>
                          <th className="text-center px-4 py-2">Estado</th>
                          <th className="text-center px-4 py-2">Programada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tareasEmpresaSeleccionada.map((t) => (
                          <tr key={t.id_tarea_asignada} className="border-t border-black/5">
                            <td className="px-4 py-2 text-black/70">{t.tareaPlantilla?.codigoDocumento || "-"}</td>
                            <td className="px-4 py-2">
                              <div className="font-semibold text-[#1d1e1c]">
                                {t.tareaPlantilla?.nombre || `Tarea #${t.id_tarea_asignada}`}
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
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!tareasEmpresaSeleccionada.length && (
                      <div className="p-4 text-xs text-black/60">No hay tareas para este cliente con los filtros actuales.</div>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : (
            // =========================
            // MODO TAREA: panel derecho
            // =========================
            !selectedTask ? (
              <div className="h-full min-h-[640px] flex items-start justify-start text-sm text-black/60 pt-2">
                Selecciona una tarea para ver los clientes que la tienen.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-black/50">Tarea</div>
                    <div className="text-sm font-semibold text-[#1d1e1c]">{selectedTask.nombre}</div>
                    <div className="text-[11px] text-black/50">
                      {selectedTask.area} · {selectedTask.codigo}
                    </div>
                  </div>

                  <div className="text-right text-[11px] text-black/60">
                    <div>Pend {selectedTask.pendientes}</div>
                    <div>Proc {selectedTask.enProceso}</div>
                    <div>Venc {selectedTask.vencidas}</div>
                    <div>Comp {selectedTask.completadas}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                    <div className="text-xs text-black/60">Pendientes</div>
                    <div className="text-2xl font-semibold text-[#f59e0b]">{selectedTask.pendientes}</div>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                    <div className="text-xs text-black/60">En proceso</div>
                    <div className="text-2xl font-semibold text-sky-600">{selectedTask.enProceso}</div>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                    <div className="text-xs text-black/60">Vencidas</div>
                    <div className="text-2xl font-semibold text-rose-600">{selectedTask.vencidas}</div>
                  </div>
                  <div className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                    <div className="text-xs text-black/60">Completadas</div>
                    <div className="text-2xl font-semibold text-emerald-600">{selectedTask.completadas}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm">
                  <DonutMini
                    pend={selectedTask.pendientes}
                    proc={selectedTask.enProceso}
                    venc={selectedTask.vencidas}
                    comp={selectedTask.completadas}
                    size={220}
                  />
                </div>

                {/* ✅ NUEVO: Empresas sin esta tarea completada */}
                <div className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#1d1e1c]">📌 Empresas sin esta tarea completada</div>
                      <div className="text-[11px] text-black/50">
                        Muestra dónde esta tarea está pendiente, vencida o no iniciada.
                      </div>
                    </div>
                    <Badge tone="neutral">{empresasAfectadas.length}</Badge>
                  </div>

                  <div className="max-h-[260px] overflow-auto">
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
                        {empresasAfectadas.map((e) => (
                          <tr key={e.rut} className="border-t border-black/5">
                            <td className="px-4 py-2">
                              <div className="font-semibold text-[#1d1e1c] truncate">{e.razonSocial}</div>
                              <div className="text-[11px] text-black/50">{e.rut}</div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Badge tone={toneEstadoAfectada(e.estado)}>{labelEstadoAfectada(e.estado)}</Badge>
                            </td>
                            <td className="px-4 py-2 text-center">{e.fechaComprometida ? formatFecha(e.fechaComprometida) : "-"}</td>
                            <td className="px-4 py-2 text-center">
                              {e.atrasoDias === null ? "-" : e.atrasoDias === 0 ? "0" : `${e.atrasoDias}`}
                            </td>
                            <td className="px-4 py-2 text-center">{e.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!empresasAfectadas.length && (
                      <div className="p-4 text-xs text-black/60">No hay empresas afectadas (todas completadas).</div>
                    )}
                  </div>
                </div>

                {/* Clientes con esa tarea */}
                <div className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
                  <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between">
                    <div className="text-xs font-semibold text-[#1d1e1c]">Clientes con esta tarea</div>
                    <Badge tone="neutral">{selectedTaskClients.length}</Badge>
                  </div>

                  <div className="max-h-[240px] overflow-auto">
                    {selectedTaskClients.map((c) => {
                      const selected = selectedTaskClientRut === c.rut;
                      const tone: Tone = c.vencidas > 0 ? "bad" : c.pendientes + c.enProceso > 0 ? "warn" : "ok";

                      return (
                        <button
                          key={c.rut}
                          onClick={() => setSelectedTaskClientRut(selected ? null : c.rut)}
                          className={`w-full text-left px-4 py-3 border-b border-black/5 transition ${
                            selected ? "bg-sky-50" : "bg-white hover:bg-black/[0.02]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#1d1e1c] truncate">{c.razonSocial}</div>
                              <div className="text-[11px] text-black/50">{c.rut}</div>
                              <div className="text-[11px] text-black/50 mt-0.5">
                                Pend {c.pendientes} · Proc {c.enProceso} · Venc {c.vencidas} · Comp {c.completadas}
                              </div>
                            </div>
                            <div className="shrink-0">
                              <Badge tone={tone}>
                                {tone === "bad" ? "Con vencidas" : tone === "warn" ? "Pendiente" : "OK"}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      );
                    })}

                    {!selectedTaskClients.length && (
                      <div className="p-4 text-xs text-black/60">Ningún cliente tiene esta tarea con los filtros actuales.</div>
                    )}
                  </div>
                </div>

                {/* Detalle instancias (cliente seleccionado) */}
                {selectedTaskClient && (
                  <div className="rounded-2xl border border-black/5 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-[#f5f4f0] border-b border-black/5 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-[#1d1e1c]">{selectedTaskClient.razonSocial}</div>
                        <div className="text-[11px] text-black/50">{selectedTaskClient.rut}</div>
                      </div>
                      <button
                        onClick={() => setSelectedTaskClientRut(null)}
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
                          {selectedTaskClient.tareas.map((t) => (
                            <tr key={t.id_tarea_asignada} className="border-t border-black/5">
                              <td className="px-4 py-2 text-black/70">{t.tareaPlantilla?.codigoDocumento || "-"}</td>
                              <td className="px-4 py-2">
                                <div className="font-semibold text-[#1d1e1c]">
                                  {t.tareaPlantilla?.nombre || `Tarea #${t.id_tarea_asignada}`}
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
                              <td className="px-4 py-2 text-center">{formatFecha(t.fechaComplecion)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {!selectedTaskClient.tareas.length && (
                        <div className="p-4 text-xs text-black/60">No hay instancias para este cliente.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default EmpresasView;
