import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import {
  getMisRutsSupervision,
  getTareasDesactivadasSupervision,
  getTrabajadores,
  reactivarTareasSupervision,
  type RutItem,
  type TareaAsignada,
  type Trabajador,
} from "../../service/supervisionTareas.service";

type Props = {
  onBack: () => void;
};

const API_MONTHS = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export default function TareasDesactivadasPage({ onBack }: Props) {
  const now = new Date();

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [trabajadorId, setTrabajadorId] = useState<number | "">("");
  const [ruts, setRuts] = useState<RutItem[]>([]);
  const [tareas, setTareas] = useState<TareaAsignada[]>([]);

  const [rutFiltro, setRutFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);

  const [loadingTrabajadores, setLoadingTrabajadores] = useState(false);
  const [loadingRuts, setLoadingRuts] = useState(false);
  const [loadingTareas, setLoadingTareas] = useState(false);
  const [reactivandoId, setReactivandoId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTrabajadores = async () => {
      try {
        setLoadingTrabajadores(true);
        setError(null);

        const data = await getTrabajadores();
        const rows = Array.isArray(data)
          ? data
          : data?.data ?? data?.trabajadores ?? [];

        setTrabajadores(rows);
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los trabajadores.");
      } finally {
        setLoadingTrabajadores(false);
      }
    };

    loadTrabajadores();
  }, []);

  useEffect(() => {
    const loadRuts = async () => {
      if (!trabajadorId) {
        setRuts([]);
        setTareas([]);
        setRutFiltro("");
        return;
      }

      try {
        setLoadingRuts(true);
        setError(null);

        const data = await getMisRutsSupervision(Number(trabajadorId));
        setRuts(Array.isArray(data) ? data : []);
        setTareas([]);
        setRutFiltro("");
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los clientes del trabajador.");
        setRuts([]);
        setTareas([]);
      } finally {
        setLoadingRuts(false);
      }
    };

    loadRuts();
  }, [trabajadorId]);

  const cargarTareas = async () => {
    if (!trabajadorId) {
      setError("Debes seleccionar un trabajador.");
      setTareas([]);
      return;
    }

    try {
      setLoadingTareas(true);
      setError(null);

      const rutsParaConsulta = rutFiltro
        ? [rutFiltro]
        : ruts.map((r) => r.rut).filter(Boolean);

      const data = await getTareasDesactivadasSupervision({
        trabajadorId: Number(trabajadorId),
        ruts: rutsParaConsulta,
        anio,
        mes,
      });

      setTareas(data.tareas ?? []);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las tareas desactivadas.");
      setTareas([]);
    } finally {
      setLoadingTareas(false);
    }
  };

  const handleReactivar = async (tarea: TareaAsignada) => {
    try {
      setReactivandoId(tarea.id_tarea_asignada);
      setError(null);

      await reactivarTareasSupervision({
        tareaIds: [tarea.id_tarea_asignada],
        comentario: "Tarea reactivada por supervisor",
      });

      setTareas((prev) =>
        prev.filter((item) => item.id_tarea_asignada !== tarea.id_tarea_asignada)
      );
    } catch (err) {
      console.error(err);
      setError("No se pudo reactivar la tarea.");
    } finally {
      setReactivandoId(null);
    }
  };

  const razonSocialMap = useMemo(() => {
    return new Map(ruts.map((r) => [r.rut, r.razonSocial ?? null]));
  }, [ruts]);

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      const term = busqueda.trim().toLowerCase();
      if (!term) return true;

      const rut = (t.rutCliente ?? "").toLowerCase();
      const razon = (razonSocialMap.get(t.rutCliente ?? "") ?? "").toLowerCase();
      const nombre = (t.tareaPlantilla?.nombre ?? "").toLowerCase();
      const codigo = (t.tareaPlantilla?.codigoDocumento ?? "").toLowerCase();
      const area = (t.tareaPlantilla?.area ?? "").toLowerCase();
      const comentarioTexto = (t.comentarios ?? "").toLowerCase();
      const trabajador = (t.asignado?.nombre ?? "").toLowerCase();

      return (
        rut.includes(term) ||
        razon.includes(term) ||
        nombre.includes(term) ||
        codigo.includes(term) ||
        area.includes(term) ||
        comentarioTexto.includes(term) ||
        trabajador.includes(term)
      );
    });
  }, [tareas, busqueda, razonSocialMap]);

  const totalDesactivadas = tareasFiltradas.length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[var(--primary-color)]/10 p-3">
            <Ban className="h-6 w-6 text-[var(--primary-color)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Tareas desactivadas
            </h1>
            <p className="text-sm text-slate-500">
              Revisión de tareas marcadas como no aplica por trabajador.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total visibles
          </div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {totalDesactivadas}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            Tareas en estado No aplica
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Trabajador
            </label>
            <select
              value={trabajadorId}
              onChange={(e) =>
                setTrabajadorId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--primary-color)]"
            >
              <option value="">Seleccionar</option>
              {trabajadores.map((t) => (
                <option key={t.id_trabajador} value={t.id_trabajador}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Cliente / RUT
            </label>
            <select
              value={rutFiltro}
              onChange={(e) => setRutFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--primary-color)]"
              disabled={!trabajadorId || loadingRuts}
            >
              <option value="">Todos</option>
              {ruts.map((r) => (
                <option key={r.rut} value={r.rut}>
                  {r.rut}
                  {r.razonSocial ? ` - ${r.razonSocial}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Año
            </label>
            <input
              type="number"
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--primary-color)]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Mes
            </label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--primary-color)]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {API_MONTHS[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="xl:col-span-2 flex items-end">
            <button
              onClick={cargarTareas}
              disabled={
                loadingTareas ||
                loadingRuts ||
                loadingTrabajadores ||
                !trabajadorId
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary-color)] px-4 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingTareas ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Cargar tareas desactivadas
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por RUT, cliente, tarea, código, área, trabajador o comentario"
              className="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--primary-color)]"
            />
          </div>

          <div className="flex items-center justify-end rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            <Users className="mr-2 h-4 w-4" />
            {trabajadorId ? "Trabajador seleccionado" : "Sin trabajador"}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Trabajador</th>
                <th className="px-4 py-3 text-left font-semibold">RUT</th>
                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold">Área</th>
                <th className="px-4 py-3 text-left font-semibold">Código</th>
                <th className="px-4 py-3 text-left font-semibold">Tarea</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Programada</th>
                <th className="px-4 py-3 text-left font-semibold">Completada</th>
                <th className="px-4 py-3 text-left font-semibold">Comentario</th>
                <th className="px-4 py-3 text-left font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {loadingTareas ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Cargando tareas desactivadas...
                    </div>
                  </td>
                </tr>
              ) : tareasFiltradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    {error || "No hay tareas desactivadas para mostrar."}
                  </td>
                </tr>
              ) : (
                tareasFiltradas.map((t) => (
                  <tr
                    key={t.id_tarea_asignada}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-3">{t.asignado?.nombre ?? "-"}</td>
                    <td className="px-4 py-3">{t.rutCliente ?? "-"}</td>
                    <td className="px-4 py-3">
                      {t.rutCliente
                        ? razonSocialMap.get(t.rutCliente) ?? "-"
                        : "-"}
                    </td>
                    <td className="px-4 py-3">{t.tareaPlantilla?.area ?? "-"}</td>
                    <td className="px-4 py-3">
                      {t.tareaPlantilla?.codigoDocumento ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      {t.tareaPlantilla?.nombre ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {t.estado === "NO_APLICA" ? "No aplica" : t.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.fechaProgramada
                        ? new Date(t.fechaProgramada).toLocaleDateString("es-CL")
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {t.fechaComplecion
                        ? new Date(t.fechaComplecion).toLocaleDateString("es-CL")
                        : "-"}
                    </td>
                    <td className="px-4 py-3 max-w-[260px]">
                      <div className="truncate" title={t.comentarios ?? "-"}>
                        {t.comentarios ?? "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleReactivar(t)}
                        disabled={reactivandoId === t.id_tarea_asignada}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reactivandoId === t.id_tarea_asignada ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        Reactivar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}