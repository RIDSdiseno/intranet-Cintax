import React from "react";
import { Search } from "lucide-react";
import type { TicketAgent } from "../types";
import type { FiltrosHudTickets, VistaTickets } from "../utils/normalizarFiltros";

const ESTADOS = ["Todos", "Abierto", "Pendiente", "Resuelto", "Cerrado"] as const;
const PRIORIDADES = ["Todas", "Baja", "Media", "Alta", "Urgente"] as const;

type BarraFiltrosTicketsProps = {
  filtros: FiltrosHudTickets;
  agentes: TicketAgent[];
  isAdmin: boolean;
  emailUsuario?: string;
  sugerenciasSolicitante: string[];
  onCambiar: (next: FiltrosHudTickets) => void;
};

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
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? "bg-[var(--primary-color)] text-white shadow-sm"
          : "bg-white text-black/70 hover:text-black"
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

  return (
    <section className="mb-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_1fr]">
        <label className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2">
          <Search size={16} className="text-black/45" />
          <input
            value={filtros.busqueda}
            onChange={(event) =>
              onCambiar({ ...filtros, busqueda: event.target.value })
            }
            className="w-full bg-transparent text-sm outline-none placeholder:text-black/45"
            placeholder="Buscar por #, asunto o correo..."
          />
        </label>

        <input
          list={datalistId}
          value={filtros.solicitante}
          onChange={(event) =>
            onCambiar({ ...filtros, solicitante: event.target.value })
          }
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-sky-500/25"
          placeholder="Solicitante (email)"
        />
        <datalist id={datalistId}>
          {sugerenciasSolicitante.map((email) => (
            <option key={email} value={email} />
          ))}
        </datalist>

        <input
          value={filtros.keywords}
          onChange={(event) =>
            onCambiar({ ...filtros, keywords: event.target.value })
          }
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-sky-500/25"
          placeholder="Keywords / tags"
        />

        <select
          value={filtros.estado}
          onChange={(event) => onCambiar({ ...filtros, estado: event.target.value })}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-sky-500/25"
        >
          {ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              Estado: {estado}
            </option>
          ))}
        </select>

        <select
          value={filtros.prioridad}
          onChange={(event) => onCambiar({ ...filtros, prioridad: event.target.value })}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-sky-500/25"
        >
          {PRIORIDADES.map((prioridad) => (
            <option key={prioridad} value={prioridad}>
              Prioridad: {prioridad}
            </option>
          ))}
        </select>

        {isAdmin ? (
          <select
            value={filtros.agente}
            onChange={(event) => onCambiar({ ...filtros, agente: event.target.value })}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-sky-500/25"
          >
            <option value="all">Agente: Todos</option>
            <option value="none">Agente: No asignado</option>
            {agentes.map((agent) => (
              <option key={agent.id_trabajador} value={String(agent.id_trabajador)}>
                {agent.nombre}
              </option>
            ))}
          </select>
        ) : (
          <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-700">
            Viendo: Mis tickets ({emailUsuario || "sin correo"})
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-black/55">Vista:</span>
        <div className="inline-flex items-center gap-1 rounded-xl border border-black/10 bg-black/[0.02] p-1">
          <BotonVista
            label="Mis tickets"
            value="mine"
            active={filtros.vista === "mine" || !isAdmin}
            onClick={(value) => onCambiar({ ...filtros, vista: value })}
          />
          {isAdmin && (
            <BotonVista
              label="Todos"
              value="all"
              active={filtros.vista === "all"}
              onClick={(value) => onCambiar({ ...filtros, vista: value })}
            />
          )}
        </div>
      </div>
    </section>
  );
}
