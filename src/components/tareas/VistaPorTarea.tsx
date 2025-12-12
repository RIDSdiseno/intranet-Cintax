// src/components/tareas/VistaPorTarea.tsx
import React, { useEffect, useState, useMemo } from "react";
import {
  ListTodo,
  PlayCircle,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { EstadoTarea, TareaAsignada, TareaPlantilla } from "./tiposTareas";
import XlsxPopulate from "xlsx-populate/browser/xlsx-populate";
import MultiCompletarTareasModal from "./MultiCompletarTareasModal";
// 👇 Flujo de correo deshabilitado en esta vista
// import EnviarCorreoTareaModal, { TareaCorreoResumen } from "./EnviarCorreoTareaModal";

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

type LoadState = "idle" | "loading" | "success" | "error";

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

const formatFecha = (iso: string | undefined | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL");
};

const renderEstadoBadge = (estado: EstadoTarea) => {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold";
  switch (estado) {
    case "PENDIENTE":
      return (
        <span className={`${base} bg-amber-50 text-amber-700`}>
          No realizado
        </span>
      );
    case "EN_PROCESO":
      return (
        <span className={`${base} bg-sky-50 text-sky-700`}>En proceso</span>
      );
    case "COMPLETADA":
      return (
        <span className={`${base} bg-emerald-50 text-emerald-700`}>
          Completada
        </span>
      );
    case "VENCIDA":
      return (
        <span className={`${base} bg-rose-50 text-rose-700`}>Vencida</span>
      );
    default:
      return <span className={base}>{estado}</span>;
  }
};

type VistaPorTareaProps = {
  /** Si viene => modo supervisión (ver tareas de otro trabajador) */
  trabajadorIdFiltro?: number;
};

// subvista: tarjetas | tabla
type SubVista = "tarjetas" | "tabla";

// extendemos la tarea para incluir la razón social y correo del cliente
type TareaAsignadaConCliente = TareaAsignada & {
  clienteRazonSocial?: string | null;
  clienteEmail?: string | null;
};

// mapa tareaId -> archivo
type FilesMap = Record<number, File | null>;

const VistaPorTarea: React.FC<VistaPorTareaProps> = ({
  trabajadorIdFiltro,
}) => {
  // -----------------------------
  // Estado base
  // -----------------------------
  const [plantillas, setPlantillas] = useState<TareaPlantilla[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] =
    useState<LoadState>("idle");
  const [errorPlantillas, setErrorPlantillas] = useState<string | null>(null);

  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState<
    number | ""
  >("");
  const [tareasPorPlantilla, setTareasPorPlantilla] = useState<
    TareaAsignadaConCliente[]
  >([]);
  const [loadingTareasPlantilla, setLoadingTareasPlantilla] =
    useState<LoadState>("idle");
  const [errorTareasPlantilla, setErrorTareasPlantilla] = useState<
    string | null
  >(null);

  const [subVista, setSubVista] = useState<SubVista>("tarjetas");
  const [busqueda, setBusqueda] = useState("");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [pagina, setPagina] = useState(1);
  const PAGE_SIZE = 10;

  const now = new Date();
  const [anioFiltro, setAnioFiltro] = useState<number>(now.getFullYear());
  const [mesFiltro, setMesFiltro] = useState<number>(now.getMonth() + 1);

  const [estadoFiltroTabla, setEstadoFiltroTabla] = useState<
    "TODOS" | EstadoTarea
  >("TODOS");

  const plantillaSeleccionada = useMemo(
    () =>
      typeof plantillaSeleccionadaId === "number"
        ? plantillas.find(
            (p) => p.id_tarea_plantilla === plantillaSeleccionadaId
          ) ?? null
        : null,
    [plantillas, plantillaSeleccionadaId]
  );

  // -----------------------------
  // Estado modal multi-completar
  // -----------------------------
  const [multiModalOpen, setMultiModalOpen] = useState(false);
  const [tareasParaMultiCompletar, setTareasParaMultiCompletar] = useState<
    TareaAsignadaConCliente[]
  >([]);
  const [filesMap, setFilesMap] = useState<FilesMap>({});
  const [isSubmittingMulti, setIsSubmittingMulti] = useState(false);
  const [multiError, setMultiError] = useState<string | null>(null);

  // -----------------------------
  // Helpers selección
  // -----------------------------
  const isSelected = (id: number) => selectedIds.includes(id);
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const getRazonSocialByRut = (rut?: string | null) => {
    if (!rut) return "";
    const t = tareasPorPlantilla.find((ta) => ta.rutCliente === rut);
    return t?.clienteRazonSocial ?? "";
  };

  // -----------------------------
  // Derivados: filtros / métricas
  // -----------------------------
  const tareasFiltradas = useMemo(() => {
    if (!busqueda.trim()) return tareasPorPlantilla;
    const term = busqueda.trim().toLowerCase();
    return tareasPorPlantilla.filter((t) => {
      const rut = (t.rutCliente ?? "").toLowerCase();
      const rs = (t.clienteRazonSocial ?? "").toLowerCase();
      const cod = (t.tareaPlantilla?.codigoDocumento ?? "").toLowerCase();
      const nombreTarea = (t.tareaPlantilla?.nombre ?? "").toLowerCase();
      const nota = (t.comentarios ?? "").toLowerCase();

      return (
        rut.includes(term) ||
        rs.includes(term) ||
        cod.includes(term) ||
        nombreTarea.includes(term) ||
        nota.includes(term)
      );
    });
  }, [tareasPorPlantilla, busqueda]);

  const tareasNoRealizadas = useMemo(
    () =>
      tareasFiltradas.filter(
        (t) => t.estado === "PENDIENTE" || t.estado === "VENCIDA"
      ),
    [tareasFiltradas]
  );
  const tareasEnProceso = useMemo(
    () => tareasFiltradas.filter((t) => t.estado === "EN_PROCESO"),
    [tareasFiltradas]
  );
  const tareasRealizadas = useMemo(
    () => tareasFiltradas.filter((t) => t.estado === "COMPLETADA"),
    [tareasFiltradas]
  );

  const totalTareas = tareasFiltradas.length;
  const totalNoRealizadas = tareasNoRealizadas.length;
  const totalEnProceso = tareasEnProceso.length;
  const totalRealizadas = tareasRealizadas.length;

  const tareasTabla = useMemo(() => {
    const base = tareasFiltradas;
    const filtradasPorEstado =
      estadoFiltroTabla === "TODOS"
        ? base
        : base.filter((t) => t.estado === estadoFiltroTabla);

    return [...filtradasPorEstado].sort(
      (a, b) =>
        new Date(a.fechaProgramada).getTime() -
        new Date(b.fechaProgramada).getTime()
    );
  }, [tareasFiltradas, estadoFiltroTabla]);

  const totalPaginas = useMemo(
    () =>
      tareasTabla.length === 0
        ? 1
        : Math.ceil(tareasTabla.length / PAGE_SIZE),
    [tareasTabla.length]
  );

  const tareasTablaPagina = useMemo(() => {
    const start = (pagina - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return tareasTabla.slice(start, end);
  }, [tareasTabla, pagina]);

  const tareasPendientesParaExcel = useMemo(
    () =>
      tareasFiltradas.filter(
        (t) => t.estado === "PENDIENTE" || t.estado === "VENCIDA"
      ),
    [tareasFiltradas]
  );

  // reset página al cambiar filtros principales
  useEffect(() => {
    setPagina(1);
  }, [plantillaSeleccionadaId, busqueda, estadoFiltroTabla]);

  // reset selección al cambiar plantilla / subvista
  useEffect(() => {
    setSelectedIds([]);
  }, [plantillaSeleccionadaId, subVista]);

  // -----------------------------
  // Cargar plantillas
  // -----------------------------
  useEffect(() => {
    const fetchPlantillas = async () => {
      setLoadingPlantillas("loading");
      setErrorPlantillas(null);
      try {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        };

        const res = await fetch(`${API_BASE_URL}/tareas/plantillas`, {
          headers,
        });

        if (!res.ok) {
          throw new Error(`Error ${res.status}`);
        }

        const data: TareaPlantilla[] = await res.json();
        const filtradas = (data || []).filter((p) => p.activo);
        setPlantillas(filtradas);
        setLoadingPlantillas("success");
      } catch (err) {
        console.error("[Front] Error cargando plantillas", err);
        setErrorPlantillas("No se pudieron cargar las tareas/plantillas.");
        setLoadingPlantillas("error");
      }
    };

    fetchPlantillas();
  }, []);

  // -----------------------------
  // Cargar tareas por plantilla
  // -----------------------------
  const fetchTareasPorPlantilla = async (
    idTareaPlantilla: number,
    anio: number,
    mes: number
  ) => {
    setLoadingTareasPlantilla("loading");
    setErrorTareasPlantilla(null);

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      };

      const params = new URLSearchParams();
      if (trabajadorIdFiltro) {
        params.append("trabajadorId", String(trabajadorIdFiltro));
      }
      if (anio && mes) {
        params.append("anio", String(anio));
        params.append("mes", String(mes));
      }

      const qs = params.toString() ? `?${params.toString()}` : "";

      const res = await fetch(
        `${API_BASE_URL}/tareas/por-plantilla/${idTareaPlantilla}${qs}`,
        { headers }
      );

      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
      }

      const data: TareaAsignadaConCliente[] = await res.json();
      setTareasPorPlantilla(data || []);
      setLoadingTareasPlantilla("success");
    } catch (err) {
      console.error("[Front] Error cargando tareas por plantilla", err);
      setErrorTareasPlantilla(
        "No se pudieron cargar las tareas para esa plantilla."
      );
      setLoadingTareasPlantilla("error");
    }
  };

  // -----------------------------
  // Seleccionar plantilla
  // -----------------------------
  const handleSelectPlantilla = (value: string) => {
    if (!value) {
      setPlantillaSeleccionadaId("");
      setTareasPorPlantilla([]);
      return;
    }

    const id = Number(value);
    setPlantillaSeleccionadaId(id);
    setSubVista("tarjetas");
    setBusqueda("");
    setPagina(1);

    fetchTareasPorPlantilla(id, anioFiltro, mesFiltro);
  };

  // recargar al cambiar mes/año y haya plantilla escogida
  useEffect(() => {
    if (typeof plantillaSeleccionadaId === "number") {
      fetchTareasPorPlantilla(plantillaSeleccionadaId, anioFiltro, mesFiltro);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anioFiltro, mesFiltro, trabajadorIdFiltro]);

  // -----------------------------
  // Modal completar (usa SIEMPRE el modal multi, aunque sea 1 tarea)
  // -----------------------------
  const abrirModalCompletar = (t: TareaAsignadaConCliente) => {
    const initialFiles: FilesMap = {
      [t.id_tarea_asignada]: null,
    };

    setFilesMap(initialFiles);
    setTareasParaMultiCompletar([t]);
    setMultiError(null);
    setMultiModalOpen(true);
  };

  // -----------------------------
  // Modal multi-completar
  // -----------------------------
  const abrirModalMultiCompletar = (ids: number[]) => {
    const seleccionadas = tareasPorPlantilla.filter((t) =>
      ids.includes(t.id_tarea_asignada)
    );
    if (!seleccionadas.length) return;

    const initialFiles: FilesMap = {};
    seleccionadas.forEach((t) => {
      initialFiles[t.id_tarea_asignada] = null;
    });

    setFilesMap(initialFiles);
    setTareasParaMultiCompletar(seleccionadas);
    setMultiError(null);
    setMultiModalOpen(true);
  };

  const closeMultiModal = () => {
    setMultiModalOpen(false);
    setTareasParaMultiCompletar([]);
    setFilesMap({});
    setIsSubmittingMulti(false);
    setMultiError(null);
  };

  const handleFilesChange = (tareaId: number, file: File | null) => {
    setFilesMap((prev) => ({
      ...prev,
      [tareaId]: file,
    }));
    if (file) setMultiError(null);
  };

  const handleMultiConfirm = async (_sendEmail?: boolean) => {
    if (!tareasParaMultiCompletar.length) return;

    const faltantes = tareasParaMultiCompletar.filter(
      (t) => !filesMap[t.id_tarea_asignada]
    );
    if (faltantes.length > 0) {
      setMultiError(
        "Debes seleccionar un archivo para todas las tareas seleccionadas."
      );
      return;
    }

    try {
      setIsSubmittingMulti(true);
      setMultiError(null);

      const nowIso = new Date().toISOString();

      await Promise.all(
        tareasParaMultiCompletar.map(async (t) => {
          const tareaId = t.id_tarea_asignada;
          const archivo = filesMap[tareaId];
          if (!archivo) return;

          // 1) subir archivo
          const formData = new FormData();
          formData.append("archivo", archivo);

          const uploadRes = await fetch(
            `${API_BASE_URL}/tareas/${tareaId}/archivos`,
            {
              method: "POST",
              headers: getAuthHeaders(),
              body: formData,
            }
          );

          if (!uploadRes.ok) {
            throw new Error(
              `Error subiendo archivo para tarea ${tareaId} (${uploadRes.status})`
            );
          }

          // 2) actualizar estado a COMPLETADA
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
            throw new Error(
              `Error actualizando estado para tarea ${tareaId} (${patchRes.status})`
            );
          }

          const updated: TareaAsignada = await patchRes.json();

          setTareasPorPlantilla((prev) =>
            prev.map((tp) =>
              tp.id_tarea_asignada === tareaId
                ? {
                    ...tp,
                    estado: updated.estado,
                    fechaComplecion:
                      updated.fechaComplecion ?? tp.fechaComplecion ?? nowIso,
                  }
                : tp
            )
          );
        })
      );

      setSelectedIds([]);
      closeMultiModal();
    } catch (err) {
      console.error("[Front] Error en completado múltiple", err);
      setMultiError(
        "Ocurrió un error al subir los archivos y completar las tareas. Revisa e intenta nuevamente."
      );
    } finally {
      setIsSubmittingMulti(false);
    }
  };

  // -----------------------------
  // Drag & Drop – tipo Trello
  // -----------------------------
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const idTarea = Number(draggableId);
    if (Number.isNaN(idTarea)) return;

    const tarea = tareasPorPlantilla.find(
      (t) => t.id_tarea_asignada === idTarea
    );
    if (!tarea) return;

    if (destination.droppableId === "col-realizadas") {
      if (tarea.estado !== "COMPLETADA") {
        // 👉 Al arrastrar a "Completadas" se abre el modal multi (para esa 1 tarea)
        abrirModalCompletar(tarea);
      }
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
      default:
        return;
    }

    setTareasPorPlantilla((prev) =>
      prev.map((t) =>
        t.id_tarea_asignada === idTarea
          ? {
              ...t,
              estado: nuevoEstado,
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
        }),
      });
    } catch (err) {
      console.error("[Front] Error actualizando estado en.backend", err);
    }
  };

  // -----------------------------
  // Acciones masivas
  // -----------------------------
  const bulkUpdateEstado = async (nuevoEstado: EstadoTarea) => {
    if (!selectedIds.length) return;

    // 🟡 CASO ESPECIAL: COMPLETADA
    if (nuevoEstado === "COMPLETADA") {
      // Si solo hay 1 tarea seleccionada, usamos el mismo modal multi pero con 1
      if (selectedIds.length === 1) {
        const tarea = tareasPorPlantilla.find(
          (t) => t.id_tarea_asignada === selectedIds[0]
        );
        if (tarea) {
          abrirModalCompletar(tarea);
        }
        return;
      }

      // Si hay 2 o más, usamos el modal MULTI
      abrirModalMultiCompletar(selectedIds);
      return;
    }

    // 🔵 Para otros estados (PENDIENTE / EN_PROCESO) sí es masivo directo
    setTareasPorPlantilla((prev) =>
      prev.map((t) =>
        selectedIds.includes(t.id_tarea_asignada)
          ? {
              ...t,
              estado: nuevoEstado,
            }
          : t
      )
    );

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      };

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

  // -----------------------------
  // Exportar pendientes a Excel
  // -----------------------------
  const exportPendientesToExcel = async () => {
    if (!tareasPendientesParaExcel.length) return;

    const tituloBase = "Tareas pendientes / vencidas";
    const tituloDetalle = plantillaSeleccionada
      ? plantillaSeleccionada.codigoDocumento
        ? `${plantillaSeleccionada.codigoDocumento} – ${plantillaSeleccionada.nombre}`
        : plantillaSeleccionada.nombre
      : "";
    const titulo = tituloDetalle
      ? `${tituloBase} – ${tituloDetalle}`
      : tituloBase;

    const hoy = new Date().toLocaleDateString("es-CL");

    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);
    sheet.name("Tareas pendientes");

    sheet.cell("A1").value(titulo);
    sheet.range("A1:F1").merged(true);
    sheet.range("A1:F1").style({
      bold: true,
      fontSize: 14,
      horizontalAlignment: "center",
      verticalAlignment: "center",
      fill: "FFD966", // dorado suave
    });

    sheet.cell("A2").value(`Generado el ${hoy}`);
    sheet.range("A2:F2").merged(true);
    sheet.range("A2:F2").style({
      italic: true,
      fontSize: 10,
      horizontalAlignment: "right",
      verticalAlignment: "center",
      fontColor: "666666",
    });

    const headers = [
      "RUT",
      "Razón social",
      "Estado",
      "Fecha programada",
      "Responsable",
      "Nota",
    ];

    headers.forEach((h, i) => {
      const cell = sheet.cell(4, i + 1);
      cell.value(h);
    });

    sheet.range("A4:F4").style({
      bold: true,
      horizontalAlignment: "center",
      verticalAlignment: "center",
      fill: "4472C4",
      fontColor: "FFFFFF",
      border: true,
    });

    let row = 5;
    tareasPendientesParaExcel.forEach((t) => {
      const responsable = t.asignado
        ? `${t.asignado.nombre} (${t.asignado.email})`
        : "";
      const estadoLegible =
        t.estado === "PENDIENTE"
          ? "No realizado"
          : t.estado === "VENCIDA"
          ? "Vencida"
          : t.estado;

      const values = [
        t.rutCliente ?? "",
        t.clienteRazonSocial ?? "",
        estadoLegible,
        formatFecha(t.fechaProgramada),
        responsable,
        t.comentarios ?? "",
      ];

      values.forEach((val, colIndex) => {
        const cell = sheet.cell(row, colIndex + 1);
        cell.value(val);
        cell.style({
          border: "thin",
          verticalAlignment: "top",
          wrapText: true,
        });
      });

      if (row % 2 === 1) {
        sheet.range(`A${row}:F${row}`).style({
          fill: "F3F6FB",
        });
      }

      row++;
    });

    sheet.column("A").width(15);
    sheet.column("B").width(30);
    sheet.column("C").width(14);
    sheet.column("D").width(16);
    sheet.column("E").width(35);
    sheet.column("F").width(45);

    sheet.freezePanes(5, 1);

    const blob = await workbook.outputAsync();
    const blobExcel = new Blob([blob], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = URL.createObjectURL(blobExcel);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tareas_pendientes_${plantillaSeleccionadaId || "tarea"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // -----------------------------
  // Render
  // -----------------------------
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

  return (
    <div className="flex flex-col gap-4">
      {/* HEADER / FILTROS */}
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: "#1C1C1C" }} // negro
            >
              Tarea repetida por RUT
            </h2>
            <p className="text-xs text-black/50">
              Elige una tarea y verás todas las asignaciones en tablero tipo
              Kanban o en vista tabla.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <label className="block text-[11px] font-semibold text-black/70 mb-1">
              Tarea / plantilla
            </label>
            {loadingPlantillas === "loading" && (
              <p className="text-xs text-black/50 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Cargando lista de
                tareas…
              </p>
            )}
            {errorPlantillas && (
              <p className="text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errorPlantillas}
              </p>
            )}
            {!errorPlantillas && loadingPlantillas === "success" && (
              <select
                value={plantillaSeleccionadaId}
                onChange={(e) => handleSelectPlantilla(e.target.value)}
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#D4AF37] bg-white"
              >
                <option value="">Selecciona una tarea…</option>
                {plantillas.map((p) => {
                  const tag =
                    p.presentacion === "CLIENTE"
                      ? "CLI"
                      : p.presentacion === "INTERNO"
                      ? "INT"
                      : p.presentacion || "—";
                  const labelDocumento = p.codigoDocumento
                    ? `${p.codigoDocumento} — ${p.nombre}`
                    : p.nombre;
                  return (
                    <option
                      key={p.id_tarea_plantilla}
                      value={p.id_tarea_plantilla}
                    >
                      {`[${tag}] ${labelDocumento}`}
                    </option>
                  );
                })}
              </select>
            )}
          </div>
        </div>

        {plantillaSeleccionadaId && (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2">
              <div className="text-[11px] text-black/70 bg-[#F5F5F5] rounded-xl px-3 py-2 border border-black/5">
                <p>
                  Mostrando asignaciones de la tarea seleccionada para{" "}
                  <span className="font-semibold">
                    {nombreMes(mesFiltro)} {anioFiltro}
                  </span>
                  . Cambia el mes para verificar que al completar una tarea se
                  genera en el período siguiente.
                </p>
              </div>

              <div className="inline-flex bg-black/5 rounded-full p-0.5 text-[11px] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSubVista("tarjetas")}
                  className={`px-3 py-1 rounded-full transition ${
                    subVista === "tarjetas"
                      ? "bg-white shadow text-black/80"
                      : "text-black/60"
                  }`}
                >
                  Vista tarjetas
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
            </div>

            {/* ⚠️ Mensaje sobre correo en esta vista */}
            <div className="mt-2 text-[11px] text-[#7C5A0B] bg-[#FFF7D6] border border-[#D4AF37]/60 rounded-xl px-3 py-2">
              Desde <span className="font-semibold">"Vista por tarea"</span> por
              el momento solo puedes subir archivos y completar tareas. El envío
              de correos al cliente se realiza desde la vista{" "}
              <span className="font-semibold">"Por RUT"</span>.
            </div>

            {/* filtros de mes/año */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 mt-2">
              <div className="flex items-center gap-3 text-[11px]">
                <div>
                  <label className="block font-semibold text-black/70 mb-1">
                    Mes
                  </label>
                  <select
                    value={mesFiltro}
                    onChange={(e) => setMesFiltro(Number(e.target.value))}
                    className="border border-black/15 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
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
                    className="border border-black/15 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    {opcionesAnios.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* búsqueda */}
        {plantillaSeleccionadaId && tareasPorPlantilla.length > 0 && (
          <div className="mt-2">
            <label className="block text-[11px] font-semibold text-black/70 mb-1">
              Buscar tareas (RUT, razón social, código, nombre, nota…)
            </label>
            <div className="flex flex-col xs:flex-row xs:items-center gap-2">
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Ej: 76.511.417-9, PANEXPRESS, A01, 'convenio'..."
                className="flex-1 border border-black/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-[#D4AF37] bg-white"
              />
              {busqueda && (
                <button
                  type="button"
                  onClick={() => setBusqueda("")}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-black/10 hover:bg-black/5 self-start xs:self-auto"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>
        )}
      </section>

      {/* CONTENIDO PRINCIPAL */}
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
        {!plantillaSeleccionadaId && (
          <p className="text-sm text-black/50">
            Selecciona una tarea en el selector de arriba para ver el tablero o
            la vista tabla.
          </p>
        )}

        {plantillaSeleccionadaId && loadingTareasPlantilla === "loading" && (
          <p className="text-sm text-black/50 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando tareas para la plantilla seleccionada…
          </p>
        )}

        {plantillaSeleccionadaId && errorTareasPlantilla && (
          <p className="text-sm text-rose-600 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {errorTareasPlantilla}
          </p>
        )}

        {plantillaSeleccionadaId &&
          loadingTareasPlantilla === "success" &&
          tareasPorPlantilla.length === 0 && (
            <p className="text-sm text-black/50">
              Ningún cliente tiene asignada esta tarea en {nombreMes(mesFiltro)}{" "}
              {anioFiltro}.
            </p>
          )}

        {/* SUBVISTA: TABLERO */}
        {plantillaSeleccionadaId &&
          subVista === "tarjetas" &&
          loadingTareasPlantilla === "success" &&
          tareasFiltradas.length > 0 && (
            <>
              {/* métricas + acciones masivas */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3 text-[11px]">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
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
                        Completadas
                      </p>
                      <p className="text-emerald-800/80">
                        {totalRealizadas} de {totalTareas}
                      </p>
                    </div>
                  </div>
                </div>

                {totalTareas > 0 && (
                  <div className="flex-1 md:flex-none flex flex-col md:flex-row md:items-center md:justify-end gap-2 bg-[#F5F5F5] border border-black/5 rounded-xl px-3 py-2">
                    <div>
                      <span className="font-semibold text-black/80">
                        Seleccionadas: {selectedIds.length}
                      </span>
                      <span className="text-black/50">
                        {" "}
                        (marca varias tareas con el checkbox)
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
                        Pasar a No realizado
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
                        onClick={() => bulkUpdateEstado("COMPLETADA")}
                        className={`px-2 py-1 rounded border text-[11px] ${
                          !selectedIds.length
                            ? "opacity-40 cursor-not-allowed border-black/10"
                            : "border-emerald-300 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100"
                        }`}
                      >
                        Pasar a Completada
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tablero Kanban */}
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  {/* NO REALIZADAS */}
                  <Droppable droppableId="col-no-realizadas">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col rounded-2xl border border-black/5 bg-[#F5F5F5] p-2 min-h-[220px] ${
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
                              isDragDisabled={t.estado === "COMPLETADA"}
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
                                  <div className="pt-1 flex flex-col items-center gap-1">
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
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        abrirModalCompletar(t);
                                      }}
                                      className="text-[9px] text-emerald-700 underline"
                                    >
                                      Completar
                                    </button>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <p className="font-mono text-[10px] text-black/50">
                                      {t.rutCliente}
                                    </p>
                                    {t.clienteRazonSocial && (
                                      <p className="text-[11px] text-black/70 font-medium">
                                        {t.clienteRazonSocial}
                                      </p>
                                    )}
                                    <p className="text-xs font-semibold text-black/80">
                                      {t.tareaPlantilla?.nombre ??
                                        "Tarea contable asignada"}
                                    </p>
                                    {t.tareaPlantilla?.codigoDocumento && (
                                      <p className="font-mono text-[10px] text-black/40">
                                        {t.tareaPlantilla.codigoDocumento}
                                      </p>
                                    )}
                                    <p className="text-[10px] text-black/60">
                                      Programada:{" "}
                                      {formatFecha(t.fechaProgramada)}
                                    </p>
                                    {t.comentarios && (
                                      <p className="text-[10px] text-black/60 line-clamp-2">
                                        Nota: {t.comentarios}
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
                        className={`flex flex-col rounded-2xl border border-black/5 bg-[#F5F5F5] p-2 min-h-[220px] ${
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
                              isDragDisabled={t.estado === "COMPLETADA"}
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
                                  <div className="pt-1 flex flex-col.items-center gap-1">
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
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        abrirModalCompletar(t);
                                      }}
                                      className="text-[9px] text-emerald-700 underline"
                                    >
                                      Completar
                                    </button>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <p className="font-mono text-[10px] text-black/50">
                                      {t.rutCliente}
                                    </p>
                                    {t.clienteRazonSocial && (
                                      <p className="text-[11px] text-black/70 font-medium">
                                        {t.clienteRazonSocial}
                                      </p>
                                    )}
                                    <p className="text-xs font-semibold text-black/80">
                                      {t.tareaPlantilla?.nombre ??
                                        "Tarea contable asignada"}
                                    </p>
                                    {t.tareaPlantilla?.codigoDocumento && (
                                      <p className="font-mono text-[10px] text-black/40">
                                        {t.tareaPlantilla.codigoDocumento}
                                      </p>
                                    )}
                                    <p className="text-[10px] text-black/60">
                                      Programada:{" "}
                                      {formatFecha(t.fechaProgramada)}
                                    </p>
                                    {t.comentarios && (
                                      <p className="text-[10px] text-black/60 line-clamp-2">
                                        Nota: {t.comentarios}
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

                  {/* COMPLETADAS */}
                  <Droppable droppableId="col-realizadas">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col rounded-2xl border border-black/5 bg-[#F5F5F5] p-2 min-h-[220px] ${
                          snapshot.isDraggingOver
                            ? "ring-2 ring-emerald-200 bg-emerald-50/40"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2 px-1">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">
                            Completadas
                          </span>
                          <span className="text-[11px] text-emerald-800/80">
                            {tareasRealizadas.length}
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col gap-2">
                          {tareasRealizadas.map((t, index) => (
                            <Draggable
                              key={t.id_tarea_asignada}
                              draggableId={String(t.id_tarea_asignada)}
                              index={index}
                              isDragDisabled={true}
                            >
                              {(dragProvided, dragSnapshot) => (
                                <article
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  style={{
                                    ...dragProvided.draggableProps.style,
                                  }}
                                  className={`border border-black/5 rounded-xl p-2 shadow-sm bg-white transition-transform text-[11px] ${
                                    dragSnapshot.isDragging
                                      ? "ring-2 ring-emerald-300 scale-[1.02]"
                                      : ""
                                  }`}
                                >
                                  <div className="flex flex-col gap-1">
                                    <p className="font-mono text-[10px] text-black/50">
                                      {t.rutCliente}
                                    </p>
                                    {t.clienteRazonSocial && (
                                      <p className="text-[11px] text-black/70 font-medium">
                                        {t.clienteRazonSocial}
                                      </p>
                                    )}
                                    <p className="text-xs font-semibold text-black/80">
                                      {t.tareaPlantilla?.nombre ??
                                        "Tarea contable asignada"}
                                    </p>
                                    {t.tareaPlantilla?.codigoDocumento && (
                                      <p className="font-mono text-[10px] text-black/40">
                                        {t.tareaPlantilla.codigoDocumento}
                                      </p>
                                    )}
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
                                        Nota: {t.comentarios}
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
                </div>
              </DragDropContext>
            </>
          )}

        {/* SUBVISTA: TABLA */}
        {plantillaSeleccionadaId &&
          subVista === "tabla" &&
          loadingTareasPlantilla === "success" && (
            <>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                <div className="flex flex-col gap-1 text-xs text-black/60">
                  {tareasTabla.length === 0 ? (
                    <span>
                      No hay tareas para mostrar (según el filtro de búsqueda y
                      estado).
                    </span>
                  ) : (
                    <span>
                      Mostrando{" "}
                      <span className="font-semibold">
                        {tareasTablaPagina.length}
                      </span>{" "}
                      de{" "}
                      <span className="font-semibold">
                        {tareasTabla.length}
                      </span>{" "}
                      tareas (página {pagina} de {totalPaginas}).
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap.items-center gap-2">
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-black/60">Estado:</span>
                    <select
                      value={estadoFiltroTabla}
                      onChange={(e) =>
                        setEstadoFiltroTabla(
                          e.target.value as "TODOS" | EstadoTarea
                        )
                      }
                      className="border border-black/15 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                    >
                      <option value="TODOS">Todos</option>
                      <option value="PENDIENTE">
                        No realizado (pendiente)
                      </option>
                      <option value="VENCIDA">No realizado (vencida)</option>
                      <option value="EN_PROCESO">En proceso</option>
                      <option value="COMPLETADA">Completada</option>
                    </select>
                  </div>

                  {tareasPendientesParaExcel.length > 0 && (
                    <button
                      type="button"
                      onClick={exportPendientesToExcel}
                      className="self-start md:self-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-[#D4AF37] text-white hover:brightness-105"
                    >
                      Exportar pendientes a Excel
                    </button>
                  )}
                </div>
              </div>

              {tareasTabla.length > 0 && (
                <>
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
                            Estado
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Programada
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Completada
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Responsable
                          </th>
                          <th className="text-left px-3 py-2 border-b border-black/10">
                            Nota
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tareasTablaPagina.map((t) => (
                          <tr
                            key={t.id_tarea_asignada}
                            className="hover:bg-black/[0.02]"
                          >
                            <td className="px-3 py-2 border-b border-black/5 font-mono">
                              {t.rutCliente}
                            </td>
                            <td className="px-3 py-2 border-b border-black/5">
                              {t.clienteRazonSocial ?? "-"}
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
                            <td className="px-3 py-2 border-b border-black/5">
                              {t.asignado
                                ? `${t.asignado.nombre} (${t.asignado.email})`
                                : "-"}
                            </td>
                            <td className="px-3 py-2 border-b border-black/5 max-w-xs">
                              {t.comentarios ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {tareasTabla.length > PAGE_SIZE && (
                    <div className="flex items-center justify-end gap-2 mt-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPagina((p) => Math.max(1, p - 1))}
                        disabled={pagina === 1}
                        className={`px-2 py-1 rounded border border-black/10 ${
                          pagina === 1
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-black/5"
                        }`}
                      >
                        Anterior
                      </button>
                      <span className="text-black/60">
                        Página {pagina} de {totalPaginas}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setPagina((p) => Math.min(totalPaginas, p + 1))
                        }
                        disabled={pagina === totalPaginas}
                        className={`px-2 py-1 rounded border border-black/10 ${
                          pagina === totalPaginas
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
            </>
          )}
      </section>

      {/* MODAL MULTI COMPLETAR (1 o N tareas) */}
      <MultiCompletarTareasModal
        open={multiModalOpen}
        tareas={tareasParaMultiCompletar}
        filesMap={filesMap}
        isSubmitting={isSubmittingMulti}
        errorMessage={multiError}
        onClose={closeMultiModal}
        onFileChange={handleFilesChange}
        onConfirm={handleMultiConfirm}
        getRazonSocial={getRazonSocialByRut}
        formatFecha={formatFecha}
        // 👇 En esta vista no queremos ni carga masiva ni checkbox de correo
        enableSmartAttach={false}
        enableSendEmail={false}
      />

      {/* ⚠️ MODAL ENVIAR CORREO DESHABILITADO EN ESTA VISTA */}
      {/* 
      <EnviarCorreoTareaModal
        open={correoModalOpen}
        tarea={tareaParaCorreo}
        isSubmitting={isSendingCorreo}
        errorMessage={correoError}
        onClose={cerrarModalCorreo}
        onSend={handleSendCorreo}
      />
      */}
    </div>
  );
};

export default VistaPorTarea;
