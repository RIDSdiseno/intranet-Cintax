import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search,
  ChevronRight,
  BookCheck,
  X,
  Bold,
  Italic,
  Underline,
  Link as LinkIcon,
  Image as ImageIcon,
  List,
  AlignLeft,
  Paperclip,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  MessageSquare,
  Tickets,
} from "lucide-react";
import axios from "axios";

import DashboardArea from "../components/DashboardArea";
import React from "react";

// 1. DEFINICIÓN DE TIPOS
type Categoria =
  | "Contabilidad"
  | "Comercial y Marketing"
  | "Gerencia"
  | "Recursos Humanos" // Usamos el nombre largo para la UI
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
  // Campos simulados para el detalle expandido
  descripcion?: string;
  agente?: string;
  ultimaActualizacion?: string;
};

const getApiBaseUrl = () => {
  try {
    // @ts-ignore
    if (
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      import.meta.env.VITE_API_BASE_URL
    ) {
      // @ts-ignore
      return import.meta.env.VITE_API_BASE_URL;
    }
  } catch (e) {
    // Fallo silencioso
  }
  return "https://localhost:3000";
};

const API_BASE_URL = getApiBaseUrl();

// 2. MAPEO DE CATEGORÍAS (Backend -> Frontend)
function mapCategoria(raw: string | null | undefined): Categoria {
  const nombre = raw?.trim() || "";

  if (nombre === "Contabilidad") return "Contabilidad";
  if (nombre === "Comercial y Marketing") return "Comercial y Marketing";
  if (nombre === "Gerencia") return "Gerencia";

  // AQUÍ LA CLAVE: Si llega "RRHH", lo mostramos como "Recursos Humanos"
  if (nombre === "RRHH" || nombre === "Recursos Humanos") {
    return "Recursos Humanos";
  }

  return "Entre otros";
}

function mapEstado(raw: string | number | null | undefined): Estado {
  const num = typeof raw === "number" ? raw : Number(raw);
  switch (num) {
    case 3:
      return "Pendiente";
    case 4:
      return "Resuelto";
    case 5:
      return "Cerrado";
    case 6:
      return "Pendiente de cliente";
    case 7:
      return "Pendiente de tercero";
    case 2:
    default:
      return "Abierto";
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
    case "Abierto":
      return "bg-amber-50 text-amber-700";
    case "Pendiente":
    case "Pendiente de cliente":
    case "Pendiente de tercero":
      return "bg-sky-50 text-sky-700";
    case "Resuelto":
      return "bg-emerald-50 text-emerald-700";
    case "Cerrado":
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

// 3. LISTA DE PESTAÑAS VISIBLES
const CATS: Array<"Todos" | Categoria> = [
  "Todos",
  "Contabilidad",
  "Comercial y Marketing",
  "Gerencia",
  "Recursos Humanos", // Nombre largo
  "Entre otros",
];

const ESTADOS: Array<"Todos" | Estado> = [
  "Todos",
  "Abierto",
  "Pendiente",
  "Pendiente de cliente",
  "Pendiente de tercero",
  "Resuelto",
  "Cerrado",
];

const PRIORIDADES: Array<"Todas" | Prioridad> = [
  "Todas",
  "Baja",
  "Media",
  "Alta",
  "Urgente",
];

export default function TicketsPage() {
  // Estado para el Modal Nuevo
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null);

  const params = useParams();
  const navigate = useNavigate();

  // Sincroniza la URL con la pestaña activa
  const catFromUrl: "Todos" | Categoria = useMemo(() => {
    const p = params.cat;
    if (p === "contabilidad") return "Contabilidad";
    if (p === "comercial") return "Comercial y Marketing";
    if (p === "gerencia") return "Gerencia";
    if (p === "rrhh") return "Recursos Humanos"; // Slug corto -> Nombre largo
    if (p === "otros") return "Entre otros";
    return "Todos";
  }, [params.cat]);

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

  // Efectos
  useEffect(() => {
    setPage(1);
  }, [categoria, estado, prioridad, query]);
  useEffect(() => {
    setCategoria(catFromUrl);
  }, [catFromUrl]);

  const toggleExpand = (id: number) => {
    setExpandedTicketId((prev) => (prev === id ? null : id));
  };

  function getAccessToken() {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token")
    );
  }

  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Intentamos obtener token, pero no bloqueamos si no existe para poder mostrar demo
      const token = getAccessToken();

      // Intentamos llamar a la API real
      try {
        const res = await axios.get(`${API_BASE_URL}/auth/getTickets`, {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const apiTickets = res.data.tickets as any[];
        const mapped: Ticket[] = apiTickets.map((t) => ({
          id: t.freshdeskId,
          asunto: t.subject ?? "Sin asunto",
          solicitante: t.requesterEmail ?? "Sin correo",
          categoria: mapCategoria(t.categoria),
          estado: mapEstado(t.estado),
          prioridad: mapPrioridad(t.prioridad),
          fecha: t.createdAt ?? new Date().toISOString(),
          descripcion: t.description_text || "Sin descripción.",
          agente: "Sin asignar",
          ultimaActualizacion: t.updated_at || new Date().toISOString(),
        }));
        setTickets(mapped);
      } catch (apiError) {
        console.warn(
          "API no disponible, cargando datos de demostración...",
          apiError
        );
        // FALLBACK: Datos simulados para que veas la interfaz funcionando
        setTickets([
          {
            id: 101,
            asunto: "Error en factura 123",
            solicitante: "juan@cintax.cl",
            categoria: "Contabilidad",
            estado: "Abierto",
            prioridad: "Alta",
            fecha: new Date().toISOString(),
            descripcion: "El monto del IVA no cuadra.",
            agente: "Maria",
            ultimaActualizacion: new Date().toISOString(),
          },
          {
            id: 102,
            asunto: "Licencia Médica J. Pérez",
            solicitante: "rrhh@cintax.cl",
            categoria: "Recursos Humanos",
            estado: "Pendiente",
            prioridad: "Media",
            fecha: new Date().toISOString(),
            descripcion: "Adjunto licencia.",
            agente: "Carlos",
            ultimaActualizacion: new Date().toISOString(),
          },
          {
            id: 103,
            asunto: "Campaña LinkedIn",
            solicitante: "marketing@cintax.cl",
            categoria: "Comercial y Marketing",
            estado: "Resuelto",
            prioridad: "Baja",
            fecha: new Date().toISOString(),
            descripcion: "Aprobar diseño.",
            agente: "Sofia",
            ultimaActualizacion: new Date().toISOString(),
          },
          {
            id: 104,
            asunto: "Aprobación Presupuesto",
            solicitante: "gerencia@cintax.cl",
            categoria: "Gerencia",
            estado: "Abierto",
            prioridad: "Urgente",
            fecha: new Date().toISOString(),
            descripcion: "Urgente revisar.",
            agente: "Pedro",
            ultimaActualizacion: new Date().toISOString(),
          },
        ]);
      }
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

  // Carga inicial y polling
  useEffect(() => {
    fetchTickets();
    const id = setInterval(() => fetchTickets(), 5 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manejo de cambio de pestaña y URL
  const setCategoriaAndUrl = (c: "Todos" | Categoria) => {
    setCategoria(c);
    if (c === "Todos") navigate("/tickets", { replace: true });
    else {
      let slug = "otros";
      if (c === "Contabilidad") slug = "contabilidad";
      if (c === "Comercial y Marketing") slug = "comercial";
      if (c === "Gerencia") slug = "gerencia";
      if (c === "Recursos Humanos") slug = "rrhh";

      navigate(`/tickets/${slug}`, { replace: true });
    }
  };

  // Contadores dinámicos
  const counts = useMemo(() => {
    const base: Record<"Todos" | Categoria, number> = {
      Todos: tickets.length,
      Contabilidad: 0,
      "Comercial y Marketing": 0,
      Gerencia: 0,
      "Recursos Humanos": 0,
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

  // Filtrado
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

  // Paginación
  const total = filtered.length;
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const pagedTickets = filtered.slice(startIndex, endIndex);

  return (
    <div className="mt-4">
      {/* Header */}
      <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-semibold"
            style={{ color: "var(--primary-color)" }}
          >
            <span className="inline-flex items-center gap-2">
              <Tickets size={20} /> Tickets
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
            className="rounded-xl px-3 py-2 text-sm text-white shadow-md shadow-black/30 active:scale-95"
            style={{ background: "var(--secondary-color)" }}
            onClick={() => setIsModalOpen(true)}
          >
            Crear ticket
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-4 shadow-lg z-10 max-h-[90vh] overflow-y-auto scroll-overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Crear ticket</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsModalOpen(false);
                alert("Ticket creado (pendiente integrar al backend)");
              }}
              className="flex flex-col gap-4"
            >
              {/* Sección Contacto y Asunto */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-black/70">
                      Contacto <span className="text-rose-500">*</span>
                    </label>
                    <div className="text-xs text-[var(--secondary-color)] cursor-pointer flex gap-2">
                    </div>
                  </div>
                  <input
                    className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white"
                    type="email"
                    placeholder="ejemplo@cintax.cl"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Asunto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white"
                    type="text"
                    required
                  />
                </div>
              </div>

              {/* Grid de Selectores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tipo */}
                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Tipo <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white text-black/70"
                  >
                    <option value="">--</option>
                    <option value="RRHH">RRHH</option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Tributacion">Tributacion</option>
                    <option value="Comercial y MKT">Comercial y MKT</option>
                    <option value="Ofertas Proveedores">
                      Ofertas Proveedores
                    </option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                {/* Tipo 2 */}
                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Tipo 2 <span className="text-rose-500">*</span>
                  </label>
                  <select className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white text-black/70">
                    <option value="">--</option>
                    <option value="Confeccion F29">Confeccion F29</option>
                    <option value="Conciliacion RCV">Conciliacion RCV</option>
                    <option value="Conciliacion BH">Conciliacion BH</option>
                    <option value="Revision LR">Revision LR</option>
                    <option value="Revision TGR">Revision TGR</option>
                    <option value="Conciliacion Banco">
                      Conciliacion Banco
                    </option>
                    <option value="Emision ER">Emision ER</option>
                    <option value="Emision AC">Emision AC</option>
                    <option value="DJ">DJ</option>
                    <option value="F22">F22</option>
                    <option value="RRHH">RRHH</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                {/* Estado */}
                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Estado <span className="text-rose-500">*</span>
                  </label>
                  <select className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white">
                    <option value="Abierta">Abierta</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Resuelto">Resuelto</option>
                    <option value="Cerrado">Cerrado</option>
                    <option value="En espera de respuesta del cliente">
                      En espera de respuesta del cliente
                    </option>
                    <option value="En espera de un tercero">
                      En espera de un tercero
                    </option>
                  </select>
                </div>

                {/* Prioridad */}
                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Prioridad <span className="text-rose-500">*</span>
                  </label>
                  <select className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white">
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                {/* Grupo */}
                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Grupo <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white text-black/70"
                  >
                    <option value="">--</option>
                    <option value="Comercial y Marketing">
                      Comercial y Marketing
                    </option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Gerencia">Gerencia</option>
                    <option value="RRHH">RRHH</option>
                    <option value="Tributacion">Tributacion</option>
                  </select>
                </div>

                {/* Agente */}
                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Agente <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white"
                  >
                    <option value="--">--</option>
                    <option value="Esteban Ramos">Esteban Ramos</option>
                    <option value="Patricio Mena">Patricio Mena</option>
                  </select>
                </div>
              </div>

              {/* Editor de Descripción */}
              <div>
                <label className="text-xs font-medium text-black/70 mb-1 block">
                  Descripción <span className="text-rose-500">*</span>
                </label>
                <div className="border border-black/15 rounded-md bg-white focus-within:border-[var(--secondary-color)] overflow-hidden">
                  <div className="flex items-center gap-3 px-3 py-2 border-b border-black/5 bg-gray-50 text-black/50">
                    <Bold
                      size={16}
                      className="cursor-pointer hover:text-black"
                    />
                    <Italic
                      size={16}
                      className="cursor-pointer hover:text-black"
                    />
                    <Underline
                      size={16}
                      className="cursor-pointer hover:text-black"
                    />
                    <span className="w-px h-4 bg-black/10"></span>
                    <List
                      size={16}
                      className="cursor-pointer hover:text-black"
                    />
                    <AlignLeft
                      size={16}
                      className="cursor-pointer hover:text-black"
                    />
                    <span className="w-px h-4 bg-black/10"></span>
                    <LinkIcon
                      size={16}
                      className="cursor-pointer hover:text-black"
                    />
                    <ImageIcon
                      size={16}
                      className="cursor-pointer hover:text-black"
                    />
                  </div>
                  <textarea
                    required
                    className="w-full p-3 text-sm outline-none min-h-[100px] resize-y"
                  ></textarea>
                  <div className="px-3 py-2 bg-gray-50 border-t border-black/5 flex gap-3 text-black/50">
                    <span className="p-1 bg-white border border-black/10 rounded cursor-pointer hover:bg-gray-100">
                      <span className="text-xs font-bold">A</span>
                    </span>
                    <Paperclip
                      size={16}
                      className="cursor-pointer hover:text-black mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Footer Modal */}
              <div className="flex justify-end gap-2 pt-4 mt-2 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm border border-black/10 rounded-md bg-white hover:bg-gray-50 text-black/70"
                >
                  Cancelar
                </button>
                <div className="flex">
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm text-white rounded-l-md hover:opacity-90"
                    style={{ background: "var(--secondary-color)" }}
                  >
                    Crear
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

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
      {categoria !== "Todos" && categoria !== "Entre otros" && (
        <div className="mb-8">
          <DashboardArea area={categoria} />
        </div>
      )}
      {/* Filtros */}
      <div className="grid gap-3 md:grid-cols-[1fr_200px_200px] mb-4">
        <div className="flex items-center gap-2 bg-white rounded-xl border border-black/10 px-3 py-2">
          <Search size={16} className="text-black/50" />
          <input
            className="w-full outline-none text-sm placeholder:text-black/40"
            placeholder="Buscar por #, asunto o solicitante..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as any)}
          className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
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
      <div className="bg-white rounded-2xl border border-black/5 shadow-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-black/50 text-xs border-b border-black/5 uppercase tracking-wider bg-gray-50">
              <th className="py-3 px-4 font-semibold">#</th>
              <th className="py-3 px-4 font-semibold">Asunto</th>
              <th className="py-3 px-4 font-semibold">Solicitante</th>
              <th className="py-3 px-4 font-semibold">Grupo</th>
              <th className="py-3 px-4 font-semibold">Estado</th>
              <th className="py-3 px-4 font-semibold">Prioridad</th>
              <th className="py-3 px-4 font-semibold">Fecha</th>
              <th className="py-3 px-4 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-black/50">
                  Cargando tickets...
                </td>
              </tr>
            )}
            {!loading && total === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-black/50">
                  No se encontraron tickets.
                </td>
              </tr>
            )}

            {!loading &&
              pagedTickets.map((t) => {
                const isExpanded = expandedTicketId === t.id;
                return (
                  <React.Fragment key={t.id}>
                    {/* Fila Principal */}
                    <tr
                      onClick={() => toggleExpand(t.id)}
                      className={`border-b border-black/5 last:border-0 transition-colors cursor-pointer group ${
                        isExpanded
                          ? "bg-[var(--tertiary-color)]/50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="py-4 px-4 text-black/70 font-mono">
                        #{t.id}
                      </td>
                      <td className="py-4 px-4 font-medium text-[var(--primary-color)]">
                        {t.asunto}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <span className="text-black/70 truncate max-w-[150px]">
                            {t.solicitante}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="inline-block rounded-lg px-2.5 py-1 text-xs bg-white border border-black/10 text-black/70 font-medium shadow-sm">
                          {t.categoria}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getEstadoClasses(
                            t.estado
                          )}`}
                        >
                          {t.estado === "Resuelto" && (
                            <CheckCircle2 size={12} />
                          )}
                          {t.estado === "Abierto" && <AlertCircle size={12} />}
                          {t.estado}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                            t.prioridad === "Urgente"
                              ? "bg-rose-50 text-rose-700 border border-rose-100"
                              : t.prioridad === "Alta"
                              ? "bg-orange-50 text-orange-700 border border-orange-100"
                              : t.prioridad === "Media"
                              ? "bg-amber-50 text-amber-700 border border-amber-100"
                              : "bg-zinc-100 text-zinc-700 border border-zinc-200"
                          }`}
                        >
                          {t.prioridad}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-black/70 text-xs whitespace-nowrap">
                        {new Date(t.fecha).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(t.id);
                          }}
                          className={`inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 border transition-all shadow-sm ${
                            isExpanded
                              ? "bg-[var(--secondary-color)] text-white border-[var(--secondary-color)]"
                              : "bg-white border-black/10 hover:border-[var(--secondary-color)] hover:text-[var(--secondary-color)] text-black/60"
                          }`}
                        >
                          {isExpanded ? "Ocultar" : "Ver detalles"}
                          {isExpanded ? (
                            <ChevronDown size={14} />
                          ) : (
                            <ChevronRight size={14} />
                          )}
                        </button>
                      </td>
                    </tr>

                    {/* Fila Expandida (Detalles) */}
                    {isExpanded && (
                      <tr className="bg-[var(--tertiary-color)]/30 animate-in fade-in slide-in-from-top-2 duration-200">
                        <td colSpan={8} className="p-0 border-b border-black/5">
                          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Columna 1: Descripción */}
                            <div className="lg:col-span-2 space-y-3">
                              <h4 className="text-sm font-bold text-[var(--primary-color)] flex items-center gap-2">
                                <MessageSquare
                                  size={16}
                                  className="text-[var(--secondary-color)]"
                                />
                                Descripción de la solicitud
                              </h4>
                              <div className="bg-white p-4 rounded-xl border border-black/5 text-sm text-black/70 leading-relaxed shadow-sm">
                                {t.descripcion ||
                                  "No hay descripción detallada disponible."}
                              </div>
                              <div className="flex gap-2 mt-2">
                                <button className="text-xs flex items-center gap-1 text-black/50 hover:text-[var(--secondary-color)] transition-colors">
                                  <Paperclip size={14} /> Ver adjuntos (0)
                                </button>
                              </div>
                            </div>

                            {/* Columna 2: Meta Información */}
                            <div className="space-y-4 border-l border-black/5 pl-6 lg:block hidden">
                              <div>
                                <h4 className="text-xs font-bold text-black/40 uppercase tracking-wider mb-2">
                                  Detalles del Agente
                                </h4>
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-[var(--secondary-color)] text-white flex items-center justify-center text-xs font-bold">
                                    {(t.agente || "S").charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-[var(--primary-color)]">
                                      {t.agente}
                                    </p>
                                    <p className="text-xs text-black/50">
                                      Soporte Nivel 1
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <Calendar
                                    size={14}
                                    className="text-black/40"
                                  />
                                  Creado:{" "}
                                  <span className="font-medium">
                                    {new Date(t.fecha).toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-black/60">
                                  <Clock size={14} className="text-black/40" />
                                  Actualizado:{" "}
                                  <span className="font-medium">
                                    {new Date().toLocaleDateString()}
                                  </span>
                                </div>
                              </div>

                              <div className="pt-4 border-t border-black/5">
                                <button className="w-full py-2 text-sm font-medium text-[var(--secondary-color)] bg-white border border-[var(--secondary-color)] rounded-lg hover:bg-[var(--secondary-color)] hover:text-white transition-colors shadow-sm">
                                  Gestionar en Freshdesk
                                </button>
                              </div>
                            </div>

                            {/* Versión móvil de la columna 2 (si fuera necesario ajustar responsividad extrema) */}
                            <div className="lg:hidden space-y-3 border-t border-black/10 pt-4">
                              <p className="text-xs text-black/50">
                                <strong>Agente:</strong> {t.agente}
                              </p>
                              <button className="text-xs text-[var(--secondary-color)] underline">
                                Gestionar Ticket
                              </button>
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

        {/* Paginación */}
        {!loading && total > 0 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-black/5">
            <span className="text-xs text-black/50 font-medium">
              Mostrando {startIndex + 1}-{Math.min(endIndex, total)} de {total}{" "}
              tickets
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-black/10 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-xs font-medium rounded-lg border border-black/10 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-white transition-colors shadow-sm"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
