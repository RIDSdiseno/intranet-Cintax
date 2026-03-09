import React from "react";
import {
  assignAgenteToCliente,
  deleteCliente,
  listClientes,
  listTrabajadoresLite,
  updateCliente,
  type ClienteRow,
  type TrabajadorLite,
} from "../service/Clientes.service";

import CreateClienteModal from "../components/clientes/CreateClienteModal";
import UploadClientesExcelModal from "../components/clientes/UploadClientesExcelModal";
import { Field, ModalShell } from "../components/clientes/ModalShell";

import { Search, RefreshCw, Pencil, Trash2, UserRoundCog } from "lucide-react";

type Role = "ADMIN" | "SUPERVISOR" | "AGENTE";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function numOr(v: unknown, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normaliza respuestas típicas:
 * - axios -> { data: { items: [...] , total: n } }
 * - { items: [...] , total: n }
 * - { data: [...] }
 * - [...]
 */
function normalizeListResponse<T>(res: any): { items: T[]; total?: number } {
  const data = res?.data ?? res;
  if (Array.isArray(data)) return { items: data as T[], total: (data as T[]).length };
  if (Array.isArray(data?.items)) return { items: data.items as T[], total: data.total };
  if (Array.isArray(data?.data)) return { items: data.data as T[], total: data.total };
  if (Array.isArray(data?.clientes)) return { items: data.clientes as T[], total: data.total };
  if (Array.isArray(data?.rows)) return { items: data.rows as T[], total: data.total };
  if (Array.isArray(data?.results)) return { items: data.results as T[], total: data.total };
  return { items: [], total: 0 };
}

/**
 * === BUSQUEDA RUT "sin puntos" ===
 * Tu BD guarda rut con puntos (ej: 76.401.040-K)
 * Backend hace contains sobre el string, por eso "764" no matchea.
 *
 * Solución: si el input parece RUT, lo "formateamos incompleto" a:
 * - después de 2 dígitos ponemos "."
 * - después de 5 dígitos ponemos "."
 * Manteniendo el "-" si el usuario lo escribió.
 */
function cleanRutLike(input: string) {
  return input
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\./g, "")
    .replace(/[^0-9K-]/g, "");
}

function looksLikeRutInput(cleaned: string) {
  return /^[0-9K-]+$/.test(cleaned) && /[0-9]/.test(cleaned);
}

function formatRutBodyPartial(body: string) {
  if (body.length <= 2) return body;

  const a = body.slice(0, 2);
  const rest = body.slice(2);

  if (rest.length <= 3) return `${a}.${rest}`;

  const b = rest.slice(0, 3);
  const c = rest.slice(3);
  return c ? `${a}.${b}.${c}` : `${a}.${b}`;
}

function buildRutSearchTerm(q: string) {
  const cleaned = cleanRutLike(q);
  if (!cleaned) return null;
  if (!looksLikeRutInput(cleaned)) return null;

  if (cleaned.includes("-")) {
    const [bodyRaw, dvRaw] = cleaned.split("-");
    const body = (bodyRaw || "").replace(/[^0-9]/g, "");
    const dv = (dvRaw || "").replace(/[^0-9K]/g, "");
    if (!body) return null;

    const bodyFmt = formatRutBodyPartial(body);
    return dvRaw !== undefined ? `${bodyFmt}-${dv}` : bodyFmt;
  }

  const body = cleaned.replace(/[^0-9]/g, "");
  if (!body) return null;

  return formatRutBodyPartial(body);
}

export default function ClientesPage({ role }: { role: Role }) {
  const canManage = role === "ADMIN" || role === "SUPERVISOR";
  const canDelete = role === "ADMIN";

  // filtros
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounced(search, 300);

  const [soloActivos, setSoloActivos] = React.useState(true);
  const [cartera, setCartera] = React.useState("");
  const [agenteId, setAgenteId] = React.useState<number | "all">("all");

  // data
  const [rows, setRows] = React.useState<ClienteRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  // paginación
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(50);
  const skip = (page - 1) * pageSize;

  // trabajadores
  const [trabajadores, setTrabajadores] = React.useState<TrabajadorLite[]>([]);
  const [loadingTrabajadores, setLoadingTrabajadores] = React.useState(false);

  // modales
  const [editOpen, setEditOpen] = React.useState(false);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [excelOpen, setExcelOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const [selected, setSelected] = React.useState<ClienteRow | null>(null);

  const safeRows = safeArray<ClienteRow>(rows);
  const safeTrabajadores = safeArray<TrabajadorLite>(trabajadores);

  const agenteMap = React.useMemo(() => {
    const m = new Map<number, TrabajadorLite>();
    for (const t of safeTrabajadores) m.set(t.id_trabajador, t);
    return m;
  }, [safeTrabajadores]);

  const rutHint = React.useMemo(() => {
    const q = search.trim();
    return q ? buildRutSearchTerm(q) : null;
  }, [search]);

  async function loadTrabajadores() {
    setLoadingTrabajadores(true);
    try {
      const res = await listTrabajadoresLite({ soloActivos: true });
      const norm = normalizeListResponse<TrabajadorLite>(res);
      setTrabajadores(safeArray<TrabajadorLite>(norm.items));
    } catch (e) {
      console.error("Error cargando trabajadores:", e);
      setTrabajadores([]);
    } finally {
      setLoadingTrabajadores(false);
    }
  }

  async function loadClientes() {
    setLoading(true);
    try {
      const rawQ = debouncedSearch.trim();
      const rutQ = rawQ ? buildRutSearchTerm(rawQ) : null;
      const searchParam = rutQ ?? (rawQ || undefined);

      const res = await listClientes({
        search: searchParam,
        cartera: cartera.trim() || undefined,
        soloActivos,
        agenteId: agenteId === "all" ? null : agenteId,
        limit: pageSize,
        skip,
      });

      const norm = normalizeListResponse<ClienteRow>(res);
      const items = safeArray<ClienteRow>(norm.items);

      setRows(items);
      setTotal(numOr(norm.total, items.length));
    } catch (e) {
      console.error("Error listando clientes:", e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // init
  React.useEffect(() => {
    loadTrabajadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reset página cuando cambian filtros/pageSize
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, cartera, soloActivos, agenteId, pageSize]);

  // recargar cuando cambie todo
  React.useEffect(() => {
    loadClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, cartera, soloActivos, agenteId, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  // clamp page
  React.useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const from = total === 0 ? 0 : skip + 1;
  const to = total === 0 ? 0 : Math.min(skip + pageSize, total);

  return (
    <div className="p-6 space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="grid gap-3 md:grid-cols-12 items-end">
          <div className="md:col-span-5">
            <label className="text-xs text-gray-600">Buscar</label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <Search size={16} className="text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="RUT (con o sin puntos), razón social o alias"
                className="w-full outline-none text-sm"
              />
            </div>

            {rutHint && (
              <div className="mt-1 text-[11px] text-gray-500">
                Buscando RUT como: <span className="font-medium">{rutHint}</span>
              </div>
            )}
          </div>

          <div className="md:col-span-3">
            <label className="text-xs text-gray-600">Agente</label>
            <select
              value={agenteId === "all" ? "all" : String(agenteId)}
              onChange={(e) =>
                setAgenteId(e.target.value === "all" ? "all" : Number(e.target.value))
              }
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
              disabled={loadingTrabajadores}
            >
              <option value="all">Todos</option>
              {safeTrabajadores.map((t) => (
                <option key={t.id_trabajador} value={t.id_trabajador}>
                  {t.nombre} ({t.email})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-gray-600">Cartera</label>
            <input
              value={cartera}
              onChange={(e) => setCartera(e.target.value)}
              placeholder="Ej: CONTA/A01"
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm select-none">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={(e) => setSoloActivos(e.target.checked)}
              />
              Solo activos
            </label>

            <button
              type="button"
              onClick={loadClientes}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
              disabled={loading}
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>

          {/* pageSize */}
          <div className="md:col-span-12 flex items-center justify-end gap-2 pt-2">
            <span className="text-xs text-gray-600">Filas por página</span>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
              disabled={loading}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="text-sm text-gray-700">
            {loading ? "Cargando..." : `${total} clientes`}
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setExcelOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
                  disabled={loading}
                >
                  Cargar Excel
                </button>

                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                  disabled={loading}
                >
                  Nuevo cliente
                </button>
              </>
            )}

            <div className="text-sm text-gray-500 ml-2">
              Página {page} de {totalPages}
            </div>
          </div>
        </div>

        <div className="overflow-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr className="text-left">
                <th className="p-3">RUT</th>
                <th className="p-3">Razón social</th>
                <th className="p-3">Alias</th>
                <th className="p-3">Cartera</th>
                <th className="p-3">Agente</th>
                <th className="p-3">Estado</th>
                <th className="p-3 w-[220px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {safeRows.map((c) => {
                const agente = c.agenteId ? agenteMap.get(c.agenteId) : null;

                return (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="p-3 font-medium text-gray-900">{c.rut}</td>
                    <td className="p-3 text-gray-900">{c.razonSocial}</td>
                    <td className="p-3 text-gray-700">{c.alias ?? "—"}</td>
                    <td className="p-3 text-gray-700">{c.codigoCartera ?? "—"}</td>

                    <td className="p-3 text-gray-700">
                      {agente ? (
                        <div className="leading-tight">
                          <div className="text-gray-900">{agente.nombre}</div>
                          <div className="text-xs text-gray-500">{agente.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-500">Sin asignar</span>
                      )}
                    </td>

                    <td className="p-3">
                      <span
                        className={cls(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs border",
                          c.activo
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-gray-200 bg-gray-50 text-gray-700"
                        )}
                      >
                        {c.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={!canManage}
                          onClick={() => {
                            setSelected(c);
                            setEditOpen(true);
                          }}
                          type="button"
                          title={!canManage ? "Solo supervisor/admin" : "Editar"}
                        >
                          <Pencil size={14} />
                          Editar
                        </button>

                        <button
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50 disabled:opacity-50"
                          disabled={!canManage}
                          onClick={() => {
                            setSelected(c);
                            setAssignOpen(true);
                          }}
                          type="button"
                          title={!canManage ? "Solo supervisor/admin" : "Reasignar"}
                        >
                          <UserRoundCog size={14} />
                          Reasignar
                        </button>

                        <button
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                          disabled={!canDelete}
                          onClick={() => {
                            setSelected(c);
                            setDeleteOpen(true);
                          }}
                          type="button"
                          title={!canDelete ? "Solo admin" : "Eliminar"}
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && safeRows.length === 0 && (
                <tr>
                  <td className="p-6 text-center text-gray-500" colSpan={7}>
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage(1)}
            >
              Primero
            </button>

            <button
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </button>
          </div>

          <div className="text-sm text-gray-600">
            {from}-{to} de {total}
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Siguiente
            </button>

            <button
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(totalPages)}
            >
              Último
            </button>
          </div>

          {/* Ir a página */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-600">Ir a</span>
            <input
              className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm"
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                setPage(Math.min(totalPages, Math.max(1, v)));
              }}
              disabled={loading}
            />
            <span className="text-xs text-gray-600">/ {totalPages}</span>
          </div>
        </div>
      </div>

      {/* Modales */}
      {editOpen && selected && (
        <EditClienteModal
          cliente={selected}
          canManage={canManage}
          onClose={() => {
            setEditOpen(false);
            setSelected(null);
          }}
          onSaved={async () => {
            setEditOpen(false);
            setSelected(null);
            await loadClientes();
          }}
        />
      )}

      {assignOpen && selected && (
        <AssignAgenteModal
          cliente={selected}
          trabajadores={safeTrabajadores}
          onClose={() => {
            setAssignOpen(false);
            setSelected(null);
          }}
          onSaved={async () => {
            setAssignOpen(false);
            setSelected(null);
            await loadClientes();
          }}
        />
      )}

      {deleteOpen && selected && (
        <DeleteClienteModal
          cliente={selected}
          onClose={() => {
            setDeleteOpen(false);
            setSelected(null);
          }}
          onDeleted={async () => {
            setDeleteOpen(false);
            setSelected(null);
            await loadClientes();
          }}
        />
      )}

      {/* ✅ Componentes */}
      {excelOpen && (
        <UploadClientesExcelModal
          canManage={canManage}
          onClose={() => setExcelOpen(false)}
          onDone={async () => {
            setExcelOpen(false);
            await loadClientes();
          }}
        />
      )}

      {createOpen && (
        <CreateClienteModal
          canManage={canManage}
          trabajadores={safeTrabajadores}
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await loadClientes();
          }}
        />
      )}
    </div>
  );
}

/** ===================== Modales locales ===================== */

function EditClienteModal({
  cliente,
  canManage,
  onClose,
  onSaved,
}: {
  cliente: ClienteRow;
  canManage: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rut, setRut] = React.useState(cliente.rut);
  const [razonSocial, setRazonSocial] = React.useState(cliente.razonSocial);
  const [alias, setAlias] = React.useState(cliente.alias ?? "");
  const [codigoCartera, setCodigoCartera] = React.useState(cliente.codigoCartera ?? "");
  const [activo, setActivo] = React.useState<boolean>(cliente.activo);

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setError(null);

    if (!canManage) return setError("Sin permisos.");
    if (!rut.trim() || !razonSocial.trim()) return setError("RUT y Razón Social son obligatorios.");

    setSaving(true);
    try {
      await updateCliente(cliente.id, {
        rut: rut.trim(),
        razonSocial: razonSocial.trim(),
        alias: alias.trim() ? alias.trim() : null,
        codigoCartera: codigoCartera.trim() ? codigoCartera.trim() : null,
        activo,
      });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Error guardando cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Editar cliente" onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="RUT">
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
          />
        </Field>

        <Field label="Estado">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Activo
          </label>
        </Field>

        <div className="md:col-span-2">
          <Field label="Razón Social">
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Alias">
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Opcional"
          />
        </Field>

        <Field label="Cartera">
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={codigoCartera}
            onChange={(e) => setCodigoCartera(e.target.value)}
            placeholder="Ej: CONTA/A01"
          />
        </Field>
      </div>

      {error && <div className="mt-3 text-sm text-rose-700">{error}</div>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}

function AssignAgenteModal({
  cliente,
  trabajadores,
  onClose,
  onSaved,
}: {
  cliente: ClienteRow;
  trabajadores: TrabajadorLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = React.useState<string>(cliente.agenteId ? String(cliente.agenteId) : "none");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const agenteId = value === "none" ? null : Number(value);
      await assignAgenteToCliente(cliente.id, agenteId);
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Error reasignando agente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Reasignar agente" onClose={onClose}>
      <div className="text-sm text-gray-700">
        Cliente: <span className="font-medium">{cliente.razonSocial}</span>
        <div className="text-xs text-gray-500">{cliente.rut}</div>
      </div>

      <div className="mt-4">
        <label className="text-xs text-gray-600">Nuevo agente</label>
        <select
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        >
          <option value="none">Sin asignar</option>
          {trabajadores.map((t) => (
            <option key={t.id_trabajador} value={t.id_trabajador}>
              {t.nombre} ({t.email})
            </option>
          ))}
        </select>
        <div className="mt-2 text-xs text-gray-600">
          Este endpoint también ajusta <span className="font-medium">codigoCartera</span> con{" "}
          <span className="font-medium">carpetaDriveCodigo</span> del agente.
        </div>
      </div>

      {error && <div className="mt-3 text-sm text-rose-700">{error}</div>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Reasignar"}
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteClienteModal({
  cliente,
  onClose,
  onDeleted,
}: {
  cliente: ClienteRow;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirmDelete() {
    setError(null);
    setBusy(true);
    try {
      await deleteCliente(cliente.id);
      onDeleted();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Error eliminando cliente");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="Eliminar cliente" onClose={onClose}>
      <div className="text-sm text-gray-700">
        Vas a eliminar:
        <div className="mt-1 font-medium text-gray-900">{cliente.razonSocial}</div>
        <div className="text-xs text-gray-500">{cliente.rut}</div>
      </div>

      <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
        Esta acción es irreversible (hard delete).
      </div>

      {error && <div className="mt-3 text-sm text-rose-700">{error}</div>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          onClick={onClose}
          disabled={busy}
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
          onClick={confirmDelete}
          disabled={busy}
        >
          {busy ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    </ModalShell>
  );
}