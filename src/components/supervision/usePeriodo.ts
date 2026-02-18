// src/components/supervision/usePeriodo.ts
import { TareaFull } from "../../lib/api";

export type Periodo = "actual" | "hist" | "mes-especifico" | "anio-especifico";

// usa fechaProgramada si existe, si no createdAt
const getDate = (t: any) => {
  const raw = t?.fechaProgramada || t?.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

export function filtrarPorPeriodo(
  tareas: TareaFull[],
  periodo: Periodo,
  mesSelect: number,
  anioSelect: number
) {
  if (!Array.isArray(tareas) || tareas.length === 0) return [];

  // histórico = todo
  if (periodo === "hist") return tareas;

  // actual: lo tratamos como "mes-especifico" usando los selectores (mes/año)
  if (periodo === "actual" || periodo === "mes-especifico") {
    const m = mesSelect - 1; // JS Date month 0-11
    const y = anioSelect;

    return tareas.filter((t) => {
      const d = getDate(t);
      if (!d) return false;
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }

  // año específico
  if (periodo === "anio-especifico") {
    const y = anioSelect;
    return tareas.filter((t) => {
      const d = getDate(t);
      if (!d) return false;
      return d.getFullYear() === y;
    });
  }

  return tareas;
}
