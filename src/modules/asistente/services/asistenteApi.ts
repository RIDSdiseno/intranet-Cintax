import { API_BASE_URL, fetchJSON } from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth";
import type {
  BorradorTicketResponse,
  EventoAsistente,
  TurnoHistorial,
} from "../types";

const ASISTENTE_BASE_URL = `${API_BASE_URL}/asistente`;

/**
 * Abre el chat y va entregando los eventos a medida que llegan.
 *
 * No se usa `EventSource` porque solo sabe hacer GET y no deja poner el
 * header Authorization que exige `authGuard`. Con `fetch` se puede mandar el
 * token y leer el cuerpo como stream, que es lo mismo con mas control.
 */
export async function conversarConAsistente(params: {
  mensaje: string;
  historial: TurnoHistorial[];
  onEvento: (evento: EventoAsistente) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const { mensaje, historial, onEvento, signal } = params;

  const token = getAuthToken();

  const res = await fetch(`${ASISTENTE_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ mensaje, historial }),
    signal,
  });

  if (!res.ok) {
    // Los errores previos al stream vienen como JSON normal.
    const texto = await res.text().catch(() => "");
    let mensajeError = "No se pudo contactar al asistente.";
    try {
      const data = JSON.parse(texto) as { error?: string };
      if (data.error) mensajeError = data.error;
    } catch {
      /* se queda el mensaje por defecto */
    }
    onEvento({ tipo: "error", mensaje: mensajeError });
    return;
  }

  if (!res.body) {
    onEvento({ tipo: "error", mensaje: "El servidor no devolvio contenido." });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Los eventos SSE se separan con una linea en blanco. El ultimo trozo
    // puede venir cortado a la mitad, asi que queda en el buffer.
    const bloques = buffer.split("\n\n");
    buffer = bloques.pop() ?? "";

    for (const bloque of bloques) {
      const linea = bloque.trim();
      if (!linea.startsWith("data:")) continue;

      try {
        onEvento(JSON.parse(linea.slice(5).trim()) as EventoAsistente);
      } catch {
        // Un evento ilegible no deberia cortar la conversacion entera.
        console.warn("Evento SSE ilegible:", linea);
      }
    }
  }
}

/**
 * Pide un borrador de respuesta para un ticket. No envia nada.
 *
 * Sin `opciones`, redacta desde cero a partir del hilo.
 *
 * Con `borradorActual` y `puntos`, integra esos puntos en el texto que ya
 * esta escrito y devuelve la respuesta completa. El borrador original no se
 * toca: el servidor no guarda nada, asi que conservarlo es responsabilidad de
 * quien llama (lo hace TicketDetailPage, en un ref).
 */
export async function pedirBorradorTicket(
  ticketId: number | string,
  opciones?: { borradorActual?: string; puntos?: string[] }
) {
  return fetchJSON<BorradorTicketResponse>(
    `${ASISTENTE_BASE_URL}/redactar-respuesta`,
    {
      method: "POST",
      body: JSON.stringify({
        ticketId: Number(ticketId),
        ...(opciones?.borradorActual
          ? { borradorActual: opciones.borradorActual }
          : {}),
        ...(opciones?.puntos?.length ? { puntos: opciones.puntos } : {}),
      }),
    }
  );
}
