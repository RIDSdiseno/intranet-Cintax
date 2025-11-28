import React, { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Calendar,
  PlayCircle,
  XCircle,
  GripVertical,
  Briefcase,
  Activity,
  ListTodo,
  BarChart3,
  Columns3,
  Folder as FolderIcon,
  FileText,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Loader2,
} from "lucide-react";

// --- TIPOS DE DATOS ---
type UserRole = "admin" | "analyst";

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
};

type TareaEstado =
  | "pendiente"
  | "completado"
  | "atrasado"
  | "en_proceso"
  | "no_realizada";

type KanbanColumnId = "asignada" | "no_realizada" | "en_proceso" | "realizada";

type Tarea = {
  id: string;
  nombre: string;
  vencimiento: string;
  estado: TareaEstado;
  comentario?: string;
};

type Cliente = {
  id: string;
  nombre: string;
  rut: string;
  email?: string;
  progreso: number;
  tareas: Tarea[];
};

type Analista = {
  id: string;
  nombre: string;
  email: string;
  avatar: string;
  clientes: Cliente[];
  cargaTotal: number;
  completadas: number;
};

// --- DRIVE / CARPETAS EJECUTIVO ---
const FOLDER_MIME = "application/vnd.google-apps.folder";
const currentYear = new Date().getFullYear().toString();

// Base usada para DRIVE (igual que en DrivePage)
const DRIVE_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "https://localhost:3000";

type DriveFileItem = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
};

type EjecutivoFolder = {
  id: string;
  name: string;
  categoria?: string;
  pathString?: string;
};

// --- CONFIGURACIÓN DE COLUMNAS ---
const KANBAN_COLUMNS: {
  id: KanbanColumnId;
  label: string;
  color: string;
  icon: React.ReactNode;
  bg: string;
  border: string;
}[] = [
  {
    id: "asignada",
    label: "Asignadas (Carpetas clientes)",
    color: "text-gray-600",
    icon: <Clock size={18} />,
    bg: "bg-gray-200/20",
    border: "border-gray-200",
  },
  {
    id: "no_realizada",
    label: "No Realizadas",
    color: "text-rose-600",
    icon: <XCircle size={18} />,
    bg: "bg-rose-200/20",
    border: "border-rose-100",
  },
  {
    id: "en_proceso",
    label: "En Proceso",
    color: "text-blue-600",
    icon: <PlayCircle size={18} />,
    bg: "bg-blue-200/20",
    border: "border-blue-100",
  },
  {
    id: "realizada",
    label: "Realizadas",
    color: "text-emerald-600",
    icon: <CheckCircle2 size={18} />,
    bg: "bg-emerald-200/20",
    border: "border-emerald-100",
  },
];

// --- ADMIN POR DEFECTO ---
const ADMIN_USER: UserProfile = {
  id: "admin",
  name: "Administrador",
  email: "administrador@cintax.cl",
  role: "admin",
  avatar: "AD",
};

const INITIAL_DATA: Analista[] = [];

// API BASE para endpoints de la intranet (auth, tareas, etc.)
const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

const getCurrentPeriod = () => {
  const date = new Date();
  const month = date.toLocaleString("es-ES", { month: "long" });
  const year = date.getFullYear();
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
};

// 🔐 Helper para token
function getAccessToken(): string | null {
  try {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token")
    );
  } catch {
    return null;
  }
}

// ✅ FETCH API tareas/analistas
async function fetchAnalistasConTareas(role: UserRole): Promise<Analista[]> {
  const params = new URLSearchParams();
  if (role === "admin") {
    params.set("todos", "true");
  }

  const base = API_BASE_URL.replace(/\/$/, "");
  const url = `${base}/auth/tareas-asignadas?${params.toString()}`;

  const token = getAccessToken();
  if (!token) throw new Error("No hay token de sesión.");

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error("No autorizado");
    throw new Error(`Error HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.analistas as Analista[];
}

// ✅ FETCH API carpetas de ejecutivo (A01, A02, etc.)
async function fetchEjecutivoFoldersApi(): Promise<EjecutivoFolder[]> {
  const token = getAccessToken();
  if (!token) throw new Error("No hay token de sesión.");

  const base = DRIVE_BASE_URL.replace(/\/$/, "");

  // 1) Categorías visibles para el usuario (CONTA, RRHH, TRIBUTARIO...)
  const resCategorias = await fetch(`${base}/drive/cintax/${currentYear}`, {
    credentials: "include",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!resCategorias.ok) {
    throw new Error(`Error HTTP categorías: ${resCategorias.status}`);
  }

  const data = await resCategorias.json();
  const categorias = data.folders || [];

  const ejecutivoFolders: EjecutivoFolder[] = [];

  // 2) Para cada categoría, traemos sus subcarpetas (A01, A02, etc.)
  for (const cat of categorias) {
    if (!cat.id) continue;

    const resFiles = await fetch(
      `${base}/drive/folder/${cat.id}/files?pageSize=100`,
      {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!resFiles.ok) {
      console.warn(
        "No se pudieron listar subcarpetas de categoría",
        cat.name,
        resFiles.status
      );
      continue;
    }

    const filesData = await resFiles.json();
    const files = filesData.files || [];

    const subFolders = files.filter(
      (f: any) => f.mimeType === FOLDER_MIME
    );

    for (const sf of subFolders) {
      ejecutivoFolders.push({
        id: sf.id,
        name: sf.name,
        categoria: cat.name ?? "",
        pathString: `CINTAX / ${currentYear} / ${cat.name} / ${sf.name}`,
      });
    }
  }

  return ejecutivoFolders;
}

// --- COMPONENTES UI ---
const ProgressBar = ({
  value,
  colorClass = "bg-[var(--secondary-color)]",
}: {
  value: number;
  colorClass?: string;
}) => (
  <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
    <div
      className={`h-full ${colorClass} transition-all duration-500 ease-out`}
      style={{ width: `${value}%` }}
    />
  </div>
);

// --- COMPONENTES DND ---

// 1. TARJETA ARRASTRABLE (Draggable)
const DraggableTaskCard = ({
  task,
  isOverlay = false,
  disabled = false,
}: {
  task: any;
  isOverlay?: boolean;
  disabled?: boolean;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.uniqueId,
      data: task,
      disabled: disabled,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none",
  };

  const dateObj = new Date(task.vencimiento);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isDatePast = dateObj < today;

  const isCompleted =
    task.estado === "completado" || task.estado === "realizada";
  const isInProgress = task.estado === "en_proceso";
  const isLate =
    (isDatePast && !isCompleted) ||
    task.estado === "atrasado" ||
    task.estado === "no_realizada";

  let cardClasses = "bg-white border-gray-200 hover:border-gray-300";
  let titleClasses = "text-gray-800";
  let dateClasses = "text-gray-500";
  let badgeClasses = "bg-gray-100 text-black/50";

  if (isCompleted) {
    cardClasses =
      "bg-white border-emerald-200 border-l-4 border-l-emerald-500 shadow-sm";
    titleClasses = "text-emerald-900 line-through decoration-emerald-900/30";
    dateClasses = "text-emerald-600";
    badgeClasses = "bg-emerald-100 text-emerald-700 font-medium";
  } else if (isLate) {
    cardClasses =
      "bg-white border-rose-200 border-l-4 border-l-rose-500 shadow-sm";
    titleClasses = "text-gray-900 font-semibold";
    dateClasses = "text-rose-600 font-bold";
    badgeClasses = "bg-rose-50 text-rose-700 font-bold";
  } else if (isInProgress) {
    cardClasses =
      "bg-white border-blue-200 border-l-4 border-l-blue-500 shadow-md";
    titleClasses = "text-blue-900 font-medium";
    dateClasses = "text-blue-600 font-medium";
    badgeClasses = "bg-blue-50 text-blue-700 font-medium";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`
        p-3.5 rounded-xl border shadow-sm transition-all relative group touch-none flex flex-col gap-2
        ${cardClasses}
        ${
          isOverlay
            ? "shadow-2xl scale-105 -rotate-2 cursor-grabbing z-50"
            : "hover:shadow-md"
        }
        ${
          disabled
            ? "cursor-default opacity-80"
            : "cursor-grab active:cursor-grabbing"
        }
      `}
    >
      <div className="flex justify-between items-start">
        <span
          className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded truncate max-w-[150px] ${badgeClasses}`}
        >
          {task.cliente}
        </span>
        {!disabled && (
          <GripVertical
            size={14}
            className="text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>

      <h4 className={`text-sm leading-snug ${titleClasses}`}>{task.nombre}</h4>

      <div className="flex items-center justify-between text-xs border-t border-black/5 pt-2 mt-1">
        <div className={`flex items-center gap-1 ${dateClasses}`}>
          <Calendar size={12} />
          {new Date(task.vencimiento).toLocaleDateString("es-CL", {
            day: "numeric",
            month: "short",
          })}
        </div>

        {task.comentario && (
          <div
            className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100"
            title={task.comentario}
          >
            <AlertCircle size={10} />
            <span className="truncate max-w-[60px]">Obs</span>
          </div>
        )}
      </div>
    </div>
  );
};

// 2. COLUMNA (Droppable) para columnas de tareas normales
const DroppableColumn = ({
  col,
  tasks,
  disabled,
}: {
  col: any;
  tasks: any[];
  disabled: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        flex-1 flex flex-col rounded-xl border min-w-[220px] max-w-[350px] transition-colors
        ${col.bg} ${col.border}
        ${
          isOver && !disabled
            ? "ring-2 ring-[var(--secondary-color)] ring-opacity-50 bg-white shadow-lg"
            : ""
        }
      `}
    >
      <div className="p-3 border-b border-gray-200/50 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-gray-700 text-sm">
          <div className={`p-1.5 rounded-lg bg-white/60 ${col.color}`}>
            {col.icon}
          </div>
          {col.label}
        </div>
        <span className="bg-white px-2 py-0.5 rounded-md text-xs font-bold text-gray-500 shadow-sm border border-gray-100">
          {tasks.length}
        </span>
      </div>

      <div className="flex-1 p-2 overflow-y-auto space-y-2.5 min-h-[200px]">
        {tasks.map((task) => (
          <DraggableTaskCard
            key={task.uniqueId}
            task={task}
            disabled={disabled}
          />
        ))}

        {tasks.length === 0 && (
          <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-300/50 rounded-xl text-gray-400 bg-white/30">
            <Briefcase size={20} className="mb-2 opacity-20" />
            <span className="text-xs">Sin tareas</span>
          </div>
        )}
      </div>
    </div>
  );
};

// 3. TARJETA DE CARPETA EJECUTIVO (A01, A02...) con navegador embebido
const EjecutivoFolderCard: React.FC<{ folder: EjecutivoFolder }> = ({
  folder,
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [stack, setStack] = useState<{ id: string; name: string }[]>([
    { id: folder.id, name: folder.name },
  ]);

  const currentNode = stack[stack.length - 1];

  const isFolder = (mime: string) => mime === FOLDER_MIME;

  const loadFolder = async (nodeId: string) => {
    try {
      setLoading(true);
      const token = getAccessToken();
      if (!token) throw new Error("No hay token de sesión.");

      const base = DRIVE_BASE_URL.replace(/\/$/, "");
      const res = await fetch(
        `${base}/drive/folder/${encodeURIComponent(nodeId)}/files?pageSize=50`,
        {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Error HTTP archivos: ${res.status}`);
      }

      const data = await res.json();
      const newFiles: DriveFileItem[] = data.files || [];
      setFiles(newFiles);
    } catch (err) {
      console.error("Error cargando carpeta de ejecutivo:", err);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && files.length === 0) {
      loadFolder(currentNode.id);
    }
  };

  const handleEnterFolder = (file: DriveFileItem) => {
    if (!isFolder(file.mimeType)) return;
    setStack((prev) => [...prev, { id: file.id, name: file.name }]);
    loadFolder(file.id);
  };

  const handleBack = () => {
    if (stack.length <= 1) return;
    setStack((prev) => {
      const newStack = prev.slice(0, prev.length - 1);
      const top = newStack[newStack.length - 1];
      loadFolder(top.id);
      return newStack;
    });
  };

  const totalFolders = files.filter((f) => isFolder(f.mimeType)).length;
  const totalFiles = files.length - totalFolders;

  return (
    <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 rounded-2xl p-[1px] shadow-sm hover:shadow-md transition-shadow">
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
        {/* CABECERA: carpeta A01 / A02 */}
        <button
          type="button"
          onClick={toggleOpen}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-slate-50"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--tertiary-color)] text-[var(--secondary-color)] shadow-inner">
              <FolderIcon size={18} />
            </span>
            <span className="flex flex-col min-w-0">
              <span className="font-semibold text-sm tracking-tight truncate">
                {folder.name}
              </span>
              <span className="flex items-center gap-2 text-[11px] text-black/55">
                {folder.categoria && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-[2px] text-[10px] font-medium text-slate-700">
                    {folder.categoria}
                  </span>
                )}
                {folder.pathString && (
                  <span className="truncate font-mono text-[10px] text-black/45">
                    {folder.pathString}
                  </span>
                )}
              </span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {loading && (
              <Loader2 className="h-4 w-4 animate-spin text-black/40" />
            )}
            <span className="text-[11px] text-black/60 font-medium">
              {open ? "Ocultar" : "Explorar"}
            </span>
            <ChevronRight
              size={14}
              className={`text-black/40 transition-transform ${
                open ? "rotate-90" : ""
              }`}
            />
          </div>
        </button>

        {/* CONTENIDO DESPLEGABLE */}
        {open && (
          <div className="px-3 pb-3 pt-2 border-t border-black/5 bg-slate-50/40">
            {/* Breadcrumb interno */}
            <div className="flex flex-wrap items-center gap-1 text-[11px] text-black/55 mb-2">
              <span className="font-mono">CINTAX / {currentYear}</span>
              {folder.categoria && (
                <>
                  <ChevronRight size={10} />
                  <span>{folder.categoria}</span>
                </>
              )}
              {stack.map((node, idx) => (
                <React.Fragment key={`${node.id}-${idx}`}>
                  <ChevronRight size={10} />
                  <span
                    className={
                      idx === stack.length - 1
                        ? "font-semibold text-black/80"
                        : "text-black/55"
                    }
                  >
                    {node.name}
                  </span>
                </React.Fragment>
              ))}
            </div>

            {/* Barra de acciones / stats */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={handleBack}
                disabled={stack.length <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2.5 py-0.5 text-[11px] text-black/60 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft size={10} />
                Atrás
              </button>

              <div className="flex items-center gap-2 text-[10px] text-black/55">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-[1px]">
                  <FolderIcon size={11} className="text-slate-500" />
                  <span>{totalFolders} carpetas</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-[1px]">
                  <FileText size={11} className="text-slate-500" />
                  <span>{totalFiles} archivos</span>
                </span>
                <span className="text-black/45">
                  ({files.length} elemento(s))
                </span>
              </div>
            </div>

            {/* Lista de archivos y subcarpetas */}
            {files.length === 0 && !loading && (
              <p className="text-[11px] text-black/50">
                Esta carpeta no tiene contenido visible.
              </p>
            )}

            {files.length > 0 && (
              <div className="max-h-[420px] overflow-y-auto border border-black/5 rounded-lg bg-white shadow-inner scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                <table className="min-w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-black/5 bg-slate-50 text-[10px] uppercase tracking-wide text-black/50 sticky top-0">
                      <th className="px-2 py-1.5">Nombre</th>
                      <th className="px-2 py-1.5">Tipo</th>
                      <th className="px-2 py-1.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((file, index) => {
                      const folderLike = isFolder(file.mimeType);
                      return (
                        <tr
                          key={`${file.id}-${index}`}
                          className="border-b border-black/5 last:border-0 odd:bg-white even:bg-slate-50/40"
                        >
                          <td className="px-2 py-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                folderLike ? handleEnterFolder(file) : undefined
                              }
                              className={`flex w-full items-center gap-2 text-left ${
                                folderLike
                                  ? "hover:text-[var(--secondary-color)]"
                                  : ""
                              }`}
                            >
                              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[var(--tertiary-color)] text-[var(--secondary-color)]">
                                {folderLike ? (
                                  <FolderIcon size={13} />
                                ) : (
                                  <FileText size={13} />
                                )}
                              </span>
                              <span className="truncate">{file.name}</span>
                            </button>
                          </td>
                          <td className="px-2 py-1.5 text-[11px] text-black/50">
                            {folderLike ? "Carpeta" : "Archivo"}
                          </td>
                          <td className="px-2 py-1.5 text-[11px] text-right space-x-2">
                            {!folderLike && file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-color)] px-2.5 py-0.5 text-[10px] font-medium text-white hover:bg-black"
                              >
                                <ExternalLink size={10} />
                                Abrir
                              </a>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ==============================
//      PÁGINA PRINCIPAL
// ==============================
export default function TareasPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(ADMIN_USER);
  const [periodo] = useState(getCurrentPeriod());
  const [analistas, setAnalistas] = useState<Analista[]>(INITIAL_DATA);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Carpetas de ejecutivo para columna "Asignadas"
  const [ejecutivoFolders, setEjecutivoFolders] = useState<EjecutivoFolder[]>(
    []
  );
  const [loadingEjecutivos, setLoadingEjecutivos] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const [activeTask, setActiveTask] = useState<any>(null);

  // Cargar tareas
  useEffect(() => {
    const cargarTareas = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        const data = await fetchAnalistasConTareas(currentUser.role);
        setAnalistas(data);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(
          "No se pudo conectar al servidor de tareas. Mostrando datos locales si existen."
        );
      } finally {
        setIsLoading(false);
      }
    };
    cargarTareas();
  }, [currentUser.role]);

  // Cargar carpetas de ejecutivo (A01, A02...)
  useEffect(() => {
    const cargarCarpetas = async () => {
      try {
        setLoadingEjecutivos(true);
        const data = await fetchEjecutivoFoldersApi();
        setEjecutivoFolders(data);
      } catch (err) {
        console.error("Error cargando carpetas de ejecutivo:", err);
      } finally {
        setLoadingEjecutivos(false);
      }
    };
    cargarCarpetas();
  }, []);

  const availableUsers = useMemo(() => {
    const users: UserProfile[] = [ADMIN_USER];
    if (!analistas.find((a) => a.email === "soporte@cintax.cl")) {
      users.push({
        id: "a-soporte",
        name: "Soporte Cintax",
        email: "soporte@cintax.cl",
        role: "analyst",
        avatar: "SC",
      });
    }
    analistas.forEach((a) => {
      users.push({
        id: a.id,
        name: a.nombre,
        email: a.email || `${a.nombre.split(" ")[0].toLowerCase()}@cintax.cl`,
        role: "analyst",
        avatar: a.avatar,
      });
    });
    return users.filter(
      (v, i, a) => a.findIndex((t) => t.email === v.email) === i
    );
  }, [analistas]);

  // --- PREPARACIÓN DE DATOS ---
  const kanbanTasks = useMemo(() => {
    const tasks: any[] = [];
    let data = analistas;

    if (currentUser.role === "analyst") {
      data = analistas.filter((a) => a.email === currentUser.email);
    }

    data.forEach((analista) => {
      analista.clientes.forEach((cliente) => {
        cliente.tareas.forEach((tarea) => {
          if (
            !searchTerm ||
            tarea.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cliente.nombre.toLowerCase().includes(searchTerm.toLowerCase())
          ) {
            tasks.push({
              ...tarea,
              uniqueId: `${analista.id}-${cliente.id}-${tarea.id}`,
              cliente: cliente.nombre,
              rut: cliente.rut,
              analistaId: analista.id,
              clienteId: cliente.id,
            });
          }
        });
      });
    });
    return tasks;
  }, [analistas, currentUser, searchTerm]);

  // --- KPIs DINÁMICOS ---
  const stats = useMemo(() => {
    const total = kanbanTasks.length;
    const completed = kanbanTasks.filter(
      (t) => t.estado === "completado"
    ).length;
    const inProgress = kanbanTasks.filter(
      (t) => t.estado === "en_proceso"
    ).length;
    const pending = kanbanTasks.filter((t) => t.estado === "pendiente").length;
    const issues = kanbanTasks.filter(
      (t) => t.estado === "atrasado" || t.estado === "no_realizada"
    ).length;

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, pending, issues, percentage };
  }, [kanbanTasks]);

  const getColumnId = (estado: TareaEstado): KanbanColumnId => {
    if (estado === "completado") return "realizada";
    if (estado === "en_proceso") return "en_proceso";
    if (estado === "atrasado") return "no_realizada";
    return "asignada";
  };

  // --- HANDLERS DND ---
  const handleDragStart = (event: DragStartEvent) => {
    if (currentUser.role === "admin") return;
    const { active } = event;
    const task = kanbanTasks.find((t) => t.uniqueId === active.id);
    setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const task = kanbanTasks.find((t) => t.uniqueId === active.id);
    const targetColumn = over.id as KanbanColumnId;

    if (task && getColumnId(task.estado) !== targetColumn) {
      let nuevoEstado: TareaEstado = "pendiente";
      if (targetColumn === "realizada") nuevoEstado = "completado";
      else if (targetColumn === "en_proceso") nuevoEstado = "en_proceso";
      else if (targetColumn === "no_realizada") nuevoEstado = "atrasado";

      handleUpdateTaskStatus(
        task.analistaId,
        task.clienteId,
        task.id,
        nuevoEstado
      );
    }
  };

  const handleUpdateTaskStatus = (
    analistaId: string,
    clienteId: string,
    tareaId: string,
    newStatus: TareaEstado
  ) => {
    setAnalistas((prev) =>
      prev.map((a) => {
        if (a.id !== analistaId) return a;
        return {
          ...a,
          clientes: a.clientes.map((c) => {
            if (c.id !== clienteId) return c;

            const updatedTareas = c.tareas.map((t) => {
              if (t.id !== tareaId) return t;
              return { ...t, estado: newStatus };
            });

            const completed = updatedTareas.filter(
              (t) => t.estado === "completado"
            ).length;
            const progress = Math.round(
              (completed / updatedTareas.length) * 100
            );

            const delta =
              (newStatus === "completado" ? 1 : 0) -
              (c.tareas.find((t) => t.id === tareaId)?.estado === "completado"
                ? 1
                : 0);
            a.completadas = Math.max(0, a.completadas + delta);

            return { ...c, tareas: updatedTareas, progreso: progress };
          }),
        };
      })
    );
  };

  const isGlobalLoading = isLoading;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="max-w-[1800px] mx-auto h-[calc(100vh-80px)] flex flex-col animate-in fade-in duration-500 mt-4">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-[var(--primary-color)] flex items-center gap-2">
              <Columns3 size={20} />
              Tablero de Gestión
              <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-2">
                <Calendar size={16} className="text-[var(--secondary-color)]" />
                {periodo}
              </span>
            </h1>
            <p className="text-black/60 text-sm mt-1">
              {currentUser.role === "admin"
                ? "Vista global de supervisión (tareas + carpetas de clientes)."
                : "Arrastra las tarjetas de tareas para actualizar su estado."}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Filtrar cliente/tarea..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--secondary-color)]"
              />
            </div>

            <select
              className="text-xs bg-white border border-gray-200 rounded-lg p-2 shadow-sm cursor-pointer"
              onChange={(e) => {
                const u = availableUsers.find((u) => u.id === e.target.value);
                if (u) setCurrentUser(u);
              }}
              value={currentUser.id}
            >
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
          <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Progreso Global
                </p>
                <h3 className="text-3xl font-bold text-[var(--primary-color)] mt-1">
                  {stats.percentage}%
                </h3>
              </div>
              <div className="p-2 bg-[var(--tertiary-color)] rounded-lg text-[var(--secondary-color)]">
                <BarChart3 size={20} />
              </div>
            </div>
            <div>
              <ProgressBar
                value={stats.percentage}
                colorClass={
                  stats.percentage === 100
                    ? "bg-emerald-500"
                    : "bg-[var(--secondary-color)]"
                }
              />
              <p className="text-[10px] text-gray-400 mt-2 text-right font-medium">
                {stats.completed} de {stats.total} tareas finalizadas
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Atención
              </p>
              <h3 className="text-2xl font-bold text-rose-600 mt-1">
                {stats.issues}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Atrasadas / No realizadas
              </p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
              <AlertCircle size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                En Ejecución
              </p>
              <h3 className="text-2xl font-bold text-blue-600 mt-1">
                {stats.inProgress}
              </h3>
              <p className="text-xs text-gray-400 mt-1">Tareas activas ahora</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Activity size={24} />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Por Iniciar
              </p>
              <h3 className="text-2xl font-bold text-gray-600 mt-1">
                {stats.pending}
              </h3>
              <p className="text-xs text-gray-400 mt-1">En cola de espera</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-100 text-gray-500">
              <ListTodo size={24} />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-lg text-sm mb-4 flex items-center gap-2 shrink-0">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        {isGlobalLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-black/40">
            <div className="w-8 h-8 border-2 border-[var(--secondary-color)] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm">Cargando tablero...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2">
            <div className="flex gap-6 h-full min-w-[1000px]">
              {KANBAN_COLUMNS.map((col) => {
                const tasksInCol = kanbanTasks.filter(
                  (t) => getColumnId(t.estado) === col.id
                );

                // Columna ASIGNADAS → muestra carpetas de ejecutivo
                if (col.id === "asignada") {
                  return (
                    <div
                      key={col.id}
                      className={`
                        flex-1 flex flex-col rounded-2xl border min-w-[300px] max-w-[420px]
                        ${col.border}
                        bg-gradient-to-b from-slate-50 via-slate-50/60 to-slate-100
                      `}
                    >
                      <div className="p-3 border-b border-gray-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-bold text-gray-700 text-sm">
                          <div className={`p-1.5 rounded-lg bg-white/80 ${col.color}`}>
                            {col.icon}
                          </div>
                          <div className="flex flex-col">
                            <span>{col.label}</span>
                            <span className="text-[11px] font-normal text-black/50">
                              {currentYear} · Carpetas por ejecutivo
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="bg-white px-2 py-0.5 rounded-md text-xs font-bold text-gray-500 shadow-sm border border-gray-100">
                            {ejecutivoFolders.length}
                          </span>
                          <span className="text-[10px] text-black/40">
                            Explorador integrado
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 p-3 pt-2 overflow-y-auto space-y-3 min-h-[260px]">
                        {loadingEjecutivos && (
                          <div className="flex flex-col items-center justify-center text-black/40 text-xs py-6">
                            <Loader2 className="h-4 w-4 animate-spin mb-1" />
                            Cargando carpetas de clientes...
                          </div>
                        )}

                        {!loadingEjecutivos &&
                          ejecutivoFolders.length === 0 && (
                            <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-gray-300/60 rounded-2xl text-gray-400 bg-white/70">
                              <FolderIcon size={22} className="mb-2 opacity-20" />
                              <span className="text-xs text-center px-4">
                                No se encontraron carpetas de clientes para tu usuario.
                              </span>
                            </div>
                          )}

                        {ejecutivoFolders.map((folder) => (
                          <EjecutivoFolderCard key={folder.id} folder={folder} />
                        ))}
                      </div>
                    </div>
                  );
                }

                // Otras columnas → tareas normales (DND)
                return (
                  <DroppableColumn
                    key={col.id}
                    col={col}
                    tasks={tasksInCol}
                    disabled={currentUser.role === "admin"}
                  />
                );
              })}
            </div>
          </div>
        )}

        {createPortal(
          <DragOverlay>
            {activeTask ? (
              <div className="w-[300px] cursor-grabbing">
                <DraggableTaskCard task={activeTask} isOverlay />
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
      </div>
    </DndContext>
  );
}
