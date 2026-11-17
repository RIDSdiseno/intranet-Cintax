// Selector del periodo del informe: un boton que abre un calendario de rango.
//
// Reemplaza a los dos <input type="date"> nativos. El motivo no es solo
// estetico: el calendario nativo no se puede estilizar (lo dibuja el
// navegador fuera de la pagina) y, sobre todo, obligaba a elegir las dos
// puntas por separado. Aca se hace un clic en el dia inicial, otro en el
// final, y el rango queda pintado entre medio.
//
// **Hacia afuera sigue hablando en textos "2026-11-28"**, que es lo que
// entregaba el input nativo y lo que espera el backend. Por eso cambiar el
// calendario no toco ni la API ni la base: este archivo traduce entre los
// `Date` que usa la libreria y los textos que usa el resto.

import React from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { es } from "react-day-picker/locale";
import "react-day-picker/style.css";

import { desdeInput, diasDeRango, etiquetaRango, paraInput } from "../utils/semanas";

export function SelectorPeriodo({
  desde,
  hasta,
  onCambiar,
  maxDias,
  disabled,
}: {
  /** Inicio del periodo, como "2026-11-28". */
  desde: string;
  /** Termino del periodo, como "2026-12-05". */
  hasta: string;
  onCambiar: (desde: string, hasta: string) => void;
  /** Tope de dias del rango. Lo aplica el calendario y tambien el servidor. */
  maxDias?: number;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const contenedor = React.useRef<HTMLDivElement>(null);

  const inicio = desdeInput(desde);
  const fin = desdeInput(hasta);

  /**
   * El rango mientras se elige, que no es el mismo que el de afuera.
   *
   * Hace falta porque `DayPicker` es controlado: pinta lo que diga `selected`
   * y nada mas. Entre el primer clic y el segundo el rango esta a medias
   * (`to` todavia es undefined), y eso no se puede publicar hacia afuera: el
   * resumen del boton y el aviso de "ya tiene informe" reaccionarian a un
   * estado pasajero. Pero si no se guarda en alguna parte, el primer dia
   * marcado no se pinta y el segundo clic calcula el rango a partir del valor
   * anterior.
   */
  const [enEdicion, setEnEdicion] = React.useState<DateRange | undefined>();

  /** Abre el panel sembrando el rango que ya estaba elegido. */
  const abrir = () => {
    setEnEdicion(inicio ? { from: inicio, to: fin ?? undefined } : undefined);
    setAbierto(true);
  };

  // Cerrar al hacer clic afuera o con Escape. Sin esto el panel queda abierto
  // tapando la pantalla y hay que volver a pulsar el boton para sacarlo.
  React.useEffect(() => {
    if (!abierto) return;

    const alClicar = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };

    document.addEventListener("mousedown", alClicar);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClicar);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  /**
   * Cada clic actualiza lo que se ve; solo el que completa el rango sale
   * hacia afuera.
   */
  const alElegir = (rango: DateRange | undefined) => {
    setEnEdicion(rango);

    if (!rango?.from || !rango.to) return;

    onCambiar(paraInput(rango.from), paraInput(rango.to));

    // Se cierra al completar el rango: el segundo clic ya dijo todo y
    // dejarlo abierto obliga a un tercero para seguir.
    setAbierto(false);
  };

  const resumen =
    inicio && fin && inicio <= fin
      ? {
          texto: etiquetaRango(inicio.toISOString(), fin.toISOString()),
          dias: diasDeRango(inicio.toISOString(), fin.toISOString()),
        }
      : null;

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={`flex items-center gap-2.5 rounded-2xl border bg-white px-3.5 py-2 text-left transition disabled:opacity-60 ${
          abierto
            ? "border-[var(--secondary-color)] shadow-sm"
            : "border-black/10 hover:border-black/25"
        }`}
      >
        <CalendarDays
          size={16}
          className="shrink-0"
          style={{ color: "var(--secondary-color)" }}
        />

        <span className="leading-tight">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-black/40">
            Periodo del informe
          </span>
          <span className="block text-sm font-medium text-black/80">
            {resumen ? (
              <>
                {resumen.texto}
                <span className="font-normal text-black/40">
                  {" "}
                  · {resumen.dias} {resumen.dias === 1 ? "dia" : "dias"}
                </span>
              </>
            ) : (
              "Elegir fechas"
            )}
          </span>
        </span>

        <ChevronDown
          size={15}
          aria-hidden
          className={`shrink-0 text-black/30 transition ${
            abierto ? "rotate-180" : ""
          }`}
        />
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Elegir el periodo del informe"
          className="absolute right-0 z-30 mt-2 rounded-2xl border border-black/10 bg-white p-3 shadow-lg"
        >
          {/* Los colores salen de las variables de la intranet, para que el
              calendario no se vea de otra aplicacion. */}
          <DayPicker
            mode="range"
            locale={es}
            selected={enEdicion}
            onSelect={alElegir}
            defaultMonth={inicio ?? undefined}
            max={maxDias}
            // Con un rango ya completo, el siguiente clic empieza uno nuevo en
            // vez de estirar el anterior. Es lo que espera quien abre el panel
            // para elegir otro periodo, que es el caso normal.
            resetOnSelect
            showOutsideDays
            className="[--rdp-accent-background-color:var(--tertiary-color)] [--rdp-accent-color:var(--primary-color)] [--rdp-today-color:var(--secondary-color)] [--rdp-day-height:2.1rem] [--rdp-day-width:2.1rem] text-sm"
          />

          <p className="mt-1 border-t border-black/5 pt-2 text-center text-[11px] text-black/40">
            Marca el primer dia y despues el ultimo
            {maxDias ? ` · maximo ${maxDias} dias` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
