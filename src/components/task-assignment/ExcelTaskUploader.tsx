import React, { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { cargarTareasDesdeExcel, type ExcelMasivoQuery } from "../../service/tareas.service";

type PreviewRow = {
  row: number;
  rut: string;
  razonSocial: string;
  agenteEmail: string;
  agenteIdRaw: string;

  tareasRaw: string;
  tareasParsed: string[];

  fechaProgramadaRaw: string;
  fechaProgramadaISO: string;

  frecuencia: string;
  diaMesVencimiento: string;
  diaSemanaVencimiento: string;

  area: string;
  presentacion: string;
  requiereDrive: string;
  codigoDocumento: string;

  volatil: string;

  valid: boolean;
  issues: string[];
};

function norm(v: unknown) {
  return String(v ?? "").trim();
}
function normLower(v: unknown) {
  return norm(v).toLowerCase();
}
function parseBoolLoose(v: unknown): boolean | null {
  const s = normLower(v);
  if (!s) return null;
  if (["true", "1", "si", "sí", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  return null;
}
function parseTareas(raw: string): string[] {
  return raw
    .split(/[,;\/\n]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}
function headerKeyMap(headers: string[]) {
  const m = new Map<string, string>();
  for (const h of headers) m.set(h.toLowerCase(), h);
  return m;
}
function getCell(rowObj: Record<string, any>, headerMap: Map<string, string>, ...keys: string[]) {
  for (const k of keys) {
    const direct = rowObj[k];
    if (direct != null && direct !== "") return direct;
    const found = headerMap.get(k.toLowerCase());
    if (found && rowObj[found] != null && rowObj[found] !== "") return rowObj[found];
  }
  return "";
}
function toISODateLike(v: any): string {
  if (!v) return "";
  if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(0, 10);

  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) {
      const js = new Date(d.y, d.m - 1, d.d);
      return Number.isFinite(js.getTime()) ? js.toISOString().slice(0, 10) : "";
    }
  }

  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : "";
}

type UploadResponse = any;

const EXAMPLE_ROWS = [
  {
    rut: "21587005-5",
    razonSocial: "Servicios Integrales Sur Ltda",
    agenteEmail: "administrador@cintax.cl",
    tarea: "Pago Cotizaciones",
    fechaProgramada: "2026-03-13",
    volatil: "NO",
    area: "RRHH",
  },
  {
    rut: "20455411-7",
    razonSocial: "Tecnologías Altiplano",
    agenteEmail: "administrador@cintax.cl",
    tarea: "Pago Cotizaciones",
    fechaProgramada: "2026-03-13",
    volatil: "NO",
    area: "RRHH",
  },
  {
    rut: "11132243-8",
    razonSocial: "Servicios Integrales Sur Ltda",
    agenteEmail: "administrador@cintax.cl",
    tarea: "Libro Compras",
    fechaProgramada: "2026-03-11",
    volatil: "NO",
    area: "CONTA",
  },
  {
    rut: "25016741-7",
    razonSocial: "Distribuidora Central",
    agenteEmail: "administrador@cintax.cl",
    tarea: "Libro Compras",
    fechaProgramada: "2026-03-25",
    volatil: "NO",
    area: "CONTA",
  },
  {
    rut: "14844139-6",
    razonSocial: "Inversiones Cordillera",
    agenteEmail: "administrador@cintax.cl",
    tarea: "Onboarding Cliente",
    fechaProgramada: "2026-03-24",
    volatil: "SI",
    area: "ADMIN",
  },
];

export default function ExcelTaskUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);

  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [forceUpdateClienteAgente, setForceUpdateClienteAgente] = useState(false);
  const [fechaFallback, setFechaFallback] = useState<string>("");
  const [agenteEmail, setAgenteEmail] = useState<string>("");
  const [agenteId, setAgenteId] = useState<string>("");

  const summary = useMemo(() => {
    if (!preview) return null;

    const totalRows = preview.length;
    const okRows = preview.filter((r) => r.valid).length;
    const badRows = totalRows - okRows;

    const totalTareas = preview.reduce((acc, r) => acc + r.tareasParsed.length, 0);
    const volatileRows = preview.filter((r) => parseBoolLoose(r.volatil) === true).length;
    const approxCreates = preview.reduce((acc, r) => (r.valid ? acc + r.tareasParsed.length : acc), 0);
    const needsFallback = preview.filter((r) => r.valid && !r.fechaProgramadaISO).length;

    return { totalRows, okRows, badRows, totalTareas, volatileRows, approxCreates, needsFallback };
  }, [preview]);

  async function buildPreview(f: File) {
    setLoadingPreview(true);
    setError(null);
    setUploadError(null);
    setUploadResult(null);

    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });

      const firstSheet = wb.SheetNames[0];
      setSheetName(firstSheet || "");
      const ws = wb.Sheets[firstSheet];
      if (!ws) throw new Error("No se encontró la primera hoja del Excel.");

      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Array<Record<string, any>>;
      if (!rawRows.length) {
        setPreview([]);
        return;
      }

      const headers = Object.keys(rawRows[0] ?? {});
      const hmap = headerKeyMap(headers);

      const parsed: PreviewRow[] = rawRows.map((r, idx) => {
        const rut = norm(getCell(r, hmap, "rut", "RUT"));
        const razonSocial = norm(getCell(r, hmap, "razonSocial", "razon social", "empresa", "razon"));

        const agenteEmailRow = norm(
          getCell(r, hmap, "agenteEmail", "emailAgente", "correoAgente", "correo", "email")
        ).toLowerCase();

        const agenteIdRaw = norm(getCell(r, hmap, "agenteId", "trabajadorId", "responsableId", "agente"));

        const tareasRaw = norm(
          getCell(r, hmap, "tarea", "tareas", "plantillaNombre", "plantilla", "nombreTarea")
        );
        const tareasParsed = parseTareas(tareasRaw);

        const fechaProgramadaRaw = norm(getCell(r, hmap, "vencimiento", "fechaProgramada", "fecha"));
        const fechaProgramadaISO = toISODateLike(getCell(r, hmap, "vencimiento", "fechaProgramada", "fecha"));

        const frecuencia = norm(
          getCell(r, hmap, "frecuencia", "frecuenciaPlantilla", "frecuencia_tarea")
        ).toUpperCase();
        const diaMesVencimiento = norm(getCell(r, hmap, "diaMesVencimiento", "diaMes", "dia_mes_vencimiento"));
        const diaSemanaVencimiento = norm(
          getCell(r, hmap, "diaSemanaVencimiento", "diaSemana", "dia_semana_vencimiento")
        );

        const area = norm(getCell(r, hmap, "area", "areaPlantilla")).toUpperCase();
        const presentacion = norm(getCell(r, hmap, "presentacion", "presentacionPlantilla")).toUpperCase();
        const requiereDrive = norm(getCell(r, hmap, "requiereDrive", "drive", "requiere_drive"));
        const codigoDocumento = norm(getCell(r, hmap, "codigoDocumento", "codigo", "codigo_documento"));

        const volatil = norm(getCell(r, hmap, "volatile", "volatil", "esVolatil", "tareaVolatil", "volatile31"));

        const issues: string[] = [];

        if (!rut) issues.push("Falta RUT (o es inválido)");
        if (!tareasParsed.length) issues.push("Falta tareas (tarea/tareas/plantillaNombre/...)");

        if (!fechaProgramadaISO) {
          issues.push("No viene fecha en la fila (se usará fecha fallback si la defines arriba)");
        }

        if (tareasParsed.length && !frecuencia) {
          issues.push("Advertencia: si la plantilla no existe en el sistema, faltará 'frecuencia' para crearla.");
        }

        const valid = issues.filter((x) => !x.startsWith("Advertencia")).every((x) => !x.startsWith("Falta"));

        return {
          row: idx + 2,
          rut,
          razonSocial,
          agenteEmail: agenteEmailRow,
          agenteIdRaw,
          tareasRaw,
          tareasParsed,
          fechaProgramadaRaw,
          fechaProgramadaISO,
          frecuencia,
          diaMesVencimiento,
          diaSemanaVencimiento,
          area,
          presentacion,
          requiereDrive,
          codigoDocumento,
          volatil,
          valid,
          issues,
        };
      });

      setPreview(parsed);
    } catch (e: any) {
      setError(e?.message || "No se pudo leer el Excel.");
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function onPickFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setError(null);
    setUploadError(null);
    setUploadResult(null);
    setSheetName("");
    if (f) await buildPreview(f);
  }

  function buildControllerQuery(): ExcelMasivoQuery {
    const q: ExcelMasivoQuery = {
      skipDuplicates,
      forceUpdateClienteAgente,
    };

    const ff = norm(fechaFallback);
    if (ff) q.fechaProgramada = ff;

    const email = norm(agenteEmail).toLowerCase();
    if (email) q.agenteEmail = email;

    const idNum = Number(norm(agenteId));
    if (norm(agenteId) && Number.isFinite(idNum) && idNum > 0) q.agenteId = idNum;

    return q;
  }

  function isFechaYYYYMMDD(s: string) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  const canUpload = useMemo(() => {
    if (!file) return false;
    if (!preview) return false;
    if (loadingPreview || uploading) return false;
    if (error) return false;

    const needsFallback = preview.some((r) => !r.fechaProgramadaISO);
    if (needsFallback) {
      const ff = norm(fechaFallback);
      if (!ff || !isFechaYYYYMMDD(ff)) return false;
    }

    if (preview.some((r) => !r.valid)) return false;
    return true;
  }, [file, preview, loadingPreview, uploading, error, fechaFallback]);

  async function onUpload() {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const query = buildControllerQuery();
      const data = await cargarTareasDesdeExcel(file, query);
      setUploadResult(data);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Error subiendo el Excel.";
      setUploadError(String(msg));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-white p-4 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Carga masiva de tareas por Excel</h2>
          <p className="mt-1 text-sm text-gray-600">
            Descarga tu plantilla, complétala siguiendo este ejemplo y luego súbela aquí en formato <b>.xlsx</b>.
          </p>
        </div>

        <div className="rounded-xl border bg-gray-50 p-3">
          <div className="text-sm font-semibold text-gray-800">Qué debe completar el cliente</div>
          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
            <div>
              <b>RUT:</b> RUT del cliente
            </div>
            <div>
              <b>Razón Social:</b> nombre de la empresa
            </div>
            <div>
              <b>Responsable:</b> correo del agente
            </div>
            <div>
              <b>Tarea:</b> nombre de la tarea
            </div>
            <div>
              <b>Fecha:</b> formato YYYY-MM-DD
            </div>
            <div>
              <b>Volátil:</b> puede escribir <b>SI</b> o <b>NO</b>
            </div>
            <div>
              <b>Área:</b> por ejemplo CONTA, RRHH o ADMIN
            </div>
          </div>
        </div>

        <div className="rounded-xl border overflow-auto">
          <div className="border-b bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800">
            Ejemplo de cómo debe verse el Excel
          </div>

          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-[#eef4ff] text-gray-800">
              <tr>
                <th className="px-3 py-2 text-left">RUT</th>
                <th className="px-3 py-2 text-left">Razón Social</th>
                <th className="px-3 py-2 text-left">Responsable</th>
                <th className="px-3 py-2 text-left">Tarea</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Volátil</th>
                <th className="px-3 py-2 text-left">Área</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_ROWS.map((item, idx) => (
                <tr key={`${item.rut}-${idx}`} className="border-t">
                  <td className="px-3 py-2 font-mono">{item.rut}</td>
                  <td className="px-3 py-2">{item.razonSocial}</td>
                  <td className="px-3 py-2 font-mono">{item.agenteEmail}</td>
                  <td className="px-3 py-2">{item.tarea}</td>
                  <td className="px-3 py-2 font-mono">{item.fechaProgramada}</td>
                  <td className="px-3 py-2">
                    <span
                      className={[
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                        item.volatil === "SI"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-gray-200 bg-gray-50 text-gray-700",
                      ].join(" ")}
                    >
                      {item.volatil}
                    </span>
                  </td>
                  <td className="px-3 py-2">{item.area}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <div className="font-semibold">Importante</div>
          <div className="mt-1">
            En la columna <span className="font-mono">volatil</span> el cliente puede escribir{" "}
            <b>SI</b> o <b>NO</b>. Tu sistema ya lo interpreta correctamente.
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600">
        Sube un Excel (.xlsx). Se muestra una previsualización y luego puedes ejecutar la carga masiva.
      </div>

      <div className="rounded-2xl border bg-white p-3 space-y-3">
        <div className="text-sm font-semibold">Opciones de carga</div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <div className="text-gray-600 mb-1">Fecha fallback (YYYY-MM-DD)</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="2026-03-08"
              value={fechaFallback}
              onChange={(e) => setFechaFallback(e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500">
              Se usa solo si una fila no trae fechaProgramada/fecha/vencimiento.
            </div>
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">agenteEmail (override opcional)</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="administrador@cintax.cl"
              value={agenteEmail}
              onChange={(e) => setAgenteEmail(e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500">
              Si lo defines acá, el backend lo usa como fallback cuando la fila no trae agenteEmail.
            </div>
          </label>

          <label className="text-sm">
            <div className="text-gray-600 mb-1">agenteId (compat opcional)</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder="123"
              value={agenteId}
              onChange={(e) => setAgenteId(e.target.value)}
            />
            <div className="mt-1 text-xs text-gray-500">
              Solo si no estás usando agenteEmail. En el backend tiene menor prioridad que email.
            </div>
          </label>

          <div className="text-sm space-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
              />
              <span>skipDuplicates</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={forceUpdateClienteAgente}
                onChange={(e) => setForceUpdateClienteAgente(e.target.checked)}
              />
              <span>forceUpdateClienteAgente</span>
            </label>

            <div className="text-xs text-gray-500">
              forceUpdateClienteAgente actualiza cliente.agenteId (solo clientes existentes) cuando se resuelve por email/id.
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-600 rounded-xl bg-gray-50 p-2">
          Importante: la marca <b>volátil 31 días</b> se controla por columna en el Excel (
          <span className="font-mono">volatil</span> / <span className="font-mono">volatile</span>). No es un parámetro de query.
        </div>
      </div>

      <input type="file" accept=".xlsx" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loadingPreview ? <div className="text-sm text-gray-600">Leyendo Excel y armando previsualización…</div> : null}

      {summary ? (
        <div className="rounded-2xl border bg-white p-3 text-sm">
          <div className="font-semibold">Resumen (aproximado)</div>
          <div className="mt-1 text-gray-700 space-y-1">
            <div>
              Hoja: <span className="font-mono">{sheetName || "-"}</span>
            </div>
            <div>
              Filas: <b>{summary.totalRows}</b> (válidas: <b>{summary.okRows}</b>, con problemas:{" "}
              <b>{summary.badRows}</b>)
            </div>
            <div>
              Tareas detectadas (por nombre): <b>{summary.totalTareas}</b>
            </div>
            <div>
              Filas marcadas como volátiles: <b>{summary.volatileRows}</b>
            </div>
            <div>
              Qué pasará al subir: el backend intentará crear aprox <b>{summary.approxCreates}</b> tareas asignadas (1 por
              tarea detectada por fila). Si alguna plantilla no existe, la creará (normal o volátil según la columna).
            </div>
            <div className="mt-2 rounded-lg bg-gray-50 p-2 text-gray-700">
              Nota: con <span className="font-mono">skipDuplicates={String(skipDuplicates)}</span>, algunas tareas pueden
              saltarse si ya existen (mismo RUT + plantilla + fecha).
            </div>
            {summary.needsFallback ? (
              <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-800">
                Hay filas sin fecha en la fila. Define una <b>Fecha fallback</b> válida (YYYY-MM-DD) para poder subir.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {preview && preview.length > 0 ? (
        <div className="space-y-2">
          <div className="text-sm font-semibold">Previsualización (primeras 25 filas)</div>

          <div className="overflow-auto rounded-2xl border bg-white">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left">Fila</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                  <th className="px-3 py-2 text-left">RUT</th>
                  <th className="px-3 py-2 text-left">Razón Social</th>
                  <th className="px-3 py-2 text-left">Responsable (agenteEmail)</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Tareas</th>
                  <th className="px-3 py-2 text-left">Volátil</th>
                  <th className="px-3 py-2 text-left">Config plantilla</th>
                  <th className="px-3 py-2 text-left">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 25).map((r) => {
                  const bad = !r.valid;
                  const vol = parseBoolLoose(r.volatil);
                  return (
                    <tr key={r.row} className={bad ? "bg-red-50/50" : ""}>
                      <td className="px-3 py-2 font-mono">{r.row}</td>
                      <td className="px-3 py-2">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                            bad
                              ? "border-red-200 bg-red-50 text-red-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700",
                          ].join(" ")}
                        >
                          {bad ? "Con problemas" : "OK"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono">{r.rut || "-"}</td>
                      <td className="px-3 py-2">{r.razonSocial || "-"}</td>
                      <td className="px-3 py-2 font-mono">{r.agenteEmail || "-"}</td>
                      <td className="px-3 py-2 font-mono">
                        {r.fechaProgramadaISO || (fechaFallback ? `${fechaFallback} (fallback)` : "-")}
                      </td>

                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {r.tareasParsed.length ? (
                            r.tareasParsed.map((t, i) => (
                              <span
                                key={`${r.row}-${i}`}
                                className="inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-xs"
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2">{vol === true ? "sí" : vol === false ? "no" : "-"}</td>

                      <td className="px-3 py-2 font-mono">
                        {r.frecuencia ? (
                          <span>
                            {r.frecuencia}
                            {r.frecuencia === "MENSUAL" && r.diaMesVencimiento ? ` (día ${r.diaMesVencimiento})` : ""}
                            {r.frecuencia === "SEMANAL" && r.diaSemanaVencimiento
                              ? ` (día ${r.diaSemanaVencimiento})`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>

                      <td className="px-3 py-2">
                        {r.issues.length ? (
                          <ul className="list-disc pl-4 text-xs text-gray-700">
                            {r.issues.slice(0, 5).map((it, i) => (
                              <li
                                key={i}
                                className={it.startsWith("Advertencia") ? "text-amber-700" : "text-red-700"}
                              >
                                {it}
                              </li>
                            ))}
                            {r.issues.length > 5 ? <li className="text-gray-500">…</li> : null}
                          </ul>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-gray-600">
            Nota: el preview no sabe si la plantilla existe en la BD. Si NO existe, el backend exigirá configuración
            (frecuencia y día según corresponda). Si existe, ignorará esa config del Excel.
          </div>
        </div>
      ) : preview && preview.length === 0 ? (
        <div className="text-sm text-gray-600">El Excel no trae filas (solo encabezados o está vacío).</div>
      ) : null}

      {uploadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{uploadError}</div>
      ) : null}

      {uploadResult ? (
        <div className="rounded-2xl border bg-white p-3 text-sm space-y-1">
          <div className="font-semibold">Resultado de carga</div>
          <div className="text-gray-700">
            {uploadResult?.sheet ? (
              <div>
                Hoja: <span className="font-mono">{String(uploadResult.sheet)}</span>
              </div>
            ) : null}
            {uploadResult?.requested != null ? <div>Requested: <b>{String(uploadResult.requested)}</b></div> : null}
            {uploadResult?.created != null ? <div>Created: <b>{String(uploadResult.created)}</b></div> : null}
            {uploadResult?.skipped != null ? <div>Skipped: <b>{String(uploadResult.skipped)}</b></div> : null}
          </div>

          {uploadResult?.note ? <div className="text-xs text-gray-600">{String(uploadResult.note)}</div> : null}
        </div>
      ) : null}

      <button className="btn" type="button" onClick={onUpload} disabled={!canUpload}>
        {uploading ? "Subiendo…" : "Subir Excel"}
      </button>

      <style>
        {`
          .btn {
            background: #111827;
            color: #fff;
            border-radius: 0.75rem;
            padding: 0.5rem 0.75rem;
            font-size: 0.875rem;
          }
          .btn:hover { background: #000; }
          .btn:disabled { opacity: .5; cursor: not-allowed; }
          input[type="checkbox"] { width: 16px; height: 16px; }
        `}
      </style>
    </div>
  );
}