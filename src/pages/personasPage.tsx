import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Users,
  Pencil,
} from "lucide-react";

import EditarPersonaModal, {
  PersonaEditable,
} from "../components/personas/EditarPersonaModal";

type Role = "ADMIN" | "SUPERVISOR" | "AGENTE";
type Area = "ADMIN" | "CONTA" | "RRHH" | "TRIBUTARIO";

type Persona = {
  id_trabajador: number;
  nombre: string;
  email: string;
  areaInterna?: Area | null;
  carpetaDriveCodigo?: string | null;
  status?: boolean | null;
};

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

const getAuthToken = () => {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token")
  );
};

const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

function safeRoleFromMe(raw: any): Role | null {
  const candidate =
    raw?.trabajador?.role ?? raw?.role ?? raw?.user?.role ?? null;
  if (
    candidate === "ADMIN" ||
    candidate === "SUPERVISOR" ||
    candidate === "AGENTE"
  )
    return candidate;
  return null;
}

function parseJwt(token: string): any | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function roleFromToken(): Role | null {
  const token = getAuthToken();
  if (!token) return null;
  const payload = parseJwt(token);
  const r = payload?.role;
  if (r === "ADMIN" || r === "SUPERVISOR" || r === "AGENTE") return r;
  return null;
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState<"idle" | "loading" | "error">("idle");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  // permisos
  const [myRole, setMyRole] = useState<Role | null>(null);
  const canEdit = myRole === "ADMIN" || myRole === "SUPERVISOR";

  // modal editar
  const [editOpen, setEditOpen] = useState(false);
  const [selected, setSelected] = useState<PersonaEditable | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(id === expandedId ? null : id);
  };

  const refreshList = async () => {
    try {
      setLoading("loading");

      const res = await fetch(`${API_BASE_URL}/trabajadores`, {
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(
          "[PersonasPage] /trabajadores no OK:",
          res.status,
          res.statusText,
          text
        );
        throw new Error(`Error HTTP ${res.status}`);
      }

      const raw = await res.json();

      let lista: any[] = [];
      if (Array.isArray(raw)) lista = raw;
      else if (Array.isArray(raw?.personas)) lista = raw.personas;
      else if (Array.isArray(raw?.data)) lista = raw.data;
      else {
        console.warn(
          "[PersonasPage] Respuesta sin array en /trabajadores. raw:",
          raw
        );
        setPersonas([]);
        setLoading("idle");
        return;
      }

      const mapped: Persona[] = lista.map((u: any) => ({
        id_trabajador: Number(u.id_trabajador ?? u.id ?? 0),
        nombre: String(u.nombre ?? "Sin nombre"),
        email: String(u.email ?? "sin-correo@dominio.cl"),
        areaInterna: (u.areaInterna ?? null) as any,
        carpetaDriveCodigo: u.carpetaDriveCodigo ?? null,
        status:
          typeof u.status === "boolean"
            ? u.status
            : typeof u.activo === "boolean"
            ? u.activo
            : null,
      }));

      mapped.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      setPersonas(mapped);
      setLoading("idle");
    } catch (e) {
      console.error("[PersonasPage] Error refreshList:", e);
      setLoading("error");
    }
  };

  // 1) Traer mi rol (y fallback desde token)
  useEffect(() => {
    const initRole = async () => {
      // fallback inmediato desde JWT (para que el botón no dependa del backend)
      const tokenRole = roleFromToken();
      if (tokenRole) setMyRole(tokenRole);

      // luego intentamos /auth/me para consistencia
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          credentials: "include",
        });
        if (!res.ok) return;

        const raw = await res.json();
        const role = safeRoleFromMe(raw);
        if (role) setMyRole(role);
      } catch {
        // ignore
      }
    };

    initRole();
  }, []);

  // 2) Traer lista
  useEffect(() => {
    refreshList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return personas;

    return personas.filter((p) => {
      return (
        p.nombre.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        String(p.id_trabajador).includes(q) ||
        String(p.areaInterna ?? "").toLowerCase().includes(q) ||
        String(p.carpetaDriveCodigo ?? "").toLowerCase().includes(q)
      );
    });
  }, [personas, query]);

  const openEdit = (p: Persona) => {
    if (!canEdit) return;

    setSelected({
      id_trabajador: p.id_trabajador,
      nombre: p.nombre,
      email: p.email, // read-only
      areaInterna: (p.areaInterna ?? null) as any,
      carpetaDriveCodigo: p.carpetaDriveCodigo ?? null,
      status: p.status ?? true,
    });

    setEditOpen(true);
  };

  const onSaveEdit = async (payload: PersonaEditable) => {
    try {
      setSavingId(payload.id_trabajador);

      const res = await fetch(
        `${API_BASE_URL}/trabajadores/${payload.id_trabajador}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          credentials: "include",
          body: JSON.stringify({
            // ✅ NO enviamos email
            nombre: payload.nombre,
            areaInterna: payload.areaInterna,
            carpetaDriveCodigo: payload.carpetaDriveCodigo,
            status: payload.status,
          }),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[PersonasPage] PATCH error:", res.status, text);
        throw new Error(`Error HTTP ${res.status}`);
      }

      // Si el backend devuelve { trabajador }, lo tomamos; si no, igual hacemos refresh
      setEditOpen(false);
      setSelected(null);

      // ✅ refrescamos lista para evitar des-sync
      await refreshList();
    } catch (e) {
      console.error(e);
      alert(
        "No se pudo guardar.\n- Revisa que tu usuario sea ADMIN/SUPERVISOR.\n- Revisa que exista PATCH /api/trabajadores/:id.\n- Mira consola/network."
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mt-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Users size={20} />
          Usuarios / Personas
        </h2>
        <p className="text-sm text-black/60">
          Listado de usuarios con su ID, correo, área interna y código de
          carpeta.
        </p>
      </div>

      {/* Buscador */}
      <div className="flex items-center gap-2 bg-white rounded-xl border border-black/10 px-3 py-2 w-full md:w-[520px]">
        <Search size={16} className="text-black/50" />
        <input
          className="w-full outline-none text-sm placeholder:text-black/40"
          placeholder="Buscar por ID, nombre, email, área interna o carpetaDriveCodigo…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Tabla desktop */}
      <div className="mt-4 bg-white rounded-2xl border border-black/5 shadow-lg overflow-x-auto hidden md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 text-xs uppercase tracking-wider border-b border-black/5">
              <th className="py-3 px-3 font-semibold">#</th>
              <th className="py-3 px-3 font-semibold">ID</th>
              <th className="py-3 px-3 font-semibold">Nombre</th>
              <th className="py-3 px-3 font-semibold">Email</th>
              <th className="py-3 px-3 font-semibold">Área interna</th>
              <th className="py-3 px-3 font-semibold">Carpeta</th>
              <th className="py-3 px-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading === "loading" && (
              <tr>
                <td colSpan={7} className="py-8 px-3 text-center text-black/50">
                  Cargando usuarios…
                </td>
              </tr>
            )}

            {loading === "error" && (
              <tr>
                <td colSpan={7} className="py-8 px-3 text-center text-rose-500">
                  Error cargando usuarios. Revisa la consola o el endpoint.
                </td>
              </tr>
            )}

            {loading === "idle" && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 px-3 text-center text-black/50">
                  No hay resultados con los filtros actuales.
                </td>
              </tr>
            )}

            {loading === "idle" &&
              filtered.map((p, i) => {
                const isExpanded = expandedId === p.id_trabajador;

                return (
                  <React.Fragment key={p.id_trabajador}>
                    <tr
                      className={`border-t group transition-colors cursor-pointer ${
                        isExpanded ? "bg-black/[0.03]" : "hover:bg-black/[0.02]"
                      }`}
                      onClick={() => toggleExpand(p.id_trabajador)}
                    >
                      <td className="py-3 px-3 text-black/70 font-mono">
                        {String(i + 1).padStart(3, "0")}
                      </td>
                      <td className="py-3 px-3 text-black/70 font-mono">
                        {p.id_trabajador}
                      </td>
                      <td className="py-3 px-3">
                        <div
                          className="font-medium"
                          style={{ color: "var(--primary-color)" }}
                        >
                          {p.nombre}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <a
                          href={`mailto:${p.email}`}
                          className="text-[var(--secondary-color)] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {p.email}
                        </a>
                      </td>
                      <td className="py-3 px-3 text-black/70">
                        {p.areaInterna ?? "—"}
                      </td>
                      <td className="py-3 px-3 text-black/70 font-mono">
                        {p.carpetaDriveCodigo ?? "—"}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(p);
                            }}
                            disabled={!canEdit}
                            title={
                              canEdit
                                ? "Editar usuario"
                                : "Solo ADMIN/SUPERVISOR"
                            }
                            className={`px-3 py-1.5 rounded-xl border transition-all bg-white flex items-center gap-2
                              ${
                                canEdit
                                  ? "border-black/10 hover:border-black/30"
                                  : "border-black/10 opacity-50 cursor-not-allowed"
                              }`}
                          >
                            <Pencil size={16} />
                            {savingId === p.id_trabajador ? "Guardando..." : "Editar"}
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(p.id_trabajador);
                            }}
                            className="p-1.5 rounded-full border border-black/10 hover:border-black/30 transition-all bg-white"
                          >
                            {isExpanded ? (
                              <ChevronDown size={18} />
                            ) : (
                              <ChevronRight size={18} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-black/[0.03] animate-in fade-in slide-in-from-top-1 duration-200">
                        <td
                          colSpan={7}
                          className="py-5 px-6 border-t border-black/10"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                              <p className="text-xs text-black/50">ID</p>
                              <p className="font-mono">{p.id_trabajador}</p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-black/50">Nombre</p>
                              <p className="font-medium">{p.nombre}</p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-black/50">Email</p>
                              <p className="font-medium">{p.email}</p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-black/50">
                                Área interna
                              </p>
                              <p className="font-medium">
                                {p.areaInterna ?? "—"}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-black/50">
                                CarpetaDriveCodigo
                              </p>
                              <p className="font-mono">
                                {p.carpetaDriveCodigo ?? "—"}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="text-xs text-black/50">Estado</p>
                              <p className="font-medium">
                                {p.status === false ? "Inactivo" : "Activo"}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mt-4 md:hidden flex flex-col gap-3">
        {loading === "loading" && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 text-center text-black/50">
            Cargando usuarios...
          </div>
        )}

        {loading === "error" && (
          <div className="bg-white rounded-2xl border border-rose-100 text-rose-600 shadow-sm p-4 text-center">
            Error cargando usuarios. Revisa la consola o el endpoint.
          </div>
        )}

        {loading === "idle" && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 text-center text-black/50">
            No hay resultados con los filtros actuales.
          </div>
        )}

        {loading === "idle" &&
          filtered.map((p, i) => {
            const isExpanded = expandedId === p.id_trabajador;

            return (
              <div
                key={p.id_trabajador}
                className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-black/50 font-mono">
                      <span>#{String(i + 1).padStart(3, "0")}</span>
                      <span>ID: {p.id_trabajador}</span>
                    </div>
                    <p
                      className="text-base font-semibold truncate"
                      style={{ color: "var(--primary-color)" }}
                    >
                      {p.nombre}
                    </p>
                    <a
                      href={`mailto:${p.email}`}
                      className="text-sm text-[var(--secondary-color)] hover:underline truncate block"
                    >
                      {p.email}
                    </a>
                    <p className="text-xs text-black/60 mt-1">
                      Área interna:{" "}
                      <span className="font-medium">{p.areaInterna ?? "—"}</span>
                    </p>
                    <p className="text-xs text-black/60">
                      Carpeta:{" "}
                      <span className="font-mono">
                        {p.carpetaDriveCodigo ?? "—"}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 items-end">
                    <button
                      onClick={() => openEdit(p)}
                      disabled={!canEdit}
                      title={canEdit ? "Editar usuario" : "Solo ADMIN/SUPERVISOR"}
                      className={`px-3 py-2 rounded-xl border transition bg-white flex items-center gap-2 text-sm
                        ${
                          canEdit
                            ? "border-black/10 hover:border-black/30"
                            : "border-black/10 opacity-50 cursor-not-allowed"
                        }`}
                    >
                      <Pencil size={16} />
                      Editar
                    </button>

                    <button
                      onClick={() => toggleExpand(p.id_trabajador)}
                      className="p-2 rounded-full border border-black/10 hover:border-black/30 transition"
                    >
                      {isExpanded ? (
                        <ChevronDown size={18} />
                      ) : (
                        <ChevronRight size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="pt-2 border-t border-black/5 space-y-2 text-sm text-black/70">
                    <div>
                      <p className="text-xs text-black/50">ID</p>
                      <p className="font-mono">{p.id_trabajador}</p>
                    </div>
                    <div>
                      <p className="text-xs text-black/50">Área interna</p>
                      <p className="font-medium">{p.areaInterna ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-black/50">CarpetaDriveCodigo</p>
                      <p className="font-mono">{p.carpetaDriveCodigo ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-black/50">Estado</p>
                      <p className="font-medium">
                        {p.status === false ? "Inactivo" : "Activo"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* ✅ MODAL */}
      <EditarPersonaModal
        open={editOpen}
        persona={selected}
        actorRole={myRole}
        saving={savingId !== null}
        onClose={() => {
          setEditOpen(false);
          setSelected(null);
        }}
        onSave={onSaveEdit}
      />
    </div>
  );
}
