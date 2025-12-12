// src/components/supervision/api.ts
// Helpers de datos para el módulo de supervisión de tareas.

export const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

export type EstadoBack = "PENDIENTE" | "EN_PROCESO" | "VENCIDA" | "COMPLETADA";

export type TareaFull = {
  id_tarea_asignada: number;
  rutCliente?: string | null;
  estado: EstadoBack;
  fechaProgramada: string;
  fechaComplecion?: string | null;
  createdAt: string;
  comentarios?: string | null;
  tareaPlantilla?: {
    id_tarea_plantilla: number;
    nombre: string;
    area: "CONTA" | "ADMIN" | "RRHH" | "TRIBUTARIO";
    codigoDocumento?: string | null;
  } | null;
  asignado?: {
    id_trabajador: number;
    nombre: string;
    email: string;
  } | null;
};

export type ResumenAgente = {
  trabajadorId: number;
  nombre: string;
  email: string;
  pendientes: number;
  enProceso: number;
  vencidas: number;
  completadas: number;
};

const getAuthToken = () =>
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token") ||
  localStorage.getItem("auth_token") ||
  sessionStorage.getItem("auth_token");

const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};
};

export async function fetchJSON<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error ${res.status} al llamar ${url}: ${text}`);
  }

  return (await res.json()) as T;
}

export const mapEstadoLabel = (estado: EstadoBack) => {
  switch (estado) {
    case "PENDIENTE":
      return "Pendiente";
    case "EN_PROCESO":
      return "En proceso";
    case "VENCIDA":
      return "Vencida";
    case "COMPLETADA":
      return "Completada";
    default:
      return estado;
  }
};

export const isPorVencer = (tarea: TareaFull, dias = 3) => {
  if (tarea.estado === "COMPLETADA") return false;
  const fv = new Date(tarea.fechaProgramada);
  const hoy = new Date();
  const limite = new Date();
  limite.setDate(hoy.getDate() + dias);
  return fv >= hoy && fv <= limite;
};
