// src/components/supervision/api.ts
// Helpers de datos para el módulo de supervisión de tareas.

const envBase =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

// Normaliza para evitar "//" (por ejemplo si el env viene con / al final)
export const API_BASE_URL = String(envBase).replace(/\/+$/, "");

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
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * fetchJSON: wrapper con:
 * - headers auth (Bearer)
 * - manejo de errores con texto (si viene HTML o texto plano)
 * - parse seguro de JSON
 */
export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  const authHeaders = getAuthHeaders() as Record<string, string>;

  if (!headers.has("Authorization") && authHeaders.Authorization) {
    headers.set("Authorization", authHeaders.Authorization);
  }

  const isFormDataBody =
    typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (!isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Error ${res.status} al llamar ${url}: ${text}`);
  }

  // Algunos backends responden 204 sin body
  if (res.status === 204) return undefined as unknown as T;

  const raw = await res.text().catch(() => "");
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Si no era JSON, igual devolvemos error explícito
    throw new Error(`Respuesta no-JSON desde ${url}: ${raw.slice(0, 200)}`);
  }
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

const safeDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * isPorVencer:
 * - considera solo tareas NO completadas
 * - compara con "hoy" a las 00:00 para evitar falsos negativos por hora
 */
export const isPorVencer = (tarea: TareaFull, dias = 3) => {
  if (tarea.estado === "COMPLETADA") return false;

  const fv = safeDate(tarea.fechaProgramada);
  if (!fv) return false;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const limite = new Date(hoy);
  limite.setDate(hoy.getDate() + dias);

  return fv >= hoy && fv <= limite;
};
