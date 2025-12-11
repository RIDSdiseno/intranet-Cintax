// src/components/tareas/VistaPorRut.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  FolderSearch,
  AlertCircle,
  ListTodo,
  PlayCircle,
  CheckCircle2,
  Search,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

import type { EstadoTarea, TareaAsignada } from "./tiposTareas";
import CompletarTareaModal from "./CompletarTareaModal";
import MultiCompletarTareasModal from "./MultiCompletarTareasModal";

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

type LoadState = "idle" | "loading" | "success" | "error";

type VistaPorRutProps = {
  trabajadorIdFiltro?: number;
};

type RutConNombre = {
  rut: string;
  razonSocial?: string | null;
};

type SubVista = "tablero" | "tabla";

const PAGE_SIZE_TABLA = 10;

// Resumen para el modal simple
type TareaResumenModal = {
  id_tarea_asignada: number;
  rutCliente?: string | null;
  clienteRazonSocial?: string | null;
  fechaProgramada: string;
  tareaPlantilla?: {
    nombre: string | null;
    codigoDocumento?: string | null;
  } | null;
};

const VistaPorRut: React.FC<VistaPorRutProps> = ({ trabajadorIdFiltro }) => {
  const [ruts, setRuts] = useState<RutConNombre[]>([]);
  const [rutSeleccionado, setRutSeleccionado] = useState<string | null>(null);

  const [tareas, setTareas] = useState<TareaAsignada[]>([]);
  const [loadingRuts, setLoadingRuts] = useState<LoadState>("idle");
  const [loadingTareas, setLoadingTareas] = useState<LoadState>("idle");
  const [errorRuts, setErrorRuts] = useState<string | null>(null);
  const [errorTareas, setErrorTareas] = useState<string | null>(null);

  // búsqueda de clientes (RUT / razón social) en el panel izquierdo
  const [busquedaCliente, setBusquedaCliente] = useState("");

  // búsqueda de tareas (código, nombre, nota, RUT, razón social) en navbar
  const [busquedaTarea, setBusquedaTarea] = useState("");

  // sub-vista tablero / tabla
  const [subVista, setSubVista] = useState<SubVista>("tablero");

  // vista tabla (todas las tareas)
  const [todasTareas, setTodasTareas] = useState<TareaAsignada[]>([]);
  const [loadingTodas, setLoadingTodas] = useState<LoadState>("idle");
  const [errorTodas, setErrorTodas] = useState<string | null>(null);
  const [paginaTabla, setPaginaTabla] = useState(1);
  const [estadoFiltroTabla, setEstadoFiltroTabla] = useState<"TODOS" | EstadoTarea>(
    "TODOS"
  );

  // selección múltiple (solo tablero)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // --- filtros de fecha (mes / año) ---
  const now = new Date();
  const [anioFiltro, setAnioFiltro] = useState<number>(now.getFullYear());
  const [mesFiltro, setMesFiltro] = useState<number>(now.getMonth() + 1); // 1–12

  // --- estado modal completar con archivo (1 tarea) ---
  const [modalTarea, setModalTarea] = useState<TareaResumenModal | null>(null);
  const [modalFile, setModalFile] = useState<File | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // --- llave para forzar recargas desde acciones (completar tarea, etc.) ---
  const [reloadKey, setReloadKey] = useState(0);

  // --- estado modal masivo (N tareas con N archivos) ---
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [multiModalLoading, setMultiModalLoading] = useState(false);
  const [multiModalError, setMultiModalError] = useState<string | null>(null);
  const [multiFilesMap, setMultiFilesMap] = useState<Record<number, File | null>>(
    {}
  );
  const [multiTareasSeleccionadas, setMultiTareasSeleccionadas] = useState<
    TareaAsignada[]
  >([]);

  // ---------------------------------------------------------------------------
  // helpers auth
  // ---------------------------------------------------------------------------
  const getAuthToken = () => {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token") ||
      localStorage.getItem("auth_token") ||
      sessionStorage.getItem("auth_token")
    );
  };

  const getAuthHeaders = (): Record<string, string> => {
    const token = getAuthToken();
    if (!token) return {};
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const getRazonSocial = (rut?: string | null) => {
    if (!rut) return null;
    return ruts.find((c) => c.rut === rut)?.razonSocial ?? null;
  };

  // ---------------------------------------------------------------------------
  // helpers visuales
  // ---------------------------------------------------------------------------
  const renderEstadoBadge = (estado: EstadoTarea) => {
    const base =
      "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold";
    switch (estado) {
      case "PENDIENTE":
        return (
          <span className={`${base} bg-amber-50 text-amber-700`}>
            No realizada
          </span>
        );
      case "VENCIDA":
        return (
          <span className={`${base} bg-rose-50 text-rose-700`}>
            No realizada (vencida)
          </span>
        );
      case "EN_PROCESO":
        return (
          <span className={`${base} bg-sky-50 text-sky-700`}>En proceso</span>
        );
      case "COMPLETADA":
        return (
          <span className={`${base} bg-emerald-50 text-emerald-700`}>
            Realizada
          </span>
        );
      default:
        return <span className={base}>{estado}</span>;
    }
  };

  const formatFecha = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL");
  };

  const nombreMes = (mes: number) =>
    [
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
    ][mes] || `Mes ${mes}`;

  const anioActual = now.getFullYear();
  const opcionesAnios = [anioActual - 1, anioActual, anioActual + 1];

  const coincidePeriodo = (fechaIso: string | null | undefined) => {
    if (!fechaIso) return false;
    const d = new Date(fechaIso);
    return (
      d.getFullYear() === anioFiltro && d.getMonth() + 1 === mesFiltro
    );
  };

  // ---------------------------------------------------------------------------
  // carga de RUTs
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchRuts = async () => {
      setLoadingRuts("loading");
      setErrorRuts(null);
      try {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        };

        const params = new URLSearchParams();
        if (trabajadorIdFiltro) {
          params.append("trabajadorId", String(trabajadorIdFiltro));
        }
        const qs = params.toString() ? `?${params.toString()}` : "";

        const res = await fetch(`${API_BASE_URL}/tareas/mis-ruts${qs}`, {
          headers,
        });

        if (!res.ok) throw new Error(`Error ${res.status}`);

        const data: RutConNombre[] = await res.json();
        setRuts(data || []);
        setRutSeleccionado(data?.[0]?.rut ?? null);

        setLoadingRuts("success");
      } catch (err) {
        console.error("[Front] Error cargando RUTs", err);
        setErrorRuts("No se pudieron cargar los RUTs asignados.");
        setLoadingRuts("error");
      }
    };

    fetchRuts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajadorIdFiltro]);

  // info del RUT seleccionado
  const rutSeleccionadoInfo = useMemo(
    () =>
      rutSeleccionado
        ? ruts.find((r) => r.rut === rutSeleccionado) ?? null
        : null,
    [ruts, rutSeleccionado]
  );

  // lista de RUTs filtrada por buscador
  const rutsFiltrados = useMemo(() => {
    const term = busquedaCliente.trim().toLowerCase();
    if (!term) return ruts;
    return ruts.filter(({ rut, razonSocial }) => {
      const rutNorm = (rut ?? "").toLowerCase();
      const rsNorm = (razonSocial ?? "").toLowerCase();
      return rutNorm.includes(term) || rsNorm.includes(term);
    });
  }, [busquedaCliente, ruts]);

  // reset de selección cuando cambia RUT o subVista
  useEffect(() => {
    setSelectedIds([]);
  }, [rutSeleccionado, subVista]);

  // ---------------------------------------------------------------------------
  // carga de tareas para el RUT seleccionado (tablero) con filtros de fecha
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!rutSeleccionado || subVista !== "tablero") {
      if (subVista === "tablero") setTareas([]);
      return;
    }

    const fetchTareas = async () => {
      setLoadingTareas("loading");
      setErrorTareas(null);

      try {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        };

        const params = new URLSearchParams();
        if (trabajadorIdFiltro) {
          params.append("trabajadorId", String(trabajadorIdFiltro));
        }
        if (anioFiltro) params.append("anio", String(anioFiltro));
        if (mesFiltro) params.append("mes", String(mesFiltro));

        const encodedRut = encodeURIComponent(rutSeleccionado);
        const qs = params.toString() ? `?${params.toString()}` : "";

        const res = await fetch(
          `${API_BASE_URL}/tareas/por-rut/${encodedRut}${qs}`,
          { headers }
        );

        if (!res.ok) throw new Error(`Error ${res.status}`);

        const data: TareaAsignada[] = await res.json();
        setTareas(data || []);
        setLoadingTareas("success");
      } catch (err) {
        console.error("[Front] Error cargando tareas por RUT", err);
        setErrorTareas("No se pudieron cargar las tareas de este RUT.");
        setLoadingTareas("error");
      }
    };

    fetchTareas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    rutSeleccionado,
    trabajadorIdFiltro,
    subVista,
    anioFiltro,
    mesFiltro,
    reloadKey,
  ]);

  // ---------------------------------------------------------------------------
  // carga de TODAS las tareas (vista tabla) con filtros básicos de fecha
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchTodas = async () => {
      if (!ruts.length || subVista !== "tabla") return;

      setLoadingTodas("loading");
      setErrorTodas(null);

      try {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        };

        const paramsBase = new URLSearchParams();
        if (trabajadorIdFiltro) {
          paramsBase.append("trabajadorId", String(trabajadorIdFiltro));
        }
        if (anioFiltro) paramsBase.append("anio", String(anioFiltro));
        if (mesFiltro) paramsBase.append("mes", String(mesFiltro));
        const baseQs = paramsBase.toString();

        const allByRut = await Promise.all(
          ruts.map(async ({ rut }) => {
            const encodedRut = encodeURIComponent(rut);
            const res = await fetch(
              `${API_BASE_URL}/tareas/por-rut/${encodedRut}${
                baseQs ? `?${baseQs}` : ""
              }`,
              { headers }
            );
            if (!res.ok)
              throw new Error(`Error ${res.status} cargando rut ${rut}`);
            const data: TareaAsignada[] = await res.json();
            return data || [];
          })
        );

        setTodasTareas(allByRut.flat());
        setLoadingTodas("success");
      } catch (err) {
        console.error("[Front] Error cargando todas las tareas", err);
        setErrorTodas(
          "No se pudieron cargar todas las tareas para la vista de tabla."
        );
        setLoadingTodas("error");
      }
    };

    fetchTodas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subVista, ruts, trabajadorIdFiltro, anioFiltro, mesFiltro, reloadKey]);

  // reset página tabla cuando cambia filtro / subVista / cantidad o búsqueda
  useEffect(() => {
    setPaginaTabla(1);
  }, [busquedaTarea, subVista, todasTareas.length]);

  // ---------------------------------------------------------------------------
  // derivadas tablero (aplicando búsqueda de tareas)
  // ---------------------------------------------------------------------------
  const tareasFiltradasTablero = useMemo(() => {
    const term = busquedaTarea.trim().toLowerCase();
    if (!term) return tareas;
    return tareas.filter((t) => {
      const rutNorm = (t.rutCliente ?? "").toLowerCase();
      const rsNorm = (getRazonSocial(t.rutCliente) ?? "").toLowerCase();
      const codNorm = (t.tareaPlantilla?.codigoDocumento ?? "").toLowerCase();
      const nomNorm = (t.tareaPlantilla?.nombre ?? "").toLowerCase();
      const notaNorm = (t.comentarios ?? "").toLowerCase();
      return (
        rutNorm.includes(term) ||
        rsNorm.includes(term) ||
        codNorm.includes(term) ||
        nomNorm.includes(term) ||
        notaNorm.includes(term)
      );
    });
  }, [tareas, busquedaTarea, ruts]);

  const tareasNoRealizadas = useMemo(
    () =>
      tareasFiltradasTablero.filter(
        (t) => t.estado === "PENDIENTE" || t.estado === "VENCIDA"
      ),
    [tareasFiltradasTablero]
  );
  const tareasEnProceso = useMemo(
    () => tareasFiltradasTablero.filter((t) => t.estado === "EN_PROCESO"),
    [tareasFiltradasTablero]
  );
  const tareasRealizadas = useMemo(
    () => tareasFiltradasTablero.filter((t) => t.estado === "COMPLETADA"),
    [tareasFiltradasTablero]
  );

  const totalTareas = tareas.length;
  const totalNoRealizadas = tareasNoRealizadas.length;
  const totalEnProceso = tareasEnProceso.length;
  const totalRealizadas = tareasRealizadas.length;

  const isSelected = (id: number) => selectedIds.includes(id);
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ---------------------------------------------------------------------------
  // derivadas tabla + búsqueda y paginación
  // ---------------------------------------------------------------------------
  const todasTareasFiltradas = useMemo(() => {
    if (!todasTareas.length) return [];

    const term = busquedaTarea.trim().toLowerCase();

    return todasTareas.filter((t) => {
      // nos aseguramos que quede filtrado por mes/año
      if (!coincidePeriodo(t.fechaProgramada)) return false;

      if (!term) return true;

      const rutNorm = (t.rutCliente ?? "").toLowerCase();
      const rsNorm = (getRazonSocial(t.rutCliente) ?? "").toLowerCase();
      const codNorm = (t.tareaPlantilla?.codigoDocumento ?? "").toLowerCase();
      const nomNorm = (t.tareaPlantilla?.nombre ?? "").toLowerCase();
      const notaNorm = (t.comentarios ?? "").toLowerCase();

      return (
        rutNorm.includes(term) ||
        rsNorm.includes(term) ||
        codNorm.includes(term) ||
        nomNorm.includes(term) ||
        notaNorm.includes(term)
      );
    });
  }, [todasTareas, busquedaTarea, anioFiltro, mesFiltro, ruts]);

  const todasTareasOrdenadas = useMemo(
    () =>
      [...todasTareasFiltradas].sort((a, b) => {
        const rutA = (a.rutCliente ?? "").localeCompare(b.rutCliente ?? "");
        if (rutA !== 0) return rutA;
        const fechaA = new Date(a.fechaProgramada).getTime();
        const fechaB = new Date(b.fechaProgramada).getTime();
        return fechaA - fechaB;
      }),
    [todasTareasFiltradas]
  );

  const totalPaginasTabla = useMemo(
    () =>
      todasTareasOrdenadas.length === 0
        ? 1
        : Math.ceil(todasTareasOrdenadas.length / PAGE_SIZE_TABLA),
    [todasTareasOrdenadas.length]
  );

  const tareasTablaPagina = useMemo(() => {
    const start = (paginaTabla - 1) * PAGE_SIZE_TABLA;
    const end = start + PAGE_SIZE_TABLA;
    return todasTareasOrdenadas.slice(start, end);
  }, [todasTareasOrdenadas, paginaTabla]);

  const gruposPorRut = useMemo(() => {
    const mapa = new Map<string, TareaAsignada[]>();
    for (const t of todasTareasOrdenadas) {
      const rut = t.rutCliente ?? "SIN_RUT";
      if (!mapa.has(rut)) mapa.set(rut, []);
      mapa.get(rut)!.push(t);
    }
    return mapa;
  }, [todasTareasOrdenadas]);

  // ---------------------------------------------------------------------------
  // helpers modal completar (1 tarea, subir archivo)
  // ---------------------------------------------------------------------------
  const abrirModalCompletar = (t: TareaAsignada) => {
    const resumen: TareaResumenModal = {
      id_tarea_asignada: t.id_tarea_asignada,
      rutCliente: t.rutCliente,
      clienteRazonSocial: getRazonSocial(t.rutCliente),
      fechaProgramada: t.fechaProgramada,
      tareaPlantilla: t.tareaPlantilla
        ? {
            nombre: t.tareaPlantilla.nombre,
            codigoDocumento: t.tareaPlantilla.codigoDocumento ?? undefined,
          }
        : null,
    };
    setModalTarea(resumen);
    setModalFile(null);
    setModalError(null);
  };

  const cerrarModalCompletar = () => {
    if (modalLoading) return;
    setModalTarea(null);
    setModalFile(null);
    setModalError(null);
  };

  const handleModalFileChange = (file: File | null) => {
    setModalFile(file);
    if (file) setModalError(null);
  };

  const handleConfirmCompletar = async () => {
    if (!modalTarea) return;
    if (!modalFile) {
      setModalError("Debes seleccionar un archivo para completar la tarea.");
      return;
    }

    const tareaId = modalTarea.id_tarea_asignada;

    try {
      setModalLoading(true);
      setModalError(null);

      // 1) Subir archivo a /tareas/:id/archivos
      const formData = new FormData();
      formData.append("archivo", modalFile);

      const uploadRes = await fetch(
        `${API_BASE_URL}/tareas/${tareaId}/archivos`,
        {
          method: "POST",
          headers: getAuthHeaders(), // solo Authorization
          body: formData,
        }
      );

      if (!uploadRes.ok) {
        throw new Error(`Error subiendo archivo (${uploadRes.status})`);
      }

      // 2) Actualizar estado a COMPLETADA
      const nowIso = new Date().toISOString();

      const patchRes = await fetch(
        `${API_BASE_URL}/tareas/${tareaId}/estado`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            estado: "COMPLETADA" as EstadoTarea,
            fechaComplecion: nowIso,
          }),
        }
      );

      if (!patchRes.ok) {
        throw new Error(`Error actualizando estado (${patchRes.status})`);
      }

      const updated: TareaAsignada = await patchRes.json();

      // 3) Actualizar lista de tareas del tablero
      setTareas((prev) =>
        prev.map((t) =>
          t.id_tarea_asignada === tareaId
            ? {
                ...t,
                estado: updated.estado,
                fechaComplecion:
                  updated.fechaComplecion ?? t.fechaComplecion ?? nowIso,
              }
            : t
        )
      );

      // 4) Actualizar también la lista de todasTareas (vista tabla), si ya está cargada
      setTodasTareas((prev) =>
        prev.map((t) =>
          t.id_tarea_asignada === tareaId
            ? {
                ...t,
                estado: updated.estado,
                fechaComplecion:
                  updated.fechaComplecion ?? t.fechaComplecion ?? nowIso,
              }
            : t
        )
      );

      // por si estaba seleccionada antes de completar
      setSelectedIds((prev) => prev.filter((id) => id !== tareaId));

      // 5) Forzar recarga desde el backend
      setReloadKey((prev) => prev + 1);

      // 6) Cerrar modal
      cerrarModalCompletar();
    } catch (err) {
      console.error("[Front] Error completando tarea con archivo", err);
      setModalError(
        "No se pudo subir el archivo y completar la tarea. Intenta nuevamente."
      );
    } finally {
      setModalLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // drag & drop tablero
  // ---------------------------------------------------------------------------
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const idTarea = Number(draggableId);
    if (Number.isNaN(idTarea)) return;

    // Si la intención es COMPLETAR (mover a col-realizadas desde otra columna),
    // abrimos el modal de 1 tarea y NO actualizamos estado directo.
    if (
      destination.droppableId === "col-realizadas" &&
      source.droppableId !== "col-realizadas"
    ) {
      const tarea = tareas.find((t) => t.id_tarea_asignada === idTarea);
      if (!tarea) return;
      abrirModalCompletar(tarea);
      return;
    }

    let nuevoEstado: EstadoTarea;
    switch (destination.droppableId) {
      case "col-no-realizadas":
        nuevoEstado = "PENDIENTE";
        break;
      case "col-en-proceso":
        nuevoEstado = "EN_PROCESO";
        break;
      case "col-realizadas":
        nuevoEstado = "COMPLETADA";
        break;
      default:
        return;
    }

    const nowIso = new Date().toISOString();

    setTareas((prev) =>
      prev.map((t) =>
        t.id_tarea_asignada === idTarea
          ? {
              ...t,
              estado: nuevoEstado,
              fechaComplecion:
                nuevoEstado === "COMPLETADA"
                  ? nowIso
                  : t.fechaComplecion ?? null,
            }
          : t
      )
    );

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      };
      await fetch(`${API_BASE_URL}/tareas/${idTarea}/estado`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          estado: nuevoEstado,
          ...(nuevoEstado === "COMPLETADA" ? { fechaComplecion: nowIso } : {}),
        }),
      });
    } catch (err) {
      console.error("[Front] Error actualizando estado en backend", err);
    }
  };

  // ---------------------------------------------------------------------------
  // acciones masivas (PENDIENTE / EN_PROCESO) + COMPLETADAS CON ARCHIVOS
  // ---------------------------------------------------------------------------
  const bulkUpdateEstado = async (nuevoEstado: EstadoTarea) => {
    if (!selectedIds.length) return;

    // ❗ No permitir marcar masivamente como COMPLETADA sin archivo
    if (nuevoEstado === "COMPLETADA") {
      alert(
        "Para marcar tareas como Realizadas debes subir un archivo por cada tarea. Usa el botón “Pasar a Realizadas (con archivo)” para completarlas masivamente con archivo."
      );
      return;
    }

    // Actualizamos solo el estado en memoria (no tocamos fechaComplecion)
    setTareas((prev) =>
      prev.map((t) =>
        selectedIds.includes(t.id_tarea_asignada)
          ? {
              ...t,
              estado: nuevoEstado,
            }
          : t
      )
    );

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    };

    try {
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`${API_BASE_URL}/tareas/${id}/estado`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              estado: nuevoEstado,
            }),
          })
        )
      );
    } catch (err) {
      console.error("[Front] Error en actualización masiva", err);
    } finally {
      setSelectedIds([]);
    }
  };

  // Abrir modal masivo para COMPLETAR varias tareas con archivos
  const abrirModalCompletarMasivo = () => {
    if (!selectedIds.length) return;

    const seleccionadas = tareas.filter((t) =>
      selectedIds.includes(t.id_tarea_asignada)
    );
    if (!seleccionadas.length) return;

    const initialMap: Record<number, File | null> = {};
    seleccionadas.forEach((t) => {
      initialMap[t.id_tarea_asignada] = null;
    });

    setMultiTareasSeleccionadas(seleccionadas);
    setMultiFilesMap(initialMap);
    setMultiModalError(null);
    setMultiModalOpen(true);
  };

  const handleMultiFileChange = (tareaId: number, file: File | null) => {
    setMultiFilesMap((prev) => ({
      ...prev,
      [tareaId]: file,
    }));
    setMultiModalError(null);
  };

  const handleConfirmCompletarMasivo = async () => {
    if (!multiTareasSeleccionadas.length) return;

    // validar que TODAS tengan archivo
    const faltantes = multiTareasSeleccionadas.filter(
      (t) => !multiFilesMap[t.id_tarea_asignada]
    );
    if (faltantes.length > 0) {
      setMultiModalError(
        "Debes seleccionar un archivo para cada tarea antes de completar."
      );
      return;
    }

    setMultiModalLoading(true);
    setMultiModalError(null);

    const headersEstado: HeadersInit = {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    };

    try {
      const nowIso = new Date().toISOString();

      for (const t of multiTareasSeleccionadas) {
        const tareaId = t.id_tarea_asignada;
        const file = multiFilesMap[tareaId];
        if (!file) continue; // seguridad

        // 1) subir archivo
        const formData = new FormData();
        formData.append("archivo", file);

        const uploadRes = await fetch(
          `${API_BASE_URL}/tareas/${tareaId}/archivos`,
          {
            method: "POST",
            headers: getAuthHeaders(), // Authorization solamente
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          throw new Error(
            `Error subiendo archivo para la tarea ${tareaId} (${uploadRes.status})`
          );
        }

        // 2) marcar COMPLETADA
        const patchRes = await fetch(
          `${API_BASE_URL}/tareas/${tareaId}/estado`,
          {
            method: "PATCH",
            headers: headersEstado,
            body: JSON.stringify({
              estado: "COMPLETADA" as EstadoTarea,
              fechaComplecion: nowIso,
            }),
          }
        );

        if (!patchRes.ok) {
          throw new Error(
            `Error actualizando estado de la tarea ${tareaId} (${patchRes.status})`
          );
        }

        const updated: TareaAsignada = await patchRes.json();

        // actualizar en memoria
        setTareas((prev) =>
          prev.map((x) =>
            x.id_tarea_asignada === tareaId
              ? {
                  ...x,
                  estado: updated.estado,
                  fechaComplecion:
                    updated.fechaComplecion ?? x.fechaComplecion ?? nowIso,
                }
              : x
          )
        );
        setTodasTareas((prev) =>
          prev.map((x) =>
            x.id_tarea_asignada === tareaId
              ? {
                  ...x,
                  estado: updated.estado,
                  fechaComplecion:
                    updated.fechaComplecion ?? x.fechaComplecion ?? nowIso,
                }
              : x
          )
        );
      }

      // forzar recarga para refrescar tareas nuevas del siguiente mes
      setReloadKey((prev) => prev + 1);

      // limpiar selección y cerrar
      setSelectedIds([]);
      setMultiModalOpen(false);
      setMultiTareasSeleccionadas([]);
      setMultiFilesMap({});
    } catch (err: any) {
      console.error("[Front] Error en completar masivo con archivos", err);
      setMultiModalError(
        err?.message ??
          "Ocurrió un error completando las tareas. Intenta nuevamente."
      );
    } finally {
      setMultiModalLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // exportar Excel (igual que ya tenías)
  // ---------------------------------------------------------------------------
  const handleExportExcel = async () => {
    if (!todasTareasOrdenadas.length) return;

    try {
      const XlsxPopulate = (
        await import("xlsx-populate/browser/xlsx-populate")
      ).default;

      const workbook = await XlsxPopulate.fromBlankAsync();
      const usedNames = new Set<string>();
      const entries = Array.from(gruposPorRut.entries());

      entries.forEach(([rut, tareasRut], index) => {
        const razon = getRazonSocial(rut) ?? "";

        let baseName = (razon || rut || "SIN_RUT")
          .replace(/[\\/?*[\]:]/g, "")
          .trim();
        if (!baseName) baseName = `RUT_${rut || index + 1}`;
        if (baseName.length > 28) baseName = baseName.slice(0, 28);

        let sheetName = baseName;
        let counter = 1;
        while (usedNames.has(sheetName)) {
          const suffix = `_${counter++}`;
          const maxBaseLen = 31 - suffix.length;
          sheetName = (baseName.slice(0, maxBaseLen) + suffix).slice(0, 31);
        }
        usedNames.add(sheetName);

        const sheet =
          index === 0
            ? workbook.sheet(0).name(sheetName)
            : workbook.addSheet(sheetName);

        sheet
          .cell("A1")
          .value("Tareas por RUT")
          .style({ bold: true, fontSize: 14 });
        sheet
          .cell("A2")
          .value(`RUT: ${rut}`)
          .style({ bold: true, fontSize: 11 });
        sheet
          .cell("A3")
          .value(razon ? `Razón social: ${razon}` : "")
          .style({ fontSize: 10 });

        const headers = [
          "RUT",
          "Razón social",
          "Código",
          "Tarea",
          "Estado",
          "Fecha programada",
          "Fecha completada",
          "Nota",
        ];
        sheet.row(5).cell(1).value(headers);
        sheet.range("A5:H5").style({
          bold: true,
          fill: "4472C4",
          fontColor: "FFFFFF",
          horizontalAlignment: "center",
        });

        tareasRut.forEach((t, idx) => {
          const rowNumber = 6 + idx;
          const estadoLegible =
            t.estado === "PENDIENTE"
              ? "No realizada"
              : t.estado === "VENCIDA"
              ? "No realizada (vencida)"
              : t.estado === "EN_PROCESO"
              ? "En proceso"
              : t.estado === "COMPLETADA"
              ? "Realizada"
              : t.estado;

          sheet.row(rowNumber).cell(1).value(t.rutCliente ?? "");
          sheet.row(rowNumber).cell(2).value(razon);
          sheet
            .row(rowNumber)
            .cell(3)
            .value(t.tareaPlantilla?.codigoDocumento ?? "");
          sheet
            .row(rowNumber)
            .cell(4)
            .value(t.tareaPlantilla?.nombre ?? "");
          sheet.row(rowNumber).cell(5).value(estadoLegible);
          sheet.row(rowNumber).cell(6).value(formatFecha(t.fechaProgramada));
          sheet
            .row(rowNumber)
            .cell(7)
            .value(t.fechaComplecion ? formatFecha(t.fechaComplecion) : "");
          sheet.row(rowNumber).cell(8).value(t.comentarios ?? "");
          sheet
            .range(`A${rowNumber}:H${rowNumber}`)
            .style({ border: true, fontSize: 10 });
        });

        const colWidths = [14, 30, 12, 32, 16, 16, 16, 40];
        colWidths.forEach((w, i) => sheet.column(i + 1).width(w));
      });

      const blob = await workbook.outputAsync();
      const blobUrl = URL.createObjectURL(
        new Blob([blob], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
      );

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "tareas_por_rut.xlsx";
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("[Front] Error exportando Excel por RUT:", err);
      alert("Hubo un problema exportando a Excel. Reintenta en unos segundos.");
    }
  };

  // ---------------------------------------------------------------------------
  // render
  // ---------------------------------------------------------------------------
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-full">
      {/* PANEL IZQUIERDO: RUTs */}
      <aside className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-black/5">
          <p className="text-xs font-semibold text-black/70 uppercase tracking-wide">
            RUTs a mi cargo
          </p>
          <p className="text-[11px] text-black/50 mt-0.5">
            Selecciona un cliente para ver sus tareas o revisar la tabla
            consolidada.
          </p>

          <div className="mt-2 relative">
            <span className="absolute inset-y-0 left-2 flex items-center">
              <Search className="w-3 h-3 text-black/30" />
            </span>
            <input
              type="text"
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
              placeholder="Buscar por RUT o razón social..."
              className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-black/10 text-[11px] outline-none focus:border-[var(--primary-color)] bg-black/[0.02]"
            />
          </div>
        </div>

        <div className="max-h-[480px] overflow-y-auto">
          {loadingRuts === "loading" && (
            <div className="p-4 text-xs text-black/50 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Cargando RUTs...
            </div>
          )}
          {errorRuts && (
            <div className="p-4 text-xs text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errorRuts}
            </div>
          )}
          {!errorRuts && loadingRuts === "success" && ruts.length === 0 && (
            <div className="p-4 text-xs text-black/40">
              No tienes clientes asignados todavía.
            </div>
          )}
          {!errorRuts &&
            loadingRuts === "success" &&
            ruts.length > 0 &&
            rutsFiltrados.length === 0 && (
              <div className="p-4 text-xs text-black/40">
                No se encontraron clientes para &quot;{busquedaCliente}&quot;.
              </div>
            )}

          <ul className="divide-y divide-black/5">
            {rutsFiltrados.map(({ rut, razonSocial }) => {
              const active = rutSeleccionado === rut;
              return (
                <li key={rut}>
                  <button
                    type="button"
                    onClick={() => setRutSeleccionado(rut)}
                    className={`w-full px-4 py-2.5 text-left text-xs flex flex-col gap-0.5 ${
                      active
                        ? "bg-[var(--primary-color)] text-white"
                        : "hover:bg-[var(--tertiary-color)] text-black/80"
                    }`}
                  >
                    <span className="font-mono text-[11px]">{rut}</span>
                    {razonSocial && (
                      <span
                        className={`text-[11px] ${
                          active ? "opacity-90" : "text-black/60"
                        }`}
                      >
                        {razonSocial}
                      </span>
                    )}
                    {active && (
                      <span className="text-[10px] opacity-80 mt-0.5">
                        RUT seleccionado
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* PANEL DERECHO */}
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 lg:p-5 flex flex-col gap-4">
        {/* header + selector vista */}
        <header className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--primary-color)" }}
              >
                Tareas por RUT
              </h2>
              <p className="text-xs text-black/50">
                Cambia entre vista tablero (por cliente) y vista tabla
                consolidada. Usa el filtro de mes y año para limitar el
                período.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* selector sub-vista */}
              <div className="inline-flex bg-black/5 rounded-full p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSubVista("tablero")}
                  className={`px-3 py-1 rounded-full transition ${
                    subVista === "tablero"
                      ? "bg-white shadow text-black/80"
                      : "text-black/60"
                  }`}
                >
                  Vista tablero
                </button>
                <button
                  type="button"
                  onClick={() => setSubVista("tabla")}
                  className={`px-3 py-1 rounded-full transition ${
                    subVista === "tabla"
                      ? "bg-white shadow text-black/80"
                      : "text-black/60"
                  }`}
                >
                  Vista tabla
                </button>
              </div>

              {/* info rut seleccionado (tablero) */}
              {subVista === "tablero" && (
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wide text-black/40">
                    RUT seleccionado
                  </p>
                  <p className="font-mono text-xs font-semibold text-black/80">
                    {rutSeleccionadoInfo?.rut ?? "Ninguno"}
                  </p>
                  {rutSeleccionadoInfo?.razonSocial && (
                    <p className="text-[11px] text-black/60">
                      {rutSeleccionadoInfo.razonSocial}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* filtros de fecha */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px]">
              <div>
                <label className="block font-semibold text-black/70 mb-1">
                  Mes
                </label>
                <select
                  value={mesFiltro}
                  onChange={(e) => setMesFiltro(Number(e.target.value))}
                  className="border border-black/15 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[var(--secondary-color)]"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {nombreMes(m)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-black/70 mb-1">
                  Año
                </label>
                <select
                  value={anioFiltro}
                  onChange={(e) => setAnioFiltro(Number(e.target.value))}
                  className="border border-black/15 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[var(--secondary-color)]"
                >
                  {opcionesAnios.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 text-[11px] text-black/60 bg-black/[0.02] rounded-xl px-3 py-2 flex items-start gap-2">
              <FolderSearch className="w-4 h-4 mt-[2px] text-black/40" />
              <p>
                Mostrando tareas del período{" "}
                <span className="font-semibold">
                  {nombreMes(mesFiltro)} {anioFiltro}
                </span>{" "}
                según los clientes a tu cargo.
              </p>
            </div>
          </div>

          {/* NAVBAR DE BÚSQUEDA DE TAREAS */}
          <div className="flex flex-wrap items-center gap-2 bg-black/[0.02] border border-black/5 rounded-xl px-3 py-2 text-[11px]">
            <div className="relative flex-1 min-w-[180px]">
              <span className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                <Search className="w-3 h-3 text-black/30" />
              </span>
              <input
                type="text"
                value={busquedaTarea}
                onChange={(e) => setBusquedaTarea(e.target.value)}
                placeholder="Buscar tareas por código, nombre, nota, RUT o razón social..."
                className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-black/10 text-[11px] outline-none focus:border-[var(--primary-color)] bg-white"
              />
            </div>

            {/* filtro por estado SOLO en vista tabla */}
            {subVista === "tabla" && (
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-black/60 hidden sm:inline">
                  Estado:
                </span>
                <select
                  value={estadoFiltroTabla}
                  onChange={(e) =>
                    setEstadoFiltroTabla(e.target.value as "TODOS" | EstadoTarea)
                  }
                  className="border border-black/15 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[var(--secondary-color)] bg-white"
                >
                  <option value="TODOS">Todos</option>
                  <option value="PENDIENTE">No realizadas (pendiente)</option>
                  <option value="VENCIDA">No realizadas (vencida)</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="COMPLETADA">Realizadas</option>
                </select>
              </div>
            )}

            {busquedaTarea && (
              <button
                type="button"
                onClick={() => setBusquedaTarea("")}
                className="text-[11px] px-2 py-1 rounded border border-black/10 hover:bg-black/5"
              >
                Limpiar
              </button>
            )}
          </div>


          {/* métricas + barra de acciones masivas (solo tablero) */}
          {subVista === "tablero" && (
            <>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-100 rounded-xl px-3 py-2">
                  <ListTodo className="w-4 h-4 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-700">
                      No realizadas
                    </p>
                    <p className="text-amber-800/80">
                      {totalNoRealizadas} de {totalTareas}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-sky-50/80 border border-sky-100 rounded-xl px-3 py-2">
                  <PlayCircle className="w-4 h-4 text-sky-600" />
                  <div>
                    <p className="font-semibold text-sky-700">En proceso</p>
                    <p className="text-sky-800/80">
                      {totalEnProceso} de {totalTareas}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-100 rounded-xl px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-700">
                      Realizadas
                    </p>
                    <p className="text-emerald-800/80">
                      {totalRealizadas} de {totalTareas}
                    </p>
                  </div>
                </div>
              </div>

              {totalTareas > 0 && (
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px] bg-black/[0.02] border border-black/5 rounded-xl px-3 py-2">
                  <div>
                    <span className="font-semibold">
                      Seleccionadas: {selectedIds.length}
                    </span>
                    <span className="text-black/50">
                      {" "}
                      (marca varias tareas con el checkbox de la izquierda)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={!selectedIds.length}
                      onClick={() => bulkUpdateEstado("PENDIENTE")}
                      className={`px-2 py-1 rounded border text-[11px] ${
                        !selectedIds.length
                          ? "opacity-40 cursor-not-allowed border-black/10"
                          : "border-amber-300 bg-amber-50/80 text-amber-800 hover:bg-amber-100"
                      }`}
                    >
                      Pasar a No realizadas
                    </button>
                    <button
                      type="button"
                      disabled={!selectedIds.length}
                      onClick={() => bulkUpdateEstado("EN_PROCESO")}
                      className={`px-2 py-1 rounded border text-[11px] ${
                        !selectedIds.length
                          ? "opacity-40 cursor-not-allowed border-black/10"
                          : "border-sky-300 bg-sky-50/80 text-sky-800 hover:bg-sky-100"
                      }`}
                    >
                      Pasar a En proceso
                    </button>
                    <button
                      type="button"
                      disabled={!selectedIds.length}
                      onClick={abrirModalCompletarMasivo}
                      className={`px-2 py-1 rounded border text-[11px] ${
                        !selectedIds.length
                          ? "opacity-40 cursor-not-allowed border-black/10"
                          : "border-emerald-300 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      Pasar a Realizadas (con archivo)
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </header>

        {/* CONTENIDO */}
        <div className="flex-1 min-h-[260px]">
          {/* ----------- VISTA TABLERO ----------- */}
          {subVista === "tablero" && (
            <>
              {!rutSeleccionado && (
                <div className="flex h-full items-center justify-center text-sm text-black/50">
                  Selecciona un RUT en la izquierda para ver sus tareas.
                </div>
              )}

              {rutSeleccionado && loadingTareas === "loading" && (
                <div className="flex h-full items-center justify-center text-sm text-black/50 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cargando tareas...
                </div>
              )}

              {rutSeleccionado && errorTareas && (
                <div className="flex h-full items-center justify-center text-sm text-rose-600 gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errorTareas}
                </div>
              )}

              {rutSeleccionado &&
                loadingTareas === "success" &&
                tareas.length === 0 && (
                  <div className="flex h-full flex-col items-center justify-center text-sm text-black/50 gap-2">
                    <FolderSearch className="w-6 h-6 text-black/30" />
                    Este cliente no tiene tareas para este período.
                  </div>
                )}

              {rutSeleccionado &&
                loadingTareas === "success" &&
                tareas.length > 0 && (
                  <DragDropContext onDragEnd={handleDragEnd}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                      {/* NO REALIZADAS */}
                      <Droppable droppableId="col-no-realizadas">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex flex-col rounded-2xl border border-black/5 bg-black/[0.02] p-2 min-h-[180px] ${
                              snapshot.isDraggingOver
                                ? "ring-2 ring-amber-200 bg-amber-50/40"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                                No realizadas
                              </span>
                              <span className="text-[11px] text-amber-800/80">
                                {tareasNoRealizadas.length}
                              </span>
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                              {tareasNoRealizadas.map((t, index) => (
                                <Draggable
                                  key={t.id_tarea_asignada}
                                  draggableId={String(t.id_tarea_asignada)}
                                  index={index}
                                >
                                  {(dragProvided, dragSnapshot) => (
                                    <article
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      style={{
                                        ...dragProvided.draggableProps.style,
                                      }}
                                      className={`border border-black/5 rounded-xl p-2 shadow-sm bg-white flex gap-2 transition-transform text-[11px] ${
                                        dragSnapshot.isDragging
                                          ? "ring-2 ring-amber-300 scale-[1.02]"
                                          : ""
                                      }`}
                                    >
                                      <div className="pt-1">
                                        <input
                                          type="checkbox"
                                          checked={isSelected(
                                            t.id_tarea_asignada
                                          )}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            toggleSelect(t.id_tarea_asignada);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-3 h-3 cursor-pointer"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-1 flex-1">
                                        <p className="font-mono text-[10px] text-black/40">
                                          {t.tareaPlantilla?.codigoDocumento}
                                        </p>
                                        <p className="text-xs font-semibold text-black/80">
                                          {t.tareaPlantilla?.nombre ??
                                            "Tarea contable"}
                                        </p>
                                        <p className="text-[10px] text-black/60">
                                          Programada:{" "}
                                          {formatFecha(t.fechaProgramada)}
                                        </p>
                                        {t.comentarios && (
                                          <p className="text-[10px] text-black/60 line-clamp-2">
                                            {t.comentarios}
                                          </p>
                                        )}
                                        {renderEstadoBadge(t.estado)}
                                      </div>
                                    </article>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>

                      {/* EN PROCESO */}
                      <Droppable droppableId="col-en-proceso">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex flex-col rounded-2xl border border-black/5 bg-black/[0.02] p-2 min-h-[180px] ${
                              snapshot.isDraggingOver
                                ? "ring-2 ring-sky-200 bg-sky-50/40"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                                En proceso
                              </span>
                              <span className="text-[11px] text-sky-800/80">
                                {tareasEnProceso.length}
                              </span>
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                              {tareasEnProceso.map((t, index) => (
                                <Draggable
                                  key={t.id_tarea_asignada}
                                  draggableId={String(t.id_tarea_asignada)}
                                  index={index}
                                >
                                  {(dragProvided, dragSnapshot) => (
                                    <article
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      {...dragProvided.dragHandleProps}
                                      style={{
                                        ...dragProvided.draggableProps.style,
                                      }}
                                      className={`border border-black/5 rounded-xl p-2 shadow-sm bg-white flex gap-2 transition-transform text-[11px] ${
                                        dragSnapshot.isDragging
                                          ? "ring-2 ring-sky-300 scale-[1.02]"
                                          : ""
                                      }`}
                                    >
                                      <div className="pt-1">
                                        <input
                                          type="checkbox"
                                          checked={isSelected(
                                            t.id_tarea_asignada
                                          )}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            toggleSelect(t.id_tarea_asignada);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-3 h-3 cursor-pointer"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-1 flex-1">
                                        <p className="font-mono text-[10px] text-black/40">
                                          {t.tareaPlantilla?.codigoDocumento}
                                        </p>
                                        <p className="text-xs font-semibold text-black/80">
                                          {t.tareaPlantilla?.nombre ??
                                            "Tarea contable"}
                                        </p>
                                        <p className="text-[10px] text-black/60">
                                          Programada:{" "}
                                          {formatFecha(t.fechaProgramada)}
                                        </p>
                                        {t.comentarios && (
                                          <p className="text-[10px] text-black/60 line-clamp-2">
                                            {t.comentarios}
                                          </p>
                                        )}
                                        {renderEstadoBadge(t.estado)}
                                      </div>
                                    </article>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>

                      {/* REALIZADAS (bloqueadas, sin drag ni selección) */}
                      <Droppable droppableId="col-realizadas">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`flex flex-col rounded-2xl border border-black/5 bg-black/[0.02] p-2 min-h-[180px] ${
                              snapshot.isDraggingOver
                                ? "ring-2 ring-emerald-200 bg-emerald-50/40"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2 px-1">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                                Realizadas
                              </span>
                              <span className="text-[11px] text-emerald-800/80">
                                {tareasRealizadas.length}
                              </span>
                            </div>

                            <div className="flex-1 flex flex-col gap-2">
                              {tareasRealizadas.map((t) => (
                                <article
                                  key={t.id_tarea_asignada}
                                  className="border border-black/5 rounded-xl p-2 shadow-sm bg-white flex gap-2 text-[11px]"
                                >
                                  <div className="flex flex-col gap-1 flex-1">
                                    <p className="font-mono text-[10px] text-black/40">
                                      {t.tareaPlantilla?.codigoDocumento}
                                    </p>
                                    <p className="text-xs font-semibold text-black/80">
                                      {t.tareaPlantilla?.nombre ??
                                        "Tarea contable"}
                                    </p>
                                    <p className="text-[10px] text-black/60">
                                      Programada:{" "}
                                      {formatFecha(t.fechaProgramada)}
                                    </p>
                                    {t.fechaComplecion && (
                                      <p className="text-[10px] text-black/60">
                                        Completada:{" "}
                                        {formatFecha(t.fechaComplecion)}
                                      </p>
                                    )}
                                    {t.comentarios && (
                                      <p className="text-[10px] text-black/60 line-clamp-2">
                                        {t.comentarios}
                                      </p>
                                    )}
                                    {renderEstadoBadge(t.estado)}
                                  </div>
                                </article>
                              ))}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </DragDropContext>
                )}
            </>
          )}

          {/* ----------- VISTA TABLA ----------- */}
          {subVista === "tabla" && (
            <div className="flex flex-col gap-3 mt-1">
              {loadingTodas === "loading" && (
                <div className="flex h-full items-center justify-center text-sm text-black/50 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Cargando todas las tareas por RUT...
                </div>
              )}

              {errorTodas && (
                <div className="flex h-full items-center justify-center text-sm text-rose-600 gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {errorTodas}
                </div>
              )}

              {loadingTodas === "success" && !todasTareasOrdenadas.length && (
                <div className="flex h-full items-center justify-center text-sm text-black/50">
                  No hay tareas para los clientes asignados en este período
                  (según el filtro).
                </div>
              )}

              {loadingTodas === "success" && todasTareasOrdenadas.length > 0 && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <p className="text-xs text-black/60">
                      Mostrando{" "}
                      <span className="font-semibold">
                        {tareasTablaPagina.length}
                      </span>{" "}
                      de{" "}
                      <span className="font-semibold">
                        {todasTareasOrdenadas.length}
                      </span>{" "}
                      tareas (página {paginaTabla} de {totalPaginasTabla}).
                    </p>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="self-start md:self-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-[var(--primary-color)] text-white hover:brightness-105"
                    >
                      Exportar a Excel (1 hoja por RUT)
                    </button>
                  </div>

                  <div className="mt-1 overflow-x-auto">
                    <table className="min-w-full text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-black/[0.03]">
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            RUT
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Razón social
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Código
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Tarea
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Estado
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Programada
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Completada
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Nota
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tareasTablaPagina.length === 0 && (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-3 py-3 text-center text-black/50"
                            >
                              No hay tareas para mostrar en esta página.
                            </td>
                          </tr>
                        )}

                        {tareasTablaPagina.length > 0 &&
                          tareasTablaPagina.map((t, idx) => {
                            const rut = t.rutCliente ?? "SIN_RUT";
                            const razon = getRazonSocial(rut) ?? "-";
                            const prev =
                              idx > 0 ? tareasTablaPagina[idx - 1] : null;
                            const prevRut = prev?.rutCliente ?? null;
                            const showHeader = !prevRut || prevRut !== rut;

                            return (
                              <React.Fragment key={t.id_tarea_asignada}>
                                {showHeader && (
                                  <tr className="bg-black/[0.03]">
                                    <td
                                      colSpan={8}
                                      className="px-3 py-2 border-b border-black/10 text-[11px] font-semibold text-black/70"
                                    >
                                      {rut} — {razon}
                                    </td>
                                  </tr>
                                )}
                                <tr className="hover:bg-black/[0.02]">
                                  <td className="px-3 py-2 border-b border-black/5 font-mono">
                                    {t.rutCliente}
                                  </td>
                                  <td className="px-3 py-2 border-b border-black/5">
                                    {razon}
                                  </td>
                                  <td className="px-3 py-2 border-b border-black/5">
                                    {t.tareaPlantilla?.codigoDocumento ?? "-"}
                                  </td>
                                  <td className="px-3 py-2 border-b border-black/5">
                                    {t.tareaPlantilla?.nombre ??
                                      "Tarea contable"}
                                  </td>
                                  <td className="px-3 py-2 border-b border-black/5">
                                    {renderEstadoBadge(t.estado)}
                                  </td>
                                  <td className="px-3 py-2 border-b border-black/5">
                                    {formatFecha(t.fechaProgramada)}
                                  </td>
                                  <td className="px-3 py-2 border-b border-black/5">
                                    {t.fechaComplecion
                                      ? formatFecha(t.fechaComplecion)
                                      : "-"}
                                  </td>
                                  <td className="px-3 py-2 border-b border-black/5 max-w-xs">
                                    {t.comentarios ?? "-"}
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  {todasTareasOrdenadas.length > PAGE_SIZE_TABLA && (
                    <div className="flex items-center justify-end gap-2 mt-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() =>
                          setPaginaTabla((p) => Math.max(1, p - 1))
                        }
                        disabled={paginaTabla === 1}
                        className={`px-2 py-1 rounded border border-black/10 ${
                          paginaTabla === 1
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-black/5"
                        }`}
                      >
                        Anterior
                      </button>
                      <span className="text-black/60">
                        Página {paginaTabla} de {totalPaginasTabla}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPaginaTabla((p) =>
                            Math.min(totalPaginasTabla, p + 1)
                          )
                        }
                        disabled={paginaTabla === totalPaginasTabla}
                        className={`px-2 py-1 rounded border border-black/10 ${
                          paginaTabla === totalPaginasTabla
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-black/5"
                        }`}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* MODAL COMPLETAR CON ARCHIVO (1 tarea) */}
      <CompletarTareaModal
        open={!!modalTarea}
        tarea={modalTarea}
        isSubmitting={modalLoading}
        canConfirm={!!modalFile}
        errorMessage={modalError}
        onClose={cerrarModalCompletar}
        onFileChange={handleModalFileChange}
        onConfirm={handleConfirmCompletar}
      />

      {/* MODAL COMPLETAR MASIVO (N tareas con N archivos) */}
      <MultiCompletarTareasModal
        open={multiModalOpen}
        tareas={multiTareasSeleccionadas}
        filesMap={multiFilesMap}
        isSubmitting={multiModalLoading}
        errorMessage={multiModalError}
        onClose={() => {
          if (multiModalLoading) return;
          setMultiModalOpen(false);
        }}
        onFileChange={handleMultiFileChange}
        onConfirm={handleConfirmCompletarMasivo}
        getRazonSocial={getRazonSocial}
        formatFecha={formatFecha}
      />
    </div>
  );
};

export default VistaPorRut;