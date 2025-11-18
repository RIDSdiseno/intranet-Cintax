import React, { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Search, LifeBuoy, ChevronRight } from "lucide-react";
import axios from "axios";

// 1. CAMBIO: Usamos el nombre largo en el Tipo
type Categoria =
  | "Contabilidad"
  | "Comercial y Marketing"
  | "Gerencia"
  | "Recursos Humanos" // <--- Antes decía RRHH
  | "Entre otros";

type Estado =
  | "Abierto"
  | "Pendiente"
  | "Resuelto"
  | "Cerrado"
  | "Pendiente de cliente"
  | "Pendiente de tercero";

type Prioridad = "Baja" | "Media" | "Alta" | "Urgente";

type Ticket = {
  id: number;
  asunto: string;
  solicitante: string;
  categoria: Categoria;
  estado: Estado;
  prioridad: Prioridad;
  fecha: string;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:3000";

// 2. CAMBIO: Mapeamos "RRHH" (backend) -> "Recursos Humanos" (frontend)
function mapCategoria(raw: string | null | undefined): Categoria {
  const nombre = raw?.trim() || "";

  if (nombre === "Contabilidad") return "Contabilidad";
  if (nombre === "Comercial y Marketing") return "Comercial y Marketing";
  if (nombre === "Gerencia") return "Gerencia";
  
  // Si el backend manda "RRHH", lo convertimos a "Recursos Humanos"
  if (nombre === "RRHH" || nombre === "Recursos Humanos") {
    return "Recursos Humanos";
  }

  return "Entre otros";
}

function mapEstado(raw: string | number | null | undefined): Estado {
  const num = typeof raw === "number" ? raw : Number(raw);
  switch (num) {
    case 3: return "Pendiente";
    case 4: return "Resuelto";
    case 5: return "Cerrado";
    case 6: return "Pendiente de cliente";
    case 7: return "Pendiente de tercero";
    case 2: default: return "Abierto";
  }
}

function mapPrioridad(raw: number | null | undefined): Prioridad {
  if (raw === 4) return "Urgente";
  if (raw === 3) return "Alta";
  if (raw === 2) return "Media";
  if (raw === 1) return "Baja";
  return "Media";
}

function getEstadoClasses(e: Estado): string {
  switch (e) {
    case "Abierto": return "bg-amber-50 text-amber-700";
    case "Pendiente":
    case "Pendiente de cliente":
    case "Pendiente de tercero": return "bg-sky-50 text-sky-700";
    case "Resuelto": return "bg-emerald-50 text-emerald-700";
    case "Cerrado": default: return "bg-zinc-100 text-zinc-700";
  }
}

// 3. CAMBIO: Actualizamos la lista de pestañas
const CATS: Array<"Todos" | Categoria> = [
  "Todos",
  "Contabilidad",
  "Comercial y Marketing",
  "Gerencia",
  "Recursos Humanos", // <--- Nombre largo en el Tab
  "Entre otros",
];

const ESTADOS: Array<"Todos" | Estado> = [
  "Todos", "Abierto", "Pendiente", "Pendiente de cliente", 
  "Pendiente de tercero", "Resuelto", "Cerrado",
];

const PRIORIDADES: Array<"Todas" | Prioridad> = [
  "Todas", "Baja", "Media", "Alta", "Urgente",
];

export default function TicketsPage() {
  const params = useParams(); 
  const navigate = useNavigate();

  // Lógica de URL: Mantenemos el slug "rrhh" pero seteamos el estado "Recursos Humanos"
  const catFromUrl: "Todos" | Categoria = (() => {
    const p = params.cat;
    if (p === "contabilidad") return "Contabilidad";
    if (p === "comercial") return "Comercial y Marketing";
    if (p === "gerencia") return "Gerencia";
    if (p === "rrhh") return "Recursos Humanos"; // <--- Slug rrhh -> Texto largo
    if (p === "otros") return "Entre otros";
    return "Todos";
  })();

  const [categoria, setCategoria] = useState<"Todos" | Categoria>(catFromUrl);
  const [estado, setEstado] = useState<"Todos" | Estado>("Todos");
  const [prioridad, setPrioridad] = useState<"Todas" | Prioridad>("Todas");
  const [query, setQuery] = useState("");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [categoria, estado, prioridad, query]);
  useEffect(() => { setCategoria(catFromUrl); }, [catFromUrl]);

  function getAccessToken() {
    return localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  }

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      if (!token) {
        setError("No autenticado");
        setLoading(false);
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/auth/getTickets`, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` },
      });

      const apiTickets = res.data.tickets as any[];

      const mapped: Ticket[] = apiTickets.map((t) => ({
        id: t.freshdeskId,
        asunto: t.subject ?? "Sin asunto",
        solicitante: t.requesterEmail ?? "Sin correo",
        categoria: mapCategoria(t.categoria), // Aquí ocurre la conversión RRHH -> Recursos Humanos
        estado: mapEstado(t.estado),
        prioridad: mapPrioridad(t.prioridad),
        fecha: t.createdAt ?? new Date().toISOString(),
      }));

      setTickets(mapped);
    } catch (err: any) {
      console.error(err);
      setError("Error al cargar tickets.");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFreshdesk = async () => {
    try {
      setSyncing(true);
      setError(null);
      const token = getAccessToken();
      if (!token) return;

      await axios.post(
        `${API_BASE_URL}/auth/sync-freshdesk`,
        { pages: 3 },
        { withCredentials: true, headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchTickets();
    } catch (err: any) {
      console.error(err);
      setError("Error al sincronizar.");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    handleSyncFreshdesk();
    const id = setInterval(() => handleSyncFreshdesk(), 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCategoriaAndUrl = (c: "Todos" | Categoria) => {
    setCategoria(c);
    if (c === "Todos") {
      navigate("/tickets", { replace: true });
    } else {
      let slug = "otros";
      if (c === "Contabilidad") slug = "contabilidad";
      if (c === "Comercial y Marketing") slug = "comercial";
      if (c === "Gerencia") slug = "gerencia";
      if (c === "Recursos Humanos") slug = "rrhh"; // <--- Texto largo -> Slug corto
      
      navigate(`/tickets/${slug}`, { replace: true });
    }
  };

  const counts = useMemo(() => {
    const base: Record<"Todos" | Categoria, number> = {
      Todos: tickets.length,
      "Contabilidad": 0,
      "Comercial y Marketing": 0,
      "Gerencia": 0,
      "Recursos Humanos": 0, // <--- Key actualizada
      "Entre otros": 0,
    };

    tickets.forEach((t) => {
      if (base[t.categoria] !== undefined) {
        base[t.categoria] += 1;
      } else {
        base["Entre otros"] += 1;
      }
    });
    return base;
  }, [tickets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
      const okCat = categoria === "Todos" ? true : t.categoria === categoria;
      const okEst = estado === "Todos" ? true : t.estado === estado;
      const okPri = prioridad === "Todas" ? true : t.prioridad === prioridad;
      const okQ = !q || 
        t.asunto.toLowerCase().includes(q) || 
        t.solicitante.toLowerCase().includes(q) || 
        t.id.toString().includes(q);
      return okCat && okEst && okPri && okQ;
    });
  }, [tickets, categoria, estado, prioridad, query]);

  const total = filtered.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedTickets = filtered.slice(startIndex, endIndex);

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--primary-color)" }}>
            <span className="inline-flex items-center gap-2">
              <LifeBuoy size={18} /> Tickets
            </span>
          </h2>
          <p className="text-sm text-black/60">
            Sincronizado con Freshdesk (Grupos)
          </p>
          {error && <p className="mt-1 text-xs text-rose-600">⚠️ {error}</p>}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSyncFreshdesk}
            disabled={syncing || loading}
            className="rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20 transition"
          >
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </button>
          <button
            className="rounded-xl px-3 py-2 text-sm text-white shadow-sm"
            style={{ background: "var(--secondary-color)" }}
            onClick={() => alert("Crear ticket pendiente")}
          >
            Crear ticket
          </button>
        </div>
      </div>

      {/* Tabs de Categoría */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCategoriaAndUrl(c)}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${
              categoria === c
                ? "bg-[var(--secondary-color)] text-white border-[var(--secondary-color)]"
                : "bg-white text-[var(--primary-color)] border-black/10 hover:border-black/20"
            }`}
          >
            {c}
            <span className="ml-1 text-xs opacity-80">
              ({c === "Todos" ? counts.Todos : counts[c]})
            </span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="grid gap-3 md:grid-cols-[1fr_200px_200px] mb-4">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-black/10 px-3 py-2">
          <Search size={16} className="text-black/50" />
          <input
            className="w-full outline-none text-sm placeholder:text-black/40"
            placeholder="Buscar..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as any)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>{e === "Todos" ? "Todos los estados" : e}</option>
          ))}
        </select>
        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as any)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>{p === "Todas" ? "Todas las prioridades" : p}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 text-xs border-b border-black/5">
              <th className="py-3 px-3 font-medium">#</th>
              <th className="py-3 px-3 font-medium">Asunto</th>
              <th className="py-3 px-3 font-medium">Solicitante</th>
              <th className="py-3 px-3 font-medium">Grupo</th>
              <th className="py-3 px-3 font-medium">Estado</th>
              <th className="py-3 px-3 font-medium">Prioridad</th>
              <th className="py-3 px-3 font-medium">Fecha</th>
              <th className="py-3 px-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="py-8 text-center text-black/50">Cargando...</td></tr>
            )}
            {!loading && total === 0 && (
              <tr><td colSpan={8} className="py-8 text-center text-black/50">No hay tickets.</td></tr>
            )}
            {!loading && pagedTickets.map((t) => (
              <tr key={t.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.01]">
                <td className="py-3 px-3 text-black/70">#{t.id}</td>
                <td className="py-3 px-3 font-medium text-[var(--primary-color)]">{t.asunto}</td>
                <td className="py-3 px-3 text-black/70">{t.solicitante}</td>
                <td className="py-3 px-3">
                  <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-[var(--tertiary-color)] text-[var(--secondary-color)]">
                    {t.categoria}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${getEstadoClasses(t.estado)}`}>
                    {t.estado}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                    t.prioridad === "Urgente" ? "bg-rose-50 text-rose-700" :
                    t.prioridad === "Alta" ? "bg-orange-50 text-orange-700" :
                    t.prioridad === "Media" ? "bg-amber-50 text-amber-700" :
                    "bg-zinc-100 text-zinc-700"
                  }`}>
                    {t.prioridad}
                  </span>
                </td>
                <td className="py-3 px-3 text-black/70">{new Date(t.fecha).toLocaleDateString()}</td>
                <td className="py-3 px-3 text-right">
                  <button className="inline-flex items-center gap-1 text-sm rounded-lg px-2 py-1 border border-black/10 hover:bg-black/5 transition">
                    Ver <ChevronRight size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Paginación simple */}
        {!loading && total > 0 && (
           <div className="flex items-center justify-between px-4 py-3 text-xs text-black/60">
             <span>{startIndex + 1}-{Math.min(endIndex, total)} de {total}</span>
             <div className="flex gap-2">
               <button 
                 onClick={() => setPage(p => Math.max(1, p-1))} 
                 disabled={page === 1}
                 className="disabled:opacity-50"
               >Anterior</button>
               <button 
                 onClick={() => setPage(p => Math.min(totalPages, p+1))} 
                 disabled={page === totalPages}
                 className="disabled:opacity-50"
               >Siguiente</button>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}