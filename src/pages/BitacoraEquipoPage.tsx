// src/pages/BitacoraEquipoPage.tsx
import { useEffect, useMemo, useState } from "react";
import sanitizeHtml from "sanitize-html";
import {
  deleteBitacoraById,
  getBitacorasEquipo,
  updateBitacoraById,
} from "../service/bitacora.service";
import type { AuthUserLite, Bitacora, Role } from "../types/bitacora";
import { Trash2, Loader2, RefreshCw, Clock, Pencil, Save, X, ChevronLeft, ChevronRight } from "lucide-react";

type Toast = { type: "ok" | "error"; msg: string };

/** Limpia HTML que genera “espacios gigantes” (párrafos vacíos repetidos, br repetidos, etc.) */
function compactHtml(raw: string) {
  const html = raw || "";

  // Normaliza saltos (por si viene con \n extra)
  let out = html.replace(/\r\n/g, "\n");

  // Elimina p vacíos del tipo <p><br></p> / <p>&nbsp;</p> repetidos
  // (sin ser muy agresivo)
  out = out.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "<br/>");

  // Colapsa varios <br> seguidos en máximo 2
  out = out.replace(/(<br\s*\/?>\s*){3,}/gi, "<br/><br/>");

  // Quita <br> al inicio
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

function stripHtmlToText(html: string) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return (tmp.textContent || tmp.innerText || "").trim();
}

/** Lee el user desde varias keys típicas */
function readAuthUser(): AuthUserLite | undefined {
  try {
    const raw =
      localStorage.getItem("user") ||
      sessionStorage.getItem("user") ||
      localStorage.getItem("auth") ||
      sessionStorage.getItem("auth") ||
      localStorage.getItem("session") ||
      sessionStorage.getItem("session");

    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as any;

    const candidate =
      parsed?.user ||
      parsed?.data?.user ||
      parsed?.data ||
      parsed?.profile ||
      parsed?.me ||
      parsed;

    return candidate as AuthUserLite;
  } catch {
    return undefined;
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

function canManageFromStorage(): boolean {
  const u = readAuthUser();
  if (!u) return false;

  if (u.isAdmin === true) return true;
  if (u.isSupervisorOrAdmin === true) return true;
  if ((u as any).isSupervisor === true) return true;

  const role =
    normalizeRole((u as any).role) ||
    normalizeRole((u as any).rol) ||
    normalizeRole((u as any).roleId) ||
    normalizeRole((u as any).role_id) ||
    normalizeRole((u as any).roleName) ||
    normalizeRole((u as any).role_name) ||
    normalizeRole((u as any)?.role?.name);

  return role === "ADMIN" || role === "SUPERVISOR";
}

function parseIsoTime(s?: string) {
  const t = new Date(s || "");
  const ms = t.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export default function BitacoraEquipoPage() {
  const [data, setData] = useState<Bitacora[]>([]);
  const [loading, setLoading] = useState(true);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const [toast, setToast] = useState<Toast | null>(null);

  // edición inline
  const [editId, setEditId] = useState<number | null>(null);
  const [editTitulo, setEditTitulo] = useState<string>("");
  const [editContenido, setEditContenido] = useState<string>("");

  // perms (storage + server)
  const storageCanManage = useMemo(() => canManageFromStorage(), []);
  const [serverCanManage, setServerCanManage] = useState(false);
  const canManage = storageCanManage || serverCanManage;

  // paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function load() {
    setLoading(true);
    setToast(null);

    try {
      const rows = await getBitacorasEquipo();
      setData(rows);

      // Si este endpoint es solo ADMIN/SUPERVISOR, entonces el que lo consulta puede administrar
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ orden “más nuevo arriba”
  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const au = parseIsoTime(a.updatedAt || a.fecha);
      const bu = parseIsoTime(b.updatedAt || b.fecha);
      if (bu !== au) return bu - au;

      const af = parseIsoTime(a.fecha);
      const bf = parseIsoTime(b.fecha);
      if (bf !== af) return bf - af;

      return (b.id || 0) - (a.id || 0);
    });
    return copy;
  }, [data]);

  // ✅ paginación client-side
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // si cambia pageSize o data y quedas fuera de rango
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const pageStartIdx = (page - 1) * pageSize;
  const pageEndIdx = Math.min(pageStartIdx + pageSize, total);
  const paged = sorted.slice(pageStartIdx, pageEndIdx);

  function startEdit(b: Bitacora) {
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

  async function handleSave(b: Bitacora) {
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
      const saved = await updateBitacoraById(b.id, {
        titulo: titulo ? titulo : null,
        contenido,
        mode: "replace",
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

  async function handleDelete(b: Bitacora) {
    if (!canManage) return;

    const who = b.trabajador?.nombre ? `de ${b.trabajador.nombre}` : "";
    const when = fmtDateCL(b.fecha);
    const okConfirm = window.confirm(`¿Eliminar esta bitácora ${who} (${when})?`);
    if (!okConfirm) return;

    setDeletingId(b.id);
    setToast(null);

    try {
      await deleteBitacoraById(b.id);
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

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold">Bitácoras del equipo</h1>
          {!canManage ? (
            <p className="text-xs text-vp-muted">
              Sin permisos detectados para administrar (revisa cómo guardas el user en storage).
            </p>
          ) : null}
        </div>

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

      {/* ✅ Barra de paginación / tamaño */}
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

            const updatedIso = b.updatedAt || b.fecha;

            return (
              <div key={b.id} className="rounded-2xl border border-vp-border bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-500">
                      <span className="truncate font-medium text-gray-800">
                        {b.trabajador?.nombre ?? "—"}
                      </span>

                      <span className="text-gray-300">•</span>
                      <span>{fmtDateCL(b.fecha)}</span>

                      <span className="text-gray-300">•</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock size={14} className="text-gray-400" />
                        Actualizado {fmtTimeCL(updatedIso)}
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
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
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
                        {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>

                {/* ✅ Edición */}
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
                        Nota: esta edición guarda como texto plano (sin formato).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className={[
                      "mt-3 text-sm text-gray-800 break-words",
                      // ✅ compacta márgenes del contenido renderizado (evita “espacios gigantes”)
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