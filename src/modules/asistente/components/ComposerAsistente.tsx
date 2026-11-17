import React from "react";
import { Send, Square } from "lucide-react";

const MAX_CARACTERES = 4000;

type ComposerAsistenteProps = {
  enviando: boolean;
  onEnviar: (texto: string) => void;
  onCancelar: () => void;
  /** Enfoca el campo al montar (al abrir el panel flotante). */
  autoFocus?: boolean;
  /** Oculta la ayuda de teclado: en el panel angosto sobra una linea de texto. */
  compacto?: boolean;
};

export default function ComposerAsistente({
  enviando,
  onEnviar,
  onCancelar,
  autoFocus = false,
  compacto = false,
}: ComposerAsistenteProps) {
  const [texto, setTexto] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  // El textarea crece con el contenido hasta un tope, para no comerse la
  // conversacion cuando alguien pega un parrafo largo.
  React.useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [texto]);

  const enviar = () => {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    onEnviar(limpio);
    setTexto("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter hace salto de linea.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      enviar();
    }
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-2 shadow-sm">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAX_CARACTERES))}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Pregunta por tus tickets, tareas o clientes..."
          aria-label="Mensaje para el asistente"
          className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-black/40"
        />

        {enviando ? (
          <button
            type="button"
            onClick={onCancelar}
            title="Detener la respuesta"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white text-black/60 transition hover:border-black/20 hover:text-black"
          >
            <Square size={15} />
          </button>
        ) : (
          <button
            type="button"
            onClick={enviar}
            disabled={!texto.trim()}
            title="Enviar"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md shadow-black/20 transition active:scale-95 disabled:opacity-40 disabled:shadow-none"
            style={{ background: "var(--secondary-color)" }}
          >
            <Send size={15} />
          </button>
        )}
      </div>

      {(!compacto || texto.length > MAX_CARACTERES - 500) && (
        <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
          {!compacto && (
            <span className="text-[11px] text-black/35">
              Enter envía · Shift+Enter salta de línea
            </span>
          )}
          {texto.length > MAX_CARACTERES - 500 && (
            <span className="ml-auto text-[11px] text-black/45">
              {texto.length}/{MAX_CARACTERES}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
