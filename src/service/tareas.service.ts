// src/service/tareas.service.ts
import { http } from "./http";

export type PlantillaLite = {
  id_tarea_plantilla: number;
  area: string;
  nombre: string;
  requiereDrive?: boolean;
};

export type RutLite = { rut: string; razonSocial: string | null };

export type TrabajadorLite = { id_trabajador: number; nombre: string; email: string };

// =====================
// Helpers (normalización)
// =====================

function normalizeFechaProgramada(input: unknown): string {
  const s = String(input ?? "").trim();
  if (!s) return "";

  // YYYY-MM-DD -> ISO UTC (evita desfases por zona horaria)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return d.toISOString();
  }

  const d = new Date(s);
  if (Number.isFinite(d.getTime())) return d.toISOString();

  // inválido => backend responderá 400
  return s;
}

function cleanRutClientes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function cleanPlantillaIds(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const nums = v
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  return Array.from(new Set(nums));
}

function normEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function toBool(v: unknown): boolean | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "si", "sí", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return undefined;
}

// =====================
// Plantillas
// =====================

export async function listPlantillas(soloActivas = true, area?: string) {
  const params = new URLSearchParams();
  if (soloActivas) params.set("soloActivas", "true");
  if (area) params.set("area", area);

  const qs = params.toString();
  const { data } = await http.get<PlantillaLite[]>(`/tareas/plantillas${qs ? `?${qs}` : ""}`);
  return data;
}

// =====================
// RUTs del trabajador
// =====================

export async function getMisRuts(trabajadorId?: number) {
  const params = new URLSearchParams();
  if (trabajadorId) params.set("trabajadorId", String(trabajadorId));

  const qs = params.toString();
  const { data } = await http.get<RutLite[]>(`/tareas/mis-ruts${qs ? `?${qs}` : ""}`);
  return data;
}

// =====================
// Trabajadores
// =====================

export async function listTrabajadoresLite() {
  const { data } = await http.get<TrabajadorLite[]>(`/trabajadores/lite`);
  return data;
}

// =====================
// Masivo manual desde plantillas
// =====================

export type CrearMasivoPayload = {
  rutClientes: string[];
  plantillaIds: number[];
  trabajadorId: number;
  fechaProgramada: string; // ISO o YYYY-MM-DD
  skipDuplicates?: boolean;
};

export type CrearMasivoOptions = {
  safe?: boolean;
  endpointOverride?: string;
  debugOnError?: boolean;
};

export async function crearDesdePlantillaMasivo(
  payload: CrearMasivoPayload,
  opts: CrearMasivoOptions = {}
) {
  const safe = opts.safe !== false; // default true

  const endpoint =
    opts.endpointOverride ??
    (safe ? `/tareas/masivo/crear-desde-plantilla-safe` : `/tareas/masivo/crear-desde-plantilla`);

  const safePayload: CrearMasivoPayload = {
    rutClientes: cleanRutClientes(payload.rutClientes),
    plantillaIds: cleanPlantillaIds(payload.plantillaIds),
    trabajadorId: Number(payload.trabajadorId),
    fechaProgramada: normalizeFechaProgramada(payload.fechaProgramada),
    skipDuplicates: payload.skipDuplicates,
  };

  try {
    const { data } = await http.post(endpoint, safePayload);
    return data;
  } catch (err: any) {
    if (opts.debugOnError) {
      console.log("[crearDesdePlantillaMasivo] endpoint:", endpoint);
      console.log("[crearDesdePlantillaMasivo] payload:", safePayload);
      console.log("[crearDesdePlantillaMasivo] error response:", err?.response?.data);
    }
    throw err;
  }
}

export const crearDesdePlantillasMasivo = crearDesdePlantillaMasivo;

// =====================
// Masivo desde Excel (nuevo controller)
// Backend: POST /tareas/masivo/excel
// form-data: archivo=<xlsx>
//
// Query soportada:
// - skipDuplicates (default true)
// - fechaProgramada (YYYY-MM-DD) fallback si la fila no trae fecha
// - agenteId (compat)
// - agenteEmail (recomendado)
// - forceUpdateClienteAgente (default false)
//
// ✅ IMPORTANTE:
// - “volátil 31 días” NO va por query: va por columna en el Excel (volatil/volatile/...)
// =====================

export type ExcelMasivoQuery = {
  skipDuplicates?: boolean;
  fechaProgramada?: string; // YYYY-MM-DD (fallback global)
  agenteId?: number; // compat
  agenteEmail?: string; // recomendado
  forceUpdateClienteAgente?: boolean;
};

function buildQuery(params?: ExcelMasivoQuery): string {
  if (!params) return "";
  const qs = new URLSearchParams();

  if (params.skipDuplicates !== undefined) qs.set("skipDuplicates", String(params.skipDuplicates));
  if (params.fechaProgramada) qs.set("fechaProgramada", params.fechaProgramada);

  if (params.agenteId != null) qs.set("agenteId", String(params.agenteId));

  const email = normEmail(params.agenteEmail);
  if (email) qs.set("agenteEmail", email);

  if (params.forceUpdateClienteAgente !== undefined)
    qs.set("forceUpdateClienteAgente", String(params.forceUpdateClienteAgente));

  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * Carga masiva de tareas desde Excel (crea clientes/plantillas si no existen).
 * Key del archivo: "archivo" (uploadExcel.single("archivo")).
 */
export async function cargarTareasDesdeExcel(file: File, query?: ExcelMasivoQuery) {
  const form = new FormData();
  form.append("archivo", file);

  const { data } = await http.post(`/tareas/masivo/excel${buildQuery(query)}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data;
}

// =====================
// Reasignación de tareas (si existe en tu backend)
// =====================

export type ReasignarTareasPayload = Record<string, any>;

export async function reasignarTareas(payload: ReasignarTareasPayload) {
  const { data } = await http.patch(`/tareas/reasignar`, payload);
  return data;
}

// =====================
// Reasignar cliente + mover tareas
// =====================

export type ReasignarClientePayload = {
  rutCliente: string; // "78.163.795-5"
  agenteId: number | null;
  moveAllTasks?: boolean;
  includeVencida?: boolean;
};

export async function reasignarCliente(payload: ReasignarClientePayload) {
  const { data } = await http.post(`/tareas/masivo/reasignar-cliente`, payload);
  return data;
}

// =====================
// Compat: preview/commit (NO hay preview real en backend)
// Mantener para no romper imports.
// =====================

export type ExcelExtraCompat = Record<string, string>;

function extraToQuery(extra?: ExcelExtraCompat): ExcelMasivoQuery {
  return {
    skipDuplicates: extra?.skipDuplicates != null ? toBool(extra.skipDuplicates) : undefined,
    fechaProgramada: extra?.fechaProgramada,
    agenteId: extra?.agenteId ? Number(extra.agenteId) : undefined,
    agenteEmail: extra?.agenteEmail,
    forceUpdateClienteAgente:
      extra?.forceUpdateClienteAgente != null ? toBool(extra.forceUpdateClienteAgente) : undefined,
  };
}

export async function previewExcel(file: File, extra?: ExcelExtraCompat) {
  return cargarTareasDesdeExcel(file, extraToQuery(extra));
}

export async function commitExcel(file: File, extra?: ExcelExtraCompat) {
  return cargarTareasDesdeExcel(file, extraToQuery(extra));
}