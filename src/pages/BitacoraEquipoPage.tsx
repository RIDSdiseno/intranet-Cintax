// src/pages/BitacoraEquipoPage.tsx
import { useEffect, useMemo, useState } from "react";
import sanitizeHtml from "sanitize-html";
import {
  deleteClienteBitacoraById,
  getClienteBitacorasEquipo,
  updateClienteBitacoraById,
  type ClienteBitacora,
} from "../service/bitacora.service";
import type { Role } from "../types/bitacora";
import {
  Trash2,
  Loader2,
  RefreshCw,
  Clock,
  Pencil,
  Save,
  X,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Search,
  Building2,
  User2,
} from "lucide-react";
import { exportBitacorasToExcelStyled } from "../utils/bitacorasExcel";

type Toast = { type: "ok" | "error"; msg: string };

type JwtFrontendPayload = {
  id: number;
  email: string;
  nombre?: string;
  nombreUsuario?: string;
  isSupervisorOrAdmin?: boolean;
  isAdmin?: boolean;
  isSupervisor?: boolean;
  picture?: string;
  avatarUrl?: string;
  role?: string | number;
  rol?: string | number;
  roleId?: string | number;
  role_id?: string | number;
  roleName?: string;
  role_name?: string;
};

type FilterOption = {
  id: string;
  label: string;
};

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

function normalizeRole(v: any): Role | undefined {
  if (v == null) return undefined;

  if (typeof v === "string") {
    const s = v.trim().toUpperCase();
    if (s === "ADMIN" || s === "ADMINISTRADOR") return "ADMIN";
    if (s === "SUPERVISOR") return "SUPERVISOR";
    if (s === "AGENTE" || s === "TRABAJADOR" || s === "USER") return "AGENTE";
  }

  if (typeof v === "number") {
    if (v === 1) return "ADMIN";
    if (v === 2) return "SUPERVISOR";
    if (v === 3) return "AGENTE";
  }

  return undefined;
}

function canManageFromToken(): boolean {
  const payload = getAuthPayload();

  if (!payload) return false;

  if (payload.isAdmin === true) return true;
  if (payload.isSupervisor === true) return true;
  if (payload.isSupervisorOrAdmin === true) return true;

  const role =
    normalizeRole(payload.role) ||
    normalizeRole(payload.rol) ||
    normalizeRole(payload.roleId) ||
    normalizeRole(payload.role_id) ||
    normalizeRole(payload.roleName) ||
    normalizeRole(payload.role_name);

  return role === "ADMIN" || role === "SUPERVISOR";
}

function compactHtml(raw: string) {
  const html = raw || "";

  let out = html.replace(/\r\n/g, "\n");
  out = out.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "<br/>");
  out = out.replace(/(<br\s*\/?>\s*){3,}/gi, "<br/><br/>");
  out = out.replace(/^(<br\s*\/?>\s*)+/gi, "");

  return out.trim();
}

function safeHtml(html: string) {
  const cleaned = compactHtml(html);

  return sanitizeHtml(cleaned, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "blockquote",
      "code",
      "pre",
      "ul",
      "ol",
      "li",
      "h1",
      "h2",
      "h3",
      "a",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      p: ["style"],
      span: ["style"],
      li: ["style"],
      ol: ["style"],
      ul: ["style"],
      code: ["class"],
      pre: ["class"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^left$/, /^right$/, /^center$/, /^justify$/],
        color: [/^#([0-9a-fA-F]{3}){1,2}$/],
        "background-color": [/^#([0-9a-fA-F]{3}){1,2}$/],
        "font-size": [/^\d+(px|rem|em)$/],
        "font-family": [/^[\w\s,"'-]+$/],
      },
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
  });
}

function fmtDateCL(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtTimeCL(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stripHtmlToText(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").trim();
}

function parseIsoTime(s?: string) {
  const t = new Date(s || "");
  const ms = t.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getTrabajadorId(b: ClienteBitacora): string {
  return String(b.trabajador?.id_trabajador ?? "");
}

function getTrabajadorNombre(b: ClienteBitacora): string {
  return b.trabajador?.nombre ?? "Sin agente";
}

function getClienteId(b: ClienteBitacora): string {
  return String(b.cliente?.id ?? b.clienteId ?? "");
}

function getClienteNombre(b: ClienteBitacora): string {
  const razonSocial = b.cliente?.razonSocial ?? "Sin cliente";
  const alias = b.cliente?.alias ?? "";
  const rut = b.cliente?.rut ?? "";

  if (alias && rut) return `${razonSocial} (${alias}) · ${rut}`;
  if (alias) return `${razonSocial} (${alias})`;
  if (rut) return `${razonSocial} · ${rut}`;
  return razonSocial;
}

function getClienteSearchBlob(b: ClienteBitacora): string {
  return normalizeText(
    [b.cliente?.razonSocial, b.cliente?.alias, b.cliente?.rut]
      .filter(Boolean)
      .join(" ")
  );
}

export default function BitacoraEquipoPage() {
  const [data, setData] = useState<ClienteBitacora[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editTitulo, setEditTitulo] = useState<string>("");
  const [editContenido, setEditContenido] = useState<string>("");

  const tokenCanManage = useMemo(() => canManageFromToken(), []);
  const [serverCanManage, setServerCanManage] = useState(false);
  const canManage = tokenCanManage || serverCanManage;

  const [search, setSearch] = useState("");
  const [selectedAgente, setSelectedAgente] = useState("");
  const [selectedCliente, setSelectedCliente] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function load() {
    setLoading(true);
    setToast(null);

    try {
      console.log("Auth payload BitacoraEquipo:", getAuthPayload());

      const rows = await getClienteBitacorasEquipo();
      setData(rows);
      setServerCanManage(true);
    } catch (e: any) {
      setServerCanManage(false);
      setToast({ type: "error", msg: e?.message || "No se pudo cargar." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const au = parseIsoTime(a.updatedAt || a.fechaGestion);
      const bu = parseIsoTime(b.updatedAt || b.fechaGestion);
      if (bu !== au) return bu - au;

      const af = parseIsoTime(a.fechaGestion);
      const bf = parseIsoTime(b.fechaGestion);
      if (bf !== af) return bf - af;

      return (b.id || 0) - (a.id || 0);
    });
    return copy;
  }, [data]);

  const agenteOptions = useMemo<FilterOption[]>(() => {
    const map = new Map<string, string>();

    for (const b of sorted) {
      const id = getTrabajadorId(b);
      const nombre = getTrabajadorNombre(b);

      if (!id || map.has(id)) continue;
      map.set(id, nombre);
    }

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [sorted]);

  const clienteOptions = useMemo<FilterOption[]>(() => {
    const map = new Map<string, string>();

    for (const b of sorted) {
      const id = getClienteId(b);
      const nombre = getClienteNombre(b);

      if (!id || map.has(id)) continue;
      map.set(id, nombre);
    }

    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [sorted]);

  const filtered = useMemo(() => {
    const q = normalizeText(search);

    return sorted.filter((b) => {
      const matchAgente = !selectedAgente || getTrabajadorId(b) === selectedAgente;
      const matchCliente = !selectedCliente || getClienteId(b) === selectedCliente;

      if (!matchAgente || !matchCliente) return false;
      if (!q) return true;

      const worker = normalizeText(getTrabajadorNombre(b));
      const client = getClienteSearchBlob(b);
      const title = normalizeText(b.titulo || "");
      const content = normalizeText(stripHtmlToText(b.contenido || ""));
      const date = normalizeText(String(b.fechaGestion || ""));

      return [worker, client, title, content, date].some((text) => text.includes(q));
    });
  }, [sorted, selectedAgente, selectedCliente, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [selectedAgente, selectedCliente, search, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pageStartIdx = (page - 1) * pageSize;
  const pageEndIdx = Math.min(pageStartIdx + pageSize, total);
  const paged = filtered.slice(pageStartIdx, pageEndIdx);

  function startEdit(b: ClienteBitacora) {
    if (!canManage) return;
    setToast(null);
    setEditId(b.id);
    setEditTitulo(b.titulo ?? "");
    setEditContenido(stripHtmlToText(b.contenido));
  }

  function cancelEdit() {
    setEditId(null);
    setEditTitulo("");
    setEditContenido("");
  }

  async function handleSave(b: ClienteBitacora) {
    if (!canManage) return;

    const titulo = editTitulo.trim();
    const contenido = editContenido.trim();

    if (!contenido) {
      setToast({ type: "error", msg: "El contenido no puede quedar vacío." });
      return;
    }

    setSavingId(b.id);
    setToast(null);

    try {
      const saved = await updateClienteBitacoraById(b.id, {
        titulo: titulo ? titulo : null,
        contenido,
      });

      setData((prev) => prev.map((x) => (x.id === b.id ? saved : x)));
      setToast({ type: "ok", msg: "Bitácora actualizada." });
      cancelEdit();
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message || "No se pudo guardar." });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(b: ClienteBitacora) {
    if (!canManage) return;

    const who = getTrabajadorNombre(b) ? `de ${getTrabajadorNombre(b)}` : "";
    const when = fmtDateCL(b.fechaGestion);
    const okConfirm = window.confirm(`¿Eliminar esta bitácora ${who} (${when})?`);
    if (!okConfirm) return;

    setDeletingId(b.id);
    setToast(null);

    try {
      await deleteClienteBitacoraById(b.id);
      setData((prev) => prev.filter((x) => x.id !== b.id));
      setToast({ type: "ok", msg: "Bitácora eliminada." });
      if (editId === b.id) cancelEdit();
    } catch (e: any) {
      setToast({
        type: "error",
        msg: e?.message || "No se pudo eliminar (posible 403: sin permisos).",
      });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExportExcel() {
    try {
      setExporting(true);
      setToast(null);

      await exportBitacorasToExcelStyled(filtered as any);

      setToast({
        type: "ok",
        msg: "Excel exportado correctamente.",
      });
    } catch (e: any) {
      setToast({
        type: "error",
        msg: e?.message || "No se pudo exportar el Excel.",
      });
    } finally {
      setExporting(false);
    }
  }

  function clearFilters() {
    setSearch("");
    setSelectedAgente("");
    setSelectedCliente("");
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold">Bitácoras del equipo</h1>
          <p className="text-sm text-gray-500">
            Vista general de bitácoras por cliente, con filtros por agente y cliente.
          </p>
          {!canManage ? (
            <p className="text-xs text-vp-muted">
              Sin permisos detectados para administrar.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            disabled={loading || exporting || filtered.length === 0}
            title="Exportar a Excel"
          >
            {exporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            Exportar Excel
          </button>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-vp-border bg-vp-bg/30 px-3 py-2 text-sm text-vp-text hover:bg-vp-bg/50 disabled:opacity-60"
            disabled={loading}
            title="Recargar"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Recargar
          </button>
        </div>
      </div>

      {toast ? (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm",
            toast.type === "ok"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <label className="mb-2 block text-sm text-gray-500">Buscar</label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Busca por agente, cliente, título o contenido"
                className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="xl:col-span-3">
            <label className="mb-2 block text-sm text-gray-500">Agente</label>
            <div className="relative">
              <User2
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                value={selectedAgente}
                onChange={(e) => setSelectedAgente(e.target.value)}
                className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm"
              >
                <option value="">Todos los agentes</option>
                {agenteOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="xl:col-span-3">
            <label className="mb-2 block text-sm text-gray-500">Cliente</label>
            <div className="relative">
              <Building2
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <select
                value={selectedCliente}
                onChange={(e) => setSelectedCliente(e.target.value)}
                className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm"
              >
                <option value="">Todos los clientes</option>
                {clienteOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="xl:col-span-1 flex items-end">
            <button
              onClick={clearFilters}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Limpiar
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-gray-400">
          Total filtrado: {filtered.length} bitácora(s)
        </div>
      </div>

      {!loading && total > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-vp-muted">
            Mostrando <span className="font-medium text-vp-text">{pageStartIdx + 1}</span>–
            <span className="font-medium text-vp-text">{pageEndIdx}</span> de{" "}
            <span className="font-medium text-vp-text">{total}</span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-vp-muted">Por página</label>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-vp-border bg-white px-3 py-2 text-sm text-vp-text"
            >
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>

            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="inline-flex items-center gap-2 rounded-xl border border-vp-border bg-white px-3 py-2 text-sm text-vp-text disabled:opacity-60"
              title="Anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="text-sm text-vp-muted">
              Página <span className="font-medium text-vp-text">{page}</span> de{" "}
              <span className="font-medium text-vp-text">{totalPages}</span>
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-2 rounded-xl border border-vp-border bg-white px-3 py-2 text-sm text-vp-text disabled:opacity-60"
              title="Siguiente"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-vp-muted">Cargando...</div>
      ) : total === 0 ? (
        <div className="text-sm text-vp-muted">No hay bitácoras para mostrar.</div>
      ) : (
        <div className="space-y-3">
          {paged.map((b) => {
            const isDeleting = deletingId === b.id;
            const isSaving = savingId === b.id;
            const isEditing = editId === b.id;

            const fecha = b.fechaGestion;
            const updatedIso = b.updatedAt || fecha;
            const trabajadorNombre = getTrabajadorNombre(b);
            const clienteNombre = getClienteNombre(b);

            return (
              <div key={b.id} className="rounded-2xl border border-vp-border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                      <span className="truncate font-medium text-gray-800">
                        {trabajadorNombre}
                      </span>

                      <span className="text-gray-300">•</span>
                      <span>{fmtDateCL(fecha)}</span>

                      <span className="text-gray-300">•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} className="text-gray-400" />
                        Actualizado {fmtTimeCL(updatedIso)}
                      </span>

                      <span className="text-gray-300">•</span>
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <Building2 size={14} className="text-gray-400" />
                        {clienteNombre}
                      </span>

                      {b.titulo ? (
                        <>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-700 font-medium truncate max-w-[520px]">
                            {b.titulo}
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSave(b)}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-xl border border-vp-border bg-vp-bg/30 px-3 py-2 text-sm text-vp-text hover:bg-vp-bg/50 disabled:opacity-60"
                            title="Guardar cambios"
                          >
                            {isSaving ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Save size={16} />
                            )}
                            Guardar
                          </button>

                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="inline-flex items-center gap-2 rounded-xl border border-vp-border bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            title="Cancelar"
                          >
                            <X size={16} />
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(b)}
                          disabled={isDeleting || isSaving}
                          className="inline-flex items-center gap-2 rounded-xl border border-vp-border bg-vp-bg/30 px-3 py-2 text-sm text-vp-text hover:bg-vp-bg/50 disabled:opacity-60"
                          title="Editar bitácora"
                        >
                          <Pencil size={16} />
                          Editar
                        </button>
                      )}

                      <button
                        onClick={() => handleDelete(b)}
                        disabled={isDeleting || isSaving}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-60"
                        title="Eliminar bitácora"
                      >
                        {isDeleting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid gap-2">
                      <label className="text-xs font-medium text-gray-600">Título (opcional)</label>
                      <input
                        value={editTitulo}
                        onChange={(e) => setEditTitulo(e.target.value)}
                        className="w-full rounded-xl border border-vp-border bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-vp-primary/20"
                        placeholder="Título..."
                        disabled={isSaving}
                      />
                    </div>

                    <div className="grid gap-2">
                      <label className="text-xs font-medium text-gray-600">Contenido</label>
                      <textarea
                        value={editContenido}
                        onChange={(e) => setEditContenido(e.target.value)}
                        className="min-h-[140px] w-full resize-y rounded-xl border border-vp-border bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-vp-primary/20"
                        placeholder="Escribe el contenido..."
                        disabled={isSaving}
                      />
                      <p className="text-xs text-gray-500">
                        Nota: esta edición guarda como texto plano.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={[
                      "mt-3 text-sm text-gray-800 break-words",
                      "[&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_blockquote]:my-1 [&_pre]:my-1",
                      "[&_h1]:my-1 [&_h2]:my-1 [&_h3]:my-1",
                      "leading-relaxed",
                    ].join(" ")}
                    dangerouslySetInnerHTML={{ __html: safeHtml(b.contenido) }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}