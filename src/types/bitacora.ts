// src/types/bitacora.ts

export type Role = "ADMIN" | "SUPERVISOR" | "AGENTE";

/**
 * Roles que podrían venir desde localStorage/backend con otras formas.
 * Esto permite normalizar sin romper TypeScript.
 */
export type RoleLike =
  | Role
  | "ADMINISTRADOR"
  | "ADMINISTRADOR/A"
  | "SUPERVISOR"
  | "SUPERVISOR/A"
  | "USER"
  | "TRABAJADOR"
  | "EMPLEADO"
  | string
  | number
  | undefined
  | null;

/** Modo de escritura de bitácora */
export type BitacoraWriteMode = "append" | "replace";

/** Mini de trabajador (para listados globales / equipo) */
export type TrabajadorMini = {
  id_trabajador: number;
  nombre: string;
  email: string;
  areaInterna: string | null;
  isSupervisor: boolean;
};

/** Bitácora (modelo principal) */
export type Bitacora = {
  id: number;
  trabajadorId: number;

  /** “día” de la bitácora (normalizado a 00:00 en backend), llega como ISO string */
  fecha: string;

  titulo: string | null;

  /**
   * Contenido:
   * - Puede venir como texto plano o como HTML (si estás usando TipTap)
   */
  contenido: string;

  /** Timestamps */
  createdAt: string;
  updatedAt: string;

  /** Solo viene en listados globales o getById con include */
  trabajador?: TrabajadorMini;
};

/** Query params para filtros */
export type BitacoraRangeQuery = {
  desde?: string; // YYYY-MM-DD
  hasta?: string; // YYYY-MM-DD
  trabajadorId?: number;
};

/**
 * Payload para crear/actualizar por día (POST /bitacoras)
 *
 * - append: agrega contenido al final (nueva entrada del mismo día)
 * - replace: reemplaza completo (edición/corrección del mismo día)
 */
export type UpsertBitacoraPayload = {
  fecha?: string; // YYYY-MM-DD
  titulo?: string | null;
  contenido: string; // texto o html
  mode?: BitacoraWriteMode; // ✅ NUEVO
};

/**
 * Payload para update por id (PUT /bitacoras/:id)
 */
export type UpdateBitacoraPayload = {
  titulo?: string | null;
  contenido?: string;

  /**
   * Opcional:
   * - append: agrega al contenido existente
   * - replace: reemplaza el contenido completo
   */
  mode?: BitacoraWriteMode;
};

/** Respuesta estándar del backend */
export type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
};

/**
 * User guardado en localStorage (shape flexible).
 * Importante: a veces el rol viene como roleId o como string distinto.
 */
export type AuthUserLite = {
  id?: number;
  nombre?: string;
  email?: string;

  // formas posibles:
  role?: Role; // esperado
  rol?: RoleLike;
  roleId?: number;
  role_id?: number;
  roleName?: RoleLike;
  role_name?: RoleLike;

  isAdmin?: boolean;
  isSupervisor?: boolean;
  isSupervisorOrAdmin?: boolean;
};