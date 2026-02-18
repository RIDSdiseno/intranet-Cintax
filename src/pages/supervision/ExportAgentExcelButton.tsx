// src/components/supervision/ExportAgentExcelButton.tsx
import React, { useMemo } from "react";
import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import type { TareaFull } from "../../lib/api";

type EstadoEmpresa = "VENCIDA" | "PENDIENTE" | "EN_PROCESO" | "COMPLETADA";

type EmpresaStat = {
  rut: string;
  razonSocial: string;
  pendientes: number;
  enProceso: number;
  vencidas: number;
  completadas: number;
  porVencer: number;
  total: number;
};

type Props = {
  disabled?: boolean;
  periodoLabel: string;
  agenteNombre: string;
  estadoFilter: "ALL" | EstadoEmpresa;
  empresaSearch: string;

  empresasFiltradas: EmpresaStat[];

  // detalle opcional
  empresaSeleccionadaRut: string | null;
  tareasAgenteFiltradas: TareaFull[];

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

  // Header row
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

  // Body rows (zebra + borders)
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as any;
      if (!cell) continue;

      const isEven = (r - (range.s.r + 1)) % 2 === 0;
      cell.s = {
        font: { color: { rgb: "111827" } },
        alignment: { vertical: "center", horizontal: "left", wrapText: true },
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

function estadoEmpresaDesdeCounts(e: EmpresaStat): EstadoEmpresa | "MIXTA" {
  const abiertos = (e.pendientes || 0) + (e.enProceso || 0) + (e.vencidas || 0);
  if (abiertos === 0 && (e.completadas || 0) > 0) return "COMPLETADA";
  if ((e.vencidas || 0) > 0) return "VENCIDA";
  if ((e.enProceso || 0) > 0) return "EN_PROCESO";
  if ((e.pendientes || 0) > 0) return "PENDIENTE";
  return "MIXTA";
}

export default function ExportAgentExcelButton({
  disabled,
  periodoLabel,
  agenteNombre,
  estadoFilter,
  empresaSearch,
  empresasFiltradas,
  empresaSeleccionadaRut,
  tareasAgenteFiltradas,
  formatFecha,
}: Props) {
  const fileName = useMemo(() => {
    const filt = estadoFilter === "ALL" ? "ALL" : estadoFilter;
    return `Supervision_Agente_${agenteNombre}_${periodoLabel}_${filt}_${toIsoLocalFilename()}.xlsx`;
  }, [agenteNombre, periodoLabel, estadoFilter]);

  const onExport = () => {
    const wb = XLSX.utils.book_new();

    // ===== Resumen =====
    const resumenRows = [
      { Campo: "Periodo", Valor: periodoLabel },
      { Campo: "Agente", Valor: agenteNombre || "-" },
      { Campo: "Filtro estado", Valor: estadoFilter === "ALL" ? "Sin filtro" : estadoFilter },
      { Campo: "Buscar empresa", Valor: empresaSearch?.trim() || "-" },
      { Campo: "Empresas visibles", Valor: empresasFiltradas.length },
      { Campo: "Tareas (agente)", Valor: tareasAgenteFiltradas.length },
      { Campo: "Exportado", Valor: new Date().toLocaleString("es-CL") },
    ];

    const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
    applyTableStyles(wsResumen, "AF9150", [22, 60]);
    XLSX.utils.book_append_sheet(wb, wsResumen, safeSheetName("Resumen"));

    // ===== Empresas =====
    const empresasRows = (empresasFiltradas || []).map((e) => {
      const estado = estadoEmpresaDesdeCounts(e);
      return {
        RUT: e.rut,
        "Razón social": e.razonSocial,
        Estado: estado,
        Pendientes: e.pendientes || 0,
        "En proceso": e.enProceso || 0,
        Vencidas: e.vencidas || 0,
        Completadas: e.completadas || 0,
        "Por vencer": e.porVencer || 0,
        Total: e.total || 0,
      };
    });

    const wsEmpresas = XLSX.utils.json_to_sheet(empresasRows);
    applyTableStyles(wsEmpresas, "111827", [14, 40, 14, 12, 12, 12, 14, 12, 10]);
    // Estado col = 2 (0-based)
    colorizeColumnByEstado(wsEmpresas, 2);
    XLSX.utils.book_append_sheet(wb, wsEmpresas, safeSheetName("Empresas"));

    // ===== Detalle empresa seleccionada =====
    if (empresaSeleccionadaRut) {
      const tareasEmpresa = (tareasAgenteFiltradas as any[]).filter((t) => (t.rutCliente || "SIN_RUT") === empresaSeleccionadaRut);

      const detRows = tareasEmpresa.map((t: any) => ({
        ID: t.id_tarea_asignada ?? "",
        RUT: t.rutCliente ?? "",
        Estado: t.estado ?? "",
        "Fecha programada": formatFecha(t.fechaProgramada ?? null),
        "Fecha compleción": formatFecha(getFechaComplecion(t)),
        "Código": t.tareaPlantilla?.codigoDocumento ?? "-",
        "Área": t.tareaPlantilla?.area ?? "-",
        Tarea: t.tareaPlantilla?.nombre ?? "-",
        Comentarios: t.comentarios ?? "",
      }));

      const wsDet = XLSX.utils.json_to_sheet(detRows);
      applyTableStyles(wsDet, "0EA5E9", [10, 14, 14, 18, 18, 14, 14, 40, 50]);
      colorizeColumnByEstado(wsDet, 2);
      XLSX.utils.book_append_sheet(wb, wsDet, safeSheetName(`Detalle_${empresaSeleccionadaRut}`));
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
      title="Exportar Excel (respeta filtros activos)"
    >
      Exportar Excel
    </button>
  );
}
