// src/types/tareas.ts

export type EstadoTarea = "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "VENCIDA";

export type TareaPlantilla = {
  id_tarea_plantilla: number;
  area: "CONTA" | "ADMIN" | "RRHH" | "TRIBUTARIO";
  nombre: string;
  detalle: string;
  codigoDocumento?: string | null;
  frecuenciaTexto?: string | null;
  plazoMaximoTexto?: string | null;
  frecuencia: "MENSUAL" | "SEMANAL" | "UNICA";
  diaMesVencimiento?: number | null;
  diaSemanaVencimiento?: number | null;
  presentacion: "CLIENTE" | "INTERNO";
  activo: boolean;
};

export type TareaAsignada = {
  id_tarea_asignada: number;
  tareaPlantillaId: number;
  trabajadorId?: number | null;
  rutCliente?: string | null;
  estado: EstadoTarea;
  fechaProgramada: string;
  fechaComplecion?: string | null;
  comentarios?: string | null;
  createdAt: string;
  updatedAt: string;
  tareaPlantilla: TareaPlantilla;
  asignado?: {
    id_trabajador: number;
    nombre: string;
    email: string;
  } | null;
};
