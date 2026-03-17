import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import RichEditor from "../components/RichEditor";
import { getClientes, type ClienteOption } from "../service/Clientes.service";
import {
  getClienteBitacoras,
  createClienteBitacora,
  updateClienteBitacoraById,
  type ClienteBitacora,
} from "../service/bitacora.service";

type Props = {
  onBack: () => void;
};

type JwtFrontendPayload = {
  id: number;
  email: string;
  nombre?: string;
  nombreUsuario?: string;
  isSupervisorOrAdmin?: boolean;
  picture?: string;
  avatarUrl?: string;
  id_trabajador?: number;
  trabajadorId?: number;
  agenteId?: number;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

function fmtDateCL(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtTimeCL(iso?: string) {
  if (!iso) return "";
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

function clienteLabel(c: ClienteOption) {
  const alias = c.alias?.trim();
  if (alias) return `${c.razonSocial} (${alias})`;
  return c.razonSocial;
}

function getAuthToken(): string | null {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken") ||
    null
  );
}

function getAuthPayload(): JwtFrontendPayload | null {
  const token = getAuthToken();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );

    return JSON.parse(jsonPayload) as JwtFrontendPayload;
  } catch {
    return null;
  }
}

function getCurrentAgenteId(): number | null {
  const payload = getAuthPayload();

  console.log("Auth payload:", payload);

  const possibleValues = [
    payload?.agenteId,
    payload?.id_trabajador,
    payload?.trabajadorId,
    payload?.id,
  ];

  for (const value of possibleValues) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

export default function ClienteBitacoraPage({ onBack }: Props) {
  const [clienteSearch, setClienteSearch] = useState("");
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clientesLoading, setClientesLoading] = useState(false);
  const [selectedClienteId, setSelectedClienteId] = useState<number | "">("");

  const [fechaGestion, setFechaGestion] = useState(getTodayISO());
  const [titulo, setTitulo] = useState("");
  const [contenidoHtml, setContenidoHtml] = useState("");

  const [mes, setMes] = useState(getCurrentMonth());
  const [anio, setAnio] = useState(getCurrentYear());

  const [bitacoras, setBitacoras] = useState<ClienteBitacora[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);

  const years = useMemo(() => {
    const y = getCurrentYear();
    return [y - 1, y, y + 1];
  }, []);

  const selectedCliente = useMemo(
    () => clientes.find((c) => c.id === selectedClienteId) ?? null,
    [clientes, selectedClienteId]
  );

  const period = useMemo(() => rangeForMonth(anio, mes), [anio, mes]);

  async function loadClientes(search?: string) {
    setClientesLoading(true);
    setError(null);

    try {
      const agenteId = getCurrentAgenteId();

      console.log("AgenteId detectado desde token:", agenteId);

      if (!agenteId) {
        setClientes([]);
        setError("No se pudo identificar el usuario actual para filtrar su cartera.");
        return;
      }

      const rows = await getClientes({
        search: search?.trim() || undefined,
        soloActivos: true,
        agenteId,
        limit: 100,
      });

      console.log("Clientes cargados:", rows);

      setClientes(rows);

      if (selectedClienteId !== "" && !rows.some((c) => c.id === selectedClienteId)) {
        setSelectedClienteId("");
        setBitacoras([]);
      }
    } catch (e: any) {
      console.error("Error cargando clientes:", e);
      setError(e?.message || "No se pudieron cargar los clientes.");
    } finally {
      setClientesLoading(false);
    }
  }

  async function loadBitacoras(clienteId: number) {
    setLoading(true);
    setError(null);

    try {
      const data = await getClienteBitacoras(clienteId, {
        desde: period.desde,
        hasta: period.hasta,
      });

      const sorted = [...data].sort((a, b) => {
        const ta = new Date(a.updatedAt || a.createdAt || a.fechaGestion).getTime();
        const tb = new Date(b.updatedAt || b.createdAt || b.fechaGestion).getTime();
        return tb - ta;
      });

      setBitacoras(sorted);
    } catch (e: any) {
      setError(e?.message || "No se pudo cargar el historial del cliente.");
      setBitacoras([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadClientes();
  }, []);

  useEffect(() => {
    if (selectedClienteId === "") {
      setBitacoras([]);
      return;
    }

    loadBitacoras(Number(selectedClienteId));
  }, [selectedClienteId, period.desde, period.hasta]);

  function resetForm() {
    setFechaGestion(getTodayISO());
    setTitulo("");
    setContenidoHtml("");
    setEditingId(null);
  }

  function startEdit(b: ClienteBitacora) {
    setError(null);
    setEditingId(b.id);
    setFechaGestion((b.fechaGestion || "").slice(0, 10) || getTodayISO());
    setTitulo(b.titulo ?? "");
    setContenidoHtml(b.contenido || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (saving) return;

    if (!selectedClienteId) {
      setError("Debes seleccionar un cliente.");
      return;
    }

    const plain = stripHtml(contenidoHtml);
    if (!plain) {
      setError("Debes ingresar contenido.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingId) {
        await updateClienteBitacoraById(editingId, {
          titulo: titulo.trim() || null,
          contenido: contenidoHtml,
          fechaGestion,
        });
      } else {
        await createClienteBitacora(Number(selectedClienteId), {
          titulo: titulo.trim() || null,
          contenido: contenidoHtml,
          fechaGestion,
        });
      }

      resetForm();
      await loadBitacoras(Number(selectedClienteId));
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar la bitácora del cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSearchClientes() {
    await loadClientes(clienteSearch);
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50"
            title="Volver"
          >
            <ArrowLeft size={18} />
          </button>

          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Bitácora por cliente</h1>
            <p className="text-sm text-gray-500">
              Registra seguimientos, observaciones y gestiones asociadas a un cliente.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (selectedClienteId) loadBitacoras(Number(selectedClienteId));
          }}
          disabled={loading || !selectedClienteId}
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

      <div className="bg-white rounded-2xl shadow-sm border p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <label className="mb-2 block text-sm text-gray-500">Buscar cliente</label>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={clienteSearch}
                  onChange={(e) => setClienteSearch(e.target.value)}
                  placeholder="Busca por razón social, alias o RUT"
                  className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearchClientes();
                  }}
                />
              </div>

              <button
                onClick={handleSearchClientes}
                disabled={clientesLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                {clientesLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Search size={16} />
                )}
                Buscar
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <label className="mb-2 block text-sm text-gray-500">Cliente seleccionado</label>
            <select
              value={selectedClienteId}
              onChange={(e) => {
                const value = e.target.value ? Number(e.target.value) : "";
                setSelectedClienteId(value);
                resetForm();
              }}
              className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
            >
              <option value="">Selecciona un cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {clienteLabel(c)} · {c.rut}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCliente ? (
          <div className="mt-4 rounded-2xl border bg-gray-50 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-gray-800 font-medium">
                  <Building2 size={16} className="text-[var(--primary-color)]" />
                  <span className="truncate">{selectedCliente.razonSocial}</span>
                </div>

                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-gray-500">
                  <span>RUT: {selectedCliente.rut}</span>

                  {selectedCliente.alias ? (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>Alias: {selectedCliente.alias}</span>
                    </>
                  ) : null}

                  {selectedCliente.codigoCartera ? (
                    <>
                      <span className="text-gray-300">•</span>
                      <span>Cartera: {selectedCliente.codigoCartera}</span>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="text-xs text-gray-400">
                {bitacoras.length} registro(s) en el período
              </div>
            </div>
          </div>
        ) : null}
      </div>

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

          <div className="text-xs text-gray-400">
            Período: {period.desde} → {period.hasta}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl shadow-sm border p-5 sm:p-6 space-y-4 relative">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-gray-800 font-medium">
                <Building2 size={18} />
                {editingId ? "Editando bitácora de cliente" : "Nueva bitácora de cliente"}
              </div>

              {editingId ? (
                <button
                  onClick={resetForm}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  title="Cancelar edición"
                >
                  <X size={16} />
                  Cancelar edición
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-2 block text-sm text-gray-500">Cliente</label>
                <input
                  type="text"
                  disabled
                  value={selectedCliente ? `${selectedCliente.razonSocial} · ${selectedCliente.rut}` : ""}
                  placeholder="Selecciona un cliente arriba"
                  className="w-full rounded-xl border bg-gray-50 px-3 py-2 text-sm text-gray-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-gray-400" />
                <input
                  type="date"
                  value={fechaGestion}
                  onChange={(e) => setFechaGestion(e.target.value)}
                  disabled={saving}
                  className="border rounded-xl px-3 py-2 text-sm bg-white"
                />
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
              disabled={saving || !selectedClienteId}
              placeholder="Describe la gestión realizada con este cliente..."
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <button
                onClick={handleSave}
                disabled={saving || !selectedClienteId || !stripHtml(contenidoHtml)}
                className={[
                  "px-5 py-2.5 rounded-xl text-white text-sm font-medium inline-flex items-center justify-center gap-2",
                  saving || !selectedClienteId || !stripHtml(contenidoHtml)
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-[var(--primary-color)] hover:opacity-90",
                ].join(" ")}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? "Guardando..." : editingId ? "Actualizar" : "Guardar"}
              </button>

              <div className="text-xs text-gray-400">
                Tip: registra llamadas, seguimientos y observaciones relevantes
              </div>
            </div>

            {saving && (
              <div className="absolute inset-0 bg-white/40 rounded-2xl pointer-events-none" />
            )}
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl shadow-sm border">
            <div className="px-5 sm:px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="font-medium text-gray-800">Historial del cliente</h2>
                <p className="text-xs text-gray-500">
                  {selectedCliente
                    ? `${selectedCliente.razonSocial} · ${monthNameES(mes)} ${anio}`
                    : "Selecciona un cliente para ver su historial"}
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
              {!selectedCliente ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500">
                  Primero selecciona un cliente para ver o registrar su bitácora.
                </div>
              ) : loading ? (
                <div className="text-sm text-gray-500">Cargando historial...</div>
              ) : bitacoras.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-sm text-gray-500">
                  No hay bitácoras para este cliente en el período seleccionado.
                </div>
              ) : (
                <div className="space-y-3">
                  {bitacoras.map((b) => {
                    const updatedIso = b.updatedAt || b.createdAt || b.fechaGestion;
                    const changed =
                      !!b.updatedAt &&
                      !!b.createdAt &&
                      !isSameInstant(b.updatedAt, b.createdAt);

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
                              <span>{fmtDateCL(b.fechaGestion)}</span>

                              <span className="text-gray-300">•</span>

                              <span className="inline-flex items-center gap-1">
                                <Clock size={13} className="text-gray-400" />
                                Actualizado {fmtTimeCL(updatedIso)}
                              </span>

                              {b.trabajador?.nombre ? (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span>Por {b.trabajador.nombre}</span>
                                </>
                              ) : null}

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

                          <button
                            onClick={() => startEdit(b)}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            title="Editar bitácora"
                          >
                            <Pencil size={16} />
                            Editar
                          </button>
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