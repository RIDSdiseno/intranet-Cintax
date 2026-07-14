import React from "react";
import {
  listPlantillas,
  listTrabajadoresLite,
  crearDesdePlantillasMasivo,
  type PlantillaLite,
  type TrabajadorLite,
} from "../../service/tareas.service";

import ClientesSelector from "./ClientesSelector";

function toISODateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(iso: string) {
  // acepta "YYYY-MM-DD" o ISO; devuelve "DD-MM-YYYY"
  const s = String(iso ?? "").trim();
  if (!s) return "-";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) {
    // si viene YYYY-MM-DD y el Date falla por TZ raro, intentamos split
    const parts = s.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return s;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

type UiResult = {
  created: number;
  skipped: number;
  requested: number;
  responsableNombre: string;
  responsableEmail: string;
  fecha: string; // iso o YYYY-MM-DD
  raw: any; // para debug opcional
};

function parseUiResult(raw: any): UiResult | null {
  if (!raw) return null;

  // backend actual (tu respuesta): ok/requested/created/skipped + trabajador + fechaProgramada
  const requested = Number(raw.requested ?? raw.total_procesadas ?? raw?.resumen?.total_procesadas ?? 0);
  const created = Number(raw.created ?? raw?.resumen?.tareas_creadas ?? 0);
  const skipped = Number(raw.skipped ?? raw?.resumen?.tareas_omitidas ?? 0);

  const trabajador = raw.trabajador ?? null;
  const responsableNombre = String(raw.responsable ?? trabajador?.nombre ?? "").trim();
  const responsableEmail = String(trabajador?.email ?? "").trim();

  const fecha = String(raw.fecha_programada ?? raw.fechaProgramada ?? "").trim();

  // Si no hay nada útil, no mostramos tarjeta
  if (!requested && !created && !skipped) return null;

  return {
    requested,
    created,
    skipped,
    responsableNombre: responsableNombre || "Sin responsable",
    responsableEmail,
    fecha: fecha || "",
    raw,
  };
}

export default function ManualTaskCreator() {
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // guardamos el raw por si quieres debug, pero renderizamos una vista amigable
  const [resultRaw, setResultRaw] = React.useState<any>(null);
  const uiResult = React.useMemo(() => parseUiResult(resultRaw), [resultRaw]);

  const [plantillas, setPlantillas] = React.useState<PlantillaLite[]>([]);
  const [trabajadores, setTrabajadores] = React.useState<TrabajadorLite[]>([]);

  // Paso 1: trabajador (obligatorio para cargar cartera)
  const [trabajadorId, setTrabajadorId] = React.useState<number | "">("");

  // Paso 2: clientes seleccionados (RUTs)
  const [selectedRuts, setSelectedRuts] = React.useState<string[]>([]);

  // Paso 3: plantillas
  const [area, setArea] = React.useState<string>("ALL");
  const [q, setQ] = React.useState<string>("");
  const [selectedPlantillaIds, setSelectedPlantillaIds] = React.useState<number[]>([]);

  // Paso 4: config
  const [fechaProgramada, setFechaProgramada] = React.useState<string>(toISODateLocal(new Date()));
  const [skipDuplicates, setSkipDuplicates] = React.useState(true);

  // UI: ver detalle técnico
  const [showTech, setShowTech] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [pls, trs] = await Promise.all([listPlantillas(true), listTrabajadoresLite()]);

        setPlantillas(pls);
        setTrabajadores(trs);
      } catch (e: any) {
        setError(e?.response?.data?.message ?? e?.message ?? "Error cargando datos");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Cascada: al cambiar trabajador, limpia lo dependiente
  React.useEffect(() => {
    setSelectedRuts([]);
    setSelectedPlantillaIds([]);
    setResultRaw(null);
    setShowTech(false);
    setError(null);
  }, [trabajadorId]);

  // Cambios relevantes limpian resultado
  React.useEffect(() => {
    setResultRaw(null);
    setShowTech(false);
  }, [selectedRuts, selectedPlantillaIds, fechaProgramada, skipDuplicates]);

  const areasDisponibles = React.useMemo(() => {
    const s = new Set<string>();
    for (const p of plantillas) s.add(String(p.area));
    return ["ALL", ...Array.from(s).sort()];
  }, [plantillas]);

  const plantillasFiltradas = React.useMemo(() => {
    const query = q.trim().toLowerCase();
    return plantillas.filter((p) => {
      if (area !== "ALL" && String(p.area) !== area) return false;
      if (!query) return true;
      return (
        p.nombre.toLowerCase().includes(query) ||
        String(p.area).toLowerCase().includes(query) ||
        String(p.id_tarea_plantilla).includes(query)
      );
    });
  }, [plantillas, area, q]);

  const paso1Ok = trabajadorId !== "";
  const paso2Ok = paso1Ok && selectedRuts.length > 0;
  const paso3Ok = paso2Ok && selectedPlantillaIds.length > 0;
  const paso4Ok = paso3Ok && Boolean(fechaProgramada);

  const requestedCount = selectedRuts.length * selectedPlantillaIds.length;

  function togglePlantilla(id: number) {
    setSelectedPlantillaIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function selectAllFiltered() {
    const ids = plantillasFiltradas.map((p) => p.id_tarea_plantilla);
    setSelectedPlantillaIds((prev) => Array.from(new Set([...prev, ...ids])));
  }

  function clearSelectedPlantillas() {
    setSelectedPlantillaIds([]);
  }

  async function onCrear() {
    if (creating) return;

    try {
      setError(null);
      setResultRaw(null);
      setShowTech(false);

      if (!paso1Ok) return setError("Selecciona un trabajador.");
      if (!paso2Ok) return setError("Selecciona al menos un cliente.");
      if (!paso3Ok) return setError("Selecciona al menos una plantilla.");
      if (!fechaProgramada) return setError("Selecciona una fecha programada.");

      setCreating(true);

      // IMPORTANTE: este alias llama a crearDesdePlantillaMasivo (en el service actualizado),
      // que por defecto apunta al endpoint SAFE (/tareas/masivo/crear-desde-plantilla-safe).
      const res = await crearDesdePlantillasMasivo({
        rutClientes: selectedRuts,
        plantillaIds: selectedPlantillaIds,
        trabajadorId: Number(trabajadorId),
        fechaProgramada,
        skipDuplicates,
      });

      setResultRaw(res);
    } catch (e: any) {
      setError(
        e?.response?.data?.error ??
          e?.response?.data?.message ??
          e?.message ??
          "Error creando tareas"
      );
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Cargando...</div>;

  return (
    <div className="space-y-4 relative">
      {creating && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex flex-col items-center justify-center gap-3"
          aria-live="assertive"
          aria-busy="true"
        >
          <span className="h-10 w-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          <div className="text-white text-sm font-medium">Creando tareas, por favor espera...</div>
        </div>
      )}

      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* PASO 1: Trabajador */}
      <Section title="1) Selecciona trabajador (cartera)">
        <Field label="Asignar a trabajador">
          <select
            className="w-full border rounded-xl px-3 py-2 text-sm"
            value={trabajadorId}
            onChange={(e) => setTrabajadorId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">Selecciona trabajador</option>
            {trabajadores.map((t) => (
              <option key={t.id_trabajador} value={t.id_trabajador}>
                {t.nombre} ({t.email})
              </option>
            ))}
          </select>
        </Field>

        <div className="text-xs text-gray-600 mt-2">
          Se cargarán clientes donde <b>cliente.agenteId</b> coincida con el trabajador.
        </div>
      </Section>

      {/* PASO 2: Clientes */}
      {paso1Ok && (
        <Section title="2) Selecciona clientes (buscar por RUT)">
          <ClientesSelector selectedRuts={selectedRuts} onChange={setSelectedRuts} trabajadorId={trabajadorId} />
        </Section>
      )}

      {/* PASO 3: Plantillas */}
      {paso2Ok && (
        <Section title="3) Selecciona plantillas">
          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex gap-2 flex-col sm:flex-row sm:items-center">
              <input
                className="w-full sm:w-[320px] border rounded-xl px-3 py-2 text-sm"
                placeholder="Buscar plantilla (nombre / área / id)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="border rounded-xl px-3 py-2 text-sm"
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                {areasDisponibles.map((a) => (
                  <option key={a} value={a}>
                    {a === "ALL" ? "Todas las áreas" : a}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="border rounded-xl px-3 py-2 text-sm hover:bg-gray-50"
              >
                Seleccionar visibles
              </button>
              <button
                type="button"
                onClick={clearSelectedPlantillas}
                className="border rounded-xl px-3 py-2 text-sm hover:bg-gray-50"
              >
                Limpiar
              </button>
            </div>
          </div>

          <div className="mt-3 border rounded-xl overflow-hidden">
            <div className="max-h-[320px] overflow-auto">
              {plantillasFiltradas.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">No hay plantillas con ese filtro.</div>
              ) : (
                <ul className="divide-y">
                  {plantillasFiltradas.map((p) => {
                    const checked = selectedPlantillaIds.includes(p.id_tarea_plantilla);
                    return (
                      <li key={p.id_tarea_plantilla} className="p-3 hover:bg-gray-50">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePlantilla(p.id_tarea_plantilla)}
                            className="mt-1"
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-sm">{p.nombre}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full border bg-white">
                                {p.area}
                              </span>
                              <span className="text-xs text-gray-500">ID: {p.id_tarea_plantilla}</span>
                            </div>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-3 text-sm bg-gray-50 flex items-center justify-between">
              <span>
                Seleccionadas: <b>{selectedPlantillaIds.length}</b>
              </span>
              <span>
                Mostrando: <b>{plantillasFiltradas.length}</b>
              </span>
            </div>
          </div>
        </Section>
      )}

      {/* PASO 4: Config */}
      {paso3Ok && (
        <Section title="4) Configuración">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Fecha programada">
              <input
                type="date"
                className="w-full border rounded-xl px-3 py-2 text-sm"
                value={fechaProgramada}
                onChange={(e) => setFechaProgramada(e.target.value)}
              />
            </Field>

            <Field label="Duplicados">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
                Omitir duplicados
              </label>
            </Field>
          </div>
        </Section>
      )}

      {/* Acción final */}
      {paso4Ok && (
        <div className="border rounded-xl p-3 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="text-sm">
            Se intentarán crear: <b>{requestedCount}</b> tareas
            <span className="text-gray-600">
              {" "}
              (Clientes: {selectedRuts.length} × Plantillas: {selectedPlantillaIds.length})
            </span>
          </div>

          <button
            type="button"
            onClick={onCrear}
            disabled={creating}
            className="bg-gray-900 text-white rounded-xl px-4 py-2 text-sm hover:bg-black disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {creating && (
              <span className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {creating ? "Creando tareas..." : "Crear tareas"}
          </button>
        </div>
      )}

      {/* Resultado amigable */}
      {uiResult && (
        <div className="border rounded-2xl p-4 bg-white">
          <div className="text-sm font-semibold">Resultado</div>

          <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
            <SummaryCard label="Tareas creadas" value={uiResult.created} />
            <SummaryCard label="Tareas omitidas" value={uiResult.skipped} />
            <SummaryCard label="Total procesadas" value={uiResult.requested} />
            <SummaryCard label="Fecha" value={prettyDate(uiResult.fecha || fechaProgramada)} />
          </div>

          <div className="mt-3 text-sm text-gray-700">
            Responsable: <b>{uiResult.responsableNombre}</b>
            {uiResult.responsableEmail ? (
              <span className="text-gray-500"> ({uiResult.responsableEmail})</span>
            ) : null}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-xs text-gray-500">
              {uiResult.skipped > 0
                ? "Algunas tareas se omitieron porque ya existían (duplicadas)."
                : "No se detectaron duplicados."}
            </div>

            <button
              type="button"
              onClick={() => setShowTech((v) => !v)}
              className="border rounded-xl px-3 py-2 text-xs hover:bg-gray-50"
            >
              {showTech ? "Ocultar detalle técnico" : "Ver detalle técnico"}
            </button>
          </div>

          {showTech && (
            <pre className="mt-3 text-xs whitespace-pre-wrap bg-gray-50 border rounded-xl p-3 overflow-auto">
              {JSON.stringify(uiResult.raw, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border rounded-2xl p-3 bg-gray-50">
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-2xl p-4">
      <div className="text-sm font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}