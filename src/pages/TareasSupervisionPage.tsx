import React, { useCallback, useEffect, useMemo, useState } from "react";
import ApexChart from "react-apexcharts";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import {
  API_BASE_URL,
  fetchJSON,
  TareaFull,
  ResumenAgente,
} from "../components/supervision/api";
import AgenteModal from "../components/supervision/AgenteModal";
import { filtrarPorPeriodo, Periodo } from "../components/supervision/usePeriodo";

type RutCliente = { rut: string; razonSocial?: string | null };
type AgenteComparativa = ResumenAgente & {
  total: number;
  abiertas: number;
  cierre: number;
};

const DIAS_POR_VENCER = 3;

const SpinnerSmall: React.FC<{ label?: string }> = ({ label = "Cargando..." }) => (
  <div className="flex items-center gap-2 text-xs text-black/60">
    <div className="relative flex h-5 w-5 items-center justify-center">
      <span className="absolute inline-flex h-full w-full rounded-full bg-sky-200 opacity-60 animate-ping" />
      <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-sky-200 border-t-sky-600 animate-spin" />
    </div>
    <span className="animate-pulse">{label}</span>
  </div>
);

async function fetchDataAgente(trabajadorId: number): Promise<{
  tareas: TareaFull[];
  ruts: RutCliente[];
}> {
  const ruts = await fetchJSON<RutCliente[]>(
    `${API_BASE_URL}/tareas/mis-ruts?trabajadorId=${trabajadorId}`
  );
  const all: TareaFull[] = [];
  for (const item of ruts) {
    const rut = encodeURIComponent(item.rut);
    const tareas = await fetchJSON<TareaFull[]>(
      `${API_BASE_URL}/tareas/por-rut/${rut}?trabajadorId=${trabajadorId}`
    );
    all.push(...tareas);
  }
  return { tareas: all, ruts };
}

const TareasSupervisionPage: React.FC = () => {
  const [resumen, setResumen] = useState<ResumenAgente[]>([]);
  const [tareasCache, setTareasCache] = useState<Record<number, TareaFull[]>>({});
  const [rutsCache, setRutsCache] = useState<Record<number, RutCliente[]>>({});
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [selectedClientRut, setSelectedClientRut] = useState<string>("ALL");
  const [periodo, setPeriodo] = useState<Periodo>("actual");
  const [mesSelect, setMesSelect] = useState<number>(new Date().getMonth() + 1);
  const [anioSelect, setAnioSelect] = useState<number>(new Date().getFullYear());
  const [agenteDetalle, setAgenteDetalle] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [comparativaLoading, setComparativaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"dashboard" | "empresas" | "comparativa">(
    "dashboard"
  );
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [empresaPage, setEmpresaPage] = useState(1);
  const [empresaSeleccionadaRut, setEmpresaSeleccionadaRut] = useState<string | null>(
    null
  );
  const EMPRESAS_PAGE_SIZE = 12;
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSelection, setExportSelection] = useState<{
    target: "dashboard" | "empresas" | "comparativa";
    format: "excel" | "pdf";
  }>({
    target: "comparativa",
    format: "excel",
  });

  const loadResumen = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resResumen = await fetchJSON<ResumenAgente[]>(
        `${API_BASE_URL}/tareas/supervision/resumen`
      );
      setResumen(resResumen);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar supervisión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResumen();
  }, [loadResumen]);

  useEffect(() => {
    // Pre-carga datos de todos los agentes cuando entramos a comparativa.
    if (viewMode !== "comparativa") return;
    const missing = resumen
      .map((r) => r.trabajadorId)
      .filter((id) => !tareasCache[id]);
    if (missing.length === 0) return;

    setComparativaLoading(true);
    Promise.all(
      missing.map(async (id) => {
        try {
          const { tareas, ruts } = await fetchDataAgente(id);
          setTareasCache((prev) => ({ ...prev, [id]: tareas }));
          setRutsCache((prev) => ({ ...prev, [id]: ruts }));
        } catch (e) {
          console.error("Error cargando datos de agente para comparativa", e);
        }
      })
    ).finally(() => setComparativaLoading(false));
  }, [viewMode, resumen, tareasCache]);

  useEffect(() => {
    if (selectedAgentId === null) return;
    if (tareasCache[selectedAgentId] && rutsCache[selectedAgentId]) {
      setAgentLoading(false);
      return;
    }
    setAgentLoading(true);

    fetchDataAgente(selectedAgentId)
      .then(({ tareas, ruts }) => {
        setTareasCache((prev) => ({ ...prev, [selectedAgentId]: tareas }));
        setRutsCache((prev) => ({ ...prev, [selectedAgentId]: ruts }));
      })
      .catch((e) => console.error("Error cargando datos del agente", e))
      .finally(() => setAgentLoading(false));
  }, [selectedAgentId, tareasCache, rutsCache]);

  const tareasSeleccionadas = useMemo(() => {
    if (selectedAgentId === null) return [];
    const base = tareasCache[selectedAgentId] || [];
    const filtradas = filtrarPorPeriodo(base, periodo, mesSelect, anioSelect);
    if (selectedClientRut === "ALL") return filtradas;
    return filtradas.filter((t) => t.rutCliente === selectedClientRut);
  }, [selectedAgentId, tareasCache, periodo, mesSelect, anioSelect, selectedClientRut]);

  const clienteOptions = useMemo(() => {
    if (selectedAgentId === null) return [];
    const ruts = rutsCache[selectedAgentId] || [];
    return ruts;
  }, [selectedAgentId, rutsCache]);

  const globalKpis = useMemo(() => {
    if (selectedAgentId === null) {
      return { total: 0, pend: 0, proc: 0, venc: 0, comp: 0, porVencer: 0 };
    }

    let pend = 0,
      proc = 0,
      venc = 0,
      comp = 0,
      porVencer = 0;
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + DIAS_POR_VENCER);

    tareasSeleccionadas.forEach((t) => {
      if (t.estado === "PENDIENTE") pend++;
      else if (t.estado === "EN_PROCESO") proc++;
      else if (t.estado === "COMPLETADA") comp++;
      else if (t.estado === "VENCIDA") venc++;

      const fv = new Date(t.fechaProgramada);
      if (t.estado !== "COMPLETADA" && fv >= hoy && fv <= limite) porVencer++;
    });

    return { total: pend + proc + venc + comp, pend, proc, venc, comp, porVencer };
  }, [tareasSeleccionadas]);

  const donutSeries = [
    globalKpis.pend,
    globalKpis.proc,
    globalKpis.venc,
    globalKpis.comp,
    globalKpis.porVencer,
  ];
  const donutOptions = {
    labels: [
      "Pendiente",
      "En proceso",
      "Vencida",
      "Completada",
      `Por vencer (<=${DIAS_POR_VENCER}d)`,
    ],
    colors: ["#fbbf24", "#38bdf8", "#f97373", "#22c55e", "#fb923c"],
    legend: { position: "bottom" },
  };

  const lineData = useMemo(() => {
    const bucket = new Map<
      string,
      { fecha: string; PENDIENTE: number; EN_PROCESO: number; VENCIDA: number; COMPLETADA: number }
    >();
    tareasSeleccionadas.forEach((t) => {
      const key = (t.fechaProgramada || t.createdAt).slice(0, 10);
      if (!bucket.has(key)) {
        bucket.set(key, {
          fecha: key,
          PENDIENTE: 0,
          EN_PROCESO: 0,
          VENCIDA: 0,
          COMPLETADA: 0,
        });
      }
      bucket.get(key)![t.estado]++;
    });
    const arr = Array.from(bucket.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    return {
      categories: arr.map((d) => d.fecha),
      series: [
        { name: "Pendiente", data: arr.map((d) => d.PENDIENTE) },
        { name: "En proceso", data: arr.map((d) => d.EN_PROCESO) },
        { name: "Vencida", data: arr.map((d) => d.VENCIDA) },
        { name: "Completada", data: arr.map((d) => d.COMPLETADA) },
      ],
    };
  }, [tareasSeleccionadas]);

  const procesoAgentes = useMemo(() => {
    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + DIAS_POR_VENCER);

    if (selectedAgentId === null) return [];

    return resumen
      .filter((r) => r.trabajadorId === selectedAgentId)
      .map((r) => {
        const tareas = tareasSeleccionadas;
        const pendientes = tareas.filter(
          (t) => t.estado === "PENDIENTE" || t.estado === "EN_PROCESO"
        );
        const vencidas = tareas.filter((t) => t.estado === "VENCIDA");
        const porVencer = pendientes.filter((t) => {
          const fv = new Date(t.fechaProgramada);
          return fv >= hoy && fv <= limite;
        });
        const proximo =
          pendientes
            .map((t) => new Date(t.fechaProgramada))
            .filter((d) => !Number.isNaN(d.getTime()) && d >= hoy)
            .sort((a, b) => a.getTime() - b.getTime())[0] || null;

        const riesgoValor = vencidas.length * 2 + pendientes.length;
        const estado =
          riesgoValor > 10 ? "Crítico" : vencidas.length > 0 ? "Riesgo" : "Normal";

        return {
          ...r,
          pendientes: pendientes.length,
          vencidas: vencidas.length,
          porVencer: porVencer.length,
          proximoVenc: proximo ? proximo.toLocaleDateString() : "-",
          estadoProceso: estado,
        };
      });
  }, [resumen, tareasSeleccionadas, selectedAgentId]);

  const clientesHistogram = useMemo(() => {
    if (!selectedAgentId) {
      return { categories: [], pendientes: [], enProceso: [], vencidas: [], completadas: [] };
    }
    const map = new Map<
      string,
      { nombre: string; pendientes: number; enProceso: number; vencidas: number; completadas: number }
    >();
    const label = (rut?: string | null) => {
      const r = rut || "SIN_RUT";
      const found = clienteOptions.find((c) => c.rut === r);
      return found?.razonSocial || r;
    };

    tareasSeleccionadas.forEach((t) => {
      const rut = t.rutCliente || "SIN_RUT";
      if (!map.has(rut)) {
        map.set(rut, {
          nombre: label(rut),
          pendientes: 0,
          enProceso: 0,
          vencidas: 0,
          completadas: 0,
        });
      }
      const row = map.get(rut)!;
      if (t.estado === "PENDIENTE") row.pendientes += 1;
      else if (t.estado === "EN_PROCESO") row.enProceso += 1;
      else if (t.estado === "VENCIDA") row.vencidas += 1;
      else if (t.estado === "COMPLETADA") row.completadas += 1;
    });

    const arr = Array.from(map.values()).sort(
      (a, b) =>
        b.pendientes + b.enProceso + b.vencidas + b.completadas -
        (a.pendientes + a.enProceso + a.vencidas + a.completadas)
    );
    return {
      categories: arr.map((c) => c.nombre),
      pendientes: arr.map((c) => c.pendientes),
      enProceso: arr.map((c) => c.enProceso),
      vencidas: arr.map((c) => c.vencidas),
      completadas: arr.map((c) => c.completadas),
    };
  }, [tareasSeleccionadas, clienteOptions, selectedAgentId]);

  // Datos por empresa (cliente) para vista "empresas"
  const empresasStats = useMemo(() => {
    if (!selectedAgentId) return [];
    const mapa = new Map<
      string,
      {
        rut: string;
        razonSocial: string;
        pendientes: number;
        enProceso: number;
        vencidas: number;
        completadas: number;
        porVencer: number;
        total: number;
      }
    >();

    // arranca con la cartera conocida
    clienteOptions.forEach((c) => {
      mapa.set(c.rut, {
        rut: c.rut,
        razonSocial: c.razonSocial || c.rut,
        pendientes: 0,
        enProceso: 0,
        vencidas: 0,
        completadas: 0,
        porVencer: 0,
        total: 0,
      });
    });

    const hoy = new Date();
    const limite = new Date();
    limite.setDate(hoy.getDate() + DIAS_POR_VENCER);

    tareasSeleccionadas.forEach((t) => {
      const rut = t.rutCliente || "SIN_RUT";
      if (!mapa.has(rut)) {
        mapa.set(rut, {
          rut,
          razonSocial: rut,
          pendientes: 0,
          enProceso: 0,
          vencidas: 0,
          completadas: 0,
          porVencer: 0,
          total: 0,
        });
      }
      const m = mapa.get(rut)!;
      if (t.estado === "PENDIENTE") m.pendientes += 1;
      else if (t.estado === "EN_PROCESO") m.enProceso += 1;
      else if (t.estado === "VENCIDA") m.vencidas += 1;
      else if (t.estado === "COMPLETADA") m.completadas += 1;
      const fv = new Date(t.fechaProgramada);
      if (t.estado !== "COMPLETADA" && fv >= hoy && fv <= limite) m.porVencer += 1;
      m.total += 1;
    });

    return Array.from(mapa.values()).sort((a, b) =>
      a.razonSocial.localeCompare(b.razonSocial)
    );
  }, [selectedAgentId, clienteOptions, tareasSeleccionadas]);

  const empresasFiltradas = useMemo(() => {
    const term = empresaSearch.trim().toLowerCase();
    if (!term) return empresasStats;
    return empresasStats.filter(
      (e) =>
        e.rut.toLowerCase().includes(term) ||
        e.razonSocial.toLowerCase().includes(term)
    );
  }, [empresasStats, empresaSearch]);

  const totalEmpresas = empresasStats.length;
  const totalTareasEmpresas = empresasStats.reduce((acc, e) => acc + e.total, 0);
  const empresasPage = useMemo(() => {
    const start = (empresaPage - 1) * EMPRESAS_PAGE_SIZE;
    return empresasFiltradas.slice(start, start + EMPRESAS_PAGE_SIZE);
  }, [empresasFiltradas, empresaPage]);

  const periodoComparativa: Periodo =
    viewMode === "comparativa"
      ? periodo === "anio-especifico"
        ? "anio-especifico"
        : "mes-especifico"
      : periodo;

  const comparativaAgentes = useMemo<AgenteComparativa[]>(() => {
    const hoy = new Date();
    return resumen.map((r) => {
      const tareas = tareasCache[r.trabajadorId] || [];
      const tareasFiltradas =
        tareas.length > 0
          ? filtrarPorPeriodo(tareas, periodoComparativa, mesSelect, anioSelect)
          : [];

      const base =
        tareasFiltradas.length > 0
          ? tareasFiltradas.reduce(
              (acc, t) => {
                if (t.estado === "PENDIENTE") acc.pendientes += 1;
                else if (t.estado === "EN_PROCESO") acc.enProceso += 1;
                else if (t.estado === "VENCIDA") acc.vencidas += 1;
                else if (t.estado === "COMPLETADA") acc.completadas += 1;
                return acc;
              },
              { pendientes: 0, enProceso: 0, vencidas: 0, completadas: 0 }
            )
          : {
              pendientes: r.pendientes,
              enProceso: r.enProceso,
              vencidas: r.vencidas,
              completadas: r.completadas,
            };

      const total =
        base.pendientes + base.enProceso + base.vencidas + base.completadas;
      const abiertas = total - base.completadas;
      const cierre = total > 0 ? Math.round((base.completadas / total) * 100) : 0;

      return { ...r, ...base, total, abiertas, cierre };
    });
  }, [resumen, tareasCache, periodoComparativa, mesSelect, anioSelect]);

  const comparativaTotals = useMemo(() => {
    const totalAgentes = comparativaAgentes.length;
    const totalTareas = comparativaAgentes.reduce((acc, a) => acc + a.total, 0);
    const totalCompletadas = comparativaAgentes.reduce(
      (acc, a) => acc + a.completadas,
      0
    );
    const backlog = comparativaAgentes.reduce((acc, a) => acc + a.abiertas, 0);
    const tasaGlobal =
      totalTareas > 0 ? Math.round((totalCompletadas / totalTareas) * 100) : 0;
    const promedioCierre =
      totalAgentes > 0
        ? Math.round(
            comparativaAgentes.reduce((acc, a) => acc + a.cierre, 0) / totalAgentes
          )
        : 0;
    const top =
      comparativaAgentes
        .slice()
        .sort((a, b) => b.cierre - a.cierre || b.total - a.total)[0] || null;

    return { totalAgentes, totalTareas, backlog, tasaGlobal, promedioCierre, top };
  }, [comparativaAgentes]);

  const comparativaStacked = useMemo(() => {
    return {
      categories: comparativaAgentes.map((a) => a.nombre),
      series: [
        { name: "Pendientes", data: comparativaAgentes.map((a) => a.pendientes) },
        { name: "En proceso", data: comparativaAgentes.map((a) => a.enProceso) },
        { name: "Vencidas", data: comparativaAgentes.map((a) => a.vencidas) },
        { name: "Completadas", data: comparativaAgentes.map((a) => a.completadas) },
      ],
    };
  }, [comparativaAgentes]);

  const comparativaRendimiento = useMemo(() => {
    return {
      categories: comparativaAgentes.map((a) => a.nombre),
      data: comparativaAgentes.map((a) => a.cierre),
    };
  }, [comparativaAgentes]);

  const exportExcelGeneric = async ({
    filename,
    sheetName,
    columns,
    rows,
    styleCell,
  }: {
    filename: string;
    sheetName: string;
    columns: Array<{ key: string; header: string; width?: number }>;
    rows: Array<Record<string, any>>;
    styleCell?: (params: { rowIndex: number; colKey: string; value: any; cell: ExcelJS.Cell }) => void;
  }) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);

    ws.columns = columns.map((c) => ({
      key: c.key,
      header: c.header,
      width: c.width || 18,
      style: {
        font: { color: { argb: "FF1D1E1C" } },
        border: {
          top: { style: "hair", color: { argb: "FFDDD9C3" } },
          bottom: { style: "hair", color: { argb: "FFDDD9C3" } },
        },
      },
    }));

    ws.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF1D1E1C" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F4F0" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDD9C3" } },
        bottom: { style: "thin", color: { argb: "FFDDD9C3" } },
      };
    });

    rows.forEach((row, idx) => {
      const excelRow = ws.addRow(row);
      excelRow.eachCell((cell, colNumber) => {
        const colKey = columns[colNumber - 1]?.key;
        if (styleCell && colKey) {
          styleCell({ rowIndex: idx + 1, colKey, value: cell.value, cell });
        }
        if ((idx + 1) % 2 === 0) {
          cell.fill = cell.fill || {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFAF8F2" },
          };
        }
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      filename
    );
  };

  const exportComparativaExcel = () => {
    const headers = [
      "Agente",
      "Total",
      "Abiertas",
      "Pendientes",
      "En proceso",
      "Vencidas",
      "Completadas",
      "Cierre (%)",
    ];
    const rows = comparativaAgentes.map((a) => [
      { key: "nombre", value: a.nombre },
      { key: "total", value: a.total },
      { key: "abiertas", value: a.abiertas },
      { key: "pendientes", value: a.pendientes },
      { key: "enProceso", value: a.enProceso },
      { key: "vencidas", value: a.vencidas },
      { key: "completadas", value: a.completadas },
      { key: "cierre", value: a.cierre },
    ]);
    exportExcelGeneric({
      filename: `comparativa_agentes_${mesSelect}-${anioSelect}.xlsx`,
      sheetName: "Comparativa",
      columns: headers.map((h, idx) => ({ key: `col${idx}`, header: h, width: idx === 0 ? 28 : 14 })),
      rows: rows.map((r) =>
        r.reduce((acc, cell, idx) => {
          acc[`col${idx}`] = cell.value;
          return acc;
        }, {} as Record<string, any>)
      ),
      styleCell: ({ colKey, value, cell }) => {
        const colIdx = Number(colKey.replace("col", ""));
        const num = Number(value) || 0;
        if (colIdx === 5 && num > 0) {
          // vencidas
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E8" } };
          cell.font = { color: { argb: "FFEF4444" } };
        }
        if (colIdx === 6 && num > 0) {
          // completadas
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1F7E1" } };
          cell.font = { color: { argb: "FF16A34A" } };
        }
        if (colIdx === 7) {
          if (num >= 70) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1F7E1" } };
          else if (num >= 40) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDF7D0" } };
          else if (num > 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E8" } };
        }
        cell.alignment = { vertical: "middle", horizontal: colIdx === 0 ? "left" : "center" };
      },
    });
  };

  const exportComparativaPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Comparativa de agentes - KPIs", 14, 16);
    doc.setFontSize(9);
    doc.text(`Periodo: ${mesSelect}/${anioSelect}`, 14, 24);
    doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 30);

    const startY = 38;
    const colX = [14, 64, 84, 104, 124, 144, 164, 184];
    const headers = ["Agente", "Total", "Abiertas", "Pend", "Proc", "Venc", "Comp", "Cierre%"];
    headers.forEach((h, idx) => {
      doc.text(h, colX[idx], startY);
    });

    let y = startY + 6;
    comparativaAgentes.forEach((a, idx) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 250 : 245, isEven ? 248 : 244, isEven ? 242 : 240);
      doc.rect(10, y - 5, 180, 8, "F");
      const values = [
        a.nombre,
        String(a.total),
        String(a.abiertas),
        String(a.pendientes),
        String(a.enProceso),
        String(a.vencidas),
        String(a.completadas),
        `${a.cierre}%`,
      ];
      values.forEach((val, colIdx) => {
        if (colIdx === 5 && a.vencidas > 0) doc.setTextColor(239, 68, 68);
        else if (colIdx === 6 && a.completadas > 0) doc.setTextColor(34, 197, 94);
        else doc.setTextColor(29, 30, 28);
        doc.text(val.slice(0, 18), colX[colIdx], y);
      });
      y += 6;
    });
    doc.save(`comparativa_agentes_${mesSelect}-${anioSelect}.pdf`);
  };

  const exportDashboardExcel = () => {
    if (!selectedAgentId) {
      alert("Selecciona un agente para exportar.");
      return;
    }
    const rows = [
      { kpi: "Total tareas", valor: globalKpis.total },
      { kpi: "Pendientes", valor: globalKpis.pend },
      { kpi: "En proceso", valor: globalKpis.proc },
      { kpi: "Vencidas", valor: globalKpis.venc },
      { kpi: `Por vencer (<=${DIAS_POR_VENCER}d)`, valor: globalKpis.porVencer },
      { kpi: "Completadas", valor: globalKpis.comp },
    ];
    exportExcelGeneric({
      filename: `dashboard_agente_${selectedAgentId}_${mesSelect}-${anioSelect}.xlsx`,
      sheetName: "Dashboard",
      columns: [
        { key: "kpi", header: "KPI", width: 32 },
        { key: "valor", header: "Valor", width: 14 },
      ],
      rows,
      styleCell: ({ colKey, value, cell }) => {
        if (colKey === "valor") {
          const num = Number(value) || 0;
          if (num === globalKpis.venc && num > 0) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E8" } };
            cell.font = { color: { argb: "FFEF4444" } };
          }
          if (num === globalKpis.comp && num > 0) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1F7E1" } };
            cell.font = { color: { argb: "FF16A34A" } };
          }
          cell.alignment = { horizontal: "center" };
        }
      },
    });
  };

  const exportDashboardPdf = () => {
    if (!selectedAgentId) {
      alert("Selecciona un agente para exportar.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Dashboard de agente - KPIs", 14, 16);
    doc.setFontSize(9);
    doc.text(`Periodo: ${mesSelect}/${anioSelect}`, 14, 24);
    const rows: Array<[string, string]> = [
      ["Total tareas", String(globalKpis.total)],
      ["Pendientes", String(globalKpis.pend)],
      ["En proceso", String(globalKpis.proc)],
      ["Vencidas", String(globalKpis.venc)],
      [`Por vencer (<=${DIAS_POR_VENCER}d)`, String(globalKpis.porVencer)],
      ["Completadas", String(globalKpis.comp)],
    ];
    let y = 34;
    const drawRow = (textColor: [number, number, number]) => {
      doc.setTextColor(...textColor);
      doc.text("KPI", 16, y);
      doc.text("Valor", 80, y);
      y += 6;
      rows.forEach((r, idx) => {
        const isEven = idx % 2 === 0;
        doc.setFillColor(isEven ? 250 : 245, isEven ? 248 : 244, isEven ? 242 : 240);
        doc.rect(12, y - 4, 180, 8, "F");
        doc.setTextColor(29, 30, 28);
        doc.text(r[0], 16, y);
        doc.text(r[1], 80, y);
        y += 6;
      });
    };
    doc.setFillColor(245, 244, 240);
    doc.rect(12, y - 4, 180, 8, "F");
    drawRow([29, 30, 28]);
    doc.save(`dashboard_agente_${selectedAgentId}_${mesSelect}-${anioSelect}.pdf`);
  };

  const exportEmpresasExcel = () => {
    if (!selectedAgentId) {
      alert("Selecciona un agente para exportar.");
      return;
    }
    exportExcelGeneric({
      filename: `empresas_agente_${selectedAgentId}_${mesSelect}-${anioSelect}.xlsx`,
      sheetName: "Empresas",
      columns: [
        { key: "rut", header: "RUT", width: 18 },
        { key: "razonSocial", header: "Razón Social", width: 32 },
        { key: "pendientes", header: "Pend", width: 10 },
        { key: "enProceso", header: "En proceso", width: 12 },
        { key: "vencidas", header: "Vencidas", width: 10 },
        { key: "completadas", header: "Completadas", width: 12 },
        { key: "porVencer", header: "Por vencer", width: 12 },
        { key: "total", header: "Total", width: 10 },
      ],
      rows: empresasStats.map((e) => ({
        rut: e.rut,
        razonSocial: e.razonSocial,
        pendientes: e.pendientes,
        enProceso: e.enProceso,
        vencidas: e.vencidas,
        completadas: e.completadas,
        porVencer: e.porVencer,
        total: e.total,
      })),
      styleCell: ({ colKey, value, cell }) => {
        if (typeof value === "number") {
          cell.alignment = { horizontal: "center" };
        }
        if (colKey === "vencidas" && value > 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE8E8" } };
          cell.font = { color: { argb: "FFEF4444" } };
        }
        if (colKey === "completadas" && value > 0) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1F7E1" } };
          cell.font = { color: { argb: "FF16A34A" } };
        }
      },
    });
  };

  const exportEmpresasPdf = () => {
    if (!selectedAgentId) {
      alert("Selecciona un agente para exportar.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text("Empresas - KPIs por cliente", 14, 16);
    doc.setFontSize(9);
    doc.text(`Periodo: ${mesSelect}/${anioSelect}`, 14, 24);

    const headers = ["RUT", "Cliente", "Pend", "Proc", "Venc", "Comp", "Total"];
    const colX = [12, 40, 92, 110, 128, 146, 164];
    let y = 32;
    doc.setFillColor(245, 244, 240);
    doc.rect(10, y - 5, 180, 9, "F");
    headers.forEach((h, idx) => doc.text(h, colX[idx], y));
    y += 7;

    empresasStats.forEach((e, idx) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      const isEven = idx % 2 === 0;
      doc.setFillColor(isEven ? 250 : 245, isEven ? 248 : 244, isEven ? 242 : 240);
      doc.rect(10, y - 5, 180, 8, "F");
      const values = [
        e.rut,
        e.razonSocial.slice(0, 28),
        String(e.pendientes),
        String(e.enProceso),
        String(e.vencidas),
        String(e.completadas),
        String(e.total),
      ];
      values.forEach((val, i) => {
        if (i === 5 && e.completadas > 0) doc.setTextColor(34, 197, 94);
        else if (i === 4 && e.vencidas > 0) doc.setTextColor(239, 68, 68);
        else doc.setTextColor(29, 30, 28);
        doc.text(val, colX[i], y);
      });
      y += 7;
    });

    doc.save(`empresas_agente_${selectedAgentId}_${mesSelect}-${anioSelect}.pdf`);
  };

  const triggerExport = (
    fmt: "excel" | "pdf",
    target: "dashboard" | "empresas" | "comparativa"
  ) => {
    if (target === "comparativa") {
      fmt === "excel" ? exportComparativaExcel() : exportComparativaPdf();
      return;
    }
    if (!selectedAgentId) {
      alert("Selecciona un agente para exportar.");
      return;
    }
    if (target === "dashboard") {
      fmt === "excel" ? exportDashboardExcel() : exportDashboardPdf();
      return;
    }
    if (target === "empresas") {
      fmt === "excel" ? exportEmpresasExcel() : exportEmpresasPdf();
      return;
    }
  };

  const empresaDetalleRut = empresaSeleccionadaRut || empresasPage[0]?.rut || null;
  const empresaDetalle = empresaDetalleRut
    ? empresasStats.find((e) => e.rut === empresaDetalleRut) || null
    : null;
  const tareasEmpresaDetalle = empresaDetalleRut
    ? tareasSeleccionadas.filter((t) => (t.rutCliente || "SIN_RUT") === empresaDetalleRut)
    : [];

  const formatFecha = (iso?: string | null) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL");
  };

  if (loading) return <div>Cargando supervisión...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  const agenteSeleccionado = selectedAgentId
    ? resumen.find((r) => r.trabajadorId === selectedAgentId)
    : null;
  const currentView: string = viewMode;
  const isComparativa = viewMode === "comparativa";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center bg-[#f5f4f0] border border-black/5 rounded-2xl px-3 py-2 shadow-sm">
        {!isComparativa && (
          <select
            className="text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
            value={selectedAgentId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedAgentId(val ? Number(val) : null);
              setSelectedClientRut("ALL");
            }}
          >
            <option value="">Selecciona un agente</option>
            {resumen.map((r) => (
              <option key={r.trabajadorId} value={r.trabajadorId}>
                {r.nombre}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-2 text-xs">
          <select
            className="bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
            value={mesSelect}
            onChange={(e) => {
              setPeriodo("mes-especifico");
              setMesSelect(Number(e.target.value));
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1}>
                Mes {i + 1}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="bg-white border border-black/10 rounded-xl px-3 py-2 w-24 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#af9150] text-[#1d1e1c]"
            value={anioSelect}
            onChange={(e) => {
              setPeriodo("anio-especifico");
              setAnioSelect(Number(e.target.value));
            }}
          />
        </div>

        {!isComparativa &&
          (["actual", "hist"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriodo(p);
                if (p === "actual") {
                  const now = new Date();
                  setMesSelect(now.getMonth() + 1);
                  setAnioSelect(now.getFullYear());
                }
              }}
              className={`px-4 py-2 rounded-full text-xs font-semibold border shadow-sm transition ${
                periodo === p
                  ? "bg-[#af9150] text-white border-[#af9150]"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              {p === "actual" ? "Actual" : "Histórico"}
            </button>
          ))}

        {selectedAgentId !== null && !isComparativa && (
          <div className="flex items-center gap-1 text-xs bg-white border border-black/10 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-[#1d1e1c]/70">Cliente:</span>
            <select
              className="text-xs bg-transparent outline-none"
              value={selectedClientRut}
              onChange={(e) => setSelectedClientRut(e.target.value)}
            >
              <option value="ALL">Todos</option>
              {clienteOptions.map((c) => (
                <option key={c.rut} value={c.rut}>
                  {c.razonSocial || c.rut}
                </option>
              ))}
            </select>
          </div>
        )}

        {(loading || agentLoading) && (
          <div className="ml-auto">
            <SpinnerSmall label="Cargando datos..." />
          </div>
        )}
      </div>

      {viewMode === "comparativa" ? (
        <section className="space-y-4">
          {(comparativaLoading || loading) && (
            <SpinnerSmall label="Cargando comparativa..." />
          )}
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "dashboard"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Dashboards
            </button>
            <button
              onClick={() => setViewMode("empresas")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "empresas"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Empresas
            </button>
            <button
              onClick={() => {
                setViewMode("comparativa");
                setPeriodo("mes-especifico");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "comparativa"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Comparativa
            </button>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => {
                  setExportSelection({
                    target: "comparativa",
                    format: "excel",
                  });
                  setShowExportModal(true);
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150] shadow-sm"
              >
                Exportar
              </button>
            </div>
          </div>
          {comparativaAgentes.length === 0 ? (
            <p className="text-sm text-black/60">
              No hay datos de agentes para comparar.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Agentes" value={comparativaTotals.totalAgentes} />
                <KpiCard label="Total tareas" value={comparativaTotals.totalTareas} color="#0ea5e9" />
                <KpiCard label="Backlog abierto" value={comparativaTotals.backlog} color="#f59e0b" />
                <KpiCard label="Tasa cierre (%)" value={comparativaTotals.tasaGlobal} color="#22c55e" />
                <KpiCard label="Cierre prom. (%)" value={comparativaTotals.promedioCierre} color="#0ea5e9" />
              </div>

              {comparativaTotals.top && (
                <div className="bg-white rounded-xl p-4 shadow border">
                  <p className="text-xs text-black/60">Mejor tasa de cierre</p>
                  <p className="text-lg font-semibold text-black/80">
                    {comparativaTotals.top.nombre}
                  </p>
                  <p className="text-xs text-black/50">
                    {comparativaTotals.top.cierre}% cierre ·{" "}
                    {comparativaTotals.top.completadas}/{comparativaTotals.top.total} tareas
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow border">
                  <h3 className="font-semibold text-sm mb-2">Estados por agente</h3>
                  <ApexChart
                    type="bar"
                    series={comparativaStacked.series as any}
                    options={{
                      chart: { stacked: true, toolbar: { show: false } },
                      plotOptions: { bar: { horizontal: true } },
                      xaxis: { categories: comparativaStacked.categories },
                      colors: ["#fbbf24", "#38bdf8", "#f97373", "#22c55e"],
                      legend: { position: "bottom" },
                    } as any}
                    height={360}
                  />
                </div>
                <div className="bg-white rounded-xl p-4 shadow border">
                  <h3 className="font-semibold text-sm mb-2">Tasa de cierre por agente</h3>
                  <ApexChart
                    type="bar"
                    series={[{ name: "Cierre %", data: comparativaRendimiento.data }] as any}
                    options={{
                      chart: { toolbar: { show: false } },
                      plotOptions: {
                        bar: { distributed: true, columnWidth: "55%" },
                      },
                      dataLabels: {
                        enabled: true,
                        formatter: (val: number) => `${Math.round(val)}%`,
                      },
                      xaxis: {
                        categories: comparativaRendimiento.categories,
                        labels: { rotate: -25 },
                      },
                      yaxis: {
                        max: 100,
                        labels: { formatter: (val: number) => `${val}%` },
                      },
                      colors: ["#22c55e", "#0ea5e9", "#f97373", "#fbbf24", "#a855f7"],
                    } as any}
                    height={360}
                  />
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow border">
                <h3 className="font-semibold text-sm mb-3">Comparativa detallada</h3>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Agente</th>
                        <th className="py-2 pr-3">Total</th>
                        <th className="py-2 pr-3">Abiertas</th>
                        <th className="py-2 pr-3">Pendientes</th>
                        <th className="py-2 pr-3">En proceso</th>
                        <th className="py-2 pr-3">Vencidas</th>
                        <th className="py-2 pr-3">Completadas</th>
                        <th className="py-2 pr-3">Cierre %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativaAgentes.map((a) => (
                        <tr
                          key={a.trabajadorId}
                          className="border-b last:border-b-0 hover:bg-slate-50"
                        >
                          <td className="py-2 pr-3">{a.nombre}</td>
                          <td className="py-2 pr-3 font-semibold text-black/80">{a.total}</td>
                          <td className="py-2 pr-3 text-amber-700">{a.abiertas}</td>
                          <td className="py-2 pr-3">{a.pendientes}</td>
                          <td className="py-2 pr-3">{a.enProceso}</td>
                          <td className="py-2 pr-3 text-rose-700">{a.vencidas}</td>
                          <td className="py-2 pr-3 text-emerald-700">{a.completadas}</td>
                          <td className="py-2 pr-3">{a.cierre}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      ) : selectedAgentId === null ? (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "dashboard"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Dashboards
            </button>
            <button
              onClick={() => setViewMode("empresas")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "empresas"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Empresas
            </button>
            <button
              onClick={() => {
                setViewMode("comparativa");
                setPeriodo("mes-especifico");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "comparativa"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Comparativa
            </button>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => {
                  setExportSelection({ target: "comparativa", format: "excel" });
                  setShowExportModal(true);
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150] shadow-sm"
              >
                Exportar
              </button>
            </div>
          </div>
          <div className="text-sm text-black/60">
            Selecciona un agente para ver sus dashboards y tareas filtradas.
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setViewMode("dashboard")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "dashboard"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Dashboards
            </button>
            <button
              onClick={() => setViewMode("empresas")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "empresas"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Empresas
            </button>
            <button
              onClick={() => {
                setViewMode("comparativa");
                setPeriodo("mes-especifico");
              }}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
                currentView === "comparativa"
                  ? "bg-[#af9150] text-white border-[#af9150] shadow-sm"
                  : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
              }`}
            >
              Comparativa
            </button>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => {
                  setExportSelection({
                    target: viewMode,
                    format: "excel",
                  });
                  setShowExportModal(true);
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150] shadow-sm"
              >
                Exportar
              </button>
            </div>
          </div>

          {viewMode === "dashboard" && (
            <>
              <section className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <KpiCard label="Total" value={globalKpis.total} />
                <KpiCard label="Pendientes" value={globalKpis.pend} color="#fbbf24" />
                <KpiCard label="En proceso" value={globalKpis.proc} color="#38bdf8" />
                <KpiCard label="Vencidas" value={globalKpis.venc} color="#f97373" />
                <KpiCard
                  label={`Por vencer (<=${DIAS_POR_VENCER}d)`}
                  value={globalKpis.porVencer}
                  color="#fb923c"
                />
                <KpiCard label="Completadas" value={globalKpis.comp} color="#22c55e" />
              </section>

              <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow border">
                  <h3 className="font-semibold text-sm mb-2">
                    Distribución {agenteSeleccionado ? `(${agenteSeleccionado.nombre})` : ""}
                  </h3>
                  <ApexChart type="donut" series={donutSeries} options={donutOptions as any} height={280} />
                </div>
                <div className="bg-white rounded-xl p-4 shadow border">
                  <h3 className="font-semibold text-sm mb-2">Avances por periodo</h3>
                  <ApexChart
                    type="area"
                    series={lineData.series as any}
                    options={{
                      xaxis: { categories: lineData.categories },
                      stroke: { curve: "smooth" },
                    } as any}
                    height={300}
                  />
                </div>
              </section>

              <section className="bg-white rounded-xl p-4 shadow border">
                <h3 className="font-semibold text-sm mb-3">Proceso general de tareas pendientes</h3>
                <div className="overflow-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Agente</th>
                        <th className="py-2 pr-3">Pendientes</th>
                        <th className="py-2 pr-3">Pend. vencidas</th>
                        <th className="py-2 pr-3">Pend. por vencer</th>
                        <th className="py-2 pr-3">Próx. vencimiento</th>
                        <th className="py-2 pr-3">Estado</th>
                        <th className="py-2 pr-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {procesoAgentes.map((a) => (
                        <tr key={a.trabajadorId} className="border-b hover:bg-slate-50">
                          <td className="py-2 pr-3">{a.nombre}</td>
                          <td className="py-2 pr-3 text-amber-700">{a.pendientes}</td>
                          <td className="py-2 pr-3 text-rose-700">{a.vencidas}</td>
                          <td className="py-2 pr-3 text-orange-600">{a.porVencer}</td>
                          <td className="py-2 pr-3">{a.proximoVenc}</td>
                          <td className="py-2 pr-3">{a.estadoProceso}</td>
                          <td className="py-2 pr-3">
                            <button
                              onClick={() => setAgenteDetalle(a.trabajadorId)}
                              className="text-xs text-sky-600 underline"
                            >
                              Ver detalle
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {viewMode === "empresas" && (
            <section className="bg-white rounded-xl p-4 shadow border space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="Clientes" value={totalEmpresas} />
                <KpiCard label="Tareas filtradas" value={totalTareasEmpresas} color="#0ea5e9" />
                <KpiCard label="Pendientes" value={empresasStats.reduce((a, e) => a + e.pendientes, 0)} color="#fbbf24" />
                <KpiCard label="Completadas" value={empresasStats.reduce((a, e) => a + e.completadas, 0)} color="#22c55e" />
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                <div className="md:w-1/2 space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={empresaSearch}
                      onChange={(e) => {
                        setEmpresaPage(1);
                        setEmpresaSearch(e.target.value);
                      }}
                      placeholder="Buscar clientes (RUT o razón social)..."
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="space-y-2 max-h-[520px] overflow-auto pr-1">
                    {empresasPage.length === 0 && (
                      <p className="text-sm text-black/50">Sin clientes para mostrar.</p>
                    )}
                    {empresasPage.map((e) => (
                      <div
                        key={e.rut}
                        className={`flex items-center justify-between border rounded-lg px-3 py-2 shadow-sm ${
                          empresaDetalleRut === e.rut ? "border-sky-300 bg-sky-50" : "border-black/10 bg-white"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-black/80">
                            {e.razonSocial}
                          </span>
                          <span className="text-[11px] text-black/60">{e.rut}</span>
                          <span className="text-[11px] text-black/60">
                            Pend {e.pendientes} · Proc {e.enProceso} · Venc {e.vencidas} · Comp {e.completadas}
                          </span>
                        </div>
                        <button
                          onClick={() => setEmpresaSeleccionadaRut(e.rut)}
                          className="text-xs text-sky-600 underline"
                        >
                          Ver detalle →
                        </button>
                      </div>
                    ))}
                  </div>

                  {empresasFiltradas.length > EMPRESAS_PAGE_SIZE && (
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <button
                        onClick={() => setEmpresaPage((p) => Math.max(1, p - 1))}
                        disabled={empresaPage === 1}
                        className={`px-2 py-1 border rounded ${
                          empresaPage === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-black/5"
                        }`}
                      >
                        Anterior
                      </button>
                      <span className="text-black/60">
                        Página {empresaPage} de {Math.max(1, Math.ceil(empresasFiltradas.length / EMPRESAS_PAGE_SIZE))}
                      </span>
                      <button
                        onClick={() =>
                          setEmpresaPage((p) =>
                            Math.min(Math.ceil(empresasFiltradas.length / EMPRESAS_PAGE_SIZE), p + 1)
                          )
                        }
                        disabled={empresaPage >= Math.ceil(empresasFiltradas.length / EMPRESAS_PAGE_SIZE)}
                        className={`px-2 py-1 border rounded ${
                          empresaPage >= Math.ceil(empresasFiltradas.length / EMPRESAS_PAGE_SIZE)
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-black/5"
                        }`}
                      >
                        Siguiente
                      </button>
                    </div>
                  )}
                </div>

                <div className="md:w-1/2 space-y-3 border rounded-lg p-3 shadow-sm bg-slate-50">
                  {empresaDetalle ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-black/50">Cliente</p>
                          <h3 className="text-lg font-semibold text-black/80">
                            {empresaDetalle.razonSocial}
                          </h3>
                          <p className="text-xs text-black/60">{empresaDetalle.rut}</p>
                        </div>
                        <div className="text-right text-xs text-black/60">
                          <div>Pend {empresaDetalle.pendientes}</div>
                          <div>Proc {empresaDetalle.enProceso}</div>
                          <div>Venc {empresaDetalle.vencidas}</div>
                          <div>Comp {empresaDetalle.completadas}</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <KpiCard label="Pendientes" value={empresaDetalle.pendientes} color="#fbbf24" />
                        <KpiCard label="En proceso" value={empresaDetalle.enProceso} color="#38bdf8" />
                        <KpiCard label="Vencidas" value={empresaDetalle.vencidas} color="#f97373" />
                        <KpiCard label="Completadas" value={empresaDetalle.completadas} color="#22c55e" />
                      </div>

                      <div className="bg-white border rounded-lg p-2">
                        <ApexChart
                          type="donut"
                          series={[
                            empresaDetalle.pendientes,
                            empresaDetalle.enProceso,
                            empresaDetalle.vencidas,
                            empresaDetalle.completadas,
                          ]}
                          options={{
                            labels: ["Pendiente", "En proceso", "Vencida", "Completada"],
                            colors: ["#fbbf24", "#38bdf8", "#f97373", "#22c55e"],
                            legend: { position: "bottom" },
                          } as any}
                          height={260}
                        />
                      </div>

                      <div className="bg-white border rounded-lg p-2">
                        <h4 className="text-sm font-semibold mb-2">Tareas del cliente</h4>
                        {tareasEmpresaDetalle.length === 0 ? (
                          <p className="text-xs text-black/50">Sin tareas en el periodo seleccionado.</p>
                        ) : (
                          <div className="overflow-auto max-h-64">
                            <table className="min-w-full text-[11px] border-collapse">
                              <thead>
                                <tr className="bg-black/[0.03]">
                                  <th className="text-left px-2 py-1 border-b border-black/10">Código</th>
                                  <th className="text-left px-2 py-1 border-b border-black/10">Tarea</th>
                                  <th className="text-left px-2 py-1 border-b border-black/10">Estado</th>
                                  <th className="text-left px-2 py-1 border-b border-black/10">Programada</th>
                                </tr>
                              </thead>
                              <tbody>
                                {tareasEmpresaDetalle.map((t) => (
                                  <tr key={t.id_tarea_asignada} className="hover:bg-black/[0.02]">
                                    <td className="px-2 py-1 border-b border-black/5 font-mono">
                                      {t.tareaPlantilla?.codigoDocumento || "-"}
                                    </td>
                                    <td className="px-2 py-1 border-b border-black/5">
                                      {t.tareaPlantilla?.nombre || "Tarea"}
                                    </td>
                                    <td className="px-2 py-1 border-b border-black/5">
                                      {t.estado}
                                    </td>
                                    <td className="px-2 py-1 border-b border-black/5">
                                      {formatFecha(t.fechaProgramada)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-black/50">Selecciona un cliente para ver detalle.</p>
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 border border-black/5">
            <h3 className="text-lg font-semibold text-[#1d1e1c] mb-1">Exportar informe</h3>
            <p className="text-xs text-black/60 mb-3">
              Elige el apartado y el formato para descargar.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-[#1d1e1c] mb-1">Apartado</p>
                <div className="grid grid-cols-1 gap-2">
                  {(["comparativa", "dashboard", "empresas"] as const).map((opt) => {
                    const disabled = opt !== "comparativa" && !selectedAgentId;
                    const label =
                      opt === "comparativa"
                        ? "Comparativa (todos)"
                        : opt === "dashboard"
                        ? "Dashboard (agente)"
                        : "Empresas (agente)";
                    return (
                      <button
                        key={opt}
                        disabled={disabled}
                        onClick={() => setExportSelection((prev) => ({ ...prev, target: opt }))}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border text-left transition ${
                          exportSelection.target === opt
                            ? "bg-[#af9150] text-white border-[#af9150]"
                            : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#1d1e1c] mb-1">Formato</p>
                <div className="flex gap-2">
                  {(["excel", "pdf"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportSelection((prev) => ({ ...prev, format: fmt }))}
                      className={`px-4 py-2 rounded-full text-xs font-semibold border transition ${
                        exportSelection.format === fmt
                          ? "bg-[#af9150] text-white border-[#af9150]"
                          : "bg-white text-[#1d1e1c] border-black/10 hover:border-[#af9150]"
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {exportSelection.target !== "comparativa" && !selectedAgentId && (
                <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  Selecciona un agente arriba para exportar Dashboard o Empresas.
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-full border border-black/10 bg-white text-[#1d1e1c] hover:border-[#af9150] shadow-sm"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  triggerExport(exportSelection.format, exportSelection.target);
                  setShowExportModal(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-full border border-[#af9150] bg-[#af9150] text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={exportSelection.target !== "comparativa" && !selectedAgentId}
              >
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}

      {agenteDetalle !== null && selectedAgentId !== null && (
        <AgenteModal
          trabajadorId={agenteDetalle}
          onClose={() => setAgenteDetalle(null)}
          periodo={periodo}
          mes={mesSelect}
          anio={anioSelect}
          tareasIniciales={tareasCache[agenteDetalle]}
          clientes={clienteOptions}
          clienteFiltroRut={selectedClientRut}
        />
      )}
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: number; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="bg-white rounded-xl p-3 shadow border">
    <p className="text-xs text-black/60">{label}</p>
    <p className="text-2xl font-semibold" style={{ color: color || "#111827" }}>
      {value}
    </p>
  </div>
);

export default TareasSupervisionPage;
