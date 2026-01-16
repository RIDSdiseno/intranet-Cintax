import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, Search, Trash2, ListTodo } from "lucide-react";
import type { LoadState } from "../shared/types";
import { getAuthHeaders } from "../shared/auth";

type Frecuencia = "UNICA" | "SEMANAL" | "MENSUAL";

type TareaPlantilla = {
  id: number;
  area: string;
  nombre: string;
  detalle: string;
  frecuencia: Frecuencia;
  diaVencimiento?: number | null;
  codigoDocumento?: string | null;
  presentacion?: string | null;
  activo?: boolean;
  createdAt?: string;
};

type Props = {
  API_BASE_URL: string;
};

const PlantillasTab: React.FC<Props> = ({ API_BASE_URL }) => {
  const [plantillas, setPlantillas] = useState<TareaPlantilla[]>([]);
  const [loading, setLoading] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");

  // form
  const [area, setArea] = useState("CONTA");
  const [frecuencia, setFrecuencia] = useState<Frecuencia>("UNICA");
  const [diaVencimiento, setDiaVencimiento] = useState<number | "">("");
  const [nombre, setNombre] = useState("");
  const [detalle, setDetalle] = useState("");
  const [codigoDocumento, setCodigoDocumento] = useState("");
  const [presentacion, setPresentacion] = useState("Cliente");
  const [creating, setCreating] = useState(false);

  const fetchPlantillas = async () => {
    setLoading("loading");
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tareas/plantillas`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message || j?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const raw = await res.json();

      const items: TareaPlantilla[] = Array.isArray((raw as any)?.items)
        ? (raw as any).items
        : Array.isArray((raw as any)?.data)
        ? (raw as any).data
        : Array.isArray((raw as any)?.plantillas)
        ? (raw as any).plantillas
        : Array.isArray(raw)
        ? raw
        : [];

      setPlantillas(items);
      setLoading("success");
    } catch (e) {
      console.error("[Front] Error cargando plantillas", e);
      setError("No se pudieron cargar las plantillas.");
      setLoading("error");
    }
  };

  // ✅ AUTO LOAD
  useEffect(() => {
    fetchPlantillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const plantillasFiltradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return plantillas;
    return plantillas.filter((p) => {
      return (
        (p.area || "").toLowerCase().includes(s) ||
        (p.nombre || "").toLowerCase().includes(s) ||
        (p.detalle || "").toLowerCase().includes(s) ||
        (p.codigoDocumento || "").toLowerCase().includes(s)
      );
    });
  }, [plantillas, q]);

  const resetForm = () => {
    setNombre("");
    setDetalle("");
    setCodigoDocumento("");
    setDiaVencimiento("");
    setFrecuencia("UNICA");
    setArea("CONTA");
    setPresentacion("Cliente");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !detalle.trim()) return;

    try {
      setCreating(true);

      const body: any = {
        area,
        frecuencia,
        nombre: nombre.trim(),
        detalle: detalle.trim(),
        codigoDocumento: codigoDocumento.trim() ? codigoDocumento.trim() : null,
        presentacion: presentacion || null,
      };

      if (frecuencia !== "UNICA") {
        body.diaVencimiento = diaVencimiento === "" ? null : Number(diaVencimiento);
      } else {
        body.diaVencimiento = null;
      }

      const res = await fetch(`${API_BASE_URL}/tareas/plantillas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message || j?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const created: TareaPlantilla = await res.json();

      setPlantillas((prev) => [created, ...prev]);
      resetForm();
    } catch (e: any) {
      console.error("[Front] Error creando plantilla", e);
      alert(`No se pudo crear la plantilla. ${e?.message || ""}`.trim());
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("¿Eliminar esta plantilla? (Esto puede borrar tareas relacionadas)")) return;
    try {
      const res = await fetch(`${API_BASE_URL}/tareas/plantillas/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setPlantillas((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error("[Front] Error eliminando plantilla", e);
      alert("No se pudo eliminar la plantilla.");
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <form
          onSubmit={handleCreate}
          className="w-full md:w-96 border border-black/5 rounded-xl p-3 bg-[#F9FAFB]"
        >
          <h2 className="text-sm font-semibold text-black/80 flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4" />
            Crear nueva plantilla (TareaPlantilla)
          </h2>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px]">
              <span className="font-semibold text-black/70">Área</span>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              >
                <option value="CONTA">CONTA</option>
                <option value="RRHH">RRHH</option>
                <option value="COMERCIAL">COMERCIAL</option>
                <option value="GERENCIA">GERENCIA</option>
                <option value="OTROS">OTROS</option>
              </select>
            </label>

            <label className="text-[11px]">
              <span className="font-semibold text-black/70">Frecuencia</span>
              <select
                value={frecuencia}
                onChange={(e) => setFrecuencia(e.target.value as Frecuencia)}
                className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              >
                <option value="UNICA">Única</option>
                <option value="SEMANAL">Semanal</option>
                <option value="MENSUAL">Mensual</option>
              </select>
            </label>
          </div>

          {frecuencia !== "UNICA" && (
            <label className="block mt-2 text-[11px]">
              <span className="font-semibold text-black/70">
                Día vencimiento ({frecuencia === "SEMANAL" ? "1=Lun...7=Dom" : "1..31"})
              </span>
              <input
                type="number"
                value={diaVencimiento}
                onChange={(e) => setDiaVencimiento(e.target.value === "" ? "" : Number(e.target.value))}
                className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                placeholder={frecuencia === "SEMANAL" ? "Ej: 5 (Viernes)" : "Ej: 10"}
              />
            </label>
          )}

          <label className="block mt-2 text-[11px]">
            <span className="font-semibold text-black/70">Nombre de la tarea</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              placeholder="Ej: Convenios y/o postergaciones TGR"
              required
            />
          </label>

          <label className="block mt-2 text-[11px]">
            <span className="font-semibold text-black/70">Detalle (obligatorio)</span>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              className="mt-1 w-full min-h-[90px] border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              placeholder="Describe qué debe hacerse para completar esta tarea…"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-2 mt-2">
            <label className="text-[11px]">
              <span className="font-semibold text-black/70">Código documento (opcional)</span>
              <input
                value={codigoDocumento}
                onChange={(e) => setCodigoDocumento(e.target.value)}
                className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                placeholder="Ej: F29, F50…"
              />
            </label>

            <label className="text-[11px]">
              <span className="font-semibold text-black/70">Presentación</span>
              <select
                value={presentacion}
                onChange={(e) => setPresentacion(e.target.value)}
                className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              >
                <option value="Cliente">Cliente</option>
                <option value="Interno">Interno</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={creating}
            className={`mt-3 w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold border border-black/10 text-white ${
              creating ? "bg-black/40 cursor-not-allowed" : "bg-[#D4AF37] hover:brightness-105"
            }`}
          >
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            {creating ? "Creando..." : "Crear plantilla"}
          </button>
        </form>

        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-black/80 flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-black/60" />
              Plantillas activas
            </h2>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2.5 text-black/40" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por área/nombre/detalle/código…"
                  className="w-72 max-w-[60vw] border border-black/15 rounded-lg pl-7 pr-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                />
              </div>

              <button
                type="button"
                onClick={fetchPlantillas}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
                title="Refrescar"
              >
                <Loader2 className={`w-3 h-3 ${loading === "loading" ? "animate-spin" : ""}`} />
                Refrescar
              </button>
            </div>
          </div>

          {loading === "loading" && (
            <p className="text-xs text-black/50 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Cargando plantillas…
            </p>
          )}

          {error && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {error}
            </p>
          )}

          {loading === "success" && plantillasFiltradas.length === 0 && (
            <div className="rounded-xl border border-black/5 bg-black/[0.02] p-4 text-sm text-black/60">
              No hay plantillas para mostrar.
            </div>
          )}

          {loading === "success" && plantillasFiltradas.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {plantillasFiltradas.map((p) => (
                <div key={p.id} className="rounded-2xl border border-black/5 bg-white shadow-sm p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg bg-black/5 text-black/60">
                          {p.area}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg bg-black/5 text-black/60">
                          {p.frecuencia}
                        </span>
                        {p.diaVencimiento ? (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-100">
                            Día {p.diaVencimiento}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 font-semibold text-black/80 text-sm truncate">{p.nombre}</div>
                      <div className="mt-1 text-[11px] text-black/55 leading-relaxed line-clamp-3">
                        {p.detalle}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-black/50">
                        {p.codigoDocumento ? (
                          <span className="px-2 py-1 rounded-lg bg-black/5">
                            Doc: <b className="text-black/70">{p.codigoDocumento}</b>
                          </span>
                        ) : null}
                        {p.presentacion ? (
                          <span className="px-2 py-1 rounded-lg bg-black/5">
                            Vista: <b className="text-black/70">{p.presentacion}</b>
                          </span>
                        ) : null}
                        <span className="px-2 py-1 rounded-lg bg-black/5">
                          ID: <b className="text-black/70">{p.id}</b>
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-rose-50 text-rose-700 hover:bg-rose-100"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3 h-3" />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border border-amber-100 bg-amber-50 rounded-xl p-3 text-[11px] text-amber-800">
        Tip: Si creas una plantilla y no aparece, revisa que tu endpoint <code>/tareas/plantillas</code> esté
        devolviendo la lista (GET).
      </div>
    </section>
  );
};

export default PlantillasTab;
