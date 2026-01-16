// src/pages/creacion-tareas/shared/date.ts
const pad2 = (n: number) => String(n).padStart(2, "0");

export const toISOAtNoonLocal = (d: Date) => {
  const safe = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  return safe.toISOString();
};

export const endOfMonthDateString = (anio: number, mes: number) => {
  const last = new Date(anio, mes, 0);
  return `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(last.getDate())}`;
};

export const dateStringToISOAtNoon = (yyyyMMdd: string) => {
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return toISOAtNoonLocal(date);
};

export const nombreMes = (m: number) =>
  [
    "",
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ][m] || `Mes ${m}`;
