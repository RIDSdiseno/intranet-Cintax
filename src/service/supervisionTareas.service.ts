import { http } from "./http";

export type EstadoTarea =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "COMPLETADA"
  | "VENCIDA"
  | "NO_APLICA";

export type SupervisionCompletarPayload = {
  tareaIds?: number[];
  trabajadorId?: number;
  rutCliente?: string;
  rutClientes?: string[];
  tareaPlantillaId?: number;
  anio?: number;
  mes?: number;
  incluirPendientes?: boolean;
  incluirEnProceso?: boolean;
  incluirVencidas?: boolean;
  comentario?: string;
  fechaComplecion?: string;
};

export type SupervisionDesactivarPayload = {
  tareaIds?: number[];
  trabajadorId?: number;
  rutCliente?: string;
  rutClientes?: string[];
  tareaPlantillaId?: number;
  anio?: number;
  mes?: number;
  incluirPendientes?: boolean;
  incluirEnProceso?: boolean;
  incluirVencidas?: boolean;
  comentario?: string;
};

export type SupervisionReactivarPayload = {
  tareaIds?: number[];
  trabajadorId?: number;
  rutCliente?: string;
  rutClientes?: string[];
  tareaPlantillaId?: number;
  anio?: number;
  mes?: number;
  comentario?: string;
};

export type Trabajador = {
  id_trabajador: number;
  nombre: string;
  email: string;
  isSupervisor?: boolean;
};

export type RutItem = {
  rut: string;
  razonSocial?: string | null;
};

export type TareaPlantillaOption = {
  id_tarea_plantilla: number;
  nombre: string;
  codigoDocumento?: string | null;
  area?: string | null;
};

export type TareaAsignada = {
  id_tarea_asignada: number;
  trabajadorId?: number | null;
  rutCliente?: string | null;
  estado: EstadoTarea;
  fechaProgramada: string;
  fechaComplecion?: string | null;
  comentarios?: string | null;
  asignado?: {
    id_trabajador: number;
    nombre: string;
    email: string;
  } | null;
  tareaPlantilla?: {
    id_tarea_plantilla: number;
    nombre: string;
    codigoDocumento?: string | null;
    area?: string | null;
  } | null;
};

export type GetTareasPorRutsPayload = {
  trabajadorId: number;
  ruts: string[];
  anio?: number;
  mes?: number;
};

export type GetTareasPorRutsResponse = {
  tareas: TareaAsignada[];
};

export type GetTareasPorPlantillaPayload = {
  tareaPlantillaId: number;
  trabajadorId?: number;
  rutCliente?: string;
  anio?: number;
  mes?: number;
};

export type GetTareasPorPlantillaResponse = {
  message?: string;
  filtrosAplicados?: {
    tareaPlantillaId?: number;
    trabajadorId?: number | null;
    rutCliente?: string | null;
    anio?: number | null;
    mes?: number | null;
  };
  count?: number;
  tareas: TareaAsignada[];
};

export type SupervisionAccionResponse = {
  message?: string;
  count?: number;
  tareas?: number[];
};

export type GetTareasDesactivadasPayload = {
  trabajadorId: number;
  ruts?: string[];
  anio?: number;
  mes?: number;
};

export type GetTareasDesactivadasResponse = {
  tareas: TareaAsignada[];
  count?: number;
};

export async function completarTareasSupervision(
  payload: SupervisionCompletarPayload
) {
  const res = await http.post("/tareas/supervision/completar", payload);
  return res.data;
}

export async function desactivarTareasSupervision(
  payload: SupervisionDesactivarPayload
): Promise<SupervisionAccionResponse> {
  const res = await http.patch("/tareas/supervision/desactivar", payload);
  return {
    message: res.data?.message,
    count: typeof res.data?.count === "number" ? res.data.count : 0,
    tareas: Array.isArray(res.data?.tareas) ? res.data.tareas : [],
  };
}

export async function reactivarTareasSupervision(
  payload: SupervisionReactivarPayload
): Promise<SupervisionAccionResponse> {
  const res = await http.patch("/tareas/supervision/reactivar", payload);
  return {
    message: res.data?.message,
    count: typeof res.data?.count === "number" ? res.data.count : 0,
    tareas: Array.isArray(res.data?.tareas) ? res.data.tareas : [],
  };
}

export async function getTrabajadores(): Promise<
  Trabajador[] | { data?: Trabajador[]; trabajadores?: Trabajador[] }
> {
  const res = await http.get("/trabajadores");
  return res.data;
}

export async function getMisRutsSupervision(
  trabajadorId: number
): Promise<RutItem[]> {
  const res = await http.get(`/tareas/mis-ruts?trabajadorId=${trabajadorId}`);
  return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
}

export async function getTareasPorRutsSupervision(
  payload: GetTareasPorRutsPayload
): Promise<GetTareasPorRutsResponse> {
  const res = await http.post("/tareas/por-ruts", payload);
  return {
    tareas: Array.isArray(res.data) ? res.data : res.data?.tareas ?? [],
  };
}

export async function getTareasPlantilla(): Promise<TareaPlantillaOption[]> {
  const res = await http.get("/tareas/plantillas");
  return Array.isArray(res.data) ? res.data : res.data?.data ?? [];
}

export async function getTareasPorPlantillaSupervision(
  payload: GetTareasPorPlantillaPayload
): Promise<GetTareasPorPlantillaResponse> {
  const params = new URLSearchParams();

  if (payload.trabajadorId !== undefined) {
    params.set("trabajadorId", String(payload.trabajadorId));
  }

  if (payload.rutCliente) {
    params.set("rutCliente", payload.rutCliente);
  }

  if (payload.anio !== undefined) {
    params.set("anio", String(payload.anio));
  }

  if (payload.mes !== undefined) {
    params.set("mes", String(payload.mes));
  }

  const query = params.toString();

  const url = `/tareas/supervision/por-plantilla/${payload.tareaPlantillaId}${
    query ? `?${query}` : ""
  }`;

  const res = await http.get(url);

  return {
    message: res.data?.message,
    filtrosAplicados: res.data?.filtrosAplicados,
    count: res.data?.count,
    tareas: Array.isArray(res.data) ? res.data : res.data?.tareas ?? [],
  };
}

export async function getTareasDesactivadasSupervision(
  payload: GetTareasDesactivadasPayload
): Promise<GetTareasDesactivadasResponse> {
  const res = await http.post("/tareas/desactivadas", payload);
  return {
    tareas: Array.isArray(res.data) ? res.data : res.data?.tareas ?? [],
    count: typeof res.data?.count === "number" ? res.data.count : undefined,
  };
}