import React from "react";
import { Search } from "lucide-react";

const ESTADOS = ["Todos", "Abierto", "Pendiente", "Resuelto", "Cerrado"];
const PRIORIDADES = ["Baja", "Media", "Alta", "Urgente"];

export default function TicketsFilters({
  query,
  onQueryChange,
  status,
  onStatusChange,
  priority,
  onPriorityChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  priority: string;
  onPriorityChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_200px_200px] mb-4">
      <div className="flex items-center gap-2 bg-white rounded-xl border border-black/10 px-3 py-2">
        <Search size={16} className="text-black/50" />
        <input
          className="w-full outline-none text-sm placeholder:text-black/40"
          placeholder="Buscar por #, asunto o solicitante..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm"
      >
        {ESTADOS.map((estado) => (
          <option key={estado} value={estado}>
            {estado === "Todos" ? "Todos los estados" : estado}
          </option>
        ))}
      </select>
      <select
        value={priority}
        onChange={(e) => onPriorityChange(e.target.value)}
        className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
      >
        {PRIORIDADES.map((prio) => (
          <option key={prio} value={prio}>
            {prio}
          </option>
        ))}
      </select>
    </div>
  );
}
