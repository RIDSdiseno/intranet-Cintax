// src/pages/supervision/ExportAllTasksExcelButton.tsx
import React from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Download } from "lucide-react";
import type { ResumenAgente, TareaFull } from "../../lib/api";

type EstadoEmpresa =
  | "VENCIDA"
  | "PENDIENTE"
  | "EN_PROCESO"
  | "COMPLETADA"
  | "NO_INICIADA";

export type ExportEstadoFilter = "ALL" | EstadoEmpresa;

type TaskMeta = {
  key: string;
  nombre: string;
  codigo: string;
  area: string;
  total: number;
};

type Props = {
  disabled?: boolean;
  periodoLabel: string;
  taskCatalog: TaskMeta[];
  carteraGlobal: Array<{ rut: string; razonSocial: string }>;
  tareasGlobalesFiltradas: TareaFull[];
  resumen: ResumenAgente[];
  formatFecha: (iso?: string | null) => string;
  exportEstadoFilter: ExportEstadoFilter;
};

function getTaskKey(t: TareaFull) {
  const pid = (t as any)?.tareaPlantilla?.id ?? (t as any)?.tareaPlantilla?.id_tarea_plantilla;
  const codigo = t.tareaPlantilla?.codigoDocumento || "SIN_CODIGO";
  const nombre = t.tareaPlantilla?.nombre || `Tarea #${(t as any)?.id_tarea_asignada ?? "-"}`;
  return String(pid ?? `${codigo}__${nombre}`);
}

function pickFechaMasProxima(isoList: Array<string | null | undefined>): string | null {
  const fechas = isoList
    .filter(Boolean)
    .map((iso) => new Date(String(iso)))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  return fechas[0] ? fechas[0].toISOString() : null;
}

function calcAtrasoDias(iso: string | null): number | null {
  if (!iso) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);

  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() >= hoy.getTime()) return 0;

  const diff = hoy.getTime() - d.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getFechaComplecion(t: any): string | null {
  return t?.fechaComplecion || t?.fechaCompletada || t?.fechaCierre || t?.updatedAt || null;
}

function resolveEstado(instancias: TareaFull[]): {
  estado: EstadoEmpresa;
  fechaComprometida: string | null;
  atrasoDias: number | null;
  abiertas: number;
} {
  if (!instancias.length) {
    return {
      estado: "NO_INICIADA",
      fechaComprometida: null,
      atrasoDias: null,
      abiertas: 0,
    };
  }

  const abiertasList = instancias.filter((x) => x.estado !== "COMPLETADA");
  const completadasList = instancias.filter((x) => x.estado === "COMPLETADA");

  if (abiertasList.length === 0 && completadasList.length > 0) {
    return {
      estado: "COMPLETADA",
      fechaComprometida: null,
      atrasoDias: 0,
      abiertas: 0,
    };
  }

  const estado: EstadoEmpresa =
    abiertasList.some((x) => x.estado === "VENCIDA")
      ? "VENCIDA"
      : abiertasList.some((x) => x.estado === "EN_PROCESO")
      ? "EN_PROCESO"
      : "PENDIENTE";

  const fecha = pickFechaMasProxima(abiertasList.map((x) => x.fechaProgramada));

  return {
    estado,
    fechaComprometida: fecha,
    atrasoDias: calcAtrasoDias(fecha),
    abiertas: abiertasList.length,
  };
}

function estadoFillColor(estado: EstadoEmpresa) {
  if (estado === "VENCIDA") return "FEE2E2";
  if (estado === "PENDIENTE") return "FEF3C7";
  if (estado === "NO_INICIADA") return "FFF7ED";
  if (estado === "EN_PROCESO") return "E2E8F0";
  return "DCFCE7";
}

function estadoFontColor(estado: EstadoEmpresa) {
  if (estado === "VENCIDA") return "B91C1C";
  if (estado === "PENDIENTE") return "92400E";
  if (estado === "NO_INICIADA") return "9A3412";
  if (estado === "EN_PROCESO") return "334155";
  return "166534";
}

export default function ExportAllTasksExcelButton({
  disabled,
  periodoLabel,
  taskCatalog,
  carteraGlobal,
  tareasGlobalesFiltradas,
  resumen,
  formatFecha,
  exportEstadoFilter,
}: Props) {
  const handleExport = async () => {
    const agentesMap = new Map<number, { nombre: string; email?: string }>();
    (resumen || []).forEach((r) => {
      agentesMap.set(r.trabajadorId, { nombre: r.nombre, email: r.email });
    });

    let rows: Array<Record<string, any>> = [];

    for (const task of taskCatalog) {
      for (const empresa of carteraGlobal) {
        const instancias = tareasGlobalesFiltradas.filter(
          (t) => getTaskKey(t) === task.key && (t.rutCliente || "SIN_RUT") === empresa.rut
        );

        const info = resolveEstado(instancias);

        const agentesCount = new Map<number, number>();
        for (const t of instancias.filter((x) => x.estado !== "COMPLETADA") as any[]) {
          const tid = t.trabajadorId;
          if (!tid) continue;
          agentesCount.set(tid, (agentesCount.get(tid) || 0) + 1);
        }

        const agentes = Array.from(agentesCount.entries())
          .map(([trabajadorId, abiertas]) => ({
            trabajadorId,
            abiertas,
            nombre: agentesMap.get(trabajadorId)?.nombre || `Agente #${trabajadorId}`,
          }))
          .sort((a, b) => b.abiertas - a.abiertas || a.nombre.localeCompare(b.nombre));

        const fechasComplecion = instancias
          .map((x: any) => getFechaComplecion(x))
          .filter(Boolean)
          .sort() as string[];

        rows.push({
          Periodo: periodoLabel,
          Area: task.area,
          Codigo: task.codigo,
          Tarea: task.nombre,
          RutEmpresa: empresa.rut,
          RazonSocial: empresa.razonSocial,
          Estado: info.estado,
          FechaComprometida: formatFecha(info.fechaComprometida),
          AtrasoDias: info.atrasoDias ?? "",
          Abiertas: info.abiertas,
          Agentes: agentes.length
            ? agentes.map((a) => `${a.nombre} (${a.abiertas})`).join(", ")
            : "-",
          TotalInstancias: instancias.length,
          Completadas: instancias.filter((x) => x.estado === "COMPLETADA").length,
          Pendientes: instancias.filter((x) => x.estado === "PENDIENTE").length,
          Vencidas: instancias.filter((x) => x.estado === "VENCIDA").length,
          EnProceso: instancias.filter((x) => x.estado === "EN_PROCESO").length,
          UltimaComplecion: formatFecha(fechasComplecion.length ? fechasComplecion[fechasComplecion.length - 1] : null),
        });
      }
    }

    if (exportEstadoFilter !== "ALL") {
      rows = rows.filter((r) => r.Estado === exportEstadoFilter);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "OpenAI";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Consolidado", {
      views: [{ state: "frozen", ySplit: 3 }],
    });

    const title = `Consolidado de tareas - ${periodoLabel}`;
    const subtitle =
      exportEstadoFilter === "ALL"
        ? "Estado exportado: Todas"
        : `Estado exportado: ${exportEstadoFilter}`;

    const headers = [
      "Periodo",
      "Area",
      "Codigo",
      "Tarea",
      "RutEmpresa",
      "RazonSocial",
      "Estado",
      "FechaComprometida",
      "AtrasoDias",
      "Abiertas",
      "Agentes",
      "TotalInstancias",
      "Completadas",
      "Pendientes",
      "Vencidas",
      "EnProceso",
      "UltimaComplecion",
    ];

    ws.mergeCells(1, 1, 1, headers.length);
    ws.getCell("A1").value = title;
    ws.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    ws.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
    ws.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1F2937" },
    };

    ws.mergeCells(2, 1, 2, headers.length);
    ws.getCell("A2").value = subtitle;
    ws.getCell("A2").font = { italic: true, color: { argb: "374151" } };
    ws.getCell("A2").alignment = { vertical: "middle", horizontal: "left" };

    ws.addRow(headers);

    const headerRow = ws.getRow(3);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "AF9150" },
    };
    headerRow.height = 20;

    rows.forEach((row) => {
      ws.addRow([
        row.Periodo,
        row.Area,
        row.Codigo,
        row.Tarea,
        row.RutEmpresa,
        row.RazonSocial,
        row.Estado,
        row.FechaComprometida,
        row.AtrasoDias,
        row.Abiertas,
        row.Agentes,
        row.TotalInstancias,
        row.Completadas,
        row.Pendientes,
        row.Vencidas,
        row.EnProceso,
        row.UltimaComplecion,
      ]);
    });

    const totalRows = ws.rowCount;

    for (let i = 4; i <= totalRows; i++) {
      const row = ws.getRow(i);
      const estado = String(row.getCell(7).value || "") as EstadoEmpresa;

      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin", color: { argb: "E5E7EB" } },
          left: { style: "thin", color: { argb: "E5E7EB" } },
          bottom: { style: "thin", color: { argb: "E5E7EB" } },
          right: { style: "thin", color: { argb: "E5E7EB" } },
        };
        cell.alignment = { vertical: "middle", wrapText: true };
      });

      const estadoCell = row.getCell(7);
      estadoCell.font = { bold: true, color: { argb: estadoFontColor(estado) } };
      estadoCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: estadoFillColor(estado) },
      };

      if (i % 2 === 0) {
        row.eachCell((cell, colNumber) => {
          if (colNumber !== 7) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FCFCFD" },
            };
          }
        });
      }
    }

    ws.autoFilter = {
      from: { row: 3, column: 1 },
      to: { row: totalRows, column: headers.length },
    };

    ws.columns = [
      { key: "Periodo", width: 18 },
      { key: "Area", width: 18 },
      { key: "Codigo", width: 16 },
      { key: "Tarea", width: 34 },
      { key: "RutEmpresa", width: 18 },
      { key: "RazonSocial", width: 34 },
      { key: "Estado", width: 16 },
      { key: "FechaComprometida", width: 18 },
      { key: "AtrasoDias", width: 12 },
      { key: "Abiertas", width: 10 },
      { key: "Agentes", width: 36 },
      { key: "TotalInstancias", width: 14 },
      { key: "Completadas", width: 12 },
      { key: "Pendientes", width: 12 },
      { key: "Vencidas", width: 12 },
      { key: "EnProceso", width: 12 },
      { key: "UltimaComplecion", width: 18 },
    ];

    const resumenWs = workbook.addWorksheet("Resumen");
    resumenWs.columns = [
      { header: "Estado", key: "estado", width: 18 },
      { header: "Cantidad", key: "cantidad", width: 14 },
    ];

    const resumenData = [
      "VENCIDA",
      "PENDIENTE",
      "EN_PROCESO",
      "NO_INICIADA",
      "COMPLETADA",
    ].map((estado) => ({
      estado,
      cantidad: rows.filter((r) => r.Estado === estado).length,
    }));

    resumenWs.mergeCells("A1:B1");
    resumenWs.getCell("A1").value = "Resumen por estado";
    resumenWs.getCell("A1").font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    resumenWs.getCell("A1").alignment = { horizontal: "center" };
    resumenWs.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "1F2937" },
    };

    resumenWs.addRow(["Estado", "Cantidad"]);
    const resumenHeader = resumenWs.getRow(2);
    resumenHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
    resumenHeader.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "AF9150" },
    };

    resumenData.forEach((item) => {
      const row = resumenWs.addRow([item.estado, item.cantidad]);
      row.getCell(1).font = { bold: true, color: { argb: estadoFontColor(item.estado as EstadoEmpresa) } };
      row.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: estadoFillColor(item.estado as EstadoEmpresa) },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    const safePeriodo = periodoLabel.replace(/[^\w-]+/g, "_");
    const safeEstado = exportEstadoFilter === "ALL" ? "todas" : exportEstadoFilter.toLowerCase();

    saveAs(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `supervision_tareas_${safeEstado}_${safePeriodo}.xlsx`
    );
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      className="px-4 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      title="Exportar tareas"
    >
      <Download className="w-4 h-4" />
      Exportar todas
    </button>
  );
}