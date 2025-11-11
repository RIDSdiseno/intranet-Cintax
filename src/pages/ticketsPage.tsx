import React, { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Search, LifeBuoy, ChevronRight } from "lucide-react";

type Categoria = "Contabilidad" | "Tributario" | "Entre otros";
type Estado = "Abierto" | "En curso" | "Resuelto" | "Cerrado";
type Prioridad = "Baja" | "Media" | "Alta" | "Crítica";

type Ticket = {
  id: number;
  asunto: string;
  solicitante: string;
  categoria: Categoria;
  estado: Estado;
  prioridad: Prioridad;
  fecha: string; // ISO o legible
};

// --- MOCK DATA ---
const TICKETS: Ticket[] = [
  { id: 2381, asunto: "Error en acceso VPN", solicitante: "María González", categoria: "Contabilidad", estado: "Resuelto", prioridad: "Media", fecha: "2025-11-08" },
  { id: 2382, asunto: "Dudas sobre facturación noviembre", solicitante: "Luis Pérez", categoria: "Contabilidad", estado: "En curso", prioridad: "Alta", fecha: "2025-11-09" },
  { id: 2383, asunto: "Ajuste declaración F29", solicitante: "Ana Torres", categoria: "Tributario", estado: "Abierto", prioridad: "Crítica", fecha: "2025-11-10" },
  { id: 2384, asunto: "Permisos de carpeta informes", solicitante: "Equipo Operaciones", categoria: "Entre otros", estado: "Abierto", prioridad: "Baja", fecha: "2025-11-09" },
  { id: 2385, asunto: "Carga XML a SII", solicitante: "Pedro Rojas", categoria: "Tributario", estado: "En curso", prioridad: "Alta", fecha: "2025-11-07" },
  { id: 2386, asunto: "Reporte gastos v2", solicitante: "Finanzas", categoria: "Contabilidad", estado: "Cerrado", prioridad: "Media", fecha: "2025-11-01" },
  { id: 2387, asunto: "Solicitud usuario nuevo", solicitante: "RR.HH.", categoria: "Entre otros", estado: "Resuelto", prioridad: "Baja", fecha: "2025-11-06" },
];

const CATS: Array<"Todos" | Categoria> = ["Todos", "Contabilidad", "Tributario", "Entre otros"];
const ESTADOS: Array<"Todos" | Estado> = ["Todos", "Abierto", "En curso", "Resuelto", "Cerrado"];
const PRIORIDADES: Array<"Todas" | Prioridad> = ["Todas", "Baja", "Media", "Alta", "Crítica"];

export default function TicketsPage() {
  const params = useParams(); // { cat?: "contabilidad" | "tributario" | "otros" }
  const navigate = useNavigate();

  // Sincroniza la categoría con la URL
  const catFromUrl: "Todos" | Categoria =
    params.cat === "contabilidad" ? "Contabilidad" :
    params.cat === "tributario" ? "Tributario" :
    params.cat === "otros" ? "Entre otros" : "Todos";

  const [categoria, setCategoria] = useState<"Todos" | Categoria>(catFromUrl);
  const [estado, setEstado] = useState<"Todos" | Estado>("Todos");
  const [prioridad, setPrioridad] = useState<"Todas" | Prioridad>("Todas");
  const [query, setQuery] = useState("");

  // Cuando cambie la URL, actualiza el tab
  useEffect(() => { setCategoria(catFromUrl); }, [catFromUrl]);

  // Al cambiar el tab de categoría, actualiza la URL
  const setCategoriaAndUrl = (c: "Todos" | Categoria) => {
    setCategoria(c);
    if (c === "Todos") navigate("/tickets", { replace: true });
    else {
      const slug = c === "Contabilidad" ? "contabilidad" : c === "Tributario" ? "tributario" : "otros";
      navigate(`/tickets/${slug}`, { replace: true });
    }
  };

  // Contadores por categoría
  const counts = useMemo(() => {
    const base = { Todos: TICKETS.length, Contabilidad: 0, Tributario: 0, "Entre otros": 0 } as Record<"Todos" | Categoria, number>;
    TICKETS.forEach(t => { base[t.categoria] += 1; });
    return base;
  }, []);

  // Filtrado principal
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TICKETS.filter(t => {
      const okCat = categoria === "Todos" ? true : t.categoria === categoria;
      const okEst = estado === "Todos" ? true : t.estado === estado;
      const okPri = prioridad === "Todas" ? true : t.prioridad === prioridad;
      const okQ =
        !q ||
        t.asunto.toLowerCase().includes(q) ||
        t.solicitante.toLowerCase().includes(q) ||
        t.id.toString().includes(q);
      return okCat && okEst && okPri && okQ;
    });
  }, [categoria, estado, prioridad, query]);

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--primary-color)" }}>
            <span className="inline-flex items-center gap-2"><LifeBuoy size={18} /> Tickets</span>
          </h2>
          <p className="text-sm text-black/60">Gestiona y filtra tickets por categoría, estado, prioridad y búsqueda.</p>
        </div>

        <button
          className="rounded-xl px-3 py-2 text-sm text-white shadow-sm"
          style={{ background: "var(--secondary-color)" }}
          onClick={() => alert("Acción: crear ticket (mock)")}
        >
          Crear ticket
        </button>
      </div>

      {/* Tabs de categoría */}
      <div className="flex flex-wrap items-center gap-2">
        {CATS.map(c => (
          <button
            key={c}
            onClick={() => setCategoriaAndUrl(c)}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${
              categoria === c
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

      {/* Filtros y búsqueda */}
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_200px_200px]">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-black/10 px-3 py-2">
          <Search size={16} className="text-black/50" />
          <input
            className="w-full outline-none text-sm placeholder:text-black/40"
            placeholder="Buscar por #, asunto o solicitante…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as any)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          {ESTADOS.map(e => <option key={e} value={e}>{e === "Todos" ? "Todos los estados" : e}</option>)}
        </select>

        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as any)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          {PRIORIDADES.map(p => <option key={p} value={p}>{p === "Todas" ? "Todas las prioridades" : p}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="mt-4 bg-white rounded-2xl border border-black/5 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 text-xs">
              <th className="py-3 px-3 font-medium">#</th>
              <th className="py-3 px-3 font-medium">Asunto</th>
              <th className="py-3 px-3 font-medium">Solicitante</th>
              <th className="py-3 px-3 font-medium">Categoría</th>
              <th className="py-3 px-3 font-medium">Estado</th>
              <th className="py-3 px-3 font-medium">Prioridad</th>
              <th className="py-3 px-3 font-medium">Fecha</th>
              <th className="py-3 px-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td className="py-8 px-3 text-center text-black/50" colSpan={8}>
                  No hay tickets con los filtros actuales.
                </td>
              </tr>
            )}
            {filtered.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="py-3 px-3 text-black/70">#{t.id}</td>
                <td className="py-3 px-3">
                  <div className="font-medium" style={{ color: "var(--primary-color)" }}>{t.asunto}</div>
                </td>
                <td className="py-3 px-3 text-black/70">{t.solicitante}</td>
                <td className="py-3 px-3">
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-[var(--tertiary-color)]">
                    {t.categoria}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                    t.estado === "Abierto"    ? "bg-amber-50 text-amber-700" :
                    t.estado === "En curso"   ? "bg-sky-50 text-sky-700" :
                    t.estado === "Resuelto"   ? "bg-emerald-50 text-emerald-700" :
                                                 "bg-zinc-100 text-zinc-700"
                  }`}>
                    {t.estado}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                    t.prioridad === "Crítica" ? "bg-rose-50 text-rose-700" :
                    t.prioridad === "Alta"    ? "bg-orange-50 text-orange-700" :
                    t.prioridad === "Media"   ? "bg-amber-50 text-amber-700" :
                                                "bg-zinc-100 text-zinc-700"
                  }`}>
                    {t.prioridad}
                  </span>
                </td>
                <td className="py-3 px-3 text-black/70">
                  {new Date(t.fecha).toLocaleDateString()}
                </td>
                <td className="py-3 px-3 text-right">
                  <button className="inline-flex items-center gap-1 text-sm rounded-xl px-3 py-1.5 border border-black/10 hover:border-black/20 transition">
                    Ver <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-black/50">
        *Para datos reales, reemplaza <code>TICKETS</code> por tu fetch a la API y conserva esta lógica de filtros en el cliente.
      </p>
    </div>
  );
}
