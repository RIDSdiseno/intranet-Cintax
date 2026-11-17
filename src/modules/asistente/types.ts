export type RolMensaje = "user" | "assistant";

/**
 * Un boton para ir a la pantalla de lo que se consulto.
 *
 * La ruta la arma el backend (`tools/acciones.ts`), no el modelo, y apunta
 * siempre a una pantalla que este usuario puede abrir.
 */
export type AccionAsistente = {
  etiqueta: string;
  ruta: string;
};

export type MensajeAsistente = {
  id: string;
  rol: RolMensaje;
  texto: string;
  /** Herramientas que corrieron mientras se generaba esta respuesta. */
  herramientas?: string[];
  /** Pantallas sugeridas al pie de la respuesta. */
  acciones?: AccionAsistente[];
  /** Marca un mensaje que quedo a medias por un error. */
  error?: boolean;
};

/** Lo que manda el backend por SSE en POST /api/asistente/chat. */
export type EventoAsistente =
  | { tipo: "texto"; texto: string }
  | { tipo: "herramienta"; etiqueta: string }
  | { tipo: "accion"; etiqueta: string; ruta: string }
  | { tipo: "fin" }
  | { tipo: "error"; mensaje: string };

/** Lo que viaja al backend como historial (sin ids ni metadatos de UI). */
export type TurnoHistorial = {
  rol: RolMensaje;
  texto: string;
};

export type BorradorTicketResponse = {
  ok: true;
  data: { borrador: string };
};
