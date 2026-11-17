import React from "react";
import {
  AlertTriangle,
  CalendarDays,
  Download,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { mensajeDeErrorApi } from "../../../lib/api";
import {
  generarInforme,
  listarInformes,
  obtenerInforme,
} from "../services/informesApi";
import type { Informe, InformeResumen } from "../types";
import { descargarInformePdf, fechaCorta } from "../utils/informePdf";
import { SelectorPeriodo } from "../components/SelectorPeriodo";
import {
  atajosDeRango,
  esSemanaExacta,
  esSemanaIso,
  paraInput,
  subtituloInforme,
  tituloInforme,
} from "../utils/semanas";

/**
 * Tope de dias del periodo, espejo de `MAX_DIAS_RANGO` en el backend.
 *
 * Aca sirve para que el calendario no deje marcar un rango imposible. **La
 * regla de verdad la aplica el servidor**, que rechaza el periodo con su
 * motivo: esto es comodidad, no validacion.
 */
const MAX_DIAS_INFORME = 92;

function Metrica({
  etiqueta,
  valor,
  tono = "normal",
}: {
  etiqueta: string;
  valor: number;
  tono?: "normal" | "bueno" | "alerta";
}) {
  const color =
    tono === "bueno"
      ? "text-emerald-600"
      : tono === "alerta"
      ? "text-rose-600"
      : "text-[var(--primary-color)]";

  return (
    <div className="rounded-xl border border-black/5 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[11px] uppercase tracking-wide text-black/45">
        {etiqueta}
      </p>
      <p className={`mt-0.5 text-xl font-semibold ${color}`}>{valor}</p>
    </div>
  );
}

/**
 * Por que origen se filtra la lista de informes.
 *
 * Son dos cosas distintas y conviene poder separarlas: el automatico lo deja
 * el cron todos los viernes y sirve de registro, mientras que los manuales son
 * los que alguien pidio para algo concreto. Desde que ambos pueden existir
 * para el mismo periodo, la lista mezcla los dos.
 */
type OrigenFiltro = "todos" | "auto" | "manual";

const FILTROS: { valor: OrigenFiltro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "auto", etiqueta: "Automaticos" },
  { valor: "manual", etiqueta: "Manuales" },
];

export default function InformesPage() {
  // Los atajos se calculan una vez: dependen de "hoy", y recalcularlos en cada
  // render haria que los botones cambiaran de rango a medianoche mientras
  // alguien tiene la pantalla abierta.
  const atajos = React.useMemo(() => atajosDeRango(), []);

  const [lista, setLista] = React.useState<InformeResumen[]>([]);
  const [semanaActiva, setSemanaActiva] = React.useState<string | null>(null);
  const [informe, setInforme] = React.useState<Informe | null>(null);

  // Filtro de la lista. Es preferencia de vista y no de datos: no va a la URL
  // ni se guarda, porque mirar solo los manuales un rato no es algo que haya
  // que recordar entre visitas.
  const [origen, setOrigen] = React.useState<OrigenFiltro>("todos");

  // El periodo a generar vive como las dos fechas que muestra el calendario,
  // no como una clave: la clave la arma el servidor al recibirlas.
  const [desde, setDesde] = React.useState(atajos[0].desde);
  const [hasta, setHasta] = React.useState(atajos[0].hasta);

  const [cargandoLista, setCargandoLista] = React.useState(true);
  const [cargandoInforme, setCargandoInforme] = React.useState(false);
  const [generando, setGenerando] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const cargarLista = React.useCallback(async (activar?: string) => {
    try {
      setCargandoLista(true);
      const res = await listarInformes();
      const informes = res.data.informes;
      setLista(informes);

      // Si no hay nada seleccionado, se abre el mas reciente.
      setSemanaActiva((actual) => activar ?? actual ?? informes[0]?.semana ?? null);
    } catch (err) {
      console.error("Error listando informes:", err);
      setError("No se pudo cargar la lista de informes.");
    } finally {
      setCargandoLista(false);
    }
  }, []);

  React.useEffect(() => {
    void cargarLista();
  }, [cargarLista]);

  React.useEffect(() => {
    if (!semanaActiva) {
      setInforme(null);
      return;
    }

    let cancelado = false;

    const cargar = async () => {
      try {
        setCargandoInforme(true);
        setError(null);
        const res = await obtenerInforme(semanaActiva);
        if (!cancelado) setInforme(res.data.informe);
      } catch (err) {
        console.error("Error cargando informe:", err);
        if (!cancelado) {
          setInforme(null);
          setError("No se pudo cargar ese informe.");
        }
      } finally {
        if (!cancelado) setCargandoInforme(false);
      }
    };

    void cargar();
    return () => {
      cancelado = true;
    };
  }, [semanaActiva]);

  const onGenerar = async () => {
    if (generando || !desde || !hasta) return;

    try {
      setGenerando(true);
      setError(null);
      const res = await generarInforme({ desde, hasta });
      setInforme(res.data.informe);

      // Lo que se genera aqui es siempre manual, asi que con el filtro en
      // "Automaticos" el informe recien hecho no aparecería en la lista y
      // parecería que no se guardo. Se vuelve a "Todos" para que se vea.
      setOrigen("todos");

      await cargarLista(res.data.informe.semana);
    } catch (err) {
      console.error("Error generando informe:", err);
      // El servidor explica el motivo cuando lo sabe ("el periodo no puede
      // pasar de 92 dias"). Taparlo con un texto generico obligaria a abrir
      // la consola para entender que corregir.
      setError(
        mensajeDeErrorApi(
          err,
          "No se pudo generar el informe. Si el periodo no tiene tareas, igual deberia generarse: revisa la consola del servidor."
        )
      );
    } finally {
      setGenerando(false);
    }
  };

  const elegirPeriodo = React.useCallback(
    (nuevoDesde: string, nuevoHasta: string) => {
      setDesde(nuevoDesde);
      setHasta(nuevoHasta);
    },
    []
  );

  // Se compara por fechas y no por clave, porque la clave la calcula el
  // servidor y aca todavia no existe. Las de la lista vienen en ISO completo.
  const delPeriodo = lista.filter(
    (i) =>
      paraInput(new Date(i.desde)) === desde &&
      paraInput(new Date(i.hasta)) === hasta
  );

  // De los de ese periodo, cual se va a reemplazar y cuales sobreviven.
  //
  // Desde esta pantalla siempre se genera un informe manual, y el servidor le
  // da clave de fechas (ver `claveDeRango` en el backend). Entonces lo unico
  // que pisa es la fila que ya tenga esa misma clave: manual y con clave de
  // fechas. Todo lo demas del mismo periodo queda donde esta.
  //
  // El "y con clave de fechas" no sobra. Los informes manuales generados antes
  // de este cambio quedaron con clave de semana, asi que tampoco se
  // reemplazan: decir que si llevaria al usuario a creer que corrigio uno
  // cuando en realidad creo otro al lado.
  const yaExiste = delPeriodo.some(
    (i) => !i.generadoAuto && !esSemanaIso(i.semana)
  );
  const sobreviven = delPeriodo.filter(
    (i) => i.generadoAuto || esSemanaIso(i.semana)
  ).length;

  // La lista que se dibuja. El informe abierto se queda abierto aunque el
  // filtro lo esconda: lo estabas leyendo, y cerrarlo por tocar un filtro de
  // la lista de al lado seria quitarte de la pantalla algo que no pediste
  // cerrar. Solo deja de estar resaltado en la lista.
  const listaVisible =
    origen === "todos"
      ? lista
      : lista.filter((i) => (origen === "auto" ? i.generadoAuto : !i.generadoAuto));

  return (
    <section className="mt-6 space-y-4">
      {/* ---------- Encabezado ---------- */}
      <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--primary-color)]">
              <FileText size={19} style={{ color: "var(--secondary-color)" }} />
              Informes de tareas
            </h2>
            <p className="mt-1 text-sm text-black/55">
              Resumen de las tareas del periodo que elijas, redactado a partir
              de los datos reales de la intranet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SelectorPeriodo
              desde={desde}
              hasta={hasta}
              onCambiar={elegirPeriodo}
              maxDias={MAX_DIAS_INFORME}
              disabled={generando}
            />

            <button
              type="button"
              onClick={onGenerar}
              disabled={generando || !desde || !hasta}
              title={
                yaExiste
                  ? "Ese periodo ya tiene un informe manual: se va a reemplazar"
                  : "Genera el informe del periodo seleccionado"
              }
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm transition active:scale-95 disabled:opacity-60"
              style={{ background: "var(--primary-color)" }}
            >
              {generando ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={15} />
              )}
              {generando
                ? "Generando..."
                : yaExiste
                ? "Regenerar"
                : "Generar informe"}
            </button>
          </div>
        </div>

        {/* Atajos fuera del calendario, no dentro: casi todos los informes son
            de la semana en curso o la anterior, y esos quedan a un clic. El
            calendario es para lo demas. */}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-3">
          <span className="mr-1 text-xs text-black/40">
            Periodos habituales:
          </span>
          {atajos.map((a) => {
            const activo = a.desde === desde && a.hasta === hasta;
            return (
              <button
                key={a.etiqueta}
                type="button"
                disabled={generando}
                onClick={() => elegirPeriodo(a.desde, a.hasta)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                  activo
                    ? "border-transparent bg-[var(--tertiary-color)] text-[var(--primary-color)] shadow-sm"
                    : "border-black/10 text-black/60 hover:border-black/25 hover:bg-black/[0.02] hover:text-black"
                }`}
              >
                {a.etiqueta}
              </button>
            );
          })}
        </div>

        {yaExiste && !generando && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={13} className="shrink-0" />
            Ese periodo ya tiene un informe generado a mano. Generarlo de nuevo
            reemplaza el anterior.
          </p>
        )}

        {/* Estos no se pisan, asi que no es una advertencia sino un aviso: sin
            el aparecen dos entradas del mismo periodo en la lista y no se
            entiende de donde salio la segunda. */}
        {sobreviven > 0 && !generando && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-black/55">
            <Info size={13} className="shrink-0" />
            Ese periodo ya tiene{" "}
            {sobreviven === 1 ? "otro informe" : `otros ${sobreviven} informes`}
            . El que generes aqui queda aparte, sin reemplazar
            {sobreviven === 1 ? "lo" : "los"}.
          </p>
        )}

        {generando && (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-xs text-black/55">
            <Loader2 size={13} className="shrink-0 animate-spin" />
            Esto toma unos segundos: se estan consultando las tareas y
            redactando el resumen.
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* ---------- Listado ---------- */}
        <aside className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-black/45">
              Anteriores
            </h3>
            <button
              type="button"
              onClick={() => void cargarLista()}
              title="Recargar la lista"
              className="rounded-lg p-1.5 text-black/40 transition hover:bg-black/5 hover:text-black/70"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* Los filtros solo aparecen cuando hay algo que filtrar: con la
              lista vacia serian tres botones que no hacen nada. */}
          {!cargandoLista && lista.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1 px-1">
              {FILTROS.map((f) => {
                const activo = origen === f.valor;
                return (
                  <button
                    key={f.valor}
                    type="button"
                    onClick={() => setOrigen(f.valor)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                      activo
                        ? "border-transparent bg-[var(--tertiary-color)] text-[var(--primary-color)]"
                        : "border-black/10 text-black/55 hover:border-black/25 hover:bg-black/[0.02] hover:text-black"
                    }`}
                  >
                    {f.etiqueta}
                  </button>
                );
              })}
            </div>
          )}

          {cargandoLista && (
            <p className="px-1 py-2 text-xs text-black/45">Cargando...</p>
          )}

          {!cargandoLista && lista.length === 0 && (
            <p className="px-1 py-2 text-xs text-black/45">
              Todavia no hay informes. Genera el primero con el boton de arriba.
            </p>
          )}

          {/* Hay informes, pero ninguno de este origen. Sin este mensaje la
              lista queda en blanco y parece que se perdieron. */}
          {!cargandoLista && lista.length > 0 && listaVisible.length === 0 && (
            <p className="px-1 py-2 text-xs text-black/45">
              Ningun informe{" "}
              {origen === "auto" ? "automatico" : "generado a mano"} todavia.
            </p>
          )}

          <ul className="space-y-1">
            {listaVisible.map((item) => {
              const activo = item.semana === semanaActiva;
              return (
                <li key={item.semana}>
                  <button
                    type="button"
                    onClick={() => setSemanaActiva(item.semana)}
                    className={`w-full rounded-xl px-3 py-2 text-left transition ${
                      activo
                        ? "bg-[var(--tertiary-color)] text-[var(--primary-color)]"
                        : "text-black/70 hover:bg-black/[0.03]"
                    }`}
                  >
                    <span className="block text-sm font-medium">
                      {tituloInforme(item)}
                    </span>
                    <span className="block text-[11px] text-black/45">
                      {subtituloInforme(item)}
                    </span>
                    {item.generadoAuto && (
                      <span className="mt-1 inline-block rounded-full bg-black/5 px-2 py-0.5 text-[10px] text-black/50">
                        automatico
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* ---------- Detalle ---------- */}
        <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          {cargandoInforme && (
            <p className="text-sm text-black/50">Cargando informe...</p>
          )}

          {!cargandoInforme && !informe && (
            <div className="py-12 text-center">
              <CalendarDays size={28} className="mx-auto text-black/20" />
              <p className="mt-3 text-sm text-black/50">
                Selecciona un informe de la lista o genera uno nuevo.
              </p>
            </div>
          )}

          {!cargandoInforme && informe && (
            <article className="space-y-5">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/5 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-[var(--primary-color)]">
                    {tituloInforme(informe)}
                  </h3>
                  <p className="text-sm text-black/55">
                    {subtituloInforme(informe)}
                  </p>
                  <p className="mt-1 text-xs text-black/40">
                    {informe.generadoAuto
                      ? "Generado automaticamente"
                      : `Generado por ${informe.generadoPor ?? "un usuario"}`}{" "}
                    el {fechaCorta(informe.generadoEn)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => descargarInformePdf(informe)}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70 transition hover:border-black/25 hover:text-black"
                >
                  <Download size={15} />
                  Descargar PDF
                </button>
              </header>

              {/* Cifras */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metrica
                  etiqueta="Completadas"
                  valor={informe.datos.totales.completadas}
                  tono="bueno"
                />
                <Metrica
                  etiqueta="En proceso"
                  valor={informe.datos.totales.enProceso}
                />
                <Metrica
                  etiqueta="Pendientes"
                  valor={informe.datos.totales.pendientes}
                />
                <Metrica
                  etiqueta="Atrasadas"
                  valor={informe.datos.atrasadas.total}
                  tono={informe.datos.atrasadas.total > 0 ? "alerta" : "normal"}
                />
              </div>

              {/* "esta semana" solo si de verdad lo es: un informe de dos
                  meses decia "vencian esta semana" bajo un titulo que mostraba
                  las dos fechas. Se mira el rango y no la clave, porque un
                  informe pedido de lunes a domingo es una semana aunque su
                  clave sea de fechas (ver `esSemanaExacta`). */}
              <p className="text-xs text-black/45">
                {informe.datos.totales.total} tareas vencian en{" "}
                {esSemanaExacta(informe.desde, informe.hasta)
                  ? "la semana"
                  : "el periodo"}{" "}
                · {informe.datos.completadasEnLaSemana} se cerraron dentro ·{" "}
                {informe.datos.atrasadas.criticas} atrasadas con 15 dias o mas
              </p>

              {/* Por area */}
              {informe.datos.porArea.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/45">
                    Por area
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-black/45">
                          <th className="py-1.5 pr-3 font-medium">Area</th>
                          <th className="py-1.5 pr-3 font-medium">Total</th>
                          <th className="py-1.5 pr-3 font-medium">Compl.</th>
                          <th className="py-1.5 pr-3 font-medium">En proc.</th>
                          <th className="py-1.5 pr-3 font-medium">Pend.</th>
                          <th className="py-1.5 font-medium">Venc.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {informe.datos.porArea.map((fila) => (
                          <tr
                            key={fila.area}
                            className="border-t border-black/5 text-black/75"
                          >
                            <td className="py-1.5 pr-3">{fila.area}</td>
                            <td className="py-1.5 pr-3">{fila.conteo.total}</td>
                            <td className="py-1.5 pr-3">
                              {fila.conteo.completadas}
                            </td>
                            <td className="py-1.5 pr-3">
                              {fila.conteo.enProceso}
                            </td>
                            <td className="py-1.5 pr-3">
                              {fila.conteo.pendientes}
                            </td>
                            <td className="py-1.5">{fila.conteo.vencidas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Por responsable */}
              {informe.datos.porTrabajador.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/45">
                    Por responsable
                  </h4>
                  <ul className="divide-y divide-black/5">
                    {informe.datos.porTrabajador.map((p) => (
                      <li
                        key={p.email || p.nombre}
                        className="flex items-center justify-between gap-3 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate text-black/75">
                          {p.nombre}
                        </span>
                        <span className="shrink-0 text-xs text-black/50">
                          {p.conteo.total} tareas · {p.conteo.completadas}{" "}
                          completadas · {p.conteo.vencidas} vencidas
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* El texto redactado */}
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/45">
                  Analisis
                </h4>
                {/* Texto plano a proposito: el prompt prohibe markdown, asi
                    que no hace falta renderizar HTML en ninguna parte. */}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-black/80">
                  {informe.resumen}
                </p>
              </div>

              {/* Atrasadas */}
              {informe.datos.atrasadas.detalle.length > 0 && (
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/45">
                    Tareas atrasadas
                  </h4>

                  {informe.datos.atrasadas.total >
                    informe.datos.atrasadas.detalle.length && (
                    <p className="mb-2 text-xs text-black/45">
                      Se muestran las{" "}
                      {informe.datos.atrasadas.detalle.length} con mas dias de
                      atraso, de un total de {informe.datos.atrasadas.total}.
                    </p>
                  )}

                  <ul className="divide-y divide-black/5">
                    {informe.datos.atrasadas.detalle.map((t, i) => (
                      <li
                        key={`${t.tarea}-${t.fechaProgramada}-${i}`}
                        className="flex items-start gap-3 py-2"
                      >
                        <span className="mt-0.5 shrink-0 rounded-lg bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                          {t.diasAtraso}d
                        </span>
                        <span className="min-w-0 text-sm text-black/75">
                          <span className="block">{t.tarea}</span>
                          <span className="block text-xs text-black/45">
                            {t.area} · {t.responsable}
                            {t.cliente ? ` · cliente ${t.cliente}` : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="border-t border-black/5 pt-3 text-xs text-black/40">
                Las cifras salen directo de la base de datos. El analisis lo
                redacta la IA a partir de esas cifras y puede equivocarse al
                interpretarlas: contrastalo con los numeros de arriba antes de
                tomar una decision.
              </p>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
