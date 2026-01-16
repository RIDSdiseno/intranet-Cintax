import { useMemo } from "react";
import type { TareaFull } from "../../lib/api";

export type Periodo =
  | "actual" // mes actual
  | "semana" // semana actual (lun-dom)
  | "mes" // alias de actual
  | "hist" // sin filtro
  | "mes-especifico" // usa mes + año proporcionados
  | "anio-especifico"; // usa año proporcionado completo

const startOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay() || 7; // lunes=1, domingo=7
  if (day > 1) d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeek = (date: Date) => {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 7);
  return d;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0, 0);

const sameMonth = (date: Date, year: number, month: number) =>
  date.getFullYear() === year && date.getMonth() === month - 1;

function inRange(date: Date, desde: Date, hasta: Date) {
  return date >= desde && date < hasta;
}

function getFechaClave(t: TareaFull) {
  const d = new Date(t.fechaProgramada || t.createdAt);
  if (Number.isNaN(d.getTime())) return new Date(0); // fallback estable
  return d;
}

export function filtrarPorPeriodo(tareas: TareaFull[], periodo: Periodo, mes?: number, anio?: number): TareaFull[] {
  if (!Array.isArray(tareas) || tareas.length === 0) return [];
  const hoy = new Date();

  switch (periodo) {
    case "hist":
      return tareas;

    case "semana": {
      const ini = startOfWeek(hoy);
      const fin = endOfWeek(hoy);
      return tareas.filter((t) => inRange(getFechaClave(t), ini, fin));
    }

    case "mes": // alias de actual
    case "actual": {
      const ini = startOfMonth(hoy);
      const fin = endOfMonth(hoy);
      return tareas.filter((t) => inRange(getFechaClave(t), ini, fin));
    }

    case "mes-especifico": {
      const m = mes ?? hoy.getMonth() + 1;
      const a = anio ?? hoy.getFullYear();
      return tareas.filter((t) => sameMonth(getFechaClave(t), a, m));
    }

    case "anio-especifico": {
      const a = anio ?? hoy.getFullYear();
      return tareas.filter((t) => getFechaClave(t).getFullYear() === a);
    }

    default:
      return tareas;
  }
}

export function useFiltroPeriodo(tareas: TareaFull[], periodo: Periodo, mes?: number, anio?: number) {
  return useMemo(() => filtrarPorPeriodo(tareas, periodo, mes, anio), [tareas, periodo, mes, anio]);
}
