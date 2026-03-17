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

  // si ok=true pero no viene data, igual lo tratamos como error
  if (payload.data === undefined) {
    throw new Error("Respuesta inválida del servidor (sin data).");
  }

  return payload.data;
}

/* =========================================================
 * BITÁCORA GENERAL
 * ========================================================= */

/**
 * POST /bitacoras
 * Crea o actualiza la bitácora del día (upsert por trabajadorId+fecha)
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
 */
export async function deleteBitacoraById(id: number): Promise<{ deleted: true }> {
  const res = await http.delete<ApiResponse<{ deleted: true } | { deleted: boolean }>>(
    `/bitacoras/${id}`
  );

  const out = unwrap(res) as any;

  if (out?.deleted !== true) {
    throw new Error("No se pudo eliminar.");
  }

  return { deleted: true };
}

/* =========================================================
 * BITÁCORA POR CLIENTE
 * ========================================================= */

export type ClienteBitacoraTrabajador = {
  id_trabajador: number;
  nombre: string;
  email: string;
  areaInterna?: string | null;
  isSupervisor?: boolean;
};

export type ClienteBitacoraCliente = {
  id: number;
  rut: string;
  razonSocial: string;
  alias?: string | null;
  activo?: boolean;
  agenteId?: number | null;
  codigoCartera?: string | null;
};

export type ClienteBitacora = {
  id: number;
  clienteId: number;
  trabajadorId: number;
  fechaGestion: string;
  titulo?: string | null;
  contenido: string;
  createdAt?: string;
  updatedAt?: string;
  cliente?: ClienteBitacoraCliente;
  trabajador?: ClienteBitacoraTrabajador;
};

export type CreateClienteBitacoraPayload = {
  titulo?: string | null;
  contenido: string;
  fechaGestion?: string;
};

export type UpdateClienteBitacoraPayload = {
  titulo?: string | null;
  contenido?: string;
  fechaGestion?: string;
};

/**
 * POST /bitacoras/clientes/:id/bitacoras
 */
export async function createClienteBitacora(
  clienteId: number,
  data: CreateClienteBitacoraPayload
): Promise<ClienteBitacora> {
  const res = await http.post<ApiResponse<ClienteBitacora>>(
    `/bitacoras/clientes/${clienteId}/bitacoras`,
    data
  );
  return unwrap(res);
}

/**
 * GET /bitacoras/clientes/:id/bitacoras?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
export async function getClienteBitacoras(
  clienteId: number,
  params?: {
    desde?: string;
    hasta?: string;
  }
): Promise<ClienteBitacora[]> {
  const res = await http.get<ApiResponse<ClienteBitacora[]>>(
    `/bitacoras/clientes/${clienteId}/bitacoras`,
    { params }
  );
  return unwrap(res);
}

/**
 * GET /bitacoras/clientes/bitacoras/:bitacoraId
 */
export async function getClienteBitacoraById(bitacoraId: number): Promise<ClienteBitacora> {
  const res = await http.get<ApiResponse<ClienteBitacora>>(
    `/bitacoras/clientes/bitacoras/${bitacoraId}`
  );
  return unwrap(res);
}

/**
 * PUT /bitacoras/clientes/bitacoras/:bitacoraId
 */
export async function updateClienteBitacoraById(
  bitacoraId: number,
  data: UpdateClienteBitacoraPayload
): Promise<ClienteBitacora> {
  const res = await http.put<ApiResponse<ClienteBitacora>>(
    `/bitacoras/clientes/bitacoras/${bitacoraId}`,
    data
  );
  return unwrap(res);
}

/**
 * DELETE /bitacoras/clientes/bitacoras/:bitacoraId
 */
export async function deleteClienteBitacoraById(
  bitacoraId: number
): Promise<{ deleted: true }> {
  const res = await http.delete<ApiResponse<{ deleted: true } | { deleted: boolean }>>(
    `/bitacoras/clientes/bitacoras/${bitacoraId}`
  );

  const out = unwrap(res) as any;

  if (out?.deleted !== true) {
    throw new Error("No se pudo eliminar.");
  }

  return { deleted: true };
}

export async function getClienteBitacorasEquipo(params?: {
  desde?: string;
  hasta?: string;
  trabajadorId?: number;
  clienteId?: number;
}): Promise<ClienteBitacora[]> {
  const res = await http.get<ApiResponse<ClienteBitacora[]>>(
    "/bitacoras/clientes/equipo",
    {
      params: {
        ...params,
        trabajadorId:
          typeof params?.trabajadorId === "number" ? params.trabajadorId : undefined,
        clienteId:
          typeof params?.clienteId === "number" ? params.clienteId : undefined,
      },
    }
  );

  return unwrap(res);
}