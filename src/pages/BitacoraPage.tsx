// src/pages/BitacoraPage.tsx
import { useEffect, useMemo, useState } from "react";
import { getMisBitacoras, upsertBitacora } from "../service/bitacora.service";
import type { Bitacora } from "../types/bitacora";
import RichEditor from "../components/RichEditor";
import { Loader2, CalendarDays, FileText, RefreshCw, Pencil, X, Clock } from "lucide-react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getTodayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function monthNameES(m: number) {
  const names = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return names[m - 1] ?? "";
}

function toISODate(y: number, m: number, d: number) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function rangeForMonth(y: number, m: number) {
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  return {
    desde: toISODate(start.getFullYear(), start.getMonth() + 1, start.getDate()),
    hasta: toISODate(end.getFullYear(), end.getMonth() + 1, end.getDate()),
  };
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isTodayISO(yyyyMmDd: string) {
  return yyyyMmDd === getTodayISO();
}

function isoFromBitacoraDate(iso: string) {
  return (iso || "").slice(0, 10);
}

function fmtDateCL(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtTimeCL(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isSameInstant(a?: string, b?: string) {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
}

export default function BitacoraPage() {
  const [fecha, setFecha] = useState(getTodayISO());
  const [titulo, setTitulo] = useState("");
  const [contenidoHtml, setContenidoHtml] = useState("");

  const [mes, setMes] = useState(getCurrentMonth());
  const [anio, setAnio] = useState(getCurrentYear());

  const [bitacoras, setBitacoras] = useState<Bitacora[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // estado de edición desde historial (solo HOY)
  const [editingFromHistory, setEditingFromHistory] = useState(false);

  const years = useMemo(() => {
    const y = getCurrentYear();
    return [y - 1, y, y + 1];
  }, []);

  const period = useMemo(() => rangeForMonth(anio, mes), [anio, mes]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMisBitacoras({ desde: period.desde, hasta: period.hasta });

      // ✅ orden: más nuevo arriba (por updatedAt si existe, si no por createdAt/fecha)
      const sorted = [...data].sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || a.fecha).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || b.fecha).getTime();
        return tb - ta;
      });

      setBitacoras(sorted);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el historial.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.desde, period.hasta]);

  function resetEditorToToday() {
    setFecha(getTodayISO());
    setTitulo("");
    setContenidoHtml("");
    setEditingFromHistory(false);
  }

  function startEditTodayFromHistory(b: Bitacora) {
    const day = isoFromBitacoraDate(b.fecha);
    if (!isTodayISO(day)) return;

    setError(null);
    setFecha(day);
    setTitulo(b.titulo ?? "");
    setContenidoHtml(b.contenido || "");
    setEditingFromHistory(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    const plain = stripHtml(contenidoHtml);
    if (!plain || saving) return;

    if (!isTodayISO(fecha)) {
      setError("Solo puedes editar/guardar la bitácora del día de hoy.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await upsertBitacora({
        fecha,
        titulo: titulo.trim() || null,
        contenido: contenidoHtml,
        mode: editingFromHistory ? "replace" : "append",
      });

      resetEditorToToday();
      await load(); // ✅ trae updatedAt actualizado y lo mostramos
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar la bitácora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Bitácora</h1>
          <p className="text-sm text-gray-500">
            Registra tu actividad diaria y revisa tu historial.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 sm:self-auto self-start"
          title="Recargar"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Recargar
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 w-12">Mes</label>
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="border rounded-xl px-3 py-2 bg-white text-sm min-w-[170px]"
              >
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i} value={i + 1}>
                    {monthNameES(i + 1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500 w-12">Año</label>
              <select
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="border rounded-xl px-3 py-2 bg-white text-sm min-w-[120px]"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-sm text-gray-500">{bitacoras.length} bitácoras en el período</div>
        </div>

        <div className="mt-3 text-xs text-gray-400">
          Período: {period.desde} → {period.hasta}
        </div>
      </div>

      {/* Layout responsive */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Editor */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl shadow-sm border p-5 sm:p-6 space-y-4 relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-gray-800 font-medium">
                <FileText size={18} />
                {editingFromHistory ? "Editando entrada de hoy" : "Nueva entrada"}
              </div>

              {editingFromHistory ? (
                <button
                  onClick={resetEditorToToday}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  title="Salir de edición"
                >
                  <X size={16} />
                  Cancelar edición
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-gray-400" />
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  disabled={saving || editingFromHistory}
                  className="border rounded-xl px-3 py-2 text-sm bg-white"
                />
              </div>

              <div className="text-xs text-gray-400">
                {isTodayISO(fecha)
                  ? "Solo puedes guardar/editar el día de hoy"
                  : "Selecciona HOY para poder guardar"}
              </div>
            </div>

            <input
              type="text"
              placeholder="Título (opcional)"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={saving}
              className="border rounded-xl px-3 py-2 w-full text-sm"
            />

            <RichEditor
              valueHtml={contenidoHtml}
              onChangeHtml={setContenidoHtml}
              disabled={saving}
              placeholder="Describe lo que hiciste hoy..."
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !stripHtml(contenidoHtml) || !isTodayISO(fecha)}
                className={[
                  "px-5 py-2.5 rounded-xl text-white text-sm font-medium inline-flex items-center justify-center gap-2",
                  saving || !stripHtml(contenidoHtml) || !isTodayISO(fecha)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[var(--primary-color)] hover:opacity-90",
                ].join(" ")}
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Guardando..." : "Guardar"}
              </button>

              <div className="text-xs text-gray-400">Tip: usa títulos, listas y links para ordenar tu día</div>
            </div>

            {saving && <div className="absolute inset-0 bg-white/40 rounded-2xl pointer-events-none" />}
          </div>
        </div>

        {/* Historial */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl shadow-sm border">
            <div className="px-5 sm:px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-800">Historial</h2>
                <p className="text-xs text-gray-500">
                  {monthNameES(mes)} {anio}
                </p>
              </div>

              {loading ? (
                <div className="inline-flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin" />
                  Cargando...
                </div>
              ) : null}
            </div>

            <div className="p-4 sm:p-6">
              {loading ? (
                <div className="text-sm text-gray-500">Cargando historial...</div>
              ) : bitacoras.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500">
                  No hay bitácoras en este período.
                </div>
              ) : (
                <div className="space-y-3">
                  {bitacoras.map((b) => {
                    const day = isoFromBitacoraDate(b.fecha);
                    const canEditThis = isTodayISO(day);

                    const updatedIso = b.updatedAt || b.createdAt || b.fecha;
                    const changed = !!b.updatedAt && !!b.createdAt && !isSameInstant(b.updatedAt, b.createdAt);

                    return (
                      <div
                        key={b.id}
                        className="rounded-2xl border p-4 hover:shadow-sm transition bg-white"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-medium text-gray-800 truncate">
                              {b.titulo || "Sin título"}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                              <span>{fmtDateCL(b.fecha)}{canEditThis ? " • Hoy" : ""}</span>

                              <span className="text-gray-300">•</span>

                              <span className="inline-flex items-center gap-1">
                                <Clock size={13} className="text-gray-400" />
                                Actualizado {fmtTimeCL(updatedIso)}
                              </span>

                              {changed ? (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5">
                                    Editada
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>

                          {canEditThis ? (
                            <button
                              onClick={() => startEditTodayFromHistory(b)}
                              disabled={saving}
                              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                              title="Editar bitácora de hoy"
                            >
                              <Pencil size={16} />
                              Editar
                            </button>
                          ) : null}
                        </div>

                        <div
                          className="mt-3 text-sm text-gray-700 break-words"
                          style={{ overflowWrap: "anywhere" }}
                          dangerouslySetInnerHTML={{ __html: b.contenido }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}