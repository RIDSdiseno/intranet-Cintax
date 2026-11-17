import {
  ArrowUpRight,
  Bot,
  Loader2,
  Search,
  TriangleAlert,
  User,
} from "lucide-react";
import type { MensajeAsistente } from "../types";

type BurbujaMensajeProps = {
  mensaje: MensajeAsistente;
  /** true mientras esta respuesta se sigue generando. */
  generando?: boolean;
  /** Navega a la pantalla de un boton. Lo decide quien pulsa, nunca el modelo. */
  onIr?: (ruta: string) => void;
};

export default function BurbujaMensaje({
  mensaje,
  generando = false,
  onIr,
}: BurbujaMensajeProps) {
  const esUsuario = mensaje.rol === "user";
  const herramientas = mensaje.herramientas ?? [];
  const acciones = mensaje.acciones ?? [];
  const sinTextoTodavia = !mensaje.texto.trim();

  if (esUsuario) {
    return (
      <div className="flex justify-end gap-2">
        <div
          className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm text-white shadow-sm"
          style={{ background: "var(--secondary-color)" }}
        >
          <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>
        </div>
        <div className="mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black/5 text-black/45 sm:flex">
          <User size={14} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <div
        className="mt-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded-full text-white sm:flex"
        style={{ background: "var(--primary-color)" }}
      >
        <Bot size={14} />
      </div>

      <div
        className={`max-w-[80%] rounded-2xl rounded-bl-md border px-4 py-2.5 text-sm shadow-sm ${
          mensaje.error
            ? "border-rose-200 bg-rose-50 text-rose-800"
            : "border-black/10 bg-white text-black/80"
        }`}
      >
        {/* De donde salieron los datos: se ve que consulto, no que invento. */}
        {herramientas.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {herramientas.map((etiqueta, i) => (
              <span
                key={`${etiqueta}-${i}`}
                className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"
              >
                <Search size={11} />
                {etiqueta}
              </span>
            ))}
          </div>
        )}

        {mensaje.error && (
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
            <TriangleAlert size={12} />
            Error
          </div>
        )}

        {sinTextoTodavia && generando ? (
          <span className="inline-flex items-center gap-2 text-black/45">
            <Loader2 size={14} className="animate-spin" />
            Pensando...
          </span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>
        )}

        {/* Atajos a la pantalla de lo que se consulto. Mientras la respuesta
            se sigue generando no se muestran: apareceria un boton a medias
            debajo de una frase incompleta. */}
        {!generando && !mensaje.error && acciones.length > 0 && onIr && (
          <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-black/5 pt-2.5">
            {acciones.map((accion) => (
              <button
                key={accion.ruta}
                type="button"
                onClick={() => onIr(accion.ruta)}
                className="inline-flex items-center gap-1 rounded-full border border-black/10 px-2.5 py-1 text-[12px] font-medium text-black/70 transition hover:border-black/20 hover:bg-black/5"
              >
                {accion.etiqueta}
                <ArrowUpRight size={12} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
