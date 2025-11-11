import React, { useMemo, useState } from "react";
import { Search } from "lucide-react";

type Categoria = "Contabilidad" | "Tributario" | "Entre otros";
type Persona = {
  id: number;
  nombre: string;
  email: string;
  area: string;           // Ej: "Clientes", "Proveedores", "Interno", etc.
  categoria: Categoria;   // Para filtrar por tipo (igual a categorías de tickets)
  estado?: "Activo" | "Inactivo";
};

// ---- Datos MOCK (puedes reemplazar luego por fetch a tu API) ----
const PERSONAS: Persona[] = [
  { id: 1,  nombre: "María González",  email: "maria.gonzalez@cliente.cl", area: "Clientes",  categoria: "Contabilidad", estado: "Activo" },
  { id: 2,  nombre: "Pedro Rojas",     email: "projas@cliente.cl",          area: "Interno",   categoria: "Tributario",   estado: "Activo" },
  { id: 3,  nombre: "Ana Torres",       email: "ana.torres@cliente.cl",     area: "Clientes",  categoria: "Entre otros",  estado: "Activo" },
  { id: 4,  nombre: "Luis Pérez",       email: "lperez@cliente.cl",         area: "Proveedores",categoria: "Contabilidad", estado: "Inactivo" },
  { id: 5,  nombre: "Carla Bustos",     email: "carla@cliente.cl",          area: "Clientes",  categoria: "Tributario",   estado: "Activo" },
  { id: 6,  nombre: "Jorge Fuentes",    email: "jorge@cliente.cl",          area: "Interno",   categoria: "Contabilidad", estado: "Activo" },
  { id: 7,  nombre: "Valentina Mora",   email: "valentina@cliente.cl",      area: "Clientes",  categoria: "Tributario",   estado: "Activo" },
  { id: 8,  nombre: "Ricardo Díaz",     email: "ricardo@cliente.cl",        area: "Proveedores",categoria: "Entre otros",  estado: "Inactivo" },
];

const CATS: Array<"Todos" | Categoria> = ["Todos", "Contabilidad", "Tributario", "Entre otros"];

export default function PersonasPage() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"Todos" | Categoria>("Todos");

  // Contadores por categoría
  const counts = useMemo(() => {
    const base = { Todos: PERSONAS.length, Contabilidad: 0, Tributario: 0, "Entre otros": 0 } as Record<"Todos" | Categoria, number>;
    PERSONAS.forEach(p => { base[p.categoria] += 1; });
    return base;
  }, []);

  // Filtrado
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PERSONAS.filter(p => {
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
        <h2 className="text-lg font-semibold" style={{ color: "var(--primary-color)" }}>Personas</h2>
        <p className="text-sm text-black/60">Directorio y clientes clasificados por categoría (Contabilidad, Tributario, Entre otros).</p>
      </div>

      {/* Controles: Filtros + Búsqueda */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Tabs de categorías */}
        <div className="flex flex-wrap items-center gap-2">
          {CATS.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`rounded-full px-3 py-1.5 text-sm border transition ${
                cat === c
                  ? "bg-[var(--secondary-color)] text-white border-[var(--secondary-color)]"
                  : "bg-white text-[var(--primary-color)] border-black/10 hover:border-black/20"
              }`}
            >
              {c} <span className="ml-1 text-xs opacity-80">
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
      <div className="mt-4 bg-white rounded-2xl border border-black/5 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 text-xs">
              <th className="py-3 px-3 font-medium">#</th>
              <th className="py-3 px-3 font-medium">Nombre</th>
              <th className="py-3 px-3 font-medium">Email</th>
              <th className="py-3 px-3 font-medium">Área</th>
              <th className="py-3 px-3 font-medium">Categoría</th>
              <th className="py-3 px-3 font-medium">Estado</th>
              <th className="py-3 px-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="py-8 px-3 text-center text-black/50" colSpan={7}>
                  No hay resultados con los filtros actuales.
                </td>
              </tr>
            )}
            {filtered.map((p, i) => (
              <tr key={p.id} className="border-t">
                <td className="py-3 px-3 text-black/70">{String(i + 1).padStart(3, "0")}</td>
                <td className="py-3 px-3">
                  <div className="font-medium" style={{ color: "var(--primary-color)" }}>{p.nombre}</div>
                  <div className="text-xs text-black/50">ID: {p.id}</div>
                </td>
                <td className="py-3 px-3">
                  <a href={`mailto:${p.email}`} className="text-[var(--secondary-color)] hover:underline">{p.email}</a>
                </td>
                <td className="py-3 px-3 text-black/70">{p.area}</td>
                <td className="py-3 px-3">
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-[var(--tertiary-color)]">
                    {p.categoria}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      p.estado === "Activo"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {p.estado ?? "—"}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button className="text-sm rounded-xl px-3 py-1.5 border border-black/10 hover:border-black/20 transition">
                    Ver ficha
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hint para integración futura */}
      <p className="mt-3 text-xs text-black/50">
        *Luego puedes sustituir el arreglo <code>PERSONAS</code> por datos desde tu API y mantener este mismo filtrado en el cliente.
      </p>
    </div>
  );
}
