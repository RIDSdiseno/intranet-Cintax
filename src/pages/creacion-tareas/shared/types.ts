// src/pages/creacion-tareas/shared/types.ts
export type LoadState = "idle" | "loading" | "success" | "error";

export type Cliente = {
  id?: number;
  rut: string;
  razonSocial: string;
  alias?: string | null;
  codigoCartera?: string | null;
  agenteId?: number | null;
  activo?: boolean;
};

export type TrabajadorAPI = {
  id_trabajador?: number;
  id?: number;
  trabajadorId?: number;
  nombre?: string;
  name?: string;
  email?: string;
};

export type Trabajador = {
  id_trabajador: number;
  nombre: string;
  email: string;
  carpetaDriveCodigo?: string | null;
  areaInterna?: string | null;
};


export type Presentacion = "CLIENTE" | "INTERNO";
export type Area = "CONTA" | "ADMIN" | "RRHH" | "TRIBUTARIO";
export type FrecuenciaTarea = "MENSUAL" | "SEMANAL" | "UNICA";

export type TareaPlantilla = {
  id_tarea_plantilla: number;
  area?: Area | string;
  nombre: string;
  detalle?: string;
  codigoDocumento?: string | null;
  presentacion?: Presentacion | string | null;
  frecuencia?: FrecuenciaTarea | string | null;
  activo: boolean;
  requiereDrive?: boolean;

  diaSemanaVencimiento?: number | null; // 1..7
  diaMesVencimiento?: number | null; // 1..31
};

export type PlantillaConAplica = TareaPlantilla & {
  aplica: boolean;
  exclusion: null | {
    motivo: string | null;
    desdeFecha: string | null;
    activa?: boolean; // true=NO aplica explícito, false=APLICA explícito
  };
};

export type TareaAsignadaAPI = {
  id_tarea_asignada: number;
  tareaPlantillaId: number;
  trabajadorId: number;
  rutCliente: string;
  estado: string;
  fechaProgramada: string | Date | null;
  fechaComplecion: string | Date | null;
  comentarios: string | null;
  driveTareaFolderId: string | null;
  plantilla: {
    id_tarea_plantilla: number;
    area: string | null;
    nombre: string;
    detalle: string | null;
    codigoDocumento: string | null;
    presentacion: string | null;
    frecuencia: string | null;
    activo: boolean;
    requiereDrive: boolean | null;
    diaSemanaVencimiento: number | null;
    diaMesVencimiento: number | null;
  };
};
