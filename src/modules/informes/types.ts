// Tipos del informe. Espejo de lo que arma
// `back/src/modules/informes/datos.ts`.
//
// Ojo con el campo `semana`: **no siempre es una semana.** Es la clave que
// identifica al informe, y tiene dos formatos:
//
//   "2026-W46"    -> informe automatico de una semana exacta
//   "2611281205"  -> todo lo demas (AAMMDD del inicio + MMDD del fin)
//
// El formato depende del origen, no solo del periodo, y por eso el informe
// automatico y el manual de una misma semana conviven como dos filas: sus
// claves no pueden chocar. Esta explicado en `claveDeRango`, en el backend.
//
// Se llama asi porque es el nombre de la columna en la base, de cuando los
// informes eran siempre semanales. Renombrarlo obligaria a migrar datos.
//
// Para mostrarlo en pantalla NO se usa este campo sino `desde` y `hasta`, que
// son fechas de verdad: ver `tituloInforme` en `utils/semanas.ts`. Y para
// decidir si se escribe "la semana" o "el periodo" tampoco sirve la clave,
// sino `esSemanaExacta`, que mira las fechas.

export type ConteoEstados = {
  completadas: number;
  pendientes: number;
  enProceso: number;
  vencidas: number;
  noAplica: number;
  total: number;
};

export type TareaAtrasada = {
  tarea: string;
  area: string;
  responsable: string;
  cliente: string | null;
  fechaProgramada: string;
  diasAtraso: number;
};

export type DatosInforme = {
  semana: string;
  desde: string;
  hasta: string;
  generadoEn: string;
  totales: ConteoEstados;
  completadasEnLaSemana: number;
  porArea: { area: string; conteo: ConteoEstados }[];
  porTrabajador: { nombre: string; email: string; conteo: ConteoEstados }[];
  atrasadas: {
    total: number;
    criticas: number;
    sinResponsable: number;
    detalle: TareaAtrasada[];
  };
};

/** Lo que devuelve el listado: sin el texto ni los datos, para que sea liviano. */
export type InformeResumen = {
  semana: string;
  desde: string;
  hasta: string;
  generadoAuto: boolean;
  generadoEn: string;
  generadoPor: string | null;
};

export type Informe = InformeResumen & {
  resumen: string;
  datos: DatosInforme;
  modelo: string | null;
};

export type ListaInformesResponse = {
  ok: boolean;
  data: { informes: InformeResumen[] };
};

export type InformeResponse = {
  ok: boolean;
  data: { informe: Informe };
};
