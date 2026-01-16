// src/pages/creacion-tareas/tabs/AsignarManualTab.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Loader2,
  Users,
  CheckSquare,
  Square,
  Sparkles,
  Layers,
  Calendar,
  UserCheck,
  Building2,
  ClipboardList,
  Search,
  RefreshCw,
} from "lucide-react";
import type {
  Cliente,
  LoadState,
  TareaPlantilla,
  Trabajador,
} from "../shared/types";
import { getAuthHeaders } from "../shared/auth";
import {
  dateStringToISOAtNoon,
  endOfMonthDateString,
  nombreMes,
} from "../shared/date";

type Props = {
  API_BASE_URL: string;
  trabajadores: Trabajador[];
};

type Mode = "manual" | "masivo";

/* ---------------------------------------
  UI Helpers
---------------------------------------- */
const Pill: React.FC<{
  active?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border transition
      ${
        active
          ? "border-[#D4AF37] bg-[#FFF7D6] text-black shadow-sm"
          : "border-black/10 bg-white hover:bg-black/[0.03] text-black/70"
      }`}
  >
    {icon}
    {children}
  </button>
);

const SoftCard: React.FC<{
  title: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, right, children, className }) => (
  <div
    className={`bg-white rounded-2xl border border-black/10 shadow-sm ${className ?? ""}`}
  >
    <div className="px-4 py-3 border-b border-black/5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-black/[0.04] border border-black/10 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <p className="text-[12px] font-semibold text-black/80">{title}</p>
          <p className="text-[10px] text-black/45">
            Selecciona y revisa antes de crear.
          </p>
        </div>
      </div>
      {right}
    </div>

    <div className="p-4">{children}</div>
  </div>
);

const MiniBtn: React.FC<{
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}> = ({ onClick, disabled, children, icon }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold border transition
      ${
        disabled
          ? "border-black/10 bg-black/[0.04] text-black/40 cursor-not-allowed"
          : "border-black/10 bg-white hover:bg-black/[0.03] text-black/70"
      }`}
  >
    {icon}
    {children}
  </button>
);

const AsignarManualTab: React.FC<Props> = ({ API_BASE_URL, trabajadores }) => {
  // data
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [plantillas, setPlantillas] = useState<TareaPlantilla[]>([]);
  const [loadingClientes, setLoadingClientes] = useState<LoadState>("idle");
  const [loadingPlantillas, setLoadingPlantillas] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchClientes = async () => {
    setLoadingClientes("loading");
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/clientes?limit=1000`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const raw: unknown = await res.json();
      const items: Cliente[] = Array.isArray((raw as any)?.items)
        ? (raw as any).items
        : Array.isArray(raw)
        ? (raw as Cliente[])
        : [];
      const uniqueByRut = Array.from(
        new Map(items.map((c) => [c.rut, c])).values()
      );
      setClientes(uniqueByRut);
      setLoadingClientes("success");
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar los clientes.");
      setLoadingClientes("error");
    }
  };

  const fetchPlantillas = async () => {
    setLoadingPlantillas("loading");
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tareas/plantillas`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data: TareaPlantilla[] = await res.json();
      setPlantillas((data || []).filter((p) => p.activo));
      setLoadingPlantillas("success");
    } catch (e) {
      console.error(e);
      setError("No se pudieron cargar las plantillas.");
      setLoadingPlantillas("error");
    }
  };

  useEffect(() => {
    fetchClientes();
    fetchPlantillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // mode
  const [mode, setMode] = useState<Mode>("manual");

  // form (manual)
  const [rutSeleccionado, setRutSeleccionado] = useState<string>("");
  const [busquedaCliente, setBusquedaCliente] = useState<string>("");
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] =
    useState<string>("");
  const [trabajadorSeleccionadoId, setTrabajadorSeleccionadoId] =
    useState<string>("");

  // form (masivo)
  const [busquedaMasivaCliente, setBusquedaMasivaCliente] =
    useState<string>("");
  const [busquedaMasivaPlantilla, setBusquedaMasivaPlantilla] =
    useState<string>("");

  const [clientesSeleccionados, setClientesSeleccionados] = useState<
    Set<string>
  >(new Set());
  const [plantillasSeleccionadas, setPlantillasSeleccionadas] = useState<
    Set<number>
  >(new Set());

  const now = new Date();
  const [anio, setAnio] = useState<number>(now.getFullYear());
  const [mes, setMes] = useState<number>(now.getMonth() + 1);

  const [fechaVencimiento, setFechaVencimiento] = useState<string>(() =>
    endOfMonthDateString(now.getFullYear(), now.getMonth() + 1)
  );

  useEffect(() => {
    setFechaVencimiento(endOfMonthDateString(anio, mes));
  }, [anio, mes]);

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      const rut = (c.rut || "").toLowerCase();
      const razon = (c.razonSocial || "").toLowerCase();
      const alias = (c.alias || "").toLowerCase();
      return rut.includes(q) || razon.includes(q) || alias.includes(q);
    });
  }, [clientes, busquedaCliente]);

  const clientesFiltradosMasivo = useMemo(() => {
    const q = busquedaMasivaCliente.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => {
      const rut = (c.rut || "").toLowerCase();
      const razon = (c.razonSocial || "").toLowerCase();
      const alias = (c.alias || "").toLowerCase();
      return rut.includes(q) || razon.includes(q) || alias.includes(q);
    });
  }, [clientes, busquedaMasivaCliente]);

  const plantillasFiltradasMasivo = useMemo(() => {
    const q = busquedaMasivaPlantilla.trim().toLowerCase();
    if (!q) return plantillas;
    return plantillas.filter((p) => {
      const name = (p.nombre || "").toLowerCase();
      const doc = (p.codigoDocumento || "").toLowerCase();
      const det = (p.detalle || "").toLowerCase();
      return name.includes(q) || doc.includes(q) || det.includes(q);
    });
  }, [plantillas, busquedaMasivaPlantilla]);

  const [asignando, setAsignando] = useState(false);

  const opcionesAnios = useMemo(() => {
    const y = now.getFullYear();
    return [y - 1, y, y + 1];
  }, [now]);

  // ✅ Manual: NO TOCAR (ya funciona)
  const handleAsignarTarea = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rutSeleccionado || !plantillaSeleccionadaId || !trabajadorSeleccionadoId) {
      alert("Debes seleccionar cliente, tarea y trabajador.");
      return;
    }

    const fechaProgramadaISO = dateStringToISOAtNoon(fechaVencimiento);
    if (!fechaProgramadaISO) {
      alert("Fecha de vencimiento inválida.");
      return;
    }

    try {
      setAsignando(true);

      const body = {
        tareaPlantillaId: Number(plantillaSeleccionadaId),
        rutClientes: [rutSeleccionado],
        fechaProgramada: fechaProgramadaISO,
        asignarAId: Number(trabajadorSeleccionadoId),
      };

      const res = await fetch(`${API_BASE_URL}/tareas/crear-desde-plantilla`, {
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

      const data: any = await res.json();
      alert(`✅ Tarea creada/asignada. Registros creados: ${data?.count ?? 1}`);

      setRutSeleccionado("");
      setPlantillaSeleccionadaId("");
      setTrabajadorSeleccionadoId("");
      setBusquedaCliente("");
    } catch (err: unknown) {
      console.error("[Front] Error creando/asignando tarea", err);
      const msg =
        err instanceof Error && err.message
          ? `No se pudo crear/asignar la tarea. Detalle: ${err.message}`
          : "No se pudo crear/asignar la tarea.";
      alert(msg);
    } finally {
      setAsignando(false);
    }
  };

  // helpers masivo
  const toggleClienteRut = (rut: string) => {
    setClientesSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(rut)) next.delete(rut);
      else next.add(rut);
      return next;
    });
  };

  const togglePlantillaId = (id: number) => {
    setPlantillasSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllClientesFiltrados = () => {
    setClientesSeleccionados((prev) => {
      const next = new Set(prev);
      clientesFiltradosMasivo.forEach((c) => next.add(c.rut));
      return next;
    });
  };

  const clearClientesSeleccionados = () => setClientesSeleccionados(new Set());

  const selectAllPlantillasFiltradas = () => {
    setPlantillasSeleccionadas((prev) => {
      const next = new Set(prev);
      plantillasFiltradasMasivo.forEach((p) => next.add(p.id_tarea_plantilla));
      return next;
    });
  };

  const clearPlantillasSeleccionadas = () => setPlantillasSeleccionadas(new Set());

  const totalCombinaciones = useMemo(() => {
    const c = clientesSeleccionados.size;
    const p = plantillasSeleccionadas.size;
    return c * p;
  }, [clientesSeleccionados.size, plantillasSeleccionadas.size]);

  // ✅ Masivo: FIX trabajadorId (backend masivo lo exige)
  const handleAsignarMasivo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!trabajadorSeleccionadoId) {
      alert("Debes seleccionar un trabajador responsable.");
      return;
    }
    if (clientesSeleccionados.size === 0) {
      alert("Debes seleccionar al menos 1 cliente.");
      return;
    }
    if (plantillasSeleccionadas.size === 0) {
      alert("Debes seleccionar al menos 1 plantilla.");
      return;
    }

    const fechaProgramadaISO = dateStringToISOAtNoon(fechaVencimiento);
    if (!fechaProgramadaISO) {
      alert("Fecha de vencimiento inválida.");
      return;
    }

    const tId = Number(trabajadorSeleccionadoId);
    if (!Number.isFinite(tId) || tId <= 0) {
      alert("Debes seleccionar un trabajador válido.");
      return;
    }

    const ok = confirm(
      `Vas a crear/asignar ${totalCombinaciones} tareas (clientes: ${clientesSeleccionados.size} × plantillas: ${plantillasSeleccionadas.size}).\n\n¿Continuar?`
    );
    if (!ok) return;

    try {
      setAsignando(true);

      const body = {
        rutClientes: Array.from(clientesSeleccionados),
        plantillaIds: Array.from(plantillasSeleccionadas),
        fechaProgramada: fechaProgramadaISO,

        // ✅ nombre que espera el controller masivo
        trabajadorId: tId,

        skipDuplicates: true,
      };

      const res = await fetch(
        `${API_BASE_URL}/tareas/crear-desde-plantilla-masivo`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message || j?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const data: any = await res.json();
      const created = data?.created ?? data?.count ?? data?.result?.count ?? null;
      const skipped = data?.skipped ?? null;

      alert(
        `✅ Masivo OK.\nSolicitados: ${totalCombinaciones}\nCreados: ${
          created ?? "—"
        }${skipped !== null ? `\nOmitidos (duplicados): ${skipped}` : ""}`
      );

      clearClientesSeleccionados();
      clearPlantillasSeleccionadas();
      setTrabajadorSeleccionadoId("");
      setBusquedaMasivaCliente("");
      setBusquedaMasivaPlantilla("");
    } catch (err: unknown) {
      console.error("[Front] Error masivo", err);
      const msg =
        err instanceof Error && err.message
          ? `No se pudo crear/asignar masivo. Detalle: ${err.message}`
          : "No se pudo crear/asignar masivo.";
      alert(msg);
    } finally {
      setAsignando(false);
    }
  };

  const headerStats = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="px-3 py-2 rounded-xl border border-black/10 bg-white text-[11px] text-black/70">
        <b className="text-black/80">{clientes.length}</b> clientes
      </div>
      <div className="px-3 py-2 rounded-xl border border-black/10 bg-white text-[11px] text-black/70">
        <b className="text-black/80">{plantillas.length}</b> plantillas
      </div>
      {mode === "masivo" ? (
        <div className="px-3 py-2 rounded-xl border border-black/10 bg-white text-[11px] text-black/70">
          <b className="text-black/80">{totalCombinaciones}</b> combinaciones
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="rounded-3xl border border-black/5 bg-gradient-to-br from-white via-white to-black/[0.02] shadow-sm p-4 flex flex-col gap-4">
      {/* Top header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-black/[0.04] border border-black/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-black/60" />
          </div>
          <div>
            <h2 className="text-[14px] font-semibold text-black/85">
              Asignación de tareas
            </h2>
            <p className="text-[11px] text-black/55">
              Manual (1 cliente) o masivo (multi clientes + multi plantillas).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill
            active={mode === "manual"}
            onClick={() => setMode("manual")}
            icon={<ClipboardList className="w-4 h-4" />}
          >
            Manual
          </Pill>
          <Pill
            active={mode === "masivo"}
            onClick={() => setMode("masivo")}
            icon={<Layers className="w-4 h-4" />}
          >
            Masivo
          </Pill>

          <div className="w-px h-8 bg-black/10 mx-1 hidden md:block" />

          <MiniBtn
            onClick={fetchClientes}
            disabled={loadingClientes === "loading"}
            icon={
              <RefreshCw
                className={`w-4 h-4 ${
                  loadingClientes === "loading" ? "animate-spin" : ""
                }`}
              />
            }
          >
            Clientes
          </MiniBtn>
          <MiniBtn
            onClick={fetchPlantillas}
            disabled={loadingPlantillas === "loading"}
            icon={
              <RefreshCw
                className={`w-4 h-4 ${
                  loadingPlantillas === "loading" ? "animate-spin" : ""
                }`}
              />
            }
          >
            Plantillas
          </MiniBtn>
        </div>
      </div>

      {headerStats}

      {/* Error banner */}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[11px] text-rose-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" />
          <div>
            <p className="font-semibold">Ocurrió un problema</p>
            <p className="text-rose-700/80">{error}</p>
          </div>
        </div>
      ) : null}

      {/* Content */}
      {mode === "manual" ? (
        <SoftCard
          title="Crear tarea asignada (manual)"
          icon={<ClipboardList className="w-4 h-4 text-black/60" />}
          right={
            <div className="text-[10px] text-black/45">
              Endpoint: <code>/tareas/crear-desde-plantilla</code>
            </div>
          }
          className="max-w-3xl"
        >
          <form onSubmit={handleAsignarTarea} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              {/* Cliente */}
              <div className="rounded-2xl border border-black/10 bg-black/[0.015] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-black/55" />
                  <p className="font-semibold text-black/75">Cliente</p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-black/40 absolute left-2 top-2.5" />
                  <input
                    type="text"
                    value={busquedaCliente}
                    onChange={(e) => setBusquedaCliente(e.target.value)}
                    placeholder="Buscar por RUT, razón social o alias…"
                    className="w-full pl-8 pr-2 py-2 rounded-xl border border-black/15 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  />
                </div>

                <select
                  value={rutSeleccionado}
                  onChange={(e) => setRutSeleccionado(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  required
                >
                  <option value="">
                    {clientesFiltrados.length === 0
                      ? "Sin resultados…"
                      : "Selecciona un cliente…"}
                  </option>
                  {clientesFiltrados.map((c) => (
                    <option key={c.id ?? c.rut} value={c.rut}>
                      {c.rut} — {c.razonSocial}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-[10px] text-black/45">
                  Mostrando {clientesFiltrados.length} de {clientes.length}
                </p>
              </div>

              {/* Plantilla */}
              <div className="rounded-2xl border border-black/10 bg-black/[0.015] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-4 h-4 text-black/55" />
                  <p className="font-semibold text-black/75">Plantilla</p>
                </div>

                <select
                  value={plantillaSeleccionadaId}
                  onChange={(e) => setPlantillaSeleccionadaId(e.target.value)}
                  className="w-full rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  required
                >
                  <option value="">Selecciona una tarea…</option>
                  {plantillas.map((p) => {
                    const tag = p.presentacion === "CLIENTE" ? "CLI" : "INT";
                    const labelDocumento = p.codigoDocumento
                      ? `${p.codigoDocumento} — ${p.nombre}`
                      : p.nombre;
                    return (
                      <option
                        key={p.id_tarea_plantilla}
                        value={String(p.id_tarea_plantilla)}
                      >
                        {`[${tag}] ${labelDocumento}`}
                      </option>
                    );
                  })}
                </select>

                <p className="mt-2 text-[10px] text-black/45">
                  Se muestran solo plantillas activas.
                </p>
              </div>

              {/* Responsable */}
              <div className="rounded-2xl border border-black/10 bg-black/[0.015] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="w-4 h-4 text-black/55" />
                  <p className="font-semibold text-black/75">Responsable</p>
                </div>

                <select
                  value={trabajadorSeleccionadoId}
                  onChange={(e) => setTrabajadorSeleccionadoId(e.target.value)}
                  className="w-full rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  required
                >
                  <option value="">Selecciona un trabajador…</option>
                  {trabajadores.map((t) => (
                    <option
                      key={t.id_trabajador}
                      value={String(t.id_trabajador)}
                    >
                      {t.nombre} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Fecha */}
              <div className="rounded-2xl border border-black/10 bg-black/[0.015] p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-black/55" />
                  <p className="font-semibold text-black/75">Vencimiento</p>
                </div>

                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="w-full rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  required
                />

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <select
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                    className="rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {nombreMes(m)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={anio}
                    onChange={(e) => setAnio(Number(e.target.value))}
                    className="rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    {opcionesAnios.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="mt-2 text-[10px] text-black/45">
                  Mes/Año ajustan al fin de mes automáticamente.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-[10px] text-black/45">
                Tip: usa búsqueda para llegar rápido al cliente.
              </div>

              <button
                type="submit"
                disabled={asignando}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold border border-black/10 text-white transition
                  ${
                    asignando
                      ? "bg-black/40 cursor-wait"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
              >
                {asignando && <Loader2 className="w-4 h-4 animate-spin" />}
                {asignando ? "Creando..." : "Crear y asignar"}
              </button>
            </div>

            {(loadingClientes === "loading" ||
              loadingPlantillas === "loading") && (
              <p className="text-[11px] text-black/50 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos…
              </p>
            )}
          </form>
        </SoftCard>
      ) : (
        <form
          onSubmit={handleAsignarMasivo}
          className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        >
          <SoftCard
            title={`Clientes (${clientesSeleccionados.size})`}
            icon={<Building2 className="w-4 h-4 text-black/60" />}
            right={
              <div className="flex gap-2">
                <MiniBtn onClick={selectAllClientesFiltrados}>
                  Seleccionar filtrados
                </MiniBtn>
                <MiniBtn onClick={clearClientesSeleccionados}>Limpiar</MiniBtn>
              </div>
            }
          >
            <div className="relative">
              <Search className="w-4 h-4 text-black/40 absolute left-2 top-2.5" />
              <input
                value={busquedaMasivaCliente}
                onChange={(e) => setBusquedaMasivaCliente(e.target.value)}
                placeholder="Buscar por RUT, razón social o alias…"
                className="w-full pl-8 pr-2 py-2 rounded-xl border border-black/15 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              />
            </div>

            <div className="mt-3 max-h-72 overflow-auto border border-black/10 rounded-2xl">
              {clientesFiltradosMasivo.length === 0 ? (
                <div className="p-3 text-[11px] text-black/50">
                  Sin resultados…
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {clientesFiltradosMasivo.map((c) => {
                    const checked = clientesSeleccionados.has(c.rut);
                    return (
                      <li key={c.id ?? c.rut}>
                        <button
                          type="button"
                          onClick={() => toggleClienteRut(c.rut)}
                          className="w-full text-left px-3 py-2 hover:bg-black/[0.03] flex items-start gap-2"
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 mt-0.5 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 mt-0.5 text-black/30" />
                          )}
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-black/80 truncate">
                              {c.rut} — {c.razonSocial}
                            </div>
                            {c.alias ? (
                              <div className="text-[10px] text-black/45 truncate">
                                Alias: {c.alias}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="mt-2 text-[10px] text-black/45">
              Mostrando {clientesFiltradosMasivo.length} de {clientes.length}
            </p>
          </SoftCard>

          <SoftCard
            title={`Plantillas (${plantillasSeleccionadas.size})`}
            icon={<ClipboardList className="w-4 h-4 text-black/60" />}
            right={
              <div className="flex gap-2">
                <MiniBtn onClick={selectAllPlantillasFiltradas}>
                  Seleccionar filtradas
                </MiniBtn>
                <MiniBtn onClick={clearPlantillasSeleccionadas}>Limpiar</MiniBtn>
              </div>
            }
          >
            <div className="relative">
              <Search className="w-4 h-4 text-black/40 absolute left-2 top-2.5" />
              <input
                value={busquedaMasivaPlantilla}
                onChange={(e) => setBusquedaMasivaPlantilla(e.target.value)}
                placeholder="Buscar por nombre, detalle o código…"
                className="w-full pl-8 pr-2 py-2 rounded-xl border border-black/15 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              />
            </div>

            <div className="mt-3 max-h-72 overflow-auto border border-black/10 rounded-2xl">
              {plantillasFiltradasMasivo.length === 0 ? (
                <div className="p-3 text-[11px] text-black/50">
                  Sin resultados…
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {plantillasFiltradasMasivo.map((p) => {
                    const checked = plantillasSeleccionadas.has(
                      p.id_tarea_plantilla
                    );
                    const tag = p.presentacion === "CLIENTE" ? "CLI" : "INT";
                    const labelDocumento = p.codigoDocumento
                      ? `${p.codigoDocumento} — ${p.nombre}`
                      : p.nombre;

                    return (
                      <li key={p.id_tarea_plantilla}>
                        <button
                          type="button"
                          onClick={() => togglePlantillaId(p.id_tarea_plantilla)}
                          className="w-full text-left px-3 py-2 hover:bg-black/[0.03] flex items-start gap-2"
                        >
                          {checked ? (
                            <CheckSquare className="w-4 h-4 mt-0.5 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4 mt-0.5 text-black/30" />
                          )}
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-black/80 truncate">
                              [{tag}] {labelDocumento}
                            </div>
                            {p.detalle ? (
                              <div className="text-[10px] text-black/45 truncate">
                                {p.detalle}
                              </div>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <p className="mt-2 text-[10px] text-black/45">
              Mostrando {plantillasFiltradasMasivo.length} de {plantillas.length}
            </p>
          </SoftCard>

          <SoftCard
            title="Configuración"
            icon={<UserCheck className="w-4 h-4 text-black/60" />}
            right={
              <div className="text-[10px] text-black/45">
                Endpoint: <code>/tareas/crear-desde-plantilla-masivo</code>
              </div>
            }
          >
            <label className="block">
              <span className="text-[11px] font-semibold text-black/70">
                Responsable
              </span>
              <select
                value={trabajadorSeleccionadoId}
                onChange={(e) => setTrabajadorSeleccionadoId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                required
              >
                <option value="">Selecciona un trabajador…</option>
                {trabajadores.map((t) => (
                  <option
                    key={t.id_trabajador}
                    value={String(t.id_trabajador)}
                  >
                    {t.nombre} ({t.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="block mt-3">
              <span className="text-[11px] font-semibold text-black/70">
                Vencimiento
              </span>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="mt-1 w-full rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-2 mt-3">
              <select
                value={mes}
                onChange={(e) => setMes(Number(e.target.value))}
                className="rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {nombreMes(m)}
                  </option>
                ))}
              </select>

              <select
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
                className="rounded-xl border border-black/15 px-2 py-2 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              >
                {opcionesAnios.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-3">
              <p className="text-[11px] font-semibold text-black/75">Resumen</p>
              <div className="mt-1 text-[11px] text-black/60">
                Clientes:{" "}
                <b className="text-black/80">{clientesSeleccionados.size}</b>
                <br />
                Plantillas:{" "}
                <b className="text-black/80">{plantillasSeleccionadas.size}</b>
                <br />
                Total: <b className="text-black/85">{totalCombinaciones}</b>
              </div>
              {totalCombinaciones > 1500 ? (
                <p className="mt-2 text-[10px] text-amber-700">
                  ⚠️ Alto volumen. Recomendado que el backend use{" "}
                  <b>createMany</b> + <b>skipDuplicates</b> (o loteo).
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={asignando}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold border border-black/10 text-white transition
                  ${
                    asignando
                      ? "bg-black/40 cursor-wait"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
              >
                {asignando && <Loader2 className="w-4 h-4 animate-spin" />}
                {asignando ? "Creando..." : "Crear masivo"}
              </button>
            </div>

            {(loadingClientes === "loading" ||
              loadingPlantillas === "loading") && (
              <p className="mt-3 text-[11px] text-black/50 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos…
              </p>
            )}
          </SoftCard>
        </form>
      )}

      <div className="text-[10px] text-black/45 flex items-center gap-2">
        <Users className="w-4 h-4 text-black/40" />
        {mode === "manual" ? (
          <>
            Usa <code>/clientes</code>, <code>/tareas/plantillas</code> y{" "}
            <code>/tareas/crear-desde-plantilla</code>.
          </>
        ) : (
          <>
            Usa <code>/clientes</code>, <code>/tareas/plantillas</code> y{" "}
            <code>/tareas/crear-desde-plantilla-masivo</code>.
          </>
        )}
      </div>
    </section>
  );
};

export default AsignarManualTab;
