import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragOverlay,
  useSensor,
  useSensors,
  MouseSensor,
  TouchSensor,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { createPortal } from "react-dom";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  Calendar,
  User,
  PlayCircle,
  XCircle,
  GripVertical,
  Briefcase,
  Activity,
  ListTodo,
  BarChart3,
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
type KanbanColumnId = "asignada" | "en_proceso" | "realizada" | "no_realizada";

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
    label: "Asignadas",
    color: "text-gray-600",
    icon: <Clock size={18} />,
    bg: "bg-gray-50/50",
    border: "border-gray-200",
  },
  {
    id: "en_proceso",
    label: "En Proceso",
    color: "text-blue-600",
    icon: <PlayCircle size={18} />,
    bg: "bg-blue-50/30",
    border: "border-blue-100",
  },
  {
    id: "realizada",
    label: "Realizadas",
    color: "text-emerald-600",
    icon: <CheckCircle2 size={18} />,
    bg: "bg-emerald-50/30",
    border: "border-emerald-100",
  },
  {
    id: "no_realizada",
    label: "No Realizadas",
    color: "text-rose-600",
    icon: <XCircle size={18} />,
    bg: "bg-rose-50/30",
    border: "border-rose-100",
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

// ✅ FETCH API
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

// 1. TARJETA ARRASTRABLE (Draggable) - ESTILOS DINÁMICOS
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

  // Lógica de Estado y Fechas
  const dateObj = new Date(task.vencimiento);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalizar hoy a media noche para comparación justa

  // Si la fecha de la tarea es menor a hoy (ayer o antes)
  const isDatePast = dateObj < today;

  const isCompleted =
    task.estado === "completado" || task.estado === "realizada";
  const isInProgress = task.estado === "en_proceso";
  const isLate =
    (isDatePast && !isCompleted) ||
    task.estado === "atrasado" ||
    task.estado === "no_realizada";

  // Clases dinámicas según estado
  let cardClasses = "bg-white border-gray-200 hover:border-gray-300";
  let titleClasses = "text-gray-800";
  let dateClasses = "text-gray-500";
  let badgeClasses = "bg-gray-100 text-black/50";

  if (isCompleted) {
    cardClasses = "bg-emerald-50/50 border-emerald-200 shadow-sm";
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

// 2. COLUMNA (Droppable)
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
      {/* Header Columna */}
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

      {/* Contenedor de Tarjetas */}
      <div className="flex-1 p-2 overflow-y-auto space-y-2.5 custom-scrollbar min-h-[200px]">
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

export default function TareasPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(ADMIN_USER);
  const [periodo, setPeriodo] = useState(getCurrentPeriod());
  const [analistas, setAnalistas] = useState<Analista[]>(INITIAL_DATA);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 5 },
    })
  );

  const [activeTask, setActiveTask] = useState<any>(null);

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
          "No se pudo conectar al servidor. Mostrando datos locales si existen."
        );
      } finally {
        setIsLoading(false);
      }
    };
    cargarTareas();
  }, [currentUser.role]);

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
              Tablero de Gestión{" "}
              <span className="text-sm font-medium text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-sm flex items-center gap-2">
                <Calendar size={16} className="text-[var(--secondary-color)]" />
                {periodo}
              </span>
            </h1>
            <p className="text-black/60 text-sm mt-1">
              {currentUser.role === "admin"
                ? "Vista global de supervisión."
                : "Arrastra las tarjetas para actualizar el estado."}
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

        {/* --- SECCIÓN DE KPIs DE PROGRESO --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 shrink-0">
          {/* KPI 1: Progreso General */}
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

          {/* KPI 2: En Ejecución */}
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

          {/* KPI 3: Por Iniciar */}
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

          {/* KPI 4: Atención */}
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
        </div>

        {errorMsg && (
          <div className="bg-rose-50 text-rose-700 px-4 py-2 rounded-lg text-sm mb-4 flex items-center gap-2 shrink-0">
            <AlertCircle size={16} /> {errorMsg}
          </div>
        )}

        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-black/40">
            <div className="w-8 h-8 border-2 border-[var(--secondary-color)] border-t-transparent rounded-full animate-spin mb-2" />
            <p className="text-sm">Cargando tablero...</p>
          </div>
        ) : (
          /* TABLERO KANBAN */
          <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2">
            <div className="flex gap-6 h-full min-w-[1000px]">
              {KANBAN_COLUMNS.map((col) => {
                const tasksInCol = kanbanTasks.filter(
                  (t) => getColumnId(t.estado) === col.id
                );
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
