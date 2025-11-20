import React, { useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  Eye,
  ChevronRight,
  Check,
  Clock,
  ListChecks,
  Phone,
  User,
  X,
} from "lucide-react";

type Categoria = "Contabilidad" | "Tributario" | "Entre otros";
type Persona = {
  id: number;
  nombre: string;
  email: string;
  area: string; // Ej: "Clientes", "Proveedores", "Interno", etc.
  categoria: Categoria;
  estado?: "Activo" | "Inactivo";
};

const PERSONAS: Persona[] = [
  {
    id: 1,
    nombre: "María González",
    email: "maria.gonzalez@cliente.cl",
    area: "Clientes",
    categoria: "Contabilidad",
    estado: "Activo",
  },
  {
    id: 2,
    nombre: "Pedro Rojas",
    email: "projas@cliente.cl",
    area: "Interno",
    categoria: "Tributario",
    estado: "Activo",
  },
  {
    id: 3,
    nombre: "Ana Torres",
    email: "ana.torres@cliente.cl",
    area: "Clientes",
    categoria: "Entre otros",
    estado: "Activo",
  },
  {
    id: 4,
    nombre: "Luis Pérez",
    email: "lperez@cliente.cl",
    area: "Proveedores",
    categoria: "Contabilidad",
    estado: "Inactivo",
  },
  {
    id: 5,
    nombre: "Carla Bustos",
    email: "carla@cliente.cl",
    area: "Clientes",
    categoria: "Tributario",
    estado: "Activo",
  },
  {
    id: 6,
    nombre: "Jorge Fuentes",
    email: "jorge@cliente.cl",
    area: "Interno",
    categoria: "Contabilidad",
    estado: "Activo",
  },
  {
    id: 7,
    nombre: "Valentina Mora",
    email: "valentina@cliente.cl",
    area: "Clientes",
    categoria: "Tributario",
    estado: "Activo",
  },
  {
    id: 8,
    nombre: "Ricardo Díaz",
    email: "ricardo@cliente.cl",
    area: "Proveedores",
    categoria: "Entre otros",
    estado: "Inactivo",
  },
];

const CATS: Array<"Todos" | Categoria> = [
  "Todos",
  "Contabilidad",
  "Tributario",
  "Entre otros",
];

export default function PersonasPage() {
  // Estado para fila expandida
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ action: string; personaId: number; personaNombre: string } | null>(null);

  const toggleExpand = (id: number) => {
    setExpandedId(id === expandedId ? null : id);
  };

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"Todos" | Categoria>("Todos");

  // Contadores por categoría
  const counts = useMemo(() => {
    const base = {
      Todos: PERSONAS.length,
      Contabilidad: 0,
      Tributario: 0,
      "Entre otros": 0,
    } as Record<"Todos" | Categoria, number>;
    PERSONAS.forEach((p) => {
      base[p.categoria] += 1;
    });
    return base;
  }, []);

  // Filtrado
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PERSONAS.filter((p) => {
      const matchCat = cat === "Todos" ? true : p.categoria === cat;
      const matchQ =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [cat, query]);

  return (
    <div className="mt-6">
      {/* Header de la page */}
      <div className="mb-4">
        <h2
          className="text-lg font-semibold"
          style={{ color: "var(--primary-color)" }}
        >
          Personas
        </h2>
        <p className="text-sm text-black/60">
          Directorio y clientes clasificados por categoría (Contabilidad,
          Tributario, Entre otros).
        </p>
      </div>

      {/* Controles: Filtros + Búsqueda */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Tabs de categorías */}
        <div className="flex flex-wrap items-center gap-2">
          {CATS.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-3 py-1.5 text-sm border transition ${
                cat === c
                  ? "bg-[var(--secondary-color)] text-white border-[var(--secondary-color)]"
                  : "bg-white text-[var(--primary-color)] border-black/10 hover:border-black/20"
              }`}
            >
              {c}{" "}
              <span className="ml-1 text-xs opacity-80">
                ({c === "Todos" ? counts.Todos : counts[c]})
              </span>
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="flex items-center gap-2 bg-white rounded-xl border border-black/10 px-3 py-2 w-full md:w-[320px]">
          <Search size={16} className="text-black/50" />
          <input
            className="w-full outline-none text-sm placeholder:text-black/40"
            placeholder="Buscar por nombre, email o área…"
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
              <th className="py-3 px-3 font-semibold">Área</th>
              <th className="py-3 px-3 font-semibold">Categoría</th>
              <th className="py-3 px-3 font-semibold">Estado</th>
              <th className="py-3 px-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {/* Mensaje de no resultados */}
            {filtered.length === 0 && (
              <tr>
                <td className="py-8 px-3 text-center text-black/50" colSpan={7}>
                  No hay resultados con los filtros actuales.
                </td>
              </tr>
            )}

            {/* Filas de datos */}
            {filtered.map((p, i) => {
              const isExpanded = expandedId === p.id;
              return (
                <React.Fragment key={p.id}>
                  <tr
                    className={`border-t group transition-colors cursor-pointer ${
                      isExpanded ? "bg-black/[0.03]" : "hover:bg-black/[0.02]"
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
                    <td className="py-3 px-3 text-black/70">{p.area}</td>
                    <td className="py-3 px-3">
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-[var(--tertiary-color)]">
                        {p.categoria}
                      </span>
                    </td>
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
                      {/* Botón para expandir detalles */}
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
                        colSpan={7}
                        className="py-6 px-6 border-t border-black/10"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                          {/* Columna 1: Detalles de Contacto y Metadatos */}
                          <div className="space-y-2">
                            <p className="font-semibold text-black/70 mb-2 border-b border-black/5 pb-1">
                              Detalles de Contacto
                            </p>
                            <div className="flex items-start gap-3">
                              <Phone size={16} className="text-black/50 mt-1" />
                              <div>
                                <p className="text-black/60">
                                  Extensión Interna
                                </p>
                                <p className="font-medium text-[var(--primary-color)]">
                                  +56 9 1234 5678
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Columna 2: Actividad y Estadísticas */}
                          <div className="space-y-2">
                            <p className="font-semibold text-black/70 mb-2 border-b border-black/5 pb-1">
                              Actividad
                            </p>
                            <div className="flex items-start gap-3">
                              <Clock size={16} className="text-black/50 mt-1" />
                              <div>
                                <p className="text-black/60">Último Login</p>
                                <p className="font-medium text-[var(--primary-color)]">
                                  15/11/2025
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
                                  Proyectos Activos
                                </p>
                                <p className="font-medium text-[var(--primary-color)]">
                                  3
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
                                onClick={() => setConfirmModal({ action: "enable", personaId: p.id, personaNombre: p.nombre })}
                                className="flex items-center justify-center gap-2 w-full py-2 text-sm font-medium text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity"
                                style={{ background: "var(--secondary-color)" }}
                              >
                                <Check size={16} />
                                Habilitar Cuenta
                              </button>
                              <button 
                                onClick={() => setConfirmModal({ action: "disable", personaId: p.id, personaNombre: p.nombre })}
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

      {/* Hint para integración futura */}
      <p className="mt-3 text-xs text-black/50">
        *Luego puedes sustituir el arreglo <strong>PERSONAS</strong> por datos
        desde tu API y mantener este mismo filtrado en el cliente.
      </p>

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
                ? `Se habilitará la cuenta de ${confirmModal.personaNombre}. Podrá acceder a todos los servicios.`
                : `Se deshabilitará el acceso de ${confirmModal.personaNombre}. Perderá acceso a todos los servicios.`}
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  const action = confirmModal.action === "enable" ? "Cuenta habilitada" : "Acceso deshabilitado";
                  alert(`${action} para ${confirmModal.personaNombre}`);
                  setConfirmModal(null);
                }}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium text-white transition ${
                  confirmModal.action === "enable"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {confirmModal.action === "enable" ? "Habilitar" : "Deshabilitar"}
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
