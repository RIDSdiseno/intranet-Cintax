// src/components/supervision/ExportTaskExcelButton.tsx
import React, { useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import type { TareaFull } from "../../lib/api";

type EstadoEmpresa = "VENCIDA" | "PENDIENTE" | "EN_PROCESO" | "COMPLETADA" | "NO_INICIADA";

type TaskMeta =
  | { nombre: string; codigo: string; area: string; total: number; key: string }
  | null
  | undefined;

type RowEmpresa = {
  rut: string;
  razonSocial: string;
  estado: EstadoEmpresa;
  fechaComprometida: string | null;
  atrasoDias: number | null;
  abiertas: number;
  agentes: Array<{ trabajadorId: number; nombre: string; abiertas: number }>;
  tareas: TareaFull[];
};

type EmpresaSinTarea = {
  rut: string;
  razonSocial: string;
};

type GroupedByAgente = Array<{
  trabajadorId: number;
  nombre: string;
  tareas: TareaFull[];
}>;

type Props = {
  disabled?: boolean;
  periodoLabel: string;
  selectedTaskMeta: TaskMeta;
  estadoFilter: "ALL" | EstadoEmpresa;
  empresaSearch: string;

  empresasFiltradas: RowEmpresa[];
  empresasSinTarea: EmpresaSinTarea[];

  detalleEmpresa: RowEmpresa | null;
  groupedByAgente: GroupedByAgente;

  formatFecha: (iso?: string | null) => string;
};

function safeSheetName(name: string) {
  return name.replace(/[:\\/?*\[\]]/g, " ").slice(0, 31).trim() || "Hoja";
}

function toIsoLocalFilename() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes()
  )}`;
}

const BORDER_ALL = {
  top: { style: "thin", color: { rgb: "D1D5DB" } },
  bottom: { style: "thin", color: { rgb: "D1D5DB" } },
  left: { style: "thin", color: { rgb: "D1D5DB" } },
  right: { style: "thin", color: { rgb: "D1D5DB" } },
};

function applyTableStyles(ws: XLSX.WorkSheet, headerFillRgb: string, colWidths: number[]) {
  const ref = (ws as any)["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);

  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
    const cell = ws[addr] as any;
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { patternType: "solid", fgColor: { rgb: headerFillRgb } },
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      border: BORDER_ALL,
    } as any;
  }

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as any;
      if (!cell) continue;

      const isEven = (r - (range.s.r + 1)) % 2 === 0;
      cell.s = {
        font: { color: { rgb: "111827" } },
        alignment: { vertical: "center", horizontal: c === 0 ? "left" : "left", wrapText: true },
        fill: isEven
          ? { patternType: "solid", fgColor: { rgb: "F9FAFB" } }
          : { patternType: "solid", fgColor: { rgb: "FFFFFF" } },
        border: BORDER_ALL,
      } as any;
    }
  }

  (ws as any)["!cols"] = colWidths.map((wch) => ({ wch }));
  (ws as any)["!freeze"] = { xSplit: 0, ySplit: 1 };
  (ws as any)["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
  (ws as any)["!rows"] = (ws as any)["!rows"] || [];
  (ws as any)["!rows"][0] = { hpt: 22 };
}

function estadoFill(estado: string | null | undefined) {
  if (estado === "VENCIDA") return "FEE2E2";
  if (estado === "PENDIENTE") return "FEF3C7";
  if (estado === "EN_PROCESO") return "DBEAFE";
  if (estado === "COMPLETADA") return "DCFCE7";
  if (estado === "NO_INICIADA") return "E2E8F0";
  return null;
}

function colorizeColumnByEstado(ws: XLSX.WorkSheet, estadoColIndex: number) {
  const ref = (ws as any)["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);

  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ r, c: estadoColIndex });
    const cell = ws[addr] as any;
    if (!cell) continue;

    const fillRgb = estadoFill(cell.v);
    if (!fillRgb) continue;

    cell.s = {
      ...(cell.s || {}),
      fill: { patternType: "solid", fgColor: { rgb: fillRgb } },
      border: BORDER_ALL,
      alignment: { vertical: "center", horizontal: "center", wrapText: true },
      font: { bold: true, color: { rgb: "111827" } },
    } as any;
  }
}

function getFechaComplecion(t: any): string | null {
  return t?.fechaComplecion || t?.fechaCompletada || t?.fechaCierre || t?.updatedAt || null;
}

export default function ExportTaskExcelButton({
  disabled,
  periodoLabel,
  selectedTaskMeta,
  estadoFilter,
  empresaSearch,
  empresasFiltradas,
  empresasSinTarea,
  detalleEmpresa,
  groupedByAgente,
  formatFecha,
}: Props) {
  const fileName = useMemo(() => {
    const tareaName = selectedTaskMeta?.nombre ? selectedTaskMeta.nombre.slice(0, 40) : "SinTarea";
    const filt = estadoFilter === "ALL" ? "ALL" : estadoFilter;
    return `Supervision_Tarea_${tareaName}_${periodoLabel}_${filt}_${toIsoLocalFilename()}.xlsx`;
  }, [selectedTaskMeta, periodoLabel, estadoFilter]);

  const onExport = () => {
    const wb = XLSX.utils.book_new();

    const resumenRows = [
      { Campo: "Periodo", Valor: periodoLabel },
      { Campo: "Tarea", Valor: selectedTaskMeta?.nombre || "-" },
      { Campo: "Área", Valor: selectedTaskMeta?.area || "-" },
      { Campo: "Código", Valor: selectedTaskMeta?.codigo || "-" },
      { Campo: "Filtro estado", Valor: estadoFilter === "ALL" ? "Sin filtro" : estadoFilter },
      { Campo: "Buscar empresa", Valor: empresaSearch?.trim() || "-" },
      { Campo: "Empresas con tarea", Valor: empresasFiltradas.length },
      { Campo: "Empresas sin tarea y sin agente", Valor: empresasSinTarea.length },
      { Campo: "Exportado", Valor: new Date().toLocaleString("es-CL") },
    ];

    const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
    applyTableStyles(wsResumen, "AF9150", [30, 60]);
    XLSX.utils.book_append_sheet(wb, wsResumen, safeSheetName("Resumen"));

    const empresasRows = (empresasFiltradas || []).map((e) => ({
      RUT: e.rut,
      "Razón social": e.razonSocial,
      Estado: e.estado,
      "Fecha comprometida": e.fechaComprometida ? formatFecha(e.fechaComprometida) : "-",
      "Atraso (días)": e.atrasoDias ?? "",
      Abiertas: e.abiertas,
      "Agentes (top)": (e.agentes || []).length
        ? (e.agentes || [])
            .slice(0, 3)
            .map((a) => `${a.nombre} (${a.abiertas})`)
            .join(" | ")
        : "Sin agente",
    }));

    const wsEmpresas = XLSX.utils.json_to_sheet(empresasRows);
    applyTableStyles(wsEmpresas, "111827", [14, 40, 14, 18, 12, 10, 50]);
    colorizeColumnByEstado(wsEmpresas, 2);
    XLSX.utils.book_append_sheet(wb, wsEmpresas, safeSheetName("Empresas_con_tarea"));

    const empresasSinRows = (empresasSinTarea || []).map((e) => ({
      RUT: e.rut,
      "Razón social": e.razonSocial,
      Estado: "NO_INICIADA",
      "Tiene tarea": "No",
      "Tiene agente": "No",
    }));

    const wsSin = XLSX.utils.json_to_sheet(empresasSinRows);
    applyTableStyles(wsSin, "92400E", [14, 40, 14, 14, 14]);
    colorizeColumnByEstado(wsSin, 2);
    XLSX.utils.book_append_sheet(wb, wsSin, safeSheetName("Empresas_sin_tarea"));

    if (detalleEmpresa) {
      const tareasDet = (detalleEmpresa.tareas || []).map((t: any) => ({
        ID: t.id_tarea_asignada ?? "",
        RUT: t.rutCliente ?? "",
        Estado: t.estado ?? "",
        "Fecha programada": formatFecha(t.fechaProgramada ?? null),
        "Fecha compleción": formatFecha(getFechaComplecion(t)),
        Código: t.tareaPlantilla?.codigoDocumento ?? "-",
        Área: t.tareaPlantilla?.area ?? "-",
        Tarea: t.tareaPlantilla?.nombre ?? "-",
        Comentarios: t.comentarios ?? "",
        "Trabajador ID": t.trabajadorId ?? "",
      }));

      const wsDet = XLSX.utils.json_to_sheet(tareasDet);
      applyTableStyles(wsDet, "0EA5E9", [10, 14, 14, 18, 18, 14, 14, 40, 50, 14]);
      colorizeColumnByEstado(wsDet, 2);
      XLSX.utils.book_append_sheet(wb, wsDet, safeSheetName(`Detalle_${detalleEmpresa.rut}`));
    }

    if (detalleEmpresa && groupedByAgente?.length) {
      const rows: any[] = [];
      groupedByAgente.forEach((g) => {
        (g.tareas as any[]).forEach((t) => {
          rows.push({
            Agente: g.nombre,
            ID: t.id_tarea_asignada ?? "",
            Estado: t.estado ?? "",
            "Fecha programada": formatFecha(t.fechaProgramada ?? null),
            "Fecha compleción": formatFecha(getFechaComplecion(t)),
            Código: t.tareaPlantilla?.codigoDocumento ?? "-",
            Área: t.tareaPlantilla?.area ?? "-",
            Tarea: t.tareaPlantilla?.nombre ?? "-",
          });
        });
      });

      const wsAg = XLSX.utils.json_to_sheet(rows);
      applyTableStyles(wsAg, "1F2937", [26, 10, 14, 18, 18, 14, 14, 40]);
      colorizeColumnByEstado(wsAg, 2);
      XLSX.utils.book_append_sheet(wb, wsAg, safeSheetName("Detalle_por_agente"));
    }

    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, fileName);
  };

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={!!disabled}
      className={`
        px-4 py-2 rounded-full text-xs font-semibold
        border border-black/10 bg-white text-[#1d1e1c]
        shadow-sm transition
        ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-[#af9150] active:scale-[0.99]"}
        focus:outline-none focus:ring-2 focus:ring-[#af9150]/40 focus:ring-offset-2
      `}
      title="Exportar Excel (incluye empresas con tarea y empresas sin tarea ni agente)"
    >
      Exportar Excel
    </button>
  );
}