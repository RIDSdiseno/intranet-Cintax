// Periodos del informe en el front: calcularlos para los atajos y nombrarlos
// en pantalla.
//
// **La clave del informe la arma el backend, no este archivo.** Antes se
// calculaba en los dos lados y tenian que coincidir carácter por carácter;
// ahora el front manda las dos fechas y recibe la clave ya hecha. Una regla
// en un solo lugar no se puede desincronizar con la otra copia.
//
// Lo que queda aca es aritmetica de calendario para los atajos, que se hace a
// mano para no sumar una dependencia al bundle por tres funciones.

/**
 * Lunes 00:00 de la semana a la que pertenece la fecha.
 *
 * Privada: la usan `atajosDeRango` y `esSemanaExacta`, aqui mismo. Quien
 * necesite una semana desde fuera del archivo pide el atajo, no el calculo.
 */
function lunesDe(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  // getDay() devuelve 0 para domingo; en ISO el domingo es el dia 7.
  const dia = d.getDay() || 7;
  d.setDate(d.getDate() - (dia - 1));
  return d;
}

/** Domingo 23:59:59 de esa misma semana. Privada, igual que `lunesDe`. */
function domingoDe(fecha: Date): Date {
  const d = lunesDe(fecha);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * "10 al 16 de noviembre". Si cruza de mes, nombra los dos.
 *
 * Y si cruza de anio, los nombra tambien: desde que el periodo lo elige el
 * usuario puede ir del 20 de diciembre al 10 de enero, y ahi "20 de diciembre
 * al 10 de enero" se lee como un viaje al pasado.
 */
export function etiquetaRango(desdeIso: string, hastaIso: string): string {
  const desde = new Date(desdeIso);
  const hasta = new Date(hastaIso);

  const mesDesde = desde.toLocaleDateString("es-CL", { month: "long" });
  const mesHasta = hasta.toLocaleDateString("es-CL", { month: "long" });

  if (desde.getFullYear() !== hasta.getFullYear()) {
    return `${desde.getDate()} de ${mesDesde} de ${desde.getFullYear()} al ${hasta.getDate()} de ${mesHasta} de ${hasta.getFullYear()}`;
  }

  if (mesDesde === mesHasta) {
    return `${desde.getDate()} al ${hasta.getDate()} de ${mesHasta}`;
  }

  return `${desde.getDate()} de ${mesDesde} al ${hasta.getDate()} de ${mesHasta}`;
}

/** "2026-11-28", que es lo que entiende un <input type="date">. */
export function paraInput(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * Lo contrario de `paraInput`: lee "2026-11-28" como fecha local.
 *
 * Se parte el texto a mano en vez de usar `new Date(texto)`, que interpreta
 * ese formato como UTC y en Chile devuelve el dia anterior a las nueve de la
 * noche. El resumen del periodo diria un dia menos.
 *
 * Existe algo parecido en `pages/creacion-tareas/shared/date.ts`
 * (`dateStringToISOAtNoon`) y no se reutiliza por tres razones: devuelve un
 * ISO al mediodia y aca hace falta un Date para comparar y contar dias; no
 * detecta fechas inexistentes como el 31 de febrero, y esta vive dentro de
 * otra pantalla, asi que importarla acoplaria dos features que no tienen
 * nada que ver.
 */
export function desdeInput(texto: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto.trim());
  if (!match) return null;

  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const fecha = new Date(anio, mes - 1, dia);

  // `new Date(2026, 1, 31)` no falla: devuelve el 3 de marzo. La unica forma
  // de detectar una fecha que no existe es comprobar que vuelva igual.
  if (fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;

  return fecha;
}

/** Cuantos dias cubre el periodo, contando los dos extremos. */
export function diasDeRango(desdeIso: string, hastaIso: string): number {
  const a = new Date(desdeIso);
  const b = new Date(hastaIso);
  // En UTC para que el cambio de hora no sume ni reste un dia.
  const ms =
    Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
    Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Si la clave es de una semana ISO y no de un periodo libre.
 *
 * El backend guarda "2026-W46" cuando el rango calza exacto con una semana y
 * "2611281205" cuando no. Aca solo se mira la forma: no hace falta repetir
 * esa decision, basta con reconocer cual de las dos tomo.
 */
export function esSemanaIso(clave: string): boolean {
  return /^\d{4}-W\d{2}$/.test(clave);
}

/**
 * Si el periodo va exacto de lunes 00:00 a domingo 23:59:59.999.
 *
 * Es otra pregunta que `esSemanaIso`, y desde que la clave depende del origen
 * las dos ya no dan la misma respuesta: un informe que alguien pidio de lunes
 * a domingo **es** una semana, pero el servidor le da clave de fechas para que
 * no pise al del cron. Ahi `esSemanaIso` dice `false` y esta dice `true`.
 *
 * Se usa para redactar (si el texto dice "la semana" o "el periodo");
 * `esSemanaIso` se usa para mostrar la clave, que es lo unico que depende de
 * su forma. Gemela de `esSemanaExacta` en `back/src/modules/informes/datos.ts`.
 */
export function esSemanaExacta(desdeIso: string, hastaIso: string): boolean {
  const desde = new Date(desdeIso);
  const hasta = new Date(hastaIso);
  return (
    lunesDe(desde).getTime() === desde.getTime() &&
    domingoDe(desde).getTime() === hasta.getTime()
  );
}

export type InformeConPeriodo = {
  semana: string;
  desde: string;
  hasta: string;
};

/**
 * El titulo del informe en pantalla.
 *
 * Las semanas conservan su clave, que es como se las nombra desde siempre.
 * Un periodo libre se nombra por sus fechas: su clave ("2611281205") es un
 * identificador interno y no le dice nada a nadie.
 */
export function tituloInforme(informe: InformeConPeriodo): string {
  return esSemanaIso(informe.semana)
    ? `Semana ${informe.semana}`
    : etiquetaRango(informe.desde, informe.hasta);
}

/** La linea de abajo: lo que el titulo no alcanzo a decir. */
export function subtituloInforme(informe: InformeConPeriodo): string {
  if (esSemanaIso(informe.semana)) {
    return etiquetaRango(informe.desde, informe.hasta);
  }

  const dias = diasDeRango(informe.desde, informe.hasta);
  const anio = new Date(informe.desde).getFullYear();
  return `${anio} · ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

export type AtajoRango = {
  etiqueta: string;
  desde: string;
  hasta: string;
};

/**
 * Los periodos que se piden siempre, a un clic.
 *
 * El calendario permite cualquier rango, pero la verdad es que casi todos los
 * informes son de la semana en curso o la anterior. Que eso siga siendo un
 * boton y no dos fechas que escribir es la diferencia entre una pantalla
 * flexible y una incomoda.
 */
export function atajosDeRango(hoy = new Date()): AtajoRango[] {
  const estaSemana = lunesDe(hoy);

  const semanaPasada = new Date(estaSemana);
  semanaPasada.setDate(semanaPasada.getDate() - 7);

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  // Dia 0 del mes siguiente es el ultimo del actual, sin tabla de meses.
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

  return [
    {
      etiqueta: "Esta semana",
      desde: paraInput(estaSemana),
      hasta: paraInput(domingoDe(estaSemana)),
    },
    {
      etiqueta: "Semana pasada",
      desde: paraInput(semanaPasada),
      hasta: paraInput(domingoDe(semanaPasada)),
    },
    {
      etiqueta: "Este mes",
      desde: paraInput(inicioMes),
      hasta: paraInput(finMes),
    },
  ];
}
