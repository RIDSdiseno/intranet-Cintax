import type { TareaFull } from "../lib/api";

/** Estados que maneja la app */
export type Estado =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "VENCIDA"
  | "COMPLETADA"
  | "NO_APLICA";

/** Filtro por vencimiento */
export type DueMode = "ALL" | "OVERDUE" | "DUE_SOON" | "ON_TIME";

export type GlobalFilters = {
  estado: Record<Estado, boolean>;
  area: string; // "ALL" | area
  search: string; // texto
  dueMode: DueMode;
  dueDays: number; // umbral por vencer
  onlyBacklog: boolean; // excluye completadas y no aplica
  onlyCompleted: boolean; // solo completadas
  taskKey: string; // "ALL" | key
};

export function safeDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** key estable para filtrar por "tipo de tarea" */
export function getTaskKeyForFilter(t: TareaFull): string {
  const plantillaId = (t as any)?.tareaPlantilla?.id;
  const codigo = (t as any)?.tareaPlantilla?.codigoDocumento;
  const nombre = (t as any)?.tareaPlantilla?.nombre;

  return String(
    plantillaId ?? codigo ?? nombre ?? t.id_tarea_asignada ?? "UNKNOWN"
  );
}

/** Aplica filtros globales a una lista de tareas */
export function applyFilters(
  list: TareaFull[],
  filters: GlobalFilters
): TareaFull[] {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + Math.max(0, filters.dueDays || 0));

  const term = (filters.search || "").trim().toLowerCase();

  return (list || []).filter((t) => {
    const st = String(t.estado) as Estado;

    // estado
    if (filters.estado && filters.estado[st] === false) return false;

    // only backlog / only completed
    if (filters.onlyBacklog && (st === "COMPLETADA" || st === "NO_APLICA")) {
      return false;
    }

    if (filters.onlyCompleted && st !== "COMPLETADA") {
      return false;
    }

    // area
    if (filters.area !== "ALL") {
      const a = String((t as any)?.tareaPlantilla?.area ?? "").trim();
      if (a !== filters.area) return false;
    }

    // taskKey
    if (filters.taskKey !== "ALL") {
      const key = getTaskKeyForFilter(t);
      if (key !== filters.taskKey) return false;
    }

    // search
    if (term) {
      const nombre = String(
        (t as any)?.tareaPlantilla?.nombre ?? ""
      ).toLowerCase();
      const area = String((t as any)?.tareaPlantilla?.area ?? "").toLowerCase();
      const cod = String(
        (t as any)?.tareaPlantilla?.codigoDocumento ?? ""
      ).toLowerCase();

      if (!nombre.includes(term) && !area.includes(term) && !cod.includes(term)) {
        return false;
      }
    }

    // dueMode
    if (filters.dueMode && filters.dueMode !== "ALL") {
      const fv = safeDate((t as any)?.fechaProgramada);
      const isCompleted = st === "COMPLETADA";
      const isNoAplica = st === "NO_APLICA";
      const isOverdue = st === "VENCIDA";

      const isDueSoon =
        !isCompleted &&
        !isNoAplica &&
        !isOverdue &&
        !!fv &&
        fv.getTime() >= hoy.getTime() &&
        fv.getTime() <= limite.getTime();

      const isOnTime =
        !isCompleted &&
        !isNoAplica &&
        !isOverdue &&
        (!fv || fv.getTime() > limite.getTime());

      if (filters.dueMode === "OVERDUE" && !isOverdue) return false;
      if (filters.dueMode === "DUE_SOON" && !isDueSoon) return false;
      if (filters.dueMode === "ON_TIME" && !isOnTime) return false;
    }

    return true;
  });
}

export type GlobalKpis = {
  total: number;
  pend: number;
  proc: number;
  venc: number;
  comp: number;
  noAplica: number;
  porVencer: number;

  backlog: number;
  cierrePct: number;
  avgCierreDias: number;
  edadBacklogDias: number;

  riskScore: number;
  riskLabel: string;
};

/**
 * KPIs globales a partir de la lista ya filtrada.
 * (filters se usa para dueDays y para consistencia)
 */
export function computeKpis(
  list: TareaFull[],
  filters: GlobalFilters
): GlobalKpis {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + Math.max(0, filters.dueDays || 0));

  let pend = 0,
    proc = 0,
    venc = 0,
    comp = 0,
    noAplica = 0,
    porVencer = 0;

  // métricas extra
  let sumCierreDias = 0;
  let nCierre = 0;

  let sumEdadBacklog = 0;
  let nBacklogEdad = 0;

  for (const t of list || []) {
    const st = String(t.estado) as Estado;

    if (st === "PENDIENTE") pend++;
    else if (st === "EN_PROCESO") proc++;
    else if (st === "VENCIDA") venc++;
    else if (st === "COMPLETADA") comp++;
    else if (st === "NO_APLICA") noAplica++;

    // por vencer: solo tareas activas, no completadas y no no_aplica
    if (
      st !== "COMPLETADA" &&
      st !== "NO_APLICA"
    ) {
      const fv = safeDate((t as any)?.fechaProgramada);
      if (
        fv &&
        fv.getTime() >= hoy.getTime() &&
        fv.getTime() <= limite.getTime()
      ) {
        porVencer++;
      }
    }

    // avgCierreDias
    if (st === "COMPLETADA") {
      const fin =
        safeDate((t as any)?.fechaCierre) ||
        safeDate((t as any)?.updatedAt) ||
        safeDate((t as any)?.fechaComplecion);

      const ini = safeDate((t as any)?.createdAt);

      if (fin && ini) {
        const days = Math.max(
          0,
          Math.round(
            (fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24)
          )
        );
        sumCierreDias += days;
        nCierre += 1;
      }
    }

    // edad backlog: solo pendientes / en proceso
    if (st === "PENDIENTE" || st === "EN_PROCESO") {
      const ini =
        safeDate((t as any)?.createdAt) ||
        safeDate((t as any)?.fechaProgramada);

      if (ini) {
        const days = Math.max(
          0,
          Math.round((hoy.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24))
        );
        sumEdadBacklog += days;
        nBacklogEdad += 1;
      }
    }
  }

  const total = pend + proc + venc + comp + noAplica;

  // backlog real operativo: excluye completadas y no aplica
  const backlog = pend + proc + venc;

  // cierre % sobre tareas operativas, sin contar no aplica
  const totalOperativo = pend + proc + venc + comp;
  const cierrePct = totalOperativo > 0 ? Math.round((comp / totalOperativo) * 100) : 0;

  const avgCierreDias = nCierre > 0 ? Math.round(sumCierreDias / nCierre) : 0;
  const edadBacklogDias =
    nBacklogEdad > 0 ? Math.round(sumEdadBacklog / nBacklogEdad) : 0;

  // score y etiqueta de riesgo
  const riskScore = venc * 3 + porVencer * 2 + backlog;
  const riskLabel =
    riskScore >= 30 ? "Crítico" : riskScore >= 15 ? "Riesgo" : "Normal";

  return {
    total,
    pend,
    proc,
    venc,
    comp,
    noAplica,
    porVencer,
    backlog,
    cierrePct,
    avgCierreDias,
    edadBacklogDias,
    riskScore,
    riskLabel,
  };
}