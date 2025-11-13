import React, { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Search, LifeBuoy, ChevronRight } from "lucide-react";
import axios from "axios";

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

// Si quieres, puedes usar import.meta.env.VITE_API_BASE_URL
const API_BASE_URL = "http://localhost:3000/api";

// Helpers para mapear desde la API (Prisma + Freshdesk)
function mapCategoria(raw: string | null | undefined): Categoria {
  const norm = (raw ?? "").toLowerCase();
  if (norm === "contabilidad") return "Contabilidad";
  if (norm === "tributario") return "Tributario";
  return "Entre otros";
}

function mapEstado(raw: string | null | undefined): Estado {
  const norm = (raw ?? "").toLowerCase();

  if (norm.includes("open") || norm.includes("abierto")) return "Abierto";
  if (norm.includes("pending") || norm.includes("curso")) return "En curso";
  if (norm.includes("resolved") || norm.includes("resuelto")) return "Resuelto";
  if (norm.includes("closed") || norm.includes("cerrado")) return "Cerrado";

  return "Abierto";
}

function mapPrioridad(raw: number | null | undefined): Prioridad {
  if (raw === 4) return "Crítica";
  if (raw === 3) return "Alta";
  if (raw === 2) return "Media";
  if (raw === 1) return "Baja";
  return "Media";
}

const CATS: Array<"Todos" | Categoria> = [
  "Todos",
  "Contabilidad",
  "Tributario",
  "Entre otros",
];
const ESTADOS: Array<"Todos" | Estado> = [
  "Todos",
  "Abierto",
  "En curso",
  "Resuelto",
  "Cerrado",
];
const PRIORIDADES: Array<"Todas" | Prioridad> = [
  "Todas",
  "Baja",
  "Media",
  "Alta",
  "Crítica",
];

export default function TicketsPage() {
  const params = useParams(); // { cat?: "contabilidad" | "tributario" | "otros" }
  const navigate = useNavigate();

  // Sincroniza la categoría con la URL
  const catFromUrl: "Todos" | Categoria =
    params.cat === "contabilidad"
      ? "Contabilidad"
      : params.cat === "tributario"
      ? "Tributario"
      : params.cat === "otros"
      ? "Entre otros"
      : "Todos";

  const [categoria, setCategoria] = useState<"Todos" | Categoria>(catFromUrl);
  const [estado, setEstado] = useState<"Todos" | Estado>("Todos");
  const [prioridad, setPrioridad] = useState<"Todas" | Prioridad>("Todas");
  const [query, setQuery] = useState("");

  // Estado para datos reales
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cuando cambie la URL, actualiza el tab
  useEffect(() => {
    setCategoria(catFromUrl);
  }, [catFromUrl]);

  // Fetch de tickets desde tu backend
  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await axios.get(`${API_BASE_URL}/auth/getTickets/`, {
        withCredentials: true,
      });

      const apiTickets = res.data.tickets as any[];

      const mapped: Ticket[] = apiTickets.map((t) => ({
        id: t.id_ticket,
        asunto: t.subject ?? "Sin asunto",
        solicitante: t.requesterEmail ?? "Sin correo",
        categoria: mapCategoria(t.categoria),
        estado: mapEstado(t.estado),
        prioridad: mapPrioridad(t.prioridad),
        fecha: t.createdAt ?? new Date().toISOString(),
      }));

      setTickets(mapped);
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.error ??
          "Error al cargar tickets desde el servidor."
      );
    } finally {
      setLoading(false);
    }
  };

  // Al montar el componente, carga tickets
  useEffect(() => {
    fetchTickets();
  }, []);

  // Botón para sincronizar con Freshdesk y recargar lista
  const handleSyncFreshdesk = async () => {
    try {
      setSyncing(true);
      setError(null);
      await axios.post(
        `${API_BASE_URL}/auth/sync-freshdesk`,
        { pages: 3 },
        { withCredentials: true }
      );
      await fetchTickets();
    } catch (err: any) {
      console.error(err);
      setError(
        err?.response?.data?.error ??
          "Error al sincronizar tickets con Freshdesk."
      );
    } finally {
      setSyncing(false);
    }
  };

  // Al cambiar el tab de categoría, actualiza la URL
  const setCategoriaAndUrl = (c: "Todos" | Categoria) => {
    setCategoria(c);
    if (c === "Todos") navigate("/tickets", { replace: true });
    else {
      const slug =
        c === "Contabilidad"
          ? "contabilidad"
          : c === "Tributario"
          ? "tributario"
          : "otros";
      navigate(`/tickets/${slug}`, { replace: true });
    }
  };

  // Contadores por categoría
  const counts = useMemo(() => {
    const base = {
      Todos: tickets.length,
      Contabilidad: 0,
      Tributario: 0,
      "Entre otros": 0,
    } as Record<"Todos" | Categoria, number>;

    tickets.forEach((t) => {
      base[t.categoria] += 1;
    });

    return base;
  }, [tickets]);

  // Filtrado principal en cliente (mantengo tu lógica)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((t) => {
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
  }, [tickets, categoria, estado, prioridad, query]);

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold"
            style={{ color: "var(--primary-color)" }}
          >
            <span className="inline-flex items-center gap-2">
              <LifeBuoy size={18} /> Tickets
            </span>
          </h2>
          <p className="text-sm text-black/60">
            Gestiona y filtra tickets por categoría, estado, prioridad y
            búsqueda. Datos sincronizados desde Freshdesk.
          </p>
          {error && (
            <p className="mt-1 text-xs text-rose-600">
              ⚠️ {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20"
            onClick={handleSyncFreshdesk}
            disabled={syncing || loading}
          >
            {syncing ? "Sincronizando…" : "Sincronizar Freshdesk"}
          </button>

          <button
            className="rounded-xl px-3 py-2 text-sm text-white shadow-sm"
            style={{ background: "var(--secondary-color)" }}
            onClick={() => alert("Acción: crear ticket (pendiente integrar)")}
          >
            Crear ticket
          </button>
        </div>
      </div>

      {/* Tabs de categoría */}
      <div className="flex flex-wrap items-center gap-2">
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
            {c}{" "}
            <span className="ml-1 text-xs opacity-80">
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
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e === "Todos" ? "Todos los estados" : e}
            </option>
          ))}
        </select>

        <select
          value={prioridad}
          onChange={(e) => setPrioridad(e.target.value as any)}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
        >
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {p === "Todas" ? "Todas las prioridades" : p}
            </option>
          ))}
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
            {loading && (
              <tr>
                <td className="py-6 px-3 text-center text-black/50" colSpan={8}>
                  Cargando tickets…
                </td>
              </tr>
            )}

            {!loading && filtered.length === 0 && (
              <tr>
                <td className="py-8 px-3 text-center text-black/50" colSpan={8}>
                  No hay tickets con los filtros actuales.
                </td>
              </tr>
            )}

            {!loading &&
              filtered.map((t) => (
                <tr key={t.id} className="border-t">
                  <td className="py-3 px-3 text-black/70">#{t.id}</td>
                  <td className="py-3 px-3">
                    <div
                      className="font-medium"
                      style={{ color: "var(--primary-color)" }}
                    >
                      {t.asunto}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-black/70">{t.solicitante}</td>
                  <td className="py-3 px-3">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-[var(--tertiary-color)]">
                      {t.categoria}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        t.estado === "Abierto"
                          ? "bg-amber-50 text-amber-700"
                          : t.estado === "En curso"
                          ? "bg-sky-50 text-sky-700"
                          : t.estado === "Resuelto"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {t.estado}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        t.prioridad === "Crítica"
                          ? "bg-rose-50 text-rose-700"
                          : t.prioridad === "Alta"
                          ? "bg-orange-50 text-orange-700"
                          : t.prioridad === "Media"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
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
    </div>
  );
}
