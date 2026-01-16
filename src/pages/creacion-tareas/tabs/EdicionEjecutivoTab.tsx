// src/pages/creacion-tareas/tabs/EdicionEjecutivoTab.tsx
import React, { useMemo, useState } from "react";
import { AlertCircle, Ban, CheckCircle2, Loader2, Search, SlidersHorizontal } from "lucide-react";
import type {
  Cliente,
  LoadState,
  PlantillaConAplica,
  TareaAsignadaAPI,
  Trabajador,
} from "../shared/types";
import { getAuthHeaders } from "../shared/auth";

type Props = {
  API_BASE_URL: string;
  trabajadores: Trabajador[];
};

const EdicionEjecutivoTab: React.FC<Props> = ({ API_BASE_URL, trabajadores }) => {
  const [ejecutivoId, setEjecutivoId] = useState<string>("");
  const [clientesEjecutivo, setClientesEjecutivo] = useState<Cliente[]>([]);
  const [loadingClientesEjecutivo, setLoadingClientesEjecutivo] = useState<LoadState>("idle");
  const [errorClientesEjecutivo, setErrorClientesEjecutivo] = useState<string | null>(null);

  const [busquedaClienteEj, setBusquedaClienteEj] = useState<string>("");
  const [rutClienteEdicion, setRutClienteEdicion] = useState<string>("");

  const [plantillasConAplica, setPlantillasConAplica] = useState<PlantillaConAplica[]>([]);
  const [loadingPlantillasConAplica, setLoadingPlantillasConAplica] = useState<LoadState>("idle");
  const [errorPlantillasConAplica, setErrorPlantillasConAplica] = useState<string | null>(null);

  const [motivosDraft, setMotivosDraft] = useState<Record<number, string>>({});
  const [updatingRow, setUpdatingRow] = useState<Record<number, boolean>>({});

  const [tareasAsignadasEdicion, setTareasAsignadasEdicion] = useState<TareaAsignadaAPI[]>([]);
  const [loadingTareasAsignadasEdicion, setLoadingTareasAsignadasEdicion] = useState<LoadState>("idle");
  const [errorTareasAsignadasEdicion, setErrorTareasAsignadasEdicion] = useState<string | null>(null);

  const fetchClientesPorEjecutivo = async (agenteId: number) => {
    setLoadingClientesEjecutivo("loading");
    setErrorClientesEjecutivo(null);

    setRutClienteEdicion("");
    setPlantillasConAplica([]);
    setLoadingPlantillasConAplica("idle");
    setErrorPlantillasConAplica(null);
    setMotivosDraft({});
    setUpdatingRow({});
    setTareasAsignadasEdicion([]);
    setLoadingTareasAsignadasEdicion("idle");
    setErrorTareasAsignadasEdicion(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/clientes?agenteId=${agenteId}&soloActivos=true&limit=500`,
        { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const raw: unknown = await res.json();

      const items: Cliente[] = Array.isArray((raw as any)?.items)
        ? ((raw as any).items as Cliente[])
        : Array.isArray(raw)
        ? (raw as Cliente[])
        : [];

      const uniqueByRut = Array.from(new Map((items || []).map((c) => [c.rut, c])).values());
      setClientesEjecutivo(uniqueByRut);
      setLoadingClientesEjecutivo("success");
    } catch (err) {
      console.error("[Front] Error cargando clientes por ejecutivo", err);
      setErrorClientesEjecutivo("No se pudieron cargar los clientes del ejecutivo.");
      setLoadingClientesEjecutivo("error");
    }
  };

  const clientesEjFiltrados = useMemo(() => {
    const q = busquedaClienteEj.trim().toLowerCase();
    if (!q) return clientesEjecutivo;

    return clientesEjecutivo.filter((c) => {
      const rut = (c.rut || "").toLowerCase();
      const razon = (c.razonSocial || "").toLowerCase();
      const alias = (c.alias || "").toLowerCase();
      return rut.includes(q) || razon.includes(q) || alias.includes(q);
    });
  }, [clientesEjecutivo, busquedaClienteEj]);

  const fetchPlantillasConAplica = async (rut: string) => {
    setLoadingPlantillasConAplica("loading");
    setErrorPlantillasConAplica(null);
    setMotivosDraft({});
    try {
      const res = await fetch(
        `${API_BASE_URL}/tareas/plantillas-con-aplica?rut=${encodeURIComponent(rut)}`,
        { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: PlantillaConAplica[] = await res.json();
      setPlantillasConAplica(data || []);
      setLoadingPlantillasConAplica("success");
    } catch (err) {
      console.error("[Front] Error cargando plantillas con aplica", err);
      setErrorPlantillasConAplica("No se pudo cargar la matriz de tareas del cliente.");
      setLoadingPlantillasConAplica("error");
    }
  };

  const fetchTareasAsignadasEdicion = async (rut: string, trabajadorId: number) => {
    setLoadingTareasAsignadasEdicion("loading");
    setErrorTareasAsignadasEdicion(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/tareas/asignadas?rut=${encodeURIComponent(rut)}&trabajadorId=${trabajadorId}&limit=1000`,
        { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }
      );

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: unknown = await res.json();
      setTareasAsignadasEdicion(Array.isArray(data) ? (data as TareaAsignadaAPI[]) : []);
      setLoadingTareasAsignadasEdicion("success");
    } catch (err) {
      console.error("[Front] Error cargando tareas asignadas (edición)", err);
      setErrorTareasAsignadasEdicion("No se pudieron cargar las tareas asignadas del cliente.");
      setLoadingTareasAsignadasEdicion("error");
      setTareasAsignadasEdicion([]);
    }
  };

  const plantillasConAplicaFiltradas = useMemo(() => {
    if (!rutClienteEdicion) return [];
    if (!ejecutivoId) return [];
    if (loadingTareasAsignadasEdicion !== "success") return [];

    const setPlantillasAsignadas = new Set((tareasAsignadasEdicion || []).map((t) => Number(t.tareaPlantillaId)));

    return (plantillasConAplica || []).filter((p) => setPlantillasAsignadas.has(Number(p.id_tarea_plantilla)));
  }, [rutClienteEdicion, ejecutivoId, loadingTareasAsignadasEdicion, tareasAsignadasEdicion, plantillasConAplica]);

  const upsertAplica = async (tareaPlantillaId: number, activa: boolean) => {
    if (!rutClienteEdicion) return;

    const motivo = (motivosDraft[tareaPlantillaId] ?? "").trim() || null;
    setUpdatingRow((p) => ({ ...p, [tareaPlantillaId]: true }));

    // optimistic (mejor consistencia: si aplica => exclusion null)
    setPlantillasConAplica((prev) =>
      prev.map((p) => {
        if (p.id_tarea_plantilla !== tareaPlantillaId) return p;
        const aplica = activa === false; // activa=false => APLICA
        return {
          ...p,
          aplica,
          exclusion: aplica
            ? null
            : {
                motivo,
                desdeFecha: null,
                activa,
              },
        };
      })
    );

    try {
      const body = {
        rutCliente: rutClienteEdicion,
        tareaPlantillaId,
        activa, // true=NO aplica, false=APLICA
        motivo: activa ? motivo : null,
        desdeFecha: null,
      };

      const res = await fetch(`${API_BASE_URL}/tareas/exclusion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.error || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      await fetchPlantillasConAplica(rutClienteEdicion);
      await fetchTareasAsignadasEdicion(rutClienteEdicion, Number(ejecutivoId));
    } catch (err: unknown) {
      console.error("[Front] Error upsert aplica/no aplica", err);
      alert(`No se pudo actualizar. ${err instanceof Error ? err.message : ""}`);
      await fetchPlantillasConAplica(rutClienteEdicion);
      await fetchTareasAsignadasEdicion(rutClienteEdicion, Number(ejecutivoId));
    } finally {
      setUpdatingRow((p) => ({ ...p, [tareaPlantillaId]: false }));
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-4">
      <div className="border border-black/5 rounded-xl p-3 bg-[#F9FAFB]">
        <h2 className="text-sm font-semibold text-black/80 flex items-center gap-2 mb-2">
          <SlidersHorizontal className="w-4 h-4" />
          Edición de tareas por ejecutivo y cliente
        </h2>
        <p className="text-[11px] text-black/50">
          Flujo: <b>Ejecutivo → Cliente → marcar tareas como “NO aplica”</b> (exclusiones). Solo se muestran
          las tareas que están asignadas.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-[11px]">
          <label className="block">
            <span className="font-semibold text-black/70">Ejecutivo</span>
            <select
              value={ejecutivoId}
              onChange={(e) => {
                const v = e.target.value;
                setEjecutivoId(v);
                setClientesEjecutivo([]);
                setBusquedaClienteEj("");
                setRutClienteEdicion("");
                setPlantillasConAplica([]);
                setMotivosDraft({});
                setUpdatingRow({});
                setTareasAsignadasEdicion([]);
                setLoadingTareasAsignadasEdicion("idle");
                setErrorTareasAsignadasEdicion(null);
                setLoadingPlantillasConAplica("idle");
                setErrorPlantillasConAplica(null);
                if (v) fetchClientesPorEjecutivo(Number(v));
              }}
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
            >
              <option value="">Selecciona un ejecutivo…</option>
              {trabajadores.map((t) => (
                <option key={t.id_trabajador} value={String(t.id_trabajador)}>
                  {t.nombre} ({t.email})
                </option>
              ))}
            </select>

            {loadingClientesEjecutivo === "loading" && (
              <p className="mt-2 text-[11px] text-black/50 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Cargando clientes del ejecutivo…
              </p>
            )}
            {errorClientesEjecutivo && (
              <p className="mt-2 text-[11px] text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errorClientesEjecutivo}
              </p>
            )}
          </label>

          <label className="block">
            <span className="font-semibold text-black/70">Cliente</span>

            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="w-3 h-3 absolute left-2 top-2.5 text-black/40" />
                <input
                  type="text"
                  value={busquedaClienteEj}
                  onChange={(e) => setBusquedaClienteEj(e.target.value)}
                  placeholder="Buscar por RUT, razón social o alias…"
                  className="w-full border border-black/15 rounded-lg pl-7 pr-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  disabled={!ejecutivoId || loadingClientesEjecutivo === "loading"}
                />
              </div>
            </div>

            <select
              value={rutClienteEdicion}
              onChange={async (e) => {
                const rut = e.target.value;
                setRutClienteEdicion(rut);
                setPlantillasConAplica([]);
                setTareasAsignadasEdicion([]);
                setErrorTareasAsignadasEdicion(null);
                setErrorPlantillasConAplica(null);

                if (rut && ejecutivoId) {
                  await Promise.all([
                    fetchPlantillasConAplica(rut),
                    fetchTareasAsignadasEdicion(rut, Number(ejecutivoId)),
                  ]);
                } else {
                  setLoadingPlantillasConAplica("idle");
                  setLoadingTareasAsignadasEdicion("idle");
                }
              }}
              className="mt-2 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              disabled={!ejecutivoId || loadingClientesEjecutivo !== "success"}
            >
              <option value="">
                {!ejecutivoId
                  ? "Primero selecciona un ejecutivo…"
                  : clientesEjFiltrados.length === 0
                  ? "Sin resultados…"
                  : "Selecciona un cliente…"}
              </option>
              {clientesEjFiltrados.map((c) => (
                <option key={c.id ?? c.rut} value={c.rut}>
                  {c.rut} — {c.razonSocial}
                </option>
              ))}
            </select>

            <p className="mt-1 text-[10px] text-black/45">
              Mostrando {clientesEjFiltrados.length} de {clientesEjecutivo.length}
            </p>
          </label>
        </div>
      </div>

      <div className="border border-black/5 rounded-xl p-3 bg-white">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-black/80">Tareas asignadas para el cliente (aplica / no aplica)</h3>

          {rutClienteEdicion && ejecutivoId && (
            <button
              type="button"
              onClick={async () => {
                await Promise.all([
                  fetchPlantillasConAplica(rutClienteEdicion),
                  fetchTareasAsignadasEdicion(rutClienteEdicion, Number(ejecutivoId)),
                ]);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
            >
              <Loader2 className="w-3 h-3" />
              Refrescar
            </button>
          )}
        </div>

        {!rutClienteEdicion && (
          <p className="text-[11px] text-black/50">Selecciona un ejecutivo y un cliente para ver/editar las tareas.</p>
        )}

        {rutClienteEdicion && loadingTareasAsignadasEdicion === "loading" && (
          <p className="text-xs text-black/50 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Cargando tareas asignadas…
          </p>
        )}

        {rutClienteEdicion && errorTareasAsignadasEdicion && (
          <p className="text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errorTareasAsignadasEdicion}
          </p>
        )}

        {rutClienteEdicion && loadingPlantillasConAplica === "loading" && (
          <p className="text-xs text-black/50 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Cargando matriz de plantillas…
          </p>
        )}

        {rutClienteEdicion && errorPlantillasConAplica && (
          <p className="text-xs text-rose-600 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {errorPlantillasConAplica}
          </p>
        )}

        {rutClienteEdicion && loadingTareasAsignadasEdicion === "success" && tareasAsignadasEdicion.length === 0 && (
          <p className="text-[11px] text-black/50">
            Este cliente no tiene tareas asignadas para este ejecutivo, por eso no hay filas para editar.
          </p>
        )}

        {rutClienteEdicion &&
          loadingTareasAsignadasEdicion === "success" &&
          loadingPlantillasConAplica === "success" &&
          tareasAsignadasEdicion.length > 0 && (
            <>
              {plantillasConAplicaFiltradas.length === 0 ? (
                <p className="text-[11px] text-black/50">
                  Hay tareas asignadas, pero no se pudo cruzar con plantillas (revisa IDs).
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-black/[0.03]">
                        <th className="text-left px-3 py-2 border-b border-black/10">Área</th>
                        <th className="text-left px-3 py-2 border-b border-black/10">Código</th>
                        <th className="text-left px-3 py-2 border-b border-black/10">Plantilla</th>
                        <th className="text-left px-3 py-2 border-b border-black/10">Estado</th>
                        <th className="text-left px-3 py-2 border-b border-black/10">Motivo (si no aplica)</th>
                        <th className="text-right px-3 py-2 border-b border-black/10">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plantillasConAplicaFiltradas.map((p) => {
                        const isNoAplica = !p.aplica;
                        const busy = Boolean(updatingRow[p.id_tarea_plantilla]);

                        return (
                          <tr
                            key={p.id_tarea_plantilla}
                            className={`hover:bg-black/[0.02] ${isNoAplica ? "opacity-95" : ""}`}
                          >
                            <td className="px-3 py-2 border-b border-black/5">{p.area || "-"}</td>
                            <td className="px-3 py-2 border-b border-black/5 font-mono">
                              {p.codigoDocumento || "-"}
                            </td>
                            <td className="px-3 py-2 border-b border-black/5">
                              <div className="font-semibold text-black/75">{p.nombre}</div>
                              <div className="text-[10px] text-black/45">
                                {p.presentacion === "CLIENTE" ? "Cliente" : "Interno"} · {p.frecuencia || "-"}
                                {p.requiereDrive === false ? " · sin Drive" : ""}
                              </div>
                            </td>
                            <td className="px-3 py-2 border-b border-black/5">
                              {isNoAplica ? (
                                <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                                  <Ban className="w-3 h-3" />
                                  NO aplica
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Aplica
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2 border-b border-black/5">
                              <input
                                value={motivosDraft[p.id_tarea_plantilla] ?? p.exclusion?.motivo ?? ""}
                                onChange={(e) =>
                                  setMotivosDraft((prev) => ({
                                    ...prev,
                                    [p.id_tarea_plantilla]: e.target.value,
                                  }))
                                }
                                placeholder="Opcional…"
                                disabled={busy}
                                className="w-full border border-black/15 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#D4AF37] bg-white disabled:bg-black/[0.03]"
                              />
                            </td>

                            <td className="px-3 py-2 border-b border-black/5 text-right">
                              {p.aplica ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => upsertAplica(p.id_tarea_plantilla, true)}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                                    busy
                                      ? "bg-black/10 text-black/40 cursor-wait"
                                      : "bg-rose-600 text-white hover:bg-rose-700"
                                  }`}
                                >
                                  {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                                  {busy ? "Guardando..." : "Marcar NO aplica"}
                                </button>
                              ) : (
                                <div className="inline-flex items-center gap-2 justify-end">
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => upsertAplica(p.id_tarea_plantilla, false)}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                                      busy
                                        ? "bg-black/10 text-black/40 cursor-wait"
                                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                                    }`}
                                  >
                                    {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {busy ? "Guardando..." : "Hacer que aplique"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => upsertAplica(p.id_tarea_plantilla, true)}
                                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                                      busy
                                        ? "bg-black/10 text-black/40 cursor-wait"
                                        : "bg-black/5 text-black/70 hover:bg-black/10"
                                    }`}
                                    title="Guarda el estado NO aplica y el motivo"
                                  >
                                    {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {busy ? "..." : "Guardar NO aplica"}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <p className="mt-2 text-[10px] text-black/45">
                    Mostrando solo plantillas que tienen <b>TareaAsignada</b> para este cliente (según{" "}
                    <code>/tareas/asignadas</code>).
                  </p>
                </div>
              )}
            </>
          )}
      </div>
    </section>
  );
};

export default EdicionEjecutivoTab;
