import React, { useEffect, useMemo, useState } from "react";
import ApexChart from "react-apexcharts";
import { API_BASE_URL, fetchJSON, TareaFull, EstadoBack } from "./api";
import { useFiltroPeriodo, Periodo } from "./usePeriodo";

type MetricasAgente = {
  resumenAgente: {
    pendientes: number;
    enProceso: number;
    vencidas: number;
    completadas: number;
    total: number;
    nombre: string;
    email: string;
  } | null;
};

type Props = {
  trabajadorId: number;
  onClose: () => void;
  periodo: Periodo;
  mes: number;
  anio: number;
  tareasIniciales?: TareaFull[];
  clientes?: { rut: string; razonSocial?: string | null }[];
  clienteFiltroRut?: string;
};

const DIAS_POR_VENCER = 3;
const formatFecha = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL");
};

const diffDias = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const delta = Math.round((d - hoy.getTime()) / (1000 * 60 * 60 * 24));
  return delta;
};

async function fetchTareasAgente(trabajadorId: number): Promise<TareaFull[]> {
  const ruts = await fetchJSON<{ rut: string }[]>(
    `${API_BASE_URL}/tareas/mis-ruts?trabajadorId=${trabajadorId}`
  );
  const all: TareaFull[] = [];
  for (const item of ruts) {
    const rut = encodeURIComponent(item.rut);
    const tareas = await fetchJSON<TareaFull[]>(
      `${API_BASE_URL}/tareas/por-rut/${rut}?trabajadorId=${trabajadorId}`
    );
    all.push(...tareas);
  }
  return all;
}

const Spinner = () => (
  <div className="flex items-center justify-center py-6">
    <div className="h-10 w-10 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
  </div>
);

const AgenteModal: React.FC<Props> = ({
  trabajadorId,
  onClose,
  periodo,
  mes,
  anio,
  tareasIniciales,
  clientes = [],
  clienteFiltroRut = "ALL",
}) => {
  const [metricas, setMetricas] = useState<MetricasAgente | null>(null);
  const [tareas, setTareas] = useState<TareaFull[]>(tareasIniciales || []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [m, t] = await Promise.all([
          fetchJSON<MetricasAgente>(
            `${API_BASE_URL}/tareas/supervision/metricas/agente/${trabajadorId}`
          ),
          tareasIniciales ? Promise.resolve(tareasIniciales) : fetchTareasAgente(trabajadorId),
        ]);
        setMetricas(m);
        setTareas(t);
      } catch (e) {
        console.error("No se pudieron cargar datos del agente", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [trabajadorId, tareasIniciales]);

  const tareasFiltradas = useFiltroPeriodo(tareas, periodo, mes, anio).filter((t) =>
    clienteFiltroRut === "ALL" ? true : t.rutCliente === clienteFiltroRut
  );

  const kpis = useMemo(() => {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + DIAS_POR_VENCER);
    let pend = 0,
      proc = 0,
      venc = 0,
      comp = 0,
      porVencer = 0;
    tareasFiltradas.forEach((t) => {
      if (t.estado === "PENDIENTE") pend++;
      else if (t.estado === "EN_PROCESO") proc++;
      else if (t.estado === "COMPLETADA") comp++;
      else if (t.estado === "VENCIDA") venc++;

      const fv = new Date(t.fechaProgramada);
      if (t.estado !== "COMPLETADA" && fv >= hoy && fv <= limite) porVencer++;
    });
    return { pend, proc, venc, comp, porVencer, total: pend + proc + venc + comp };
  }, [tareasFiltradas]);

  const donutSeries = [kpis.pend, kpis.proc, kpis.venc, kpis.comp, kpis.porVencer];
  const donutOptions = {
    labels: [
      "Pendiente",
      "En proceso",
      "Vencida",
      "Completada",
      `Por vencer (<=${DIAS_POR_VENCER}d)`,
    ],
    colors: ["#fbbf24", "#38bdf8", "#f97373", "#22c55e", "#fb923c"],
    legend: { position: "bottom" },
  };

  const pendientesPorEmpresa = useMemo(() => {
    const map = new Map<
      string,
      { rut: string; nombre: string; pendientes: number }
    >();
    const getLabel = (rut: string | null | undefined) => {
      const r = rut || "SIN_RUT";
      const found = clientes.find((c) => c.rut === r);
      return found?.razonSocial || r;
    };
    tareasFiltradas
      .filter((t) => t.estado === "PENDIENTE")
      .forEach((t) => {
        const rut = t.rutCliente || "SIN_RUT";
        if (!map.has(rut)) {
          map.set(rut, { rut, nombre: getLabel(rut), pendientes: 0 });
        }
        map.get(rut)!.pendientes += 1;
      });
    return Array.from(map.values()).sort((a, b) => b.pendientes - a.pendientes);
  }, [tareasFiltradas, clientes]);

  const barSeries = [
    {
      name: "Pendientes",
      data: pendientesPorEmpresa.map((p) => p.pendientes),
    },
  ];
  const barOptions = {
    xaxis: {
      categories: pendientesPorEmpresa.map((p) => p.nombre),
      labels: { rotate: -30, trim: true },
    },
    colors: ["#fbbf24"],
    plotOptions: { bar: { horizontal: false, columnWidth: "50%" } },
    dataLabels: { enabled: true },
    legend: { position: "top" as const },
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-semibold">
              {metricas?.resumenAgente?.nombre || "Agente"}
            </h2>
            <p className="text-xs text-black/60">{metricas?.resumenAgente?.email}</p>
          </div>
          <button onClick={onClose} className="text-sm text-red-500">
            Cerrar
          </button>
        </div>

        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
              <Kpi label="Pendientes" value={kpis.pend} color="#fbbf24" />
              <Kpi label="En proceso" value={kpis.proc} color="#38bdf8" />
              <Kpi label="Vencidas" value={kpis.venc} color="#f97373" />
              <Kpi
                label={`Por vencer (<=${DIAS_POR_VENCER}d)`}
                value={kpis.porVencer}
                color="#fb923c"
              />
              <Kpi label="Completadas" value={kpis.comp} color="#22c55e" />
            </div>

            <div className="bg-white mt-4 rounded-xl p-4 border shadow">
              <h3 className="font-semibold text-sm mb-2">Distribución</h3>
              <ApexChart type="donut" series={donutSeries} options={donutOptions as any} height={260} />
            </div>

            <div className="bg-white mt-4 rounded-xl p-4 border shadow space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">Pendientes por empresa</h3>
                {pendientesPorEmpresa.length === 0 ? (
                  <p className="text-xs text-black/50">Sin tareas pendientes</p>
                ) : (
                  <ApexChart
                    type="bar"
                    series={barSeries as any}
                    options={barOptions as any}
                    height={260}
                  />
                )}
              </div>

              <TareasTabs
                tareas={tareasFiltradas}
                porVencerDias={DIAS_POR_VENCER}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

type TabKey = EstadoBack | "POR_VENCER";

const TareasTabs: React.FC<{
  tareas: TareaFull[];
  porVencerDias: number;
}> = ({ tareas, porVencerDias }) => {
  const [tab, setTab] = useState<TabKey>("PENDIENTE");

  const hoy = new Date();
  const limite = new Date();
  limite.setDate(hoy.getDate() + porVencerDias);

  const listas = useMemo(() => {
    const pendientes: TareaFull[] = [];
    const enProceso: TareaFull[] = [];
    const vencidas: TareaFull[] = [];
    const completadas: TareaFull[] = [];
    const porVencer: TareaFull[] = [];

    tareas.forEach((t) => {
      const fv = new Date(t.fechaProgramada);
      if (t.estado === "PENDIENTE") pendientes.push(t);
      if (t.estado === "EN_PROCESO") enProceso.push(t);
      if (t.estado === "VENCIDA") vencidas.push(t);
      if (t.estado === "COMPLETADA") completadas.push(t);
      if (t.estado !== "COMPLETADA" && fv >= hoy && fv <= limite) {
        porVencer.push(t);
      }
    });

    return { pendientes, enProceso, vencidas, completadas, porVencer };
  }, [tareas, hoy, limite]);

  const renderList = (arr: TareaFull[]) => {
    if (!arr.length) {
      return <p className="text-xs text-black/50">Sin tareas en esta categoría.</p>;
    }

    return (
      <div className="flex flex-col gap-2 max-h-72 overflow-auto">
        {arr.map((t) => {
          const dias = diffDias(t.fechaProgramada);
          const critico = t.estado !== "COMPLETADA" && typeof dias === "number" && dias < 0;
          const badge =
            t.estado === "COMPLETADA"
              ? "bg-emerald-50 text-emerald-700"
              : t.estado === "EN_PROCESO"
              ? "bg-sky-50 text-sky-700"
              : t.estado === "VENCIDA"
              ? "bg-rose-50 text-rose-700"
              : "bg-amber-50 text-amber-700";

          return (
            <div
              key={t.id_tarea_asignada}
              className="border border-black/5 rounded-lg p-3 bg-slate-50"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-black/80">
                  {t.tareaPlantilla?.nombre || "Tarea"}
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${badge}`}>
                  {t.estado}
                </span>
              </div>
              <div className="text-[11px] text-black/60">
                Vence: {formatFecha(t.fechaProgramada)}{" "}
                {typeof dias === "number" && (
                  <span className={critico ? "text-rose-600 font-semibold" : "text-black/60"}>
                    ({dias === 0 ? "hoy" : dias > 0 ? `en ${dias} d` : `${Math.abs(dias)} d vencida`})
                  </span>
                )}
              </div>
              {t.comentarios && (
                <p className="text-[11px] text-black/60 line-clamp-2 mt-1">{t.comentarios}</p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const currentList =
    tab === "PENDIENTE"
      ? listas.pendientes
      : tab === "EN_PROCESO"
      ? listas.enProceso
      : tab === "VENCIDA"
      ? listas.vencidas
      : tab === "COMPLETADA"
      ? listas.completadas
      : listas.porVencer;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "PENDIENTE", label: "Pendientes" },
    { key: "EN_PROCESO", label: "En proceso" },
    { key: "VENCIDA", label: "Vencidas" },
    { key: "POR_VENCER", label: `Por vencer (<=${porVencerDias}d)` },
    { key: "COMPLETADA", label: "Completadas" },
  ];

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-2 mb-3">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs border ${
              tab === t.key ? "bg-sky-600 text-white" : "bg-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {renderList(currentList)}
    </div>
  );
};

const Kpi: React.FC<{ label: string; value: number; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="bg-slate-50 rounded-lg p-3 border">
    <p className="text-xs text-black/60">{label}</p>
    <p className="text-xl font-semibold" style={{ color: color || "#111827" }}>
      {value}
    </p>
  </div>
);

export default AgenteModal;
