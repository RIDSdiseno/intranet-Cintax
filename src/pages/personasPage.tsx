import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  Clock,
  ListChecks,
  Phone,
  X,
  Users,
} from "lucide-react";

type Persona = {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  area?: string;
  categoria?: string;
  estado: "Activo" | "Inactivo";
  activo?: boolean;
  ultimoLogin?: string | null;
  proyectosActivos?: number;
  areaInterna?: string | null; // 👈 NUEVO
};

type FiltroRol = "Todos" | string;

// 👇 Igual que en otros componentes tuyos (VistaPorRut, etc.)
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
  return {
    Authorization: `Bearer ${token}`,
  };
};

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState<"idle" | "loading" | "error">("idle");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    action: string;
    personaId: number;
    personaNombre: string;
  } | null>(null);

  const [query, setQuery] = useState("");
  const [rolFiltro, setRolFiltro] = useState<FiltroRol>("Todos");

  const toggleExpand = (id: number) => {
    setExpandedId(id === expandedId ? null : id);
  };

  // ============================
  //   FETCH A API / USUARIOS
  // ============================
  useEffect(() => {
    const fetchPersonas = async () => {
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
            "[PersonasPage] Respuesta no OK:",
            res.status,
            res.statusText,
            text
          );
          throw new Error(`Error HTTP ${res.status}`);
        }

        const raw = await res.json();
        console.log("[PersonasPage] RAW data /trabajadores:", raw);

        // Detectar dónde viene el array (nuevo: array directo / antiguo: { personas })
        let lista: any[] = [];

        if (Array.isArray(raw)) {
          lista = raw;
        } else if (Array.isArray((raw as any).personas)) {
          lista = (raw as any).personas;
        } else if (Array.isArray((raw as any).data)) {
          lista = (raw as any).data;
        } else {
          console.warn(
            "[PersonasPage] No se encontró un array en la respuesta. raw:",
            raw
          );
          setPersonas([]);
          setLoading("idle");
          return;
        }

        const mapped: Persona[] = lista.map((u: any) => ({
          id: u.id ?? u.id_trabajador ?? 0,
          nombre: u.nombre ?? "Sin nombre",
          email: u.email ?? "sin-correo@dominio.cl",
          rol: u.rol ?? "Sin rol",
          area: u.area,
          categoria: u.categoria,
          estado:
            u.estado === "Inactivo" || u.activo === false
              ? "Inactivo"
              : "Activo",
          activo: u.activo,
          ultimoLogin: u.ultimoLogin ?? null,
          proyectosActivos: u.proyectosActivos ?? 0,
          areaInterna: u.areaInterna ?? null, // 👈 NUEVO: viene del backend (CONTA, TRIBUTARIO, etc.)
        }));

        setPersonas(mapped);
        setLoading("idle");
      } catch (error) {
        console.error("[PersonasPage] Error cargando usuarios:", error);
        setLoading("error");
      }
    };

    fetchPersonas();
  }, []);

  // Roles dinámicos para los tabs
  const rolesDisponibles = useMemo<FiltroRol[]>(() => {
    const set = new Set<string>();
    personas.forEach((p) => {
      if (p.rol) set.add(p.rol);
    });
    return ["Todos", ...Array.from(set)];
  }, [personas]);

  // Contadores por rol
  const counts = useMemo(() => {
    const base: Record<FiltroRol, number> = {
      Todos: personas.length,
    };
    personas.forEach((p) => {
      base[p.rol] = (base[p.rol] || 0) + 1;
    });
    return base;
  }, [personas]);

  // Filtrado
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return personas.filter((p) => {
      const matchRol = rolFiltro === "Todos" ? true : p.rol === rolFiltro;
      const matchQ =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.rol.toLowerCase().includes(q) ||
        (p.areaInterna?.toLowerCase().includes(q) ?? false); // 👈 búsqueda también por área interna
      return matchRol && matchQ;
    });
  }, [personas, rolFiltro, query]);

  const formatUltimoLogin = (value?: string | null) => {
    if (!value) return "—";
    try {
      const d = new Date(value);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString("es-CL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="mt-4">
      {/* Header de la page */}
      <div className="mb-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <Users size={20} />
          Usuarios / Personas
        </h2>
        <p className="text-sm text-black/60">
          Listado de usuarios con su correo y rol en el sistema.
        </p>
      </div>

      {/* Controles: Filtros + Búsqueda */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Tabs de roles */}
        <div className="flex flex-wrap items-center gap-2">
          {rolesDisponibles.map((r) => (
            <button
              key={r}
              onClick={() => setRolFiltro(r)}
              className={`rounded-full px-3 py-1.5 text-sm border transition ${
                rolFiltro === r
                  ? "bg-[var(--secondary-color)] text-white border-[var(--secondary-color)]"
                  : "bg-white text-[var(--primary-color)] border-black/10 hover:border-black/20"
              }`}
            >
              {r}{" "}
              <span className="ml-1 text-xs opacity-80">
                ({counts[r] ?? 0})
              </span>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-black/10 px-3 py-2 w-full md:w-[320px]">
          <Search size={16} className="text-black/50" />
          <input
            className="w-full outline-none text-sm placeholder:text-black/40"
            placeholder="Buscar por nombre, email, rol o área interna…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="mt-4 bg-white rounded-2xl border border-black/5 shadow-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 text-xs uppercase tracking-wider border-b border-black/5">
              <th className="py-3 px-3 font-semibold">#</th>
              <th className="py-3 px-3 font-semibold">Nombre</th>
              <th className="py-3 px-3 font-semibold">Email</th>
              <th className="py-3 px-3 font-semibold">Rol</th>
              <th className="py-3 px-3 font-semibold">Estado</th>
              <th className="py-3 px-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {/* Estado de carga / error */}
            {loading === "loading" && (
              <tr>
                <td colSpan={6} className="py-8 px-3 text-center text-black/50">
                  Cargando usuarios…
                </td>
              </tr>
            )}

            {loading === "error" && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 px-3 text-center text-rose-500"
                >
                  Error cargando usuarios. Revisa la consola o el endpoint.
                </td>
              </tr>
            )}

            {/* Mensaje de no resultados */}
            {loading === "idle" && filtered.length === 0 && (
              <tr>
                <td
                  className="py-8 px-3 text-center text-black/50"
                  colSpan={6}
                >
                  No hay resultados con los filtros actuales.
                </td>
              </tr>
            )}

            {/* Filas de datos */}
            {loading === "idle" &&
              filtered.map((p, i) => {
                const isExpanded = expandedId === p.id;
                return (
                  <React.Fragment key={p.id}>
                    <tr
                      className={`border-t group transition-colors cursor-pointer ${
                        isExpanded
                          ? "bg-black/[0.03]"
                          : "hover:bg-black/[0.02]"
                      }`}
                    >
                      <td
                        className="py-3 px-3 text-black/70 font-mono"
                        onClick={() => toggleExpand(p.id)}
                      >
                        {String(i + 1).padStart(3, "0")}
                      </td>
                      <td
                        className="py-3 px-3"
                        onClick={() => toggleExpand(p.id)}
                      >
                        <div
                          className="font-medium"
                          style={{ color: "var(--primary-color)" }}
                        >
                          {p.nombre}
                        </div>
                        <div className="text-xs text-black/50">ID: {p.id}</div>
                      </td>
                      <td className="py-3 px-3">
                        <a
                          href={`mailto:${p.email}`}
                          className="text-[var(--secondary-color)] hover:underline"
                        >
                          {p.email}
                        </a>
                      </td>
                      <td className="py-3 px-3 text-black/70">{p.rol}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.estado === "Activo"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {p.estado ?? "—"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right flex items-center justify-end gap-2 h-full">
                        <button
                          onClick={() => toggleExpand(p.id)}
                          className={`p-1.5 rounded-full border border-black/10 hover:border-black/30 transition-all ${
                            isExpanded ? "bg-black/5" : "bg-white"
                          }`}
                        >
                          {isExpanded ? (
                            <ChevronDown size={18} />
                          ) : (
                            <ChevronRight size={18} />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Fila de Contenido Expandido */}
                    {isExpanded && (
                      <tr className="bg-black/[0.03] animate-in fade-in slide-in-from-top-1 duration-200">
                        <td
                          colSpan={6}
                          className="py-6 px-6 border-t border-black/10"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                            {/* Columna 1: Detalles de Contacto */}
                            <div className="space-y-2">
                              <p className="font-semibold text-black/70 mb-2 border-b border-black/5 pb-1">
                                Detalles de Contacto
                              </p>
                              <div className="flex items-start gap-3">
                                <Phone
                                  size={16}
                                  className="text-black/50 mt-1"
                                />
                                <div>
                                  <p className="text-black/60">
                                    Correo principal
                                  </p>
                                  <p className="font-medium text-[var(--primary-color)]">
                                    {p.email}
                                  </p>
                                </div>
                              </div>
                              {p.area && (
                                <div className="mt-2 text-sm text-black/60">
                                  Área:{" "}
                                  <span className="font-medium">
                                    {p.area}
                                  </span>
                                </div>
                              )}
                              {p.areaInterna && (
                                <div className="text-sm text-black/60">
                                  Área interna:{" "}
                                  <span className="font-medium">
                                    {p.areaInterna}
                                  </span>
                                </div>
                              )}
                              {p.categoria && (
                                <div className="text-sm text-black/60">
                                  Categoría:{" "}
                                  <span className="font-medium">
                                    {p.categoria}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Columna 2: Actividad */}
                            <div className="space-y-2">
                              <p className="font-semibold text-black/70 mb-2 border-b border-black/5 pb-1">
                                Actividad
                              </p>
                              <div className="flex items-start gap-3">
                                <Clock
                                  size={16}
                                  className="text-black/50 mt-1"
                                />
                                <div>
                                  <p className="text-black/60">
                                    Último Login
                                  </p>
                                  <p className="font-medium text-[var(--primary-color)]">
                                    {formatUltimoLogin(p.ultimoLogin)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-start gap-3">
                                <ListChecks
                                  size={16}
                                  className="text-black/50 mt-1"
                                />
                                <div>
                                  <p className="text-black/60">
                                    Proyectos activos (tareas)
                                  </p>
                                  <p className="font-medium text-[var(--primary-color)]">
                                    {p.proyectosActivos ?? 0}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Columna 3: Acciones Administrativas */}
                            <div className="space-y-2">
                              <p className="font-semibold text-black/70 mb-2 border-b border-black/5 pb-1">
                                Acciones Administrativas
                              </p>
                              <div className="flex flex-col gap-2 pt-1">
                                <button
                                  onClick={() =>
                                    setConfirmModal({
                                      action: "enable",
                                      personaId: p.id,
                                      personaNombre: p.nombre,
                                    })
                                  }
                                  className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                                  style={{
                                    background: "var(--secondary-color)",
                                  }}
                                >
                                  <Check size={16} />
                                  Habilitar Cuenta
                                </button>
                                <button
                                  onClick={() =>
                                    setConfirmModal({
                                      action: "disable",
                                      personaId: p.id,
                                      personaNombre: p.nombre,
                                    })
                                  }
                                  className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-rose-700 bg-white rounded-lg border border-rose-300 hover:bg-rose-50 transition-colors"
                                >
                                  <X size={16} />
                                  Deshabilitar Acceso
                                </button>
                              </div>
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

      {/* Modal de confirmación */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setConfirmModal(null)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-lg z-10">
            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: "var(--primary-color)" }}
            >
              {confirmModal.action === "enable"
                ? "¿Habilitar cuenta?"
                : "¿Deshabilitar acceso?"}
            </h3>
            <p className="text-sm text-black/60 mb-6">
              {confirmModal.action === "enable"
                ? `Se habilitará la cuenta de ${confirmModal.personaNombre}.`
                : `Se deshabilitará el acceso de ${confirmModal.personaNombre}.`}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  // Aquí después puedes llamar a tu API /trabajadores/:id/habilitar o deshabilitar
                  const action =
                    confirmModal.action === "enable"
                      ? "Cuenta habilitada"
                      : "Acceso deshabilitado";
                  alert(`${action} para ${confirmModal.personaNombre}`);
                  setConfirmModal(null);
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium text-white transition ${
                  confirmModal.action === "enable"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {confirmModal.action === "enable"
                  ? "Habilitar"
                  : "Deshabilitar"}
              </button>
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium border border-black/10 bg-white hover:border-black/20 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
