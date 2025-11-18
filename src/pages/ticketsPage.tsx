import React, { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Search, LifeBuoy, ChevronRight, X,
  Bold, Italic, Underline, Link as LinkIcon, Image as ImageIcon, List, AlignLeft, Paperclip
} from "lucide-react";
import axios from "axios";

type Categoria =
  | "Contabilidad"
  | "Tributario"
  | "Administración"
  | "Marketing y Comercial"
  | "Recursos Humanos"
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
  fecha: string; // ISO o legible
};

// Si quieres, puedes usar import.meta.env.VITE_API_BASE_URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://localhost:3000";

// Helpers para mapear desde la API (Prisma + Freshdesk)
function mapCategoria(raw: string | null | undefined): Categoria {
  const norm = (raw ?? "").toLowerCase();

  if (norm === "contabilidad") return "Contabilidad";
  if (norm === "tributario") return "Tributario";

  // Nuevas categorías
  if (norm === "administracion" || norm === "administración") {
    return "Administración";
  }
  if (
    norm === "marketing" ||
    norm === "marketing y comercial" ||
    norm === "marketing_comercial"
  ) {
    return "Marketing y Comercial";
  }
  if (norm === "rrhh" || norm === "recursos humanos") {
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

// Clase de color según estado
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

const CATS: Array<"Todos" | Categoria> = [
  "Todos",
  "Contabilidad",
  "Tributario",
  "Administración",
  "Marketing y Comercial",
  "Recursos Humanos",
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const params = useParams(); // { cat?: "contabilidad" | "tributario" | "administracion" | "marketing" | "rrhh" | "otros" }
  const navigate = useNavigate();

  // Sincroniza la categoría con la URL
  const catFromUrl: "Todos" | Categoria =
    params.cat === "contabilidad"
      ? "Contabilidad"
      : params.cat === "tributario"
        ? "Tributario"
        : params.cat === "administracion"
          ? "Administración"
          : params.cat === "marketing"
            ? "Marketing y Comercial"
            : params.cat === "rrhh"
              ? "Recursos Humanos"
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

  // Paginación
  const [pageSize, setPageSize] = useState(10); // 10 por defecto
  const [page, setPage] = useState(1);

  // Resetear página cuando cambian filtros o búsqueda
  useEffect(() => {
    setPage(1);
  }, [categoria, estado, prioridad, query]);

  // Cuando cambie la URL, actualiza el tab
  useEffect(() => {
    setCategoria(catFromUrl);
  }, [catFromUrl]);

  function getAccessToken() {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token")
    );
  }

  // Fetch de tickets desde tu backend
  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = getAccessToken();
      if (!token) {
        setError("No autenticado (falta token)");
        setTickets([]);
        setLoading(false);
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/auth/getTickets`, {
        withCredentials: true,
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

  // Botón para sincronizar con Freshdesk y recargar lista
  const handleSyncFreshdesk = async () => {
    try {
      setSyncing(true);
      setError(null);

      const token = getAccessToken();
      if (!token) {
        setError("No autenticado (falta token)");
        setSyncing(false);
        return;
      }

      await axios.post(
        `${API_BASE_URL}/auth/sync-freshdesk`,
        { pages: 3 },
        {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
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

  // Sincronizar al entrar + cada 5 minutos
  useEffect(() => {
    handleSyncFreshdesk(); // primera vez

    const id = setInterval(() => {
      handleSyncFreshdesk();
    }, 5 * 60 * 1000); // cada 5 minutos

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            : c === "Administración"
              ? "administracion"
              : c === "Marketing y Comercial"
                ? "marketing"
                : c === "Recursos Humanos"
                  ? "rrhh"
                  : "otros";
      navigate(`/tickets/${slug}`, { replace: true });
    }
  };

  // Contadores por categoría
  const counts = useMemo(() => {
    const base: Record<"Todos" | Categoria, number> = {
      Todos: tickets.length,
      Contabilidad: 0,
      Tributario: 0,
      Administración: 0,
      "Marketing y Comercial": 0,
      "Recursos Humanos": 0,
      "Entre otros": 0,
    };

    tickets.forEach((t) => {
      base[t.categoria] += 1;
    });

    return base;
  }, [tickets]);

  // Filtrado principal en cliente
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

  // Paginación en memoria
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
            <p className="mt-1 text-xs text-rose-600">⚠️ {error}</p>
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
            onClick={() => setIsModalOpen(true)}
          >
            Crear ticket
          </button>
        </div>
      </div>
      {/* Modal para crear ticket */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-4 shadow-lg z-10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Crear ticket</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded hover:bg-black/5"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setIsModalOpen(false);
                alert("Ticket creado (pendiente integrar)");
              }}
              className="flex flex-col gap-4"
            >
              {/* Sección Superior: Contacto y Asunto */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium text-black/70">
                      Contacto <span className="text-rose-500">*</span>
                    </label>
                    <div className="text-xs text-[var(--secondary-color)] cursor-pointer flex gap-2">
                      <span className="hover:underline">Agregar nuevo contacto</span>
                      <span className="text-black/20">|</span>
                      <span className="hover:underline">Agregar Cc</span>
                    </div>
                  </div>
                  <input
                    className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors bg-white"
                    type="email"
                    placeholder="ejemplo@correo.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Asunto <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors bg-white"
                    type="text"
                    required
                  />
                </div>
              </div>

              {/* Grid de Selectores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Tipo <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white text-black/70">
                    <option value="">--</option>
                    <option value="RRHH">RRHH</option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Tributacion">Tributacion</option>
                    <option value="Comercial y MKT">Comercial y MKT</option>
                    <option value="Ofertas Proveedores">Ofertas Proveedores</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

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
                    <option value="Conciliacion Banco">Conciliacion Banco</option>
                    <option value="Emision ER">Emision ER</option>
                    <option value="Emision AC">Emision AC</option>
                    <option value="DJ">DJ</option>
                    <option value="F22">F22</option>
                    <option value="RRHH">RRHH</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Estado <span className="text-rose-500">*</span>
                  </label>
                  <select className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white font-medium">
                    <option value="Abierta">Abierta</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Resuelto">Resuelto</option>
                    <option value="Cerrada">Cerrada</option>
                    <option value="En espera de respuesta del cliente">En espera de respuesta del cliente</option>
                    <option value="En espera de un tercero">En espera de un tercero</option>
                  </select>
                </div>

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

                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Grupo <span className="text-rose-500">*</span>
                  </label>
                  <select 
                  required
                  className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white text-black/70">
                    <option value="">--</option>
                    <option value="Comercial y Marketing">Comercial y Marketing</option>
                    <option value="Contabilidad">Contabilidad</option>
                    <option value="Gerencia">Gerencia</option>
                    <option value="RRHH">RRHH</option>
                    <option value="Tributacion">Tributacion</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-black/70 mb-1 block">
                    Agente <span className="text-rose-500">*</span>
                  </label>
                  <select 
                  required
                  className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] bg-white font-medium">
                    <option value="--">--</option>
                    <option value="Esteban Ramos">Esteban Ramos</option>
                    <option value="Patricio Mena">Patricio Mena</option>
                    <option value="Soporte Consultores">Soporte Consultores</option>
                  </select>
                </div>
              </div>

              {/* Editor de Descripción */}
              <div>
                <label className="text-xs font-medium text-black/70 mb-1 block">
                  Descripción <span className="text-rose-500">*</span>
                </label>
                <div className="border border-black/15 rounded-md bg-white focus-within:border-[var(--secondary-color)] transition-colors overflow-hidden">
                  {/* Toolbar simulada */}
                  <div className="flex items-center gap-3 px-3 py-2 border-b border-black/5 bg-gray-50 text-black/50">
                    <Bold size={16} className="cursor-pointer hover:text-black" />
                    <Italic size={16} className="cursor-pointer hover:text-black" />
                    <Underline size={16} className="cursor-pointer hover:text-black" />
                    <span className="w-px h-4 bg-black/10"></span>
                    <List size={16} className="cursor-pointer hover:text-black" />
                    <AlignLeft size={16} className="cursor-pointer hover:text-black" />
                    <span className="w-px h-4 bg-black/10"></span>
                    <LinkIcon size={16} className="cursor-pointer hover:text-black" />
                    <ImageIcon size={16} className="cursor-pointer hover:text-black" />
                  </div>
                  <textarea
                    className="w-full p-3 text-sm outline-none min-h-[120px] resize-y"
                    required
                  ></textarea>
                  {/* Footer del editor */}
                  <div className="px-3 py-2 bg-gray-50 border-t border-black/5 flex gap-3 text-black/50">
                    <span className="p-1 bg-white border border-black/10 rounded cursor-pointer hover:bg-gray-100">
                      <span className="text-xs font-bold">A</span>
                    </span>
                    <Paperclip size={16} className="cursor-pointer hover:text-black mt-1" />
                  </div>
                </div>
              </div>

              {/* Etiquetas */}
              <div>
                <label className="text-xs font-medium text-black/70 mb-1 block">
                  Etiquetas
                </label>
                <input
                  className="w-full border border-black/15 rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors bg-white"
                  type="text"
                />
              </div>

              {/* Footer de Acciones */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-4 pt-4 mt-2 border-t border-black/5">
                <label className="flex items-center gap-2 text-sm text-black/70 cursor-pointer select-none">
                  <input type="checkbox" className="rounded border-black/20 text-[var(--secondary-color)] focus:ring-[var(--secondary-color)]" />
                  Crear otro
                </label>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm border border-black/10 rounded-md bg-white hover:bg-gray-50 text-black/70 transition-colors"
                  >
                    Cancelar
                  </button>
                  <div className="flex">
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm text-white rounded-l-md hover:opacity-90 transition-opacity"
                      style={{ background: "var(--secondary-color)" }}
                    >
                      Crear
                    </button>
                    <button
                      type="button"
                      className="px-2 py-2 text-white border-l border-white/20 rounded-r-md hover:opacity-90 transition-opacity"
                      style={{ background: "var(--secondary-color)" }}
                    >
                      <ChevronRight size={16} className="rotate-90" />
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs de categoría */}
      <div className="flex flex-wrap items-center gap-2">
        {CATS.map((c) => (
          <button
            key={c}
            onClick={() => setCategoriaAndUrl(c)}
            className={`rounded-full px-3 py-1.5 text-sm border transition ${categoria === c
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
                <td
                  colSpan={8}
                  className="py-6 px-3 text-center text-black/50"
                >
                  Cargando tickets desde Freshdesk…
                </td>
              </tr>
            )}

            {!loading && total === 0 && (
              <tr>
                <td
                  className="py-8 px-3 text-center text-black/50"
                  colSpan={8}
                >
                  No hay tickets con los filtros actuales.
                </td>
              </tr>
            )}

            {!loading &&
              pagedTickets.map((t) => (
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
                  <td className="py-3 px-3 text-black/70">
                    {t.solicitante}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs bg-[var(--tertiary-color)]">
                      {t.categoria}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${getEstadoClasses(
                        t.estado
                      )}`}
                    >
                      {t.estado}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${t.prioridad === "Urgente"
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

        {/* Footer de paginación */}
        {!loading && total > 0 && (
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-black/5 text-xs text-black/60">
            <span>
              Mostrando{" "}
              <strong>
                {startIndex + 1}–{Math.min(endIndex, total)}
              </strong>{" "}
              de <strong>{total}</strong> tickets
            </span>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1">
                <span>Por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="border border-black/10 rounded-lg px-2 py-1 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 rounded-lg border border-black/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span>
                  Página <strong>{page}</strong> de{" "}
                  <strong>{totalPages}</strong>
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || total === 0}
                  className="px-2 py-1 rounded-lg border border-black/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}