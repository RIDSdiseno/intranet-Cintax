import axios from "axios";

export type TrabajadorLite = {
  id_trabajador: number;
  nombre: string;
  email: string;
  status: boolean;
  carpetaDriveCodigo?: string | null;
};

export type ClienteRow = {
  id: number;
  rut: string;
  razonSocial: string;
  alias: string | null;
  codigoCartera: string | null;
  agenteId: number | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

/**
 * Alias útil para pantallas como ClienteBitacoraPage
 */
export type ClienteOption = ClienteRow;

export type ListClientesResponse = {
  items: ClienteRow[];
  total: number;
  take: number;
  skip: number;
};

function authHeaders() {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");

  return token ? { Authorization: `Bearer ${token}` } : {};
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, // ✅ usa tu env
});

/**
 * GET /api/clientes
 */
export async function listClientes(params: {
  search?: string;
  cartera?: string;
  agenteId?: number | null;
  soloActivos?: boolean;
  limit?: number;
  skip?: number;
}) {
  return api.get<ListClientesResponse>("/clientes", {
    params: {
      ...(params.search?.trim() ? { search: params.search.trim() } : {}),
      ...(params.cartera?.trim() ? { cartera: params.cartera.trim() } : {}),
      ...(typeof params.agenteId === "number" ? { agenteId: params.agenteId } : {}),
      ...(params.soloActivos ? { soloActivos: "true" } : {}),
      ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      ...(typeof params.skip === "number" ? { skip: params.skip } : {}),
    },
    headers: authHeaders(),
  });
}

/**
 * Helper simple que devuelve directamente Cliente[]
 * Ideal para selects, búsquedas rápidas y ClienteBitacoraPage
 */
export async function getClientes(params?: {
  search?: string;
  cartera?: string;
  agenteId?: number | null;
  soloActivos?: boolean;
  limit?: number;
  skip?: number;
}): Promise<ClienteOption[]> {
  const res = await listClientes({
    search: params?.search,
    cartera: params?.cartera,
    agenteId: params?.agenteId,
    soloActivos: params?.soloActivos,
    limit: params?.limit,
    skip: params?.skip,
  });

  return Array.isArray(res.data?.items) ? res.data.items : [];
}

/**
 * GET /api/clientes/:id
 * Por si después lo necesitas en detalle
 */
export async function getClienteById(id: number) {
  return api.get<ClienteRow>(`/clientes/${id}`, {
    headers: authHeaders(),
  });
}

/**
 * POST /api/clientes
 */
export async function createCliente(data: {
  rut: string;
  razonSocial: string;
  alias?: string | null;
  codigoCartera?: string | null;
  agenteId?: number | null;
  activo?: boolean;
}) {
  return api.post<ClienteRow>("/clientes", data, { headers: authHeaders() });
}

/**
 * PATCH /api/clientes/:id
 */
export async function updateCliente(
  id: number,
  data: {
    rut?: string;
    razonSocial?: string;
    alias?: string | null;
    codigoCartera?: string | null;
    agenteId?: number | null;
    activo?: boolean;
  }
) {
  return api.patch<ClienteRow>(`/clientes/${id}`, data, { headers: authHeaders() });
}

/**
 * PATCH /api/clientes/:id/asignar-agente
 */
export async function assignAgenteToCliente(id: number, agenteId: number | null) {
  return api.patch<ClienteRow>(
    `/clientes/${id}/asignar-agente`,
    { agenteId },
    { headers: authHeaders() }
  );
}

/**
 * DELETE /api/clientes/:id
 */
export async function deleteCliente(id: number) {
  return api.delete(`/clientes/${id}`, { headers: authHeaders() });
}

/**
 * ====== MASIVO EXCEL ======
 * POST /api/clientes/masivo-excel
 * form-data: archivo (.xlsx)
 *
 * Query:
 *  - dryRun=true
 *  - updateExisting=true
 *  - defaultActivo=false
 */

export type BulkExcelSummary = {
  sheet: string;
  totalRows: number;
  validRows: number;
  invalidCount: number;
  duplicatesInFileCount: number;
  existingCount: number;
  toCreateCount: number;
  toUpdateCount: number;
  dryRun: boolean;
  updateExisting: boolean;
  createdCount?: number;
  updatedCount?: number;
};

export type BulkExcelResponse = {
  ok: boolean;
  mode: "DRY_RUN" | "COMMIT";
  summary: BulkExcelSummary;
  invalid?: Array<{ row: number; rutRaw: any; razonRaw: any; error: string }>;
  duplicatesInFile?: Array<{ row: number; rut: string }>;
  previewCreate?: Array<{
    rut: string;
    razonSocial: string;
    alias: string | null;
    activo: boolean;
  }>;
  previewUpdate?: Array<{ rut: string }>;
};

export async function uploadClientesMasivoExcel(args: {
  file: File;
  dryRun?: boolean;
  updateExisting?: boolean;
  defaultActivo?: boolean;
}) {
  const form = new FormData();
  form.append("archivo", args.file);

  return api.post<BulkExcelResponse>("/clientes/masivo-excel", form, {
    params: {
      ...(typeof args.dryRun === "boolean" ? { dryRun: String(args.dryRun) } : {}),
      ...(typeof args.updateExisting === "boolean"
        ? { updateExisting: String(args.updateExisting) }
        : {}),
      ...(typeof args.defaultActivo === "boolean"
        ? { defaultActivo: String(args.defaultActivo) }
        : {}),
    },
    headers: {
      ...authHeaders(),
      "Content-Type": "multipart/form-data",
    },
  });
}

/**
 * GET /api/trabajadores?soloActivos=true
 */
export async function listTrabajadoresLite(params?: { soloActivos?: boolean }) {
  return api.get<{ items: TrabajadorLite[] }>("/trabajadores", {
    params: {
      ...(params?.soloActivos ? { soloActivos: "true" } : {}),
    },
    headers: authHeaders(),
  });
}