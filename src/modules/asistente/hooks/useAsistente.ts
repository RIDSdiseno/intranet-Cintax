import React from "react";
import { conversarConAsistente } from "../services/asistenteApi";
import type { MensajeAsistente, TurnoHistorial } from "../types";

function nuevoId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Deja pasar solo rutas de esta intranet.
 *
 * Hoy las rutas las arma el backend con constantes y el modelo ni las ve, asi
 * que esto no deberia filtrar nada. Esta igual porque el boton navega sin
 * preguntar: si alguna vez una ruta terminara saliendo de un texto generado,
 * el costo de no tener este chequeo seria un boton que manda al usuario fuera
 * del sitio. `//evil.com` es una URL absoluta aunque empiece con `/`.
 */
function esRutaInterna(ruta: string): boolean {
  return (
    typeof ruta === "string" &&
    ruta.startsWith("/") &&
    !ruta.startsWith("//") &&
    !ruta.includes("://")
  );
}

/**
 * Estado de la conversacion con el asistente.
 *
 * El historial vive aca y solo aca: no se guarda en el servidor ni en
 * localStorage. Al recargar la pagina se empieza de cero, que es lo que se
 * decidio para esta version.
 */
export function useAsistente() {
  const [mensajes, setMensajes] = React.useState<MensajeAsistente[]>([]);
  const [enviando, setEnviando] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  // Si el componente se desmonta a mitad de una respuesta, se corta el
  // request en vez de dejarlo generando contra una pantalla que ya no esta.
  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const cancelar = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setEnviando(false);
  }, []);

  const limpiar = React.useCallback(() => {
    cancelar();
    setMensajes([]);
  }, [cancelar]);

  const enviar = React.useCallback(
    async (texto: string) => {
      const limpio = texto.trim();
      if (!limpio || enviando) return;

      const idRespuesta = nuevoId();

      // El historial que viaja es el de ANTES de este turno: el mensaje nuevo
      // va aparte, y la respuesta todavia no existe.
      const historial: TurnoHistorial[] = mensajes
        .filter((m) => !m.error && m.texto.trim())
        .map((m) => ({ rol: m.rol, texto: m.texto }));

      setMensajes((prev) => [
        ...prev,
        { id: nuevoId(), rol: "user", texto: limpio },
        { id: idRespuesta, rol: "assistant", texto: "", herramientas: [] },
      ]);
      setEnviando(true);

      const controlador = new AbortController();
      abortRef.current = controlador;

      const actualizar = (
        cambio: (actual: MensajeAsistente) => MensajeAsistente
      ) => {
        setMensajes((prev) =>
          prev.map((m) => (m.id === idRespuesta ? cambio(m) : m))
        );
      };

      try {
        await conversarConAsistente({
          mensaje: limpio,
          historial,
          signal: controlador.signal,
          onEvento: (evento) => {
            if (evento.tipo === "texto") {
              actualizar((m) => ({ ...m, texto: m.texto + evento.texto }));
              return;
            }

            if (evento.tipo === "herramienta") {
              actualizar((m) => ({
                ...m,
                herramientas: [...(m.herramientas ?? []), evento.etiqueta],
              }));
              return;
            }

            if (evento.tipo === "accion") {
              if (!esRutaInterna(evento.ruta)) return;
              actualizar((m) => ({
                ...m,
                acciones: [
                  ...(m.acciones ?? []),
                  { etiqueta: evento.etiqueta, ruta: evento.ruta },
                ],
              }));
              return;
            }

            if (evento.tipo === "error") {
              actualizar((m) => ({
                ...m,
                error: true,
                texto: m.texto
                  ? `${m.texto}\n\n${evento.mensaje}`
                  : evento.mensaje,
              }));
            }
          },
        });
      } catch (err) {
        // Cancelar es una accion del usuario, no un error que mostrarle.
        if ((err as Error)?.name !== "AbortError") {
          console.error("Error hablando con el asistente:", err);
          actualizar((m) => ({
            ...m,
            error: true,
            texto: m.texto || "Se corto la conexion con el asistente.",
          }));
        }
      } finally {
        // Una respuesta vacia sin error no aporta nada en pantalla.
        setMensajes((prev) =>
          prev.filter((m) => m.id !== idRespuesta || m.texto.trim() || m.error)
        );
        abortRef.current = null;
        setEnviando(false);
      }
    },
    [enviando, mensajes]
  );

  return { mensajes, enviando, enviar, cancelar, limpiar };
}
