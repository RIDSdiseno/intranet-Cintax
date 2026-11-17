import React from "react";
import { Bot, Eraser, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import BurbujaMensaje from "./BurbujaMensaje";
import ComposerAsistente from "./ComposerAsistente";
import { useAsistente } from "../hooks/useAsistente";
import { getAuthPayload } from "../../../lib/auth";

const SUGERENCIAS = [
  "¿Cuántos tickets abiertos hay?",
  "¿Qué tareas me vencen esta semana?",
  "¿Cómo va el SLA de primera respuesta?",
];

/**
 * Asistente flotante.
 *
 * Va montado en el AppShell, no en una ruta: asi acompana al usuario por toda
 * la intranet y, sobre todo, **la conversacion sobrevive al navegar**. Si
 * viviera en una pagina, cambiar de pantalla la borraria.
 */
export default function AsistenteFlotante() {
  const [abierto, setAbierto] = React.useState(false);
  const { mensajes, enviando, enviar, cancelar, limpiar } = useAsistente();
  const navigate = useNavigate();

  /**
   * Ir a la pantalla de un boton.
   *
   * Cierra el panel, porque si no la respuesta queda tapando justo lo que
   * fuiste a ver. La conversacion no se pierde: el estado vive en
   * `useAsistente`, que esta en este componente y no se desmonta al cerrar.
   */
  const irA = React.useCallback(
    (ruta: string) => {
      setAbierto(false);
      navigate(ruta);
    },
    [navigate]
  );

  const usuario = getAuthPayload();
  const primerNombre = (usuario?.nombre || usuario?.email || "").split(" ")[0];

  const finRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  // Seguir la respuesta mientras se escribe.
  React.useEffect(() => {
    if (!abierto) return;
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, abierto]);

  // Escape cierra el panel, como cualquier otro dialogo de la intranet.
  React.useEffect(() => {
    if (!abierto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  const idUltimo = mensajes.length > 0 ? mensajes[mensajes.length - 1].id : null;
  const hayConversacion = mensajes.length > 0;

  return (
    <>
      {/* ---------- Lanzador ---------- */}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={abierto ? "Cerrar asistente" : "Abrir asistente"}
        aria-expanded={abierto}
        className="fixed bottom-5 right-5 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl shadow-black/25 transition hover:scale-105 active:scale-95"
        style={{ background: "var(--primary-color)" }}
      >
        {abierto ? (
          <X size={22} />
        ) : (
          <>
            <Bot size={24} />
            {/* Chispa dorada: lo distingue de un boton de ayuda cualquiera. */}
            <Sparkles
              size={12}
              className="absolute right-3 top-3"
              style={{ color: "var(--secondary-color)" }}
            />
          </>
        )}
      </button>

      {/* ---------- Panel ---------- */}
      {abierto && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Asistente Cintax"
          className="fixed inset-x-3 bottom-24 top-3 z-[60] flex flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl sm:inset-x-auto sm:top-auto sm:right-5 sm:h-[620px] sm:max-h-[calc(100vh-7rem)] sm:w-[400px]"
        >
          {/* Encabezado */}
          <div
            className="flex items-center justify-between gap-2 px-4 py-3 text-white"
            style={{ background: "var(--primary-color)" }}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "var(--secondary-color)" }}
              >
                <Bot size={17} />
              </div>
              <div className="min-w-0 leading-tight">
                <p className="truncate text-sm font-semibold">
                  Asistente{" "}
                  <span style={{ color: "var(--secondary-color)" }}>Cintax</span>
                </p>
                <p className="truncate text-[11px] text-white/55">
                  Tickets, tareas y clientes
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {hayConversacion && (
                <button
                  type="button"
                  onClick={limpiar}
                  title="Limpiar conversación"
                  aria-label="Limpiar conversación"
                  className="rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <Eraser size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setAbierto(false)}
                title="Cerrar"
                aria-label="Cerrar asistente"
                className="rounded-lg p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Conversación */}
          <div
            className="flex-1 overflow-y-auto p-4"
            style={{ background: "var(--tertiary-color)" }}
          >
            {!hayConversacion ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                  style={{ background: "var(--primary-color)" }}
                >
                  <Bot size={22} />
                </div>

                <p className="text-sm font-medium text-black/75">
                  {primerNombre ? `Hola, ${primerNombre}` : "Hola"}
                </p>
                <p className="mt-1 max-w-[260px] text-xs text-black/55">
                  Puedo buscar en tus tickets, tareas y clientes. Solo veo lo
                  que tú puedes ver en la intranet.
                </p>

                <div className="mt-5 flex w-full flex-col gap-2">
                  {SUGERENCIAS.map((sugerencia) => (
                    <button
                      key={sugerencia}
                      type="button"
                      onClick={() => enviar(sugerencia)}
                      className="rounded-xl border border-black/10 bg-white px-3 py-2 text-left text-xs text-black/70 shadow-sm transition hover:border-black/25 hover:text-black"
                    >
                      {sugerencia}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {mensajes.map((mensaje) => (
                  <BurbujaMensaje
                    key={mensaje.id}
                    mensaje={mensaje}
                    generando={enviando && mensaje.id === idUltimo}
                    onIr={irA}
                  />
                ))}
                <div ref={finRef} />
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-black/10 bg-white p-3">
            <ComposerAsistente
              enviando={enviando}
              onEnviar={enviar}
              onCancelar={cancelar}
              autoFocus
              compacto
            />
            <p className="mt-1.5 px-1 text-[10px] leading-tight text-black/40">
              Puede equivocarse. Verifica los datos importantes en la pantalla
              correspondiente. La conversación no se guarda.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
