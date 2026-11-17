import { jsPDF } from "jspdf";
import type { Informe } from "../types";
import {
  esSemanaExacta,
  esSemanaIso,
  paraInput,
  tituloInforme,
} from "./semanas";

// Medidas en milimetros, que es la unidad del documento.
const MARGEN = 18;
const ANCHO_PAGINA = 210; // A4 vertical
const ALTO_PAGINA = 297;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const LIMITE_INFERIOR = ALTO_PAGINA - MARGEN;

const COLOR_PRIMARIO: [number, number, number] = [29, 30, 28]; // --primary-color
const COLOR_SECUNDARIO: [number, number, number] = [175, 145, 80]; // --secondary-color
const COLOR_SUAVE: [number, number, number] = [110, 110, 110];

/**
 * Como se nombra el periodo en el pie y en el archivo descargado.
 *
 * Para una semana es su clave de siempre. Para un periodo libre son las dos
 * fechas con guiones: la clave interna ("2611281205") serviria para que el
 * nombre fuera unico, pero "informe-2611281205.pdf" en la carpeta de
 * descargas no le dice nada a nadie.
 */
function nombrePeriodo(informe: Informe): string {
  if (esSemanaIso(informe.semana)) return informe.semana;

  // Con `paraInput` y no con `toISOString()`: el termino del periodo son las
  // 23:59 locales, que en UTC ya es el dia siguiente. El nombre del archivo
  // diria un dia de mas.
  return `${paraInput(new Date(informe.desde))}_a_${paraInput(
    new Date(informe.hasta)
  )}`;
}

export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Arma el PDF del informe y lo descarga.
 *
 * Se dibuja a mano en vez de capturar la pantalla: asi el PDF sale con texto
 * de verdad (se puede buscar y copiar) y no depende de como se vea el
 * navegador de quien lo descarga.
 */
export function descargarInformePdf(informe: Informe): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGEN;

  /** Salta de pagina si lo que viene no cabe. */
  const asegurarEspacio = (alto: number) => {
    if (y + alto <= LIMITE_INFERIOR) return;
    doc.addPage();
    y = MARGEN;
  };

  const titulo = (texto: string) => {
    asegurarEspacio(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_SECUNDARIO);
    doc.text(texto.toUpperCase(), MARGEN, y);
    y += 6;
    doc.setTextColor(...COLOR_PRIMARIO);
  };

  const parrafo = (texto: string, tamano = 10) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(tamano);
    const lineas = doc.splitTextToSize(texto, ANCHO_UTIL) as string[];
    const altoLinea = tamano * 0.5;

    for (const linea of lineas) {
      asegurarEspacio(altoLinea);
      doc.text(linea, MARGEN, y);
      y += altoLinea;
    }
  };

  // Se pregunta por las fechas y no por la forma de la clave: un informe que
  // alguien pidio de lunes a domingo es una semana aunque su clave sea de
  // fechas (ver `esSemanaExacta`). Si se mirara la clave, el PDF diria "el
  // periodo" mientras el texto que redacto la IA adentro dice "la semana".
  const esSemana = esSemanaExacta(informe.desde, informe.hasta);

  // ---------- Encabezado ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...COLOR_PRIMARIO);
  // El titulo depende del periodo: "semanal" solo si de verdad lo es. Un
  // informe de dos meses titulado "Informe semanal" es un error en un
  // documento que se manda por correo.
  doc.text(
    esSemana ? "Informe semanal de tareas" : "Informe de tareas",
    MARGEN,
    y
  );
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLOR_SUAVE);
  doc.text(
    `${tituloInforme(informe)}  ·  ${fechaCorta(informe.desde)} al ${fechaCorta(
      informe.hasta
    )}`,
    MARGEN,
    y
  );
  y += 5;

  const origen = informe.generadoAuto
    ? "Generado automaticamente"
    : `Generado por ${informe.generadoPor ?? "un usuario"}`;
  doc.text(`${origen} el ${fechaCorta(informe.generadoEn)}`, MARGEN, y);
  y += 4;

  doc.setDrawColor(...COLOR_SECUNDARIO);
  doc.setLineWidth(0.5);
  doc.line(MARGEN, y, ANCHO_PAGINA - MARGEN, y);
  y += 8;
  doc.setTextColor(...COLOR_PRIMARIO);

  // ---------- Cifras ----------
  const { totales, atrasadas } = informe.datos;

  // Un informe de dos meses encabezado "Cifras de la semana" contradice al
  // propio texto del informe, que habla del periodo. El campo del JSON sigue
  // llamandose `completadasEnLaSemana` por compatibilidad, pero lo que cuenta
  // es el periodo del informe, sea cual sea.
  const periodo = esSemana ? "la semana" : "el periodo";

  titulo(`Cifras de ${periodo}`);
  parrafo(
    [
      `Tareas con vencimiento en ${periodo}: ${totales.total}`,
      `Completadas: ${totales.completadas}   En proceso: ${totales.enProceso}   Pendientes: ${totales.pendientes}   Vencidas: ${totales.vencidas}`,
      `Cerradas durante ${periodo}: ${informe.datos.completadasEnLaSemana}`,
      `Atrasadas al generar el informe: ${atrasadas.total} (criticas: ${atrasadas.criticas}, sin responsable: ${atrasadas.sinResponsable})`,
    ].join("\n")
  );
  y += 4;

  // ---------- Por area ----------
  if (informe.datos.porArea.length > 0) {
    titulo("Por area");
    for (const fila of informe.datos.porArea) {
      parrafo(
        `${fila.area}: ${fila.conteo.total} tareas — ${fila.conteo.completadas} completadas, ${fila.conteo.enProceso} en proceso, ${fila.conteo.pendientes} pendientes, ${fila.conteo.vencidas} vencidas`
      );
    }
    y += 4;
  }

  // ---------- Por responsable ----------
  if (informe.datos.porTrabajador.length > 0) {
    titulo("Por responsable");
    for (const p of informe.datos.porTrabajador) {
      parrafo(
        `${p.nombre}: ${p.conteo.total} tareas — ${p.conteo.completadas} completadas, ${p.conteo.vencidas} vencidas`,
        9
      );
    }
    y += 4;
  }

  // ---------- El texto de la IA ----------
  // Viene en texto plano con titulos en MAYUSCULAS, asi que esas lineas se
  // destacan como subtitulos y el resto va como parrafo normal.
  titulo("Analisis");
  for (const linea of informe.resumen.split("\n")) {
    const limpia = linea.trim();

    if (!limpia) {
      y += 2;
      continue;
    }

    const esTitulo = limpia === limpia.toUpperCase() && limpia.length < 60;

    if (esTitulo) {
      asegurarEspacio(8);
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(limpia, MARGEN, y);
      y += 5;
    } else {
      parrafo(limpia);
    }
  }

  // ---------- Tareas atrasadas ----------
  if (atrasadas.detalle.length > 0) {
    y += 4;
    titulo("Tareas atrasadas");

    if (atrasadas.total > atrasadas.detalle.length) {
      doc.setTextColor(...COLOR_SUAVE);
      parrafo(
        `Se listan las ${atrasadas.detalle.length} con mas dias de atraso, de un total de ${atrasadas.total}.`,
        9
      );
      doc.setTextColor(...COLOR_PRIMARIO);
      y += 2;
    }

    for (const t of atrasadas.detalle) {
      parrafo(
        `${t.diasAtraso} dias — ${t.tarea} (${t.area}) — ${t.responsable}${
          t.cliente ? ` — cliente ${t.cliente}` : ""
        }`,
        9
      );
    }
  }

  // ---------- Pie en cada pagina ----------
  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_SUAVE);
    doc.text(
      `Intranet Cintax · Informe ${nombrePeriodo(informe)} · Pagina ${i} de ${paginas}`,
      MARGEN,
      ALTO_PAGINA - 10
    );
  }

  doc.save(`informe-${nombrePeriodo(informe)}.pdf`);
}
