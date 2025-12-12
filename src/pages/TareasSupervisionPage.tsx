import React, { useCallback, useEffect, useMemo, useState } from "react";
import ApexChart from "react-apexcharts";
import {
  API_BASE_URL,
  fetchJSON,
  TareaFull,
  ResumenAgente,
} from "../components/supervision/api";
import AgenteModal from "../components/supervision/AgenteModal";
import { filtrarPorPeriodo, Periodo } from "../components/supervision/usePeriodo";

type RutCliente = { rut: string; razonSocial?: string | null };

const DIAS_POR_VENCER = 3;

const SpinnerSmall: React.FC<{ label?: string }> = ({ label = "Cargando..." }) => (
  <div className="flex items-center gap-2 text-xs text-black/60">
    <div className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full rounded-full bg-sky-200 opacity-60 animate-ping" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
    </div>
    <span className="animate-pulse">{label}</span>
  </div>
);

async function fetchDataAgente(trabajadorId: number): Promise<{
  tareas: TareaFull[];
  ruts: RutCliente[];
}> {
  const ruts = await fetchJSON<RutCliente[]>(
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
  return { tareas: all, ruts };
}

const TareasSupervisionPage: React.FC = () => {
  const [resumen, setResumen] = useState<ResumenAgente[]>([]);
  const [tareasCache, setTareasCache] = useState<Record<number, TareaFull[]>>({});
  const [rutsCache, setRutsCache] = useState<Record<number, RutCliente[]>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedClientRut, setSelectedClientRut] = useState<string>("ALL");
  const [periodo, setPeriodo] = useState<Periodo>("actual");
  const [mesSelect, setMesSelect] = useState<number>(new Date().getMonth() + 1);
  const [anioSelect, setAnioSelect] = useState<number>(new Date().getFullYear());
  const [agenteDetalle, setAgenteDetalle] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"dashboard" | "empresas">("dashboard");

  const loadResumen = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resResumen = await fetchJSON<ResumenAgente[]>(
        `${API_BASE_URL}/tareas/supervision/resumen`
      );
      setResumen(resResumen);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar supervisión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumen();
  }, [loadResumen]);

  useEffect(() => {
    if (selectedAgentId === null) return;
    if (tareasCache[selectedAgentId] && rutsCache[selectedAgentId]) {
      setAgentLoading(false);
      return;
    }
    setAgentLoading(true);

    fetchDataAgente(selectedAgentId)
      .then(({ tareas, ruts }) => {
        setTareasCache((prev) => ({ ...prev, [selectedAgentId]: tareas }));
        setRutsCache((prev) => ({ ...prev, [selectedAgentId]: ruts }));
      })
      .catch((e) => console.error("Error cargando datos del agente", e))
      .finally(() => setAgentLoading(false));
  }, [selectedAgentId, tareasCache, rutsCache]);

  const tareasSeleccionadas = useMemo(() => {
    if (selectedAgentId === null) return [];
    const base = tareasCache[selectedAgentId] || [];
    const filtradas = filtrarPorPeriodo(base, periodo, mesSelect, anioSelect);
    if (selectedClientRut === "ALL") return filtradas;
    return filtradas.filter((t) => t.rutCliente === selectedClientRut);
  }, [selectedAgentId, tareasCache, periodo, mesSelect, anioSelect, selectedClientRut]);

  const clienteOptions = useMemo(() => {
    if (selectedAgentId === null) return [];
    const ruts = rutsCache[selectedAgentId] || [];
    return ruts;
  }, [selectedAgentId, rutsCache]);

  const globalKpis = useMemo(() => {
    if (selectedAgentId === null) {
      return { total: 0, pend: 0, proc: 0, venc: 0, comp: 0, porVencer: 0 };
    }

    let pend = 0,
      proc = 0,
      venc = 0,
      comp = 0,
      porVencer = 0;
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + DIAS_POR_VENCER);

    tareasSeleccionadas.forEach((t) => {
      if (t.estado === "PENDIENTE") pend++;
      else if (t.estado === "EN_PROCESO") proc++;
      else if (t.estado === "COMPLETADA") comp++;
      else if (t.estado === "VENCIDA") venc++;

      const fv = new Date(t.fechaProgramada);
      if (t.estado !== "COMPLETADA" && fv >= hoy && fv <= limite) porVencer++;
    });

    return { total: pend + proc + venc + comp, pend, proc, venc, comp, porVencer };
  }, [tareasSeleccionadas]);

  const donutSeries = [
    globalKpis.pend,
    globalKpis.proc,
    globalKpis.venc,
    globalKpis.comp,
    globalKpis.porVencer,
  ];
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

  const lineData = useMemo(() => {
    const bucket = new Map<
      string,
      { fecha: string; PENDIENTE: number; EN_PROCESO: number; VENCIDA: number; COMPLETADA: number }
    >();
    tareasSeleccionadas.forEach((t) => {
      const key = (t.fechaProgramada || t.createdAt).slice(0, 10);
      if (!bucket.has(key)) {
        bucket.set(key, {
          fecha: key,
          PENDIENTE: 0,
          EN_PROCESO: 0,
          VENCIDA: 0,
          COMPLETADA: 0,
        });
      }
      bucket.get(key)![t.estado]++;
    });
    const arr = Array.from(bucket.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return {
      categories: arr.map((d) => d.fecha),
      series: [
        { name: "Pendiente", data: arr.map((d) => d.PENDIENTE) },
        { name: "En proceso", data: arr.map((d) => d.EN_PROCESO) },
        { name: "Vencida", data: arr.map((d) => d.VENCIDA) },
        { name: "Completada", data: arr.map((d) => d.COMPLETADA) },
      ],
    };
  }, [tareasSeleccionadas]);

  const procesoAgentes = useMemo(() => {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + DIAS_POR_VENCER);

    if (selectedAgentId === null) return [];

    return resumen
      .filter((r) => r.trabajadorId === selectedAgentId)
      .map((r) => {
        const tareas = tareasSeleccionadas;
        const pendientes = tareas.filter(
          (t) => t.estado === "PENDIENTE" || t.estado === "EN_PROCESO"
        );
        const vencidas = tareas.filter((t) => t.estado === "VENCIDA");
        const porVencer = pendientes.filter((t) => {
          const fv = new Date(t.fechaProgramada);
          return fv >= hoy && fv <= limite;
        });
        const proximo =
          pendientes
            .map((t) => new Date(t.fechaProgramada))
            .filter((d) => !Number.isNaN(d.getTime()) && d >= hoy)
            .sort((a, b) => a.getTime() - b.getTime())[0] || null;

        const riesgoValor = vencidas.length * 2 + pendientes.length;
        const estado =
          riesgoValor > 10 ? "Crítico" : vencidas.length > 0 ? "Riesgo" : "Normal";

        return {
          ...r,
          pendientes: pendientes.length,
          vencidas: vencidas.length,
          porVencer: porVencer.length,
          proximoVenc: proximo ? proximo.toLocaleDateString() : "-",
          estadoProceso: estado,
        };
      });
  }, [resumen, tareasSeleccionadas, selectedAgentId]);

  const clientesHistogram = useMemo(() => {
    if (!selectedAgentId) {
      return { categories: [], pendientes: [], enProceso: [], vencidas: [], completadas: [] };
    }
    const map = new Map<
      string,
      { nombre: string; pendientes: number; enProceso: number; vencidas: number; completadas: number }
    >();
    const label = (rut?: string | null) => {
      const r = rut || "SIN_RUT";
      const found = clienteOptions.find((c) => c.rut === r);
      return found?.razonSocial || r;
    };

    tareasSeleccionadas.forEach((t) => {
      const rut = t.rutCliente || "SIN_RUT";
      if (!map.has(rut)) {
        map.set(rut, {
          nombre: label(rut),
          pendientes: 0,
          enProceso: 0,
          vencidas: 0,
          completadas: 0,
        });
      }
      const row = map.get(rut)!;
      if (t.estado === "PENDIENTE") row.pendientes += 1;
      else if (t.estado === "EN_PROCESO") row.enProceso += 1;
      else if (t.estado === "VENCIDA") row.vencidas += 1;
      else if (t.estado === "COMPLETADA") row.completadas += 1;
    });

    const arr = Array.from(map.values()).sort(
      (a, b) =>
        b.pendientes + b.enProceso + b.vencidas + b.completadas -
        (a.pendientes + a.enProceso + a.vencidas + a.completadas)
    );
    return {
      categories: arr.map((c) => c.nombre),
      pendientes: arr.map((c) => c.pendientes),
      enProceso: arr.map((c) => c.enProceso),
      vencidas: arr.map((c) => c.vencidas),
      completadas: arr.map((c) => c.completadas),
    };
  }, [tareasSeleccionadas, clienteOptions, selectedAgentId]);

  if (loading) return <div>Cargando supervisión...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const agenteSeleccionado = selectedAgentId
    ? resumen.find((r) => r.trabajadorId === selectedAgentId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          className="border rounded px-2 py-1 text-xs"
          value={selectedAgentId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedAgentId(val ? Number(val) : null);
            setSelectedClientRut("ALL");
          }}
        >
          <option value="">Selecciona un agente</option>
          {resumen.map((r) => (
            <option key={r.trabajadorId} value={r.trabajadorId}>
              {r.nombre}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1 text-xs">
          <select
            className="border rounded px-2 py-1"
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
            className="border rounded px-2 py-1 w-20"
            value={anioSelect}
            onChange={(e) => {
              setPeriodo("anio-especifico");
              setAnioSelect(Number(e.target.value));
            }}
          />
        </div>

        {(["actual", "hist"] as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => {
              setPeriodo(p);
              if (p === "actual") {
                const now = new Date();
                setMesSelect(now.getMonth() + 1);
                setAnioSelect(now.getFullYear());
              }
            }}
            className={`px-3 py-1 rounded-full text-xs border ${
              periodo === p ? "bg-sky-600 text-white" : "bg-white"
            }`}
          >
            {p === "actual" ? "Actual" : "Histórico"}
          </button>
        ))}

        {selectedAgentId !== null && (
          <div className="flex items-center gap-1 text-xs">
            <span>Cliente:</span>
            <select
              className="border rounded px-2 py-1"
              value={selectedClientRut}
              onChange={(e) => setSelectedClientRut(e.target.value)}
            >
              <option value="ALL">Todos</option>
              {clienteOptions.map((c) => (
                <option key={c.rut} value={c.rut}>
                  {c.razonSocial || c.rut}
                </option>
              ))}
            </select>
          </div>
        )}

        {(loading || agentLoading) && (
          <div className="ml-auto">
            <SpinnerSmall label="Cargando datos..." />
          </div>
        )}
      </div>

      {selectedAgentId === null ? (
        <div className="text-sm text-black/60">
          Selecciona un agente para ver sus dashboards y tareas filtradas.
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`px-4 py-1.5 rounded-full text-xs border ${
                viewMode === "dashboard" ? "bg-sky-600 text-white" : "bg-white"
              }`}
            >
              Dashboards
            </button>
            <button
              onClick={() => setViewMode("empresas")}
              className={`px-4 py-1.5 rounded-full text-xs border ${
                viewMode === "empresas" ? "bg-sky-600 text-white" : "bg-white"
              }`}
            >
              Empresas
            </button>
          </div>

          {viewMode === "dashboard" && (
            <>
              <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KpiCard label="Total" value={globalKpis.total} />
                <KpiCard label="Pendientes" value={globalKpis.pend} color="#fbbf24" />
                <KpiCard label="En proceso" value={globalKpis.proc} color="#38bdf8" />
                <KpiCard label="Vencidas" value={globalKpis.venc} color="#f97373" />
                <KpiCard
                  label={`Por vencer (<=${DIAS_POR_VENCER}d)`}
                  value={globalKpis.porVencer}
                  color="#fb923c"
                />
                <KpiCard label="Completadas" value={globalKpis.comp} color="#22c55e" />
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow border">
                  <h3 className="font-semibold text-sm mb-2">
                    Distribución {agenteSeleccionado ? `(${agenteSeleccionado.nombre})` : ""}
                  </h3>
                  <ApexChart type="donut" series={donutSeries} options={donutOptions as any} height={280} />
                </div>
                <div className="bg-white rounded-xl p-4 shadow border">
                  <h3 className="font-semibold text-sm mb-2">Avances por periodo</h3>
                  <ApexChart
                    type="area"
                    series={lineData.series as any}
                    options={{
                      xaxis: { categories: lineData.categories },
                      stroke: { curve: "smooth" },
                    } as any}
                    height={300}
                  />
                </div>
              </section>

              <section className="bg-white rounded-xl p-4 shadow border">
                <h3 className="font-semibold text-sm mb-3">Proceso general de tareas pendientes</h3>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Agente</th>
                        <th className="py-2 pr-3">Pendientes</th>
                        <th className="py-2 pr-3">Pend. vencidas</th>
                        <th className="py-2 pr-3">Pend. por vencer</th>
                        <th className="py-2 pr-3">Próx. vencimiento</th>
                        <th className="py-2 pr-3">Estado</th>
                        <th className="py-2 pr-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procesoAgentes.map((a) => (
                        <tr key={a.trabajadorId} className="border-b hover:bg-slate-50">
                          <td className="py-2 pr-3">{a.nombre}</td>
                          <td className="py-2 pr-3 text-amber-700">{a.pendientes}</td>
                          <td className="py-2 pr-3 text-rose-700">{a.vencidas}</td>
                          <td className="py-2 pr-3 text-orange-600">{a.porVencer}</td>
                          <td className="py-2 pr-3">{a.proximoVenc}</td>
                          <td className="py-2 pr-3">{a.estadoProceso}</td>
                          <td className="py-2 pr-3">
                            <button
                              onClick={() => setAgenteDetalle(a.trabajadorId)}
                              className="text-xs text-sky-600 underline"
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {viewMode === "empresas" && (
            <section className="bg-white rounded-xl p-4 shadow border">
              <h3 className="font-semibold text-sm mb-3">Empresas del agente (todas las tareas)</h3>
              {clientesHistogram.categories.length === 0 ? (
                <p className="text-xs text-black/50">Sin tareas para mostrar.</p>
              ) : (
                <ApexChart
                  type="bar"
                  series={[
                    { name: "Pendiente", data: clientesHistogram.pendientes },
                    { name: "En proceso", data: clientesHistogram.enProceso },
                    { name: "Vencida", data: clientesHistogram.vencidas },
                    { name: "Completada", data: clientesHistogram.completadas },
                  ] as any}
                  options={{
                    xaxis: { categories: clientesHistogram.categories, labels: { rotate: -30 } },
                    plotOptions: { bar: { horizontal: false, stacked: true, columnWidth: "60%" } },
                    colors: ["#fbbf24", "#38bdf8", "#f97373", "#22c55e"],
                    dataLabels: { enabled: true },
                    legend: { position: "top" },
                    tooltip: { shared: true },
                  } as any}
                  height={420}
                />
              )}
            </section>
          )}
        </>
      )}

      {agenteDetalle !== null && selectedAgentId !== null && (
        <AgenteModal
          trabajadorId={agenteDetalle}
          onClose={() => setAgenteDetalle(null)}
          periodo={periodo}
          mes={mesSelect}
          anio={anioSelect}
          tareasIniciales={tareasCache[agenteDetalle]}
          clientes={clienteOptions}
          clienteFiltroRut={selectedClientRut}
        />
      )}
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: number; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="bg-white rounded-xl p-3 shadow border">
    <p className="text-xs text-black/60">{label}</p>
    <p className="text-2xl font-semibold" style={{ color: color || "#111827" }}>
      {value}
    </p>
  </div>
);

export default TareasSupervisionPage;
