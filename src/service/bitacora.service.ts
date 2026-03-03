// src/service/bitacora.service.ts
import { http } from "./http";
import type {
  ApiResponse,
  Bitacora,
  UpsertBitacoraPayload,
  UpdateBitacoraPayload,
} from "../types/bitacora";

function unwrap<T>(res: { data: ApiResponse<T> }): T {
  const payload = res?.data;

  if (!payload?.ok) {
    throw new Error(payload?.error?.message || "Error");
  }

  // si ok=true pero no viene data, igual lo tratamos como error (evita undefined silencioso)
  if (payload.data === undefined) {
    throw new Error("Respuesta inválida del servidor (sin data).");
  }

  return payload.data;
}

/**
 * POST /bitacoras
 * Crea o actualiza la bitácora del día (upsert por trabajadorId+fecha)
 *
 * Reglas (backend):
 * - AGENTE: solo HOY y solo su bitácora
 * - ADMIN/SUPERVISOR: puede crear/append su propia bitácora en cualquier fecha
 */
export async function upsertBitacora(data: UpsertBitacoraPayload): Promise<Bitacora> {
  const res = await http.post<ApiResponse<Bitacora>>("/bitacoras", data);
  return unwrap(res);
}

/**
 * GET /bitacoras/mias?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
export async function getMisBitacoras(params?: {
  desde?: string;
  hasta?: string;
}): Promise<Bitacora[]> {
  const res = await http.get<ApiResponse<Bitacora[]>>("/bitacoras/mias", { params });
  return unwrap(res);
}

/**
 * GET /bitacoras?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&trabajadorId=123
 * (ADMIN/SUPERVISOR)
 */
export async function getBitacorasEquipo(params?: {
  desde?: string;
  hasta?: string;
  trabajadorId?: number;
}): Promise<Bitacora[]> {
  const res = await http.get<ApiResponse<Bitacora[]>>("/bitacoras", {
    params: {
      ...params,
      trabajadorId: typeof params?.trabajadorId === "number" ? params.trabajadorId : undefined,
    },
  });
  return unwrap(res);
}

/**
 * GET /bitacoras/:id
 * (dueño o ADMIN/SUPERVISOR)
 */
export async function getBitacoraById(id: number): Promise<Bitacora> {
  const res = await http.get<ApiResponse<Bitacora>>(`/bitacoras/${id}`);
  return unwrap(res);
}

/**
 * PUT /bitacoras/:id
 * (dueño o ADMIN/SUPERVISOR)
 */
export async function updateBitacoraById(
  id: number,
  data: UpdateBitacoraPayload
): Promise<Bitacora> {
  const res = await http.put<ApiResponse<Bitacora>>(`/bitacoras/${id}`, data);
  return unwrap(res);
}

/**
 * Helper: ADMIN/SUPERVISOR editando una bitácora completa (replace).
 */
export async function replaceBitacoraById(
  id: number,
  data: { titulo?: string | null; contenido: string }
): Promise<Bitacora> {
  return updateBitacoraById(id, { ...data, mode: "replace" });
}

/**
 * DELETE /bitacoras/:id
 * ✅ SOLO ADMIN/SUPERVISOR (según backend actualizado)
 */
export async function deleteBitacoraById(id: number): Promise<{ deleted: true }> {
  const res = await http.delete<ApiResponse<{ deleted: true } | { deleted: boolean }>>(
    `/bitacoras/${id}`
  );

  const out = unwrap(res) as any;

  // normaliza por si viene boolean
  if (out?.deleted !== true) {
    throw new Error("No se pudo eliminar.");
  }

  return { deleted: true };
}