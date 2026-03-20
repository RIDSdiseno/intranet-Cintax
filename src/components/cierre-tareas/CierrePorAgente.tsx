import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import {
  completarTareasSupervision,
  desactivarTareasSupervision,
  getMisRutsSupervision,
  getTareasPorRutsSupervision,
  getTrabajadores,
  type EstadoTarea,
  type RutItem,
  type TareaAsignada,
  type Trabajador,
} from "../../service/supervisionTareas.service";

type Props = {
  onBack: () => void;
};

type EstadoFiltro =
  | "TODOS"
  | "PENDIENTE"
  | "EN_PROCESO"
  | "VENCIDA"
  | "COMPLETADA"
  | "NO_APLICA";

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

export default function CierrePorAgente({ onBack }: Props) {
  const now = new Date();

  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [trabajadorId, setTrabajadorId] = useState<number | "">("");
  const [ruts, setRuts] = useState<RutItem[]>([]);
  const [tareas, setTareas] = useState<TareaAsignada[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [rutFiltro, setRutFiltro] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("TODOS");
  const [busqueda, setBusqueda] = useState("");
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [comentario, setComentario] = useState("");

  const [loadingTrabajadores, setLoadingTrabajadores] = useState(false);
  const [loadingRuts, setLoadingRuts] = useState(false);
  const [loadingTareas, setLoadingTareas] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        setSelectedIds([]);
        setRutFiltro("");
        return;
      }

      try {
        setLoadingRuts(true);
        setError(null);

        const data = await getMisRutsSupervision(Number(trabajadorId));
        setRuts(Array.isArray(data) ? data : []);
        setTareas([]);
        setSelectedIds([]);
        setRutFiltro("");
      } catch (err) {
        console.error(err);
        setError("No se pudieron cargar los clientes del trabajador.");
        setRuts([]);
        setTareas([]);
        setSelectedIds([]);
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
      setSelectedIds([]);
      return;
    }

    try {
      setLoadingTareas(true);
      setError(null);

      const rutsParaConsulta = rutFiltro
        ? [rutFiltro]
        : ruts.map((r) => r.rut).filter(Boolean);

      const data = await getTareasPorRutsSupervision({
        trabajadorId: Number(trabajadorId),
        ruts: rutsParaConsulta,
        anio,
        mes,
      });

      setTareas(data.tareas ?? []);
      setSelectedIds([]);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las tareas.");
      setTareas([]);
      setSelectedIds([]);
    } finally {
      setLoadingTareas(false);
    }
  };

  const razonSocialMap = useMemo(() => {
    return new Map(ruts.map((r) => [r.rut, r.razonSocial ?? null]));
  }, [ruts]);

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      if (estadoFiltro !== "TODOS" && t.estado !== estadoFiltro) return false;

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
  }, [tareas, estadoFiltro, busqueda, razonSocialMap]);

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const ids = tareasFiltradas
      .filter((t) => t.estado !== "COMPLETADA" && t.estado !== "NO_APLICA")
      .map((t) => t.id_tarea_asignada);

    const todosSeleccionados =
      ids.length > 0 && ids.every((id) => selectedIds.includes(id));

    setSelectedIds(todosSeleccionados ? [] : ids);
  };

  const completarSeleccionadas = async () => {
    if (!selectedIds.length) {
      alert("Debes seleccionar al menos una tarea.");
      return;
    }

    try {
      setSubmitting(true);

      await completarTareasSupervision({
        tareaIds: selectedIds,
        comentario,
      });

      await cargarTareas();
      setComentario("");
      setSelectedIds([]);
      alert("Tareas completadas correctamente.");
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.message ||
          "No se pudieron completar las tareas seleccionadas."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const completarTodasFiltradas = async () => {
    if (!trabajadorId) {
      alert("Debes seleccionar un trabajador.");
      return;
    }

    try {
      setSubmitting(true);

      await completarTareasSupervision({
        trabajadorId: Number(trabajadorId),
        rutCliente: rutFiltro || undefined,
        anio,
        mes,
        incluirPendientes:
          estadoFiltro === "TODOS" || estadoFiltro === "PENDIENTE",
        incluirEnProceso:
          estadoFiltro === "TODOS" || estadoFiltro === "EN_PROCESO",
        incluirVencidas:
          estadoFiltro === "TODOS" || estadoFiltro === "VENCIDA",
        comentario,
      });

      await cargarTareas();
      setComentario("");
      setSelectedIds([]);
      alert("Tareas completadas correctamente.");
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.message ||
          "No se pudieron completar las tareas filtradas."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const completarUna = async (id: number) => {
    try {
      setSubmitting(true);

      await completarTareasSupervision({
        tareaIds: [id],
        comentario,
      });

      await cargarTareas();
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      alert("Tarea completada correctamente.");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo completar la tarea.");
    } finally {
      setSubmitting(false);
    }
  };

  const desactivarSeleccionadas = async () => {
    if (!selectedIds.length) {
      alert("Debes seleccionar al menos una tarea.");
      return;
    }

    try {
      setSubmitting(true);

      await desactivarTareasSupervision({
        tareaIds: selectedIds,
        comentario,
      });

      await cargarTareas();
      setComentario("");
      setSelectedIds([]);
      alert("Tareas desactivadas correctamente.");
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.message ||
          "No se pudieron desactivar las tareas seleccionadas."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const desactivarTodasFiltradas = async () => {
    if (!trabajadorId) {
      alert("Debes seleccionar un trabajador.");
      return;
    }

    try {
      setSubmitting(true);

      await desactivarTareasSupervision({
        trabajadorId: Number(trabajadorId),
        rutCliente: rutFiltro || undefined,
        anio,
        mes,
        incluirPendientes:
          estadoFiltro === "TODOS" || estadoFiltro === "PENDIENTE",
        incluirEnProceso:
          estadoFiltro === "TODOS" || estadoFiltro === "EN_PROCESO",
        incluirVencidas:
          estadoFiltro === "TODOS" || estadoFiltro === "VENCIDA",
        comentario,
      });

      await cargarTareas();
      setComentario("");
      setSelectedIds([]);
      alert("Tareas desactivadas correctamente.");
    } catch (err: any) {
      console.error(err);
      alert(
        err?.response?.data?.message ||
          "No se pudieron desactivar las tareas filtradas."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const desactivarUna = async (id: number) => {
    try {
      setSubmitting(true);

      await desactivarTareasSupervision({
        tareaIds: [id],
        comentario,
      });

      await cargarTareas();
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      alert("Tarea desactivada correctamente.");
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo desactivar la tarea.");
    } finally {
      setSubmitting(false);
    }
  };

  const badgeEstado = (estado: EstadoTarea) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold";

    if (estado === "PENDIENTE") {
      return (
        <span className={`${base} bg-amber-50 text-amber-700`}>
          Pendiente
        </span>
      );
    }

    if (estado === "EN_PROCESO") {
      return (
        <span className={`${base} bg-sky-50 text-sky-700`}>
          En proceso
        </span>
      );
    }

    if (estado === "VENCIDA") {
      return (
        <span className={`${base} bg-rose-50 text-rose-700`}>
          Vencida
        </span>
      );
    }

    if (estado === "COMPLETADA") {
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700`}>
          Completada
        </span>
      );
    }

    if (estado === "NO_APLICA") {
      return (
        <span className={`${base} bg-slate-100 text-slate-700`}>
          No aplica
        </span>
      );
    }

    return (
      <span className={`${base} bg-slate-100 text-slate-700`}>{estado}</span>
    );
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-[var(--primary-color)]/10 p-3">
            <Users className="h-6 w-6 text-[var(--primary-color)]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Cierre de tareas · Por agente
            </h1>
            <p className="text-sm text-slate-500">
              Cierra o desactiva tareas de trabajadores sin necesidad de subir
              archivos.
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
              Estado
            </label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--primary-color)]"
            >
              <option value="TODOS">Todos</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="VENCIDA">Vencida</option>
              <option value="COMPLETADA">Completada</option>
              <option value="NO_APLICA">No aplica</option>
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

          <div className="flex items-end">
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
              Cargar tareas
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por RUT, cliente, tarea, código, área, trabajador o comentario"
              className="w-full rounded-xl border border-slate-300 py-2 pl-10 pr-3 text-sm outline-none focus:border-[var(--primary-color)]"
            />
          </div>

          <input
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            placeholder="Comentario de cierre supervisor/admin"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--primary-color)]"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSelectAll}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Seleccionar visibles
          </button>

          <button
            onClick={completarSeleccionadas}
            disabled={submitting || selectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Completar seleccionadas ({selectedIds.length})
          </button>

          <button
            onClick={desactivarSeleccionadas}
            disabled={submitting || selectedIds.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            Desactivar seleccionadas ({selectedIds.length})
          </button>

          <button
            onClick={completarTodasFiltradas}
            disabled={submitting || !trabajadorId}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Completar todas las filtradas
          </button>

          <button
            onClick={desactivarTodasFiltradas}
            disabled={
              submitting ||
              !trabajadorId ||
              estadoFiltro === "COMPLETADA" ||
              estadoFiltro === "NO_APLICA"
            }
            className="inline-flex items-center gap-2 rounded-xl bg-rose-900 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Ban className="h-4 w-4" />
            )}
            Desactivar todas las filtradas
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Sel.</th>
                <th className="px-4 py-3 text-left font-semibold">Trabajador</th>
                <th className="px-4 py-3 text-left font-semibold">RUT</th>
                <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                <th className="px-4 py-3 text-left font-semibold">Área</th>
                <th className="px-4 py-3 text-left font-semibold">Código</th>
                <th className="px-4 py-3 text-left font-semibold">Tarea</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Programada</th>
                <th className="px-4 py-3 text-left font-semibold">Completada</th>
                <th className="px-4 py-3 text-left font-semibold">Acción</th>
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
                      Cargando tareas...
                    </div>
                  </td>
                </tr>
              ) : tareasFiltradas.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    {error || "No hay tareas para mostrar."}
                  </td>
                </tr>
              ) : (
                tareasFiltradas.map((t) => {
                  const disabled =
                    t.estado === "COMPLETADA" || t.estado === "NO_APLICA";

                  return (
                    <tr
                      key={t.id_tarea_asignada}
                      className="border-t border-slate-100"
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(t.id_tarea_asignada)}
                          disabled={disabled}
                          onChange={() => toggleSelected(t.id_tarea_asignada)}
                        />
                      </td>
                      <td className="px-4 py-3">{t.asignado?.nombre ?? "-"}</td>
                      <td className="px-4 py-3">{t.rutCliente ?? "-"}</td>
                      <td className="px-4 py-3">
                        {t.rutCliente
                          ? razonSocialMap.get(t.rutCliente) ?? "-"
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {t.tareaPlantilla?.area ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {t.tareaPlantilla?.codigoDocumento ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {t.tareaPlantilla?.nombre ?? "-"}
                      </td>
                      <td className="px-4 py-3">{badgeEstado(t.estado)}</td>
                      <td className="px-4 py-3">
                        {new Date(t.fechaProgramada).toLocaleDateString("es-CL")}
                      </td>
                      <td className="px-4 py-3">
                        {t.fechaComplecion
                          ? new Date(t.fechaComplecion).toLocaleDateString(
                              "es-CL"
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => completarUna(t.id_tarea_asignada)}
                            disabled={disabled || submitting}
                            className="rounded-lg bg-[var(--primary-color)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Completar
                          </button>

                          <button
                            onClick={() => desactivarUna(t.id_tarea_asignada)}
                            disabled={disabled || submitting}
                            className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Desactivar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}