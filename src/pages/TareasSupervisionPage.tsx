// src/pages/TareasSupervisionPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import VistaPorRut from "../components/tareas/VistaPorRut";
import VistaPorTarea from "../components/tareas/VistaPorTarea";
import {
  Activity,
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Clock3,
  Target,
  Users as UsersIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  type PieLabelRenderProps,
} from "recharts";

type VistaTareas = "porRut" | "porTarea";

type ResumenAgente = {
  trabajadorId: number;
  nombre: string;
  email: string;
  pendientes: number;
  enProceso: number;
  vencidas: number;
  completadas: number;
  total: number; // total tareas
  areaInterna?: string | null; // ej: CONTA, TRIBUTARIO, etc.
  rol?: string | null;
};

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

const getAuthToken = () => {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token")
  );
};

const TareasSupervisionPage: React.FC = () => {
  const [vista, setVista] = useState<VistaTareas>("porRut");
  const [resumen, setResumen] = useState<ResumenAgente[]>([]);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);

  const [agenteSeleccionadoId, setAgenteSeleccionadoId] = useState<
    number | ""
  >("");
  const [filtroArea, setFiltroArea] = useState<string>("Todas");

  // ======================================================
  //   FETCH /tareas/supervision/resumen
  // ======================================================
  useEffect(() => {
    const fetchResumen = async () => {
      setLoadingResumen(true);
      setErrorResumen(null);
      try {
        const token = getAuthToken();

        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE_URL}/tareas/supervision/resumen`,
          { headers }
        );

        if (!res.ok) {
          if (res.status === 403) {
            throw new Error(
              "No tienes permisos para ver la supervisión de tareas. Esta vista es solo para supervisores o administradores."
            );
          }
          if (res.status === 401) {
            throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
          }
          throw new Error(`Error ${res.status}`);
        }

        const raw: any[] = await res.json();

        const parsed: ResumenAgente[] = (raw || []).map((r: any) => {
          const pendientes = r.pendientes ?? 0;
          const enProceso = r.enProceso ?? 0;
          const vencidas = r.vencidas ?? 0;
          const completadas = r.completadas ?? 0;

          return {
            trabajadorId: r.trabajadorId,
            nombre: r.nombre,
            email: r.email,
            pendientes,
            enProceso,
            vencidas,
            completadas,
            total: pendientes + enProceso + vencidas + completadas,
            areaInterna: r.areaInterna ?? r.area ?? null,
            rol: r.rol ?? null,
          };
        });

        setResumen(parsed);
      } catch (err: any) {
        console.error("[Front] Error cargando resumen supervisión", err);
        setErrorResumen(
          err?.message || "No se pudo cargar el resumen de tareas."
        );
      } finally {
        setLoadingResumen(false);
      }
    };

    fetchResumen();
  }, []);

  const agenteSeleccionado = resumen.find(
    (r) => r.trabajadorId === agenteSeleccionadoId
  );

  // ======================================================
  //   DERIVADOS / KPIs / GRÁFICOS
  // ======================================================

  // Áreas internas disponibles
  const areasDisponibles = useMemo(() => {
    const set = new Set<string>();
    resumen.forEach((r) => {
      if (r.areaInterna) set.add(r.areaInterna);
    });
    return ["Todas", ...Array.from(set)];
  }, [resumen]);

  // Filtrado por área
  const resumenFiltradoPorArea = useMemo(() => {
    if (filtroArea === "Todas") return resumen;
    return resumen.filter((r) => r.areaInterna === filtroArea);
  }, [resumen, filtroArea]);

  // KPIs globales del área seleccionada
  const kpis = useMemo(() => {
    if (resumenFiltradoPorArea.length === 0) {
      return {
        totalTareas: 0,
        totalPendientes: 0,
        totalEnProceso: 0,
        totalVencidas: 0,
        totalCompletadas: 0,
        porcentajeCompletadas: 0,
        promedioTareasPorAgente: 0,
      };
    }

    const totalTareas = resumenFiltradoPorArea.reduce(
      (acc, r) => acc + r.total,
      0
    );
    const totalPendientes = resumenFiltradoPorArea.reduce(
      (acc, r) => acc + r.pendientes,
      0
    );
    const totalEnProceso = resumenFiltradoPorArea.reduce(
      (acc, r) => acc + r.enProceso,
      0
    );
    const totalVencidas = resumenFiltradoPorArea.reduce(
      (acc, r) => acc + r.vencidas,
      0
    );
    const totalCompletadas = resumenFiltradoPorArea.reduce(
      (acc, r) => acc + r.completadas,
      0
    );
    const promedioTareasPorAgente =
      totalTareas / resumenFiltradoPorArea.length;

    const porcentajeCompletadas =
      totalTareas > 0 ? Math.round((totalCompletadas / totalTareas) * 100) : 0;

    return {
      totalTareas,
      totalPendientes,
      totalEnProceso,
      totalVencidas,
      totalCompletadas,
      porcentajeCompletadas,
      promedioTareasPorAgente: Math.round(promedioTareasPorAgente * 10) / 10,
    };
  }, [resumenFiltradoPorArea]);

  // KPIs comparativos por agente (porcentajes)
  const kpisPorAgente = useMemo(() => {
    return resumenFiltradoPorArea.map((r) => {
      const total =
        r.total || r.pendientes + r.enProceso + r.vencidas + r.completadas;

      const porcentajeCompletadas =
        total > 0 ? Math.round((r.completadas / total) * 100) : 0;

      const porcentajeVencidas =
        total > 0 ? Math.round((r.vencidas / total) * 100) : 0;

      const porcentajePendientes =
        total > 0 ? Math.round((r.pendientes / total) * 100) : 0;

      return {
        ...r,
        porcentajeCompletadas,
        porcentajeVencidas,
        porcentajePendientes,
        totalCalculado: total,
      };
    });
  }, [resumenFiltradoPorArea]);

  // Mejor cumplimiento (mayor % completadas)
  const mejorCumplimiento = useMemo(() => {
    if (kpisPorAgente.length === 0) return null;
    return [...kpisPorAgente].sort(
      (a, b) => b.porcentajeCompletadas - a.porcentajeCompletadas
    )[0];
  }, [kpisPorAgente]);

  // Mayor proporción de vencidas
  const masVencidas = useMemo(() => {
    if (kpisPorAgente.length === 0) return null;
    return [...kpisPorAgente].sort(
      (a, b) => b.porcentajeVencidas - a.porcentajeVencidas
    )[0];
  }, [kpisPorAgente]);

  // Ranking Top 5 por total de tareas
  const rankingPorTotal = useMemo(() => {
    return [...resumenFiltradoPorArea]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [resumenFiltradoPorArea]);

  // Data para gráfico de barras apiladas por agente
  const dataBarEstadosPorAgente = useMemo(
    () =>
      resumenFiltradoPorArea.map((r) => ({
        name: r.nombre,
        Pendientes: r.pendientes,
        "En proceso": r.enProceso,
        Vencidas: r.vencidas,
        Completadas: r.completadas,
      })),
    [resumenFiltradoPorArea]
  );

  // Data para gráfico de torta por estado global
  const dataPieEstados = useMemo(() => {
    const { totalPendientes, totalEnProceso, totalVencidas, totalCompletadas } =
      kpis;
    return [
      { name: "Pendientes", value: totalPendientes },
      { name: "En proceso", value: totalEnProceso },
      { name: "Vencidas", value: totalVencidas },
      { name: "Completadas", value: totalCompletadas },
    ].filter((d) => d.value > 0);
  }, [kpis]);

  const pieColors = ["#fbbf24", "#38bdf8", "#f97373", "#22c55e"];

  // ======================================================
  //   MANEJO DE PERMISOS / ERRORES
  // ======================================================

  if (errorResumen?.includes("permisos")) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-black/80">
          Supervisión de tareas
        </h1>
        <p className="text-xs text-black/50">
          Esta sección está restringida para usuarios con rol de supervisión o
          administración.
        </p>
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-xl px-4 py-3">
          {errorResumen}
        </div>
      </div>
    );
  }

  // ======================================================
  //   RENDER
  // ======================================================

  return (
    <div className="mt-6 flex flex-col gap-5">
      {/* HEADER (sin crear/asignar tareas) */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-black/80 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[var(--secondary-color)]" />
            Supervisión de tareas
          </h1>
          <p className="text-xs text-black/50">
            Monitoriza el desempeño de los agentes, compara por área (ej.
            Contabilidad) y revisa sus tareas en detalle.
          </p>
        </div>
      </header>

      {/* PANEL PRINCIPAL: FILTROS + KPIs + GRÁFICOS */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Columna izquierda: filtros, selector agente y KPIs */}
        <div className="flex flex-col gap-4 xl:col-span-1">
          {/* Card filtros y agente */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2
                  className="text-sm font-semibold"
                  style={{ color: "var(--primary-color)" }}
                >
                  Filtros de supervisión
                </h2>
                <p className="text-[11px] text-black/50">
                  Elige área interna y agente para analizar.
                </p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-black/50">
                <UsersIcon className="w-3.5 h-3.5" />
                {resumenFiltradoPorArea.length} agentes
              </div>
            </div>

            {/* Filtro área interna */}
            <div>
              <label className="block text-[11px] font-semibold text-black/70 mb-1">
                Área interna
              </label>
              <select
                value={filtroArea}
                onChange={(e) => {
                  setFiltroArea(e.target.value);
                  setAgenteSeleccionadoId(""); // reset agente al cambiar área
                }}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--secondary-color)]"
              >
                {areasDisponibles.map((a) => (
                  <option key={a} value={a}>
                    {a === "Todas" ? "Todas las áreas" : a}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de agente */}
            <div>
              <label className="block text-[11px] font-semibold text-black/70 mb-1">
                Agente
              </label>
              {loadingResumen && (
                <p className="text-xs text-black/50">Cargando agentes…</p>
              )}
              {errorResumen && !loadingResumen && (
                <p className="text-xs text-rose-600">{errorResumen}</p>
              )}
              {!errorResumen && !loadingResumen && (
                <select
                  value={agenteSeleccionadoId}
                  onChange={(e) =>
                    setAgenteSeleccionadoId(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  className="w-full border border-black/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--secondary-color)]"
                >
                  <option value="">Selecciona un agente…</option>
                  {resumenFiltradoPorArea.map((r) => (
                    <option key={r.trabajadorId} value={r.trabajadorId}>
                      {r.nombre} ({r.email})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* KPIs del área seleccionada */}
            <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
              <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 flex flex-col gap-1">
                <span className="flex items-center gap-1 text-slate-700 font-semibold">
                  <Activity className="w-3.5 h-3.5" />
                  Total tareas
                </span>
                <span className="text-slate-900 text-sm">
                  {kpis.totalTareas}
                </span>
                <span className="text-[10px] text-slate-500">
                  Promedio por agente: {kpis.promedioTareasPorAgente}
                </span>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex flex-col gap-1">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Completadas
                </span>
                <span className="text-emerald-900 text-sm">
                  {kpis.totalCompletadas}
                </span>
                <span className="text-[10px] text-emerald-600">
                  {kpis.porcentajeCompletadas}% del total
                </span>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 flex flex-col gap-1">
                <span className="flex items-center gap-1 text-amber-700 font-semibold">
                  <Clock3 className="w-3.5 h-3.5" />
                  Pendientes
                </span>
                <span className="text-amber-900 text-sm">
                  {kpis.totalPendientes}
                </span>
                <span className="text-[10px] text-amber-700">
                  Tareas aún por iniciar
                </span>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex flex-col gap-1">
                <span className="flex items-center gap-1 text-rose-700 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Vencidas
                </span>
                <span className="text-rose-900 text-sm">
                  {kpis.totalVencidas}
                </span>
                <span className="text-[10px] text-rose-600">
                  Priorizar seguimiento
                </span>
              </div>
            </div>

            {/* Comparativas entre trabajadores (mejor/peor) */}
            {kpisPorAgente.length > 0 && (
              <div className="mt-3 border-t border-black/5 pt-3 space-y-2 text-[11px]">
                <p className="text-[11px] text-black/60 mb-1">
                  Comparativa entre trabajadores (área seleccionada):
                </p>

                {mejorCumplimiento && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 flex justify-between items-center gap-2">
                    <div>
                      <p className="font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mejor cumplimiento
                      </p>
                      <p className="text-[10px] text-emerald-700/80">
                        {mejorCumplimiento.nombre} ·{" "}
                        {mejorCumplimiento.porcentajeCompletadas}% completadas
                      </p>
                    </div>
                    <span className="text-[10px] text-emerald-900/80">
                      {mejorCumplimiento.completadas}/
                      {mejorCumplimiento.totalCalculado} tareas
                    </span>
                  </div>
                )}

                {masVencidas && (
                  <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex justify-between items-center gap-2">
                    <div>
                      <p className="font-semibold text-rose-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Mayor proporción de vencidas
                      </p>
                      <p className="text-[10px] text-rose-700/80">
                        {masVencidas.nombre} ·{" "}
                        {masVencidas.porcentajeVencidas}% vencidas
                      </p>
                    </div>
                    <span className="text-[10px] text-rose-900/80">
                      {masVencidas.vencidas}/
                      {masVencidas.totalCalculado} tareas
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Resumen del agente seleccionado */}
            {agenteSeleccionado && (
              <div className="mt-3 border-t border-black/5 pt-3">
                <p className="text-[11px] text-black/60 mb-1">
                  Resumen del agente seleccionado:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <p className="font-semibold text-amber-700">Pendientes</p>
                    <p className="text-amber-800/80 text-sm">
                      {agenteSeleccionado.pendientes}
                    </p>
                  </div>
                  <div className="bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
                    <p className="font-semibold text-sky-700">En proceso</p>
                    <p className="text-sky-800/80 text-sm">
                      {agenteSeleccionado.enProceso}
                    </p>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                    <p className="font-semibold text-rose-700">Vencidas</p>
                    <p className="text-rose-800/80 text-sm">
                      {agenteSeleccionado.vencidas}
                    </p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                    <p className="font-semibold text-emerald-700">
                      Completadas
                    </p>
                    <p className="text-emerald-800/80 text-sm">
                      {agenteSeleccionado.completadas}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Columna central: gráfico barras apiladas */}
        <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-3 xl:col-span-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-black/80 flex items-center gap-1">
                <BarChart2 className="w-4 h-4 text-[var(--secondary-color)]" />
                Estados por agente (área seleccionada)
              </h2>
              <p className="text-[11px] text-black/50">
                Comparativa visual de pendientes, en proceso, vencidas y
                completadas.
              </p>
            </div>
          </div>
          {dataBarEstadosPorAgente.length === 0 ? (
            <p className="text-[11px] text-black/40 mt-4">
              No hay datos para el área seleccionada.
            </p>
          ) : (
            <div className="w-full h-64 mt-1">
              <ResponsiveContainer>
                <BarChart data={dataBarEstadosPorAgente} stackOffset="none">
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Pendientes" stackId="a" fill="#fbbf24" />
                  <Bar dataKey="En proceso" stackId="a" fill="#38bdf8" />
                  <Bar dataKey="Vencidas" stackId="a" fill="#f97373" />
                  <Bar dataKey="Completadas" stackId="a" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Columna derecha: pie + ranking + tabla comparativa */}
        <div className="flex flex-col gap-4 xl:col-span-1">
          {/* Gráfico de torta */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-black/80 flex items-center gap-1">
                  <Target className="w-4 h-4 text-[var(--secondary-color)]" />
                  Mix de estados
                </h2>
                <p className="text-[11px] text-black/50">
                  Distribución de tareas por estado en el área filtrada.
                </p>
              </div>
            </div>
            {dataPieEstados.length === 0 ? (
              <p className="text-[11px] text-black/40 mt-4">
                No hay tareas registradas para mostrar distribución.
              </p>
            ) : (
              <div className="w-full h-52 mt-1 flex items-center justify-center">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={dataPieEstados}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={70}
                      innerRadius={40}
                      paddingAngle={2}
                      label={(props: PieLabelRenderProps) => {
                        const name = props.name ?? "";
                        const percent = props.percent ?? 0;
                        return `${name} (${(percent * 100).toFixed(0)}%)`;
                      }}
                    >
                      {dataPieEstados.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={pieColors[index % pieColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Ranking / comparativa top 5 + tabla comparativa */}
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-black/80 flex items-center gap-1 mb-2">
              <UsersIcon className="w-4 h-4 text-[var(--secondary-color)]" />
              Ranking agentes (Top 5 por tareas)
            </h2>
            {rankingPorTotal.length === 0 ? (
              <p className="text-[11px] text-black/40">
                No hay agentes con tareas en el área seleccionada.
              </p>
            ) : (
              <div className="space-y-2 text-[11px]">
                {rankingPorTotal.map((r, idx) => {
                  const porcentaje =
                    kpis.totalTareas > 0
                      ? Math.round((r.total / kpis.totalTareas) * 100)
                      : 0;
                  return (
                    <div
                      key={r.trabajadorId}
                      className="flex flex-col gap-1 border border-black/5 rounded-xl px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-black/80">
                            #{idx + 1} {r.nombre}
                          </p>
                          <p className="text-[10px] text-black/40">
                            {r.email} · Área: {r.areaInterna ?? "—"}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-black/70">
                          {r.total} tareas
                        </span>
                      </div>
                      <div className="w-full bg-black/5 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${porcentaje}%`,
                            background:
                              "linear-gradient(90deg, #22c55e, #38bdf8)",
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-black/45">
                        <span>
                          Pend: {r.pendientes} · En proc: {r.enProceso}
                        </span>
                        <span>
                          Venc: {r.vencidas} · Comp: {r.completadas}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tabla comparativa rápida por agente */}
            {kpisPorAgente.length > 0 && (
              <div className="mt-3 border-t border-black/5 pt-3">
                <p className="text-[11px] text-black/60 mb-1">
                  Comparativa rápida por agente:
                </p>
                <div className="max-h-40 overflow-auto rounded-lg border border-black/5">
                  <table className="w-full text-[10px]">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-2 py-1 font-semibold">
                          Agente
                        </th>
                        <th className="text-right px-2 py-1 font-semibold">
                          Total
                        </th>
                        <th className="text-right px-2 py-1 font-semibold">
                          % Comp
                        </th>
                        <th className="text-right px-2 py-1 font-semibold">
                          % Venc
                        </th>
                        <th className="text-right px-2 py-1 font-semibold">
                          % Pend
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpisPorAgente.map((r) => (
                        <tr
                          key={r.trabajadorId}
                          className="odd:bg-white even:bg-slate-50/40"
                        >
                          <td className="px-2 py-1 truncate max-w-[140px]">
                            {r.nombre}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {r.totalCalculado}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {r.porcentajeCompletadas}%
                          </td>
                          <td className="px-2 py-1 text-right">
                            {r.porcentajeVencidas}%
                          </td>
                          <td className="px-2 py-1 text-right">
                            {r.porcentajePendientes}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* selector de vista */}
      <div className="inline-flex bg-white rounded-full border border-black/5 p-1 self-start shadow-sm mt-1">
        <button
          type="button"
          onClick={() => setVista("porRut")}
          className={`px-4 py-1.5 text-xs rounded-full transition ${
            vista === "porRut"
              ? "bg-[var(--primary-color)] text-white shadow-sm"
              : "text-black/60 hover:bg-black/5"
          }`}
          disabled={!agenteSeleccionadoId}
        >
          Ver por RUT
        </button>
        <button
          type="button"
          onClick={() => setVista("porTarea")}
          className={`px-4 py-1.5 text-xs rounded-full transition ${
            vista === "porTarea"
              ? "bg-[var(--primary-color)] text-white shadow-sm"
              : "text-black/60 hover:bg-black/5"
          }`}
          disabled={!agenteSeleccionadoId}
        >
          Ver por tarea
        </button>
      </div>

      {!agenteSeleccionadoId && !loadingResumen && !errorResumen && (
        <p className="text-xs text-black/50">
          Selecciona un agente para ver su tablero de tareas en modo
          supervisión.
        </p>
      )}

      {agenteSeleccionadoId && (
        <p className="text-[11px] text-black/50">
          Estás viendo las tareas asignadas al agente seleccionado, no las
          tuyas.
        </p>
      )}

      {agenteSeleccionadoId && vista === "porRut" && (
        <VistaPorRut trabajadorIdFiltro={agenteSeleccionadoId} />
      )}

      {agenteSeleccionadoId && vista === "porTarea" && (
        <VistaPorTarea trabajadorIdFiltro={agenteSeleccionadoId} />
      )}
    </div>
  );
};

export default TareasSupervisionPage;
