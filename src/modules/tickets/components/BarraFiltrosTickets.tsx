import React from "react";
import {
  ChevronDown,
  CircleDot,
  Flag,
  Mail,
  RotateCcw,
  Search,
  Tag,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import type { TicketAgent } from "../types";
import {
  ESTADOS_TICKET,
  FILTROS_HUD_INICIALES,
  PRIORIDADES_TICKET,
  type FiltrosHudTickets,
  type VistaTickets,
} from "../utils/normalizarFiltros";

// Las listas salen de `normalizarFiltros` porque el parser de la URL valida
// contra las mismas: tenerlas dos veces dejaria que la barra ofreciera un
// estado que el enlace compartido descarta sin decir nada.
const ESTADOS = ESTADOS_TICKET;
const PRIORIDADES = PRIORIDADES_TICKET;

/** Caja comun de todos los campos: misma altura, borde y foco. */
function cajaClass(activo: boolean) {
  // El fondo va solo en cada rama: bg-white + bg-sky-50 juntos dependen del
  // orden del CSS generado y el resaltado podria no verse.
  return `relative flex h-10 min-w-0 items-center rounded-xl border transition focus-within:ring-2 focus-within:ring-sky-500/25 ${
    activo
      ? "border-sky-300 bg-sky-50/40"
      : "border-black/10 bg-white hover:border-black/20 focus-within:border-black/20"
  }`;
}

type BarraFiltrosTicketsProps = {
  filtros: FiltrosHudTickets;
  agentes: TicketAgent[];
  isAdmin: boolean;
  emailUsuario?: string;
  sugerenciasSolicitante: string[];
  onCambiar: (next: FiltrosHudTickets) => void;
};

function CampoTexto({
  icon: Icon,
  value,
  onChange,
  placeholder,
  title,
  list,
  className = "",
}: {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  title: string;
  list?: string;
  className?: string;
}) {
  const activo = value.trim().length > 0;

  return (
    <label className={`${cajaClass(activo)} gap-2 px-3 ${className}`}>
      <Icon
        size={16}
        className={`shrink-0 ${activo ? "text-sky-600" : "text-black/40"}`}
      />
      <input
        list={list}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault();
            onChange("");
          }
        }}
        className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-black/45"
        placeholder={placeholder}
        title={`${title} (Esc para limpiar)`}
        aria-label={title}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 rounded-full p-1 text-black/40 transition hover:bg-black/5 hover:text-black/80"
          title="Limpiar"
          aria-label={`Limpiar ${placeholder}`}
        >
          <X size={14} />
        </button>
      )}
    </label>
  );
}

function CampoSelect({
  icon: Icon,
  value,
  valorPorDefecto,
  onChange,
  label,
  children,
}: {
  icon: LucideIcon;
  value: string;
  valorPorDefecto: string;
  onChange: (value: string) => void;
  label: string;
  children: React.ReactNode;
}) {
  const activo = value !== valorPorDefecto;

  return (
    <div className={cajaClass(activo)}>
      <Icon
        size={16}
        className={`pointer-events-none absolute left-3 ${
          activo ? "text-sky-600" : "text-black/40"
        }`}
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-full w-full min-w-0 cursor-pointer appearance-none truncate rounded-xl bg-transparent pl-9 pr-9 text-sm outline-none ${
          activo ? "font-medium text-sky-800" : "text-black/80"
        }`}
        aria-label={label}
      >
        {children}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 text-black/40"
      />
    </div>
  );
}

function BotonVista({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: VistaTickets;
  active: boolean;
  onClick: (value: VistaTickets) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      aria-pressed={active}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? "bg-[var(--primary-color)] text-white shadow-sm"
          : "bg-transparent text-black/70 hover:bg-white hover:text-black"
      }`}
    >
      {label}
    </button>
  );
}

export default function BarraFiltrosTickets({
  filtros,
  agentes,
  isAdmin,
  emailUsuario,
  sugerenciasSolicitante,
  onCambiar,
}: BarraFiltrosTicketsProps) {
  const datalistId = "tickets-solicitantes";

  const set = <K extends keyof FiltrosHudTickets>(
    key: K,
    value: FiltrosHudTickets[K]
  ) => onCambiar({ ...filtros, [key]: value });

  // La vista (Mis tickets / Todos) no cuenta como filtro: es un modo.
  const filtrosActivos = [
    filtros.busqueda.trim(),
    filtros.solicitante.trim(),
    filtros.keywords.trim(),
    filtros.estado !== FILTROS_HUD_INICIALES.estado,
    filtros.prioridad !== FILTROS_HUD_INICIALES.prioridad,
    isAdmin && filtros.agente !== FILTROS_HUD_INICIALES.agente,
  ].filter(Boolean).length;

  const limpiarFiltros = () =>
    onCambiar({ ...FILTROS_HUD_INICIALES, vista: filtros.vista });

  return (
    <section className="mb-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      {/* Fila 1: texto (la busqueda lleva mas ancho). */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]">
        <CampoTexto
          icon={Search}
          value={filtros.busqueda}
          onChange={(v) => set("busqueda", v)}
          placeholder="Buscar por #, asunto o correo..."
          title="Buscar por número de ticket, asunto o correo"
          className="md:col-span-2 lg:col-span-1"
        />
        <CampoTexto
          icon={Mail}
          list={datalistId}
          value={filtros.solicitante}
          onChange={(v) => set("solicitante", v)}
          placeholder="Solicitante (email)"
          title="Filtrar por correo del solicitante"
        />
        <CampoTexto
          icon={Tag}
          value={filtros.keywords}
          onChange={(v) => set("keywords", v)}
          placeholder="Keywords / tags"
          title="Buscar palabras clave en asunto o descripción"
        />
        <datalist id={datalistId}>
          {sugerenciasSolicitante.map((email) => (
            <option key={email} value={email} />
          ))}
        </datalist>
      </div>

      {/* Fila 2: selectores. */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <CampoSelect
          icon={CircleDot}
          label="Estado"
          value={filtros.estado}
          valorPorDefecto={FILTROS_HUD_INICIALES.estado}
          onChange={(v) => set("estado", v)}
        >
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              Estado: {estado}
            </option>
          ))}
        </CampoSelect>

        <CampoSelect
          icon={Flag}
          label="Prioridad"
          value={filtros.prioridad}
          valorPorDefecto={FILTROS_HUD_INICIALES.prioridad}
          onChange={(v) => set("prioridad", v)}
        >
          {PRIORIDADES.map((prioridad) => (
            <option key={prioridad} value={prioridad}>
              Prioridad: {prioridad}
            </option>
          ))}
        </CampoSelect>

        {isAdmin ? (
          <CampoSelect
            icon={UserRound}
            label="Agente"
            value={filtros.agente}
            valorPorDefecto={FILTROS_HUD_INICIALES.agente}
            onChange={(v) => set("agente", v)}
          >
            <option value="all">Agente: Todos</option>
            <option value="none">Agente: No asignado</option>
            {agentes.map((agent) => (
              <option key={agent.id_trabajador} value={String(agent.id_trabajador)}>
                Agente: {agent.nombre}
              </option>
            ))}
          </CampoSelect>
        ) : (
          <div
            className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 text-xs text-sky-700"
            title={emailUsuario || undefined}
          >
            <UserRound size={16} className="shrink-0" />
            <span className="truncate">
              {filtros.vista === "mine"
                ? `Mis tickets (${emailUsuario || "sin correo"})`
                : "Todos los tickets de tu área"}
            </span>
          </div>
        )}
      </div>

      {/* Pie: vista + limpiar. */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-black/55">Vista:</span>
          <div className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-black/[0.03] p-1">
            <BotonVista
              label="Mis tickets"
              value="mine"
              active={filtros.vista === "mine"}
              onClick={(value) => set("vista", value)}
            />
            {/* Tambien para agentes: su "Todos" es el area que les permite el
                backend, y es la unica forma de ver los tickets que llegan por
                correo, que nacen sin asignar. */}
            <BotonVista
              label={isAdmin ? "Todos" : "Toda mi área"}
              value="all"
              active={filtros.vista === "all"}
              onClick={(value) => set("vista", value)}
            />
          </div>
        </div>

        {filtrosActivos > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
              {filtrosActivos} {filtrosActivos === 1 ? "filtro activo" : "filtros activos"}
            </span>
            <button
              type="button"
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-sm text-black/70 transition hover:border-black/20 hover:text-black"
            >
              <RotateCcw size={14} />
              Limpiar filtros
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
