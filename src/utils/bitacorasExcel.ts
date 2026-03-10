// src/utils/bitacorasExcel.ts
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { Bitacora } from "../types/bitacora";

function fmtDateCL(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtTimeCL(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateTimeCL(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseIsoTime(s?: string) {
  const t = new Date(s || "");
  const ms = t.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function htmlToReadableText(html: string) {
  if (typeof document === "undefined") return html || "";

  const div = document.createElement("div");
  div.innerHTML = html || "";

  div.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));

  div.querySelectorAll("li").forEach((li) => {
    const text = li.textContent?.trim() || "";
    li.textContent = text ? `• ${text}\n` : "\n";
  });

  div.querySelectorAll("p, blockquote, h1, h2, h3, pre").forEach((el) => {
    if (el.textContent && !el.textContent.endsWith("\n")) {
      el.appendChild(document.createTextNode("\n"));
    }
  });

  return (div.textContent || div.innerText || "")
    .replace(/\u00A0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function autoFitColumns(worksheet: ExcelJS.Worksheet, min = 12, max = 80) {
  worksheet.columns?.forEach((column) => {
    let length = min;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value == null ? "" : String(cell.value);
      const longestLine = Math.max(...value.split("\n").map((line) => line.length), 0);
      length = Math.max(length, longestLine + 2);
    });

    column.width = Math.min(length, max);
  });
}

function applyTitle(row: ExcelJS.Row, fillColor = "1F4E78") {
  row.height = 24;

  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 13,
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFFFFFF" } },
      left: { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
      right: { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });
}

function applyHeader(row: ExcelJS.Row, fillColor = "D9EAF7") {
  row.height = 22;

  row.eachCell((cell) => {
    cell.font = {
      bold: true,
      color: { argb: "1F1F1F" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillColor },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "B7C9D6" } },
      left: { style: "thin", color: { argb: "B7C9D6" } },
      bottom: { style: "thin", color: { argb: "B7C9D6" } },
      right: { style: "thin", color: { argb: "B7C9D6" } },
    };
  });
}

function applyBodyBorders(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: "thin", color: { argb: "E5E7EB" } },
      left: { style: "thin", color: { argb: "E5E7EB" } },
      bottom: { style: "thin", color: { argb: "E5E7EB" } },
      right: { style: "thin", color: { argb: "E5E7EB" } },
    };
    cell.alignment = {
      vertical: "top",
      wrapText: true,
    };
  });
}

function paintZebraRow(row: ExcelJS.Row, even: boolean) {
  if (!even) return;

  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F8FBFF" },
    };
  });
}

export async function exportBitacorasToExcelStyled(rows: Bitacora[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ChatGPT";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sortedRows = [...rows].sort((a, b) => {
    const au = parseIsoTime(a.updatedAt || a.fecha);
    const bu = parseIsoTime(b.updatedAt || b.fecha);
    if (bu !== au) return bu - au;

    const af = parseIsoTime(a.fecha);
    const bf = parseIsoTime(b.fecha);
    if (bf !== af) return bf - af;

    return (b.id || 0) - (a.id || 0);
  });

  const grouped = new Map<
    string,
    {
      trabajador: string;
      total: number;
      ultimaFechaIso: string;
      ultimaActualizacionIso: string;
      conTitulo: number;
      sinTitulo: number;
    }
  >();

  for (const b of sortedRows) {
    const trabajador = b.trabajador?.nombre?.trim() || "Sin nombre";
    const updatedIso = b.updatedAt || b.fecha || "";
    const current = grouped.get(trabajador);

    if (!current) {
      grouped.set(trabajador, {
        trabajador,
        total: 1,
        ultimaFechaIso: b.fecha || "",
        ultimaActualizacionIso: updatedIso,
        conTitulo: b.titulo?.trim() ? 1 : 0,
        sinTitulo: b.titulo?.trim() ? 0 : 1,
      });
    } else {
      current.total += 1;
      if (b.titulo?.trim()) current.conTitulo += 1;
      else current.sinTitulo += 1;

      if (parseIsoTime(updatedIso) > parseIsoTime(current.ultimaActualizacionIso)) {
        current.ultimaActualizacionIso = updatedIso;
        current.ultimaFechaIso = b.fecha || current.ultimaFechaIso;
      }
    }
  }

  const resumenData = Array.from(grouped.values()).sort((a, b) =>
    a.trabajador.localeCompare(b.trabajador, "es")
  );

  const totalBitacoras = sortedRows.length;
  const totalTrabajadores = resumenData.length;
  const bitacorasConTitulo = sortedRows.filter((b) => !!b.titulo?.trim()).length;
  const bitacorasSinTitulo = totalBitacoras - bitacorasConTitulo;

  // =========================
  // HOJA 1: RESUMEN
  // =========================
  const wsResumen = workbook.addWorksheet("Resumen por persona", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  wsResumen.mergeCells("A1:F1");
  wsResumen.getCell("A1").value = "BITÁCORAS DEL EQUIPO - RESUMEN POR PERSONA";
  applyTitle(wsResumen.getRow(1));

  wsResumen.mergeCells("A2:F2");
  wsResumen.getCell("A2").value = `Generado el: ${fmtDateTimeCL(new Date().toISOString())}`;
  wsResumen.getCell("A2").font = { italic: true, color: { argb: "555555" } };

  wsResumen.addRow([]);
  wsResumen.addRow([
    "Trabajador",
    "Total bitácoras",
    "Con título",
    "Sin título",
    "Última fecha",
    "Última actualización",
  ]);

  applyHeader(wsResumen.getRow(4), "CFE8F6");

  resumenData.forEach((r, index) => {
    const row = wsResumen.addRow([
      r.trabajador,
      r.total,
      r.conTitulo,
      r.sinTitulo,
      fmtDateCL(r.ultimaFechaIso),
      fmtDateTimeCL(r.ultimaActualizacionIso),
    ]);

    applyBodyBorders(row);
    paintZebraRow(row, index % 2 === 1);

    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
  });

  wsResumen.autoFilter = "A4:F4";
  autoFitColumns(wsResumen);

  // =========================
  // HOJA 2: DETALLE
  // =========================
  const wsDetalle = workbook.addWorksheet("Detalle completo", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  wsDetalle.mergeCells("A1:G1");
  wsDetalle.getCell("A1").value = "BITÁCORAS DEL EQUIPO - DETALLE COMPLETO";
  applyTitle(wsDetalle.getRow(1), "2F6B3A");

  wsDetalle.mergeCells("A2:G2");
  wsDetalle.getCell("A2").value = `Generado el: ${fmtDateTimeCL(new Date().toISOString())}`;
  wsDetalle.getCell("A2").font = { italic: true, color: { argb: "555555" } };

  wsDetalle.addRow([]);
  wsDetalle.addRow([
    "ID",
    "Trabajador",
    "Fecha bitácora",
    "Hora actualización",
    "Fecha actualización completa",
    "Título",
    "Contenido",
  ]);

  applyHeader(wsDetalle.getRow(4), "D9F2E3");

  sortedRows.forEach((b, index) => {
    const row = wsDetalle.addRow([
      b.id,
      b.trabajador?.nombre?.trim() || "Sin nombre",
      fmtDateCL(b.fecha),
      fmtTimeCL(b.updatedAt || b.fecha),
      fmtDateTimeCL(b.updatedAt || b.fecha),
      b.titulo?.trim() || "Sin título",
      htmlToReadableText(b.contenido),
    ]);

    applyBodyBorders(row);
    paintZebraRow(row, index % 2 === 1);

    row.height = 42;
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(5).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    const tituloCell = row.getCell(6);
    if ((b.titulo?.trim() || "") !== "") {
      tituloCell.font = { bold: true, color: { argb: "1F4E78" } };
    }

    const contenidoCell = row.getCell(7);
    contenidoCell.alignment = { vertical: "top", wrapText: true };

    if ((b.titulo?.trim() || "") === "") {
      tituloCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF4E5" },
      };
      tituloCell.font = { italic: true, color: { argb: "9A6700" } };
    }
  });

  wsDetalle.autoFilter = "A4:G4";
  wsDetalle.columns = [
    { width: 10 },
    { width: 28 },
    { width: 16 },
    { width: 18 },
    { width: 24 },
    { width: 30 },
    { width: 90 },
  ];

  // =========================
  // HOJA 3: MÉTRICAS
  // =========================
  const wsMetricas = workbook.addWorksheet("Métricas", {
    views: [{ state: "frozen", ySplit: 3 }],
  });

  wsMetricas.mergeCells("A1:B1");
  wsMetricas.getCell("A1").value = "BITÁCORAS DEL EQUIPO - MÉTRICAS";
  applyTitle(wsMetricas.getRow(1), "7A3E00");

  wsMetricas.addRow([]);
  wsMetricas.addRow(["Indicador", "Valor"]);
  applyHeader(wsMetricas.getRow(3), "FCE4D6");

  const metricRows = [
    ["Total de bitácoras", totalBitacoras],
    ["Total de trabajadores con bitácoras", totalTrabajadores],
    ["Bitácoras con título", bitacorasConTitulo],
    ["Bitácoras sin título", bitacorasSinTitulo],
  ];

  metricRows.forEach((item, index) => {
    const row = wsMetricas.addRow(item);
    applyBodyBorders(row);
    paintZebraRow(row, index % 2 === 1);
    row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
  });

  wsMetricas.columns = [{ width: 38 }, { width: 16 }];

  const buffer = await workbook.xlsx.writeBuffer();

  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");

  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `bitacoras_equipo_${y}-${m}-${d}.xlsx`
  );
}