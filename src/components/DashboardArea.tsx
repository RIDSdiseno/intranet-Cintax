import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  Users,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  PieChart as PieIcon,
} from "lucide-react";

type DashboardProps = {
  area: string;
};

const MOCK_DATA: Record<string, any> = {
  Contabilidad: {
    kpis: {
      abiertos: 12,
      urgentes: 5,
      sinAsignar: 3,
      resueltos: 45,
    },
    prioridad: [
      { name: "Baja", value: 10 },
      { name: "Media", value: 15 },
      { name: "Alta", value: 20 },
      { name: "Urgente", value: 5 },
    ],
    estado: [
      { name: "Abierta", value: 12 },
      { name: "Pendiente", value: 8 },
      { name: "Resuelto", value: 45 },
      { name: "Cerrado", value: 20 },
    ],
  },
  "Comercial y Marketing": {
    kpis: {
      abiertos: 18,
      urgentes: 15,
      sinAsignar: 6,
      resueltos: 35,
    },
    prioridad: [
      { name: "Baja", value: 5 },
      { name: "Media", value: 12 },
      { name: "Alta", value: 25 },
      { name: "Urgente", value: 15 },
    ],
    estado: [
      { name: "Abierta", value: 18 },
      { name: "Pendiente", value: 10 },
      { name: "Resuelto", value: 35 },
      { name: "Cerrado", value: 28 },
    ],
  },
  "Recursos Humanos": {
    kpis: {
      abiertos: 15,
      urgentes: 4,
      sinAsignar: 7,
      resueltos: 72,
    },
    prioridad: [
      { name: "Baja", value: 30 },
      { name: "Media", value: 40 },
      { name: "Alta", value: 15 },
      { name: "Urgente", value: 4 },
    ],
    estado: [
      { name: "Abierta", value: 15 },
      { name: "Pendiente", value: 5 },
      { name: "Resuelto", value: 72 },
      { name: "Cerrado", value: 10 },
    ],
  },
  Gerencia: {
    kpis: {
      abiertos: 8,
      urgentes: 2,
      sinAsignar: 0,
      resueltos: 15,
    },
    prioridad: [
      { name: "Baja", value: 5 },
      { name: "Media", value: 8 },
      { name: "Alta", value: 10 },
      { name: "Urgente", value: 2 },
    ],
    estado: [
      { name: "Abierta", value: 8 },
      { name: "Pendiente", value: 2 },
      { name: "Resuelto", value: 15 },
      { name: "Cerrado", value: 5 },
    ],
  },
  // Default para "Entre otros" o "Todos"
  Default: {
    kpis: {
      abiertos: 0,
      urgentes: 0,
      sinAsignar: 0,
      resueltos: 0,
    },
    prioridad: [],
    estado: [],
  },
};

const COLORS_PRIORIDAD = {
  Baja: "#10b981", // Emerald
  Media: "#3b82f6", // Blue
  Alta: "#f59e0b", // Amber
  Urgente: "#e11d48", // Rose
};

const COLORS_ESTADO = ["#1d1e1c", "#af9150", "#71717a", "#d4d4d8"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-black/10 shadow-lg rounded-xl z-50">
        <p className="text-sm font-semibold text-[var(--primary-color)]">
          {label}
        </p>
        <p className="text-xs text-[var(--secondary-color)]">
          {payload[0].name}: {payload[0].value} tickets
        </p>
      </div>
    );
  }
  return null;
};

export default function DashboardArea({ area }: DashboardProps) {
  // Selección de datos segura
  const data = useMemo(() => {
    return MOCK_DATA[area] || MOCK_DATA["Default"];
  }, [area]);

  // Si no hay datos (ej. área nueva sin configurar), mostramos un estado vacío elegante
  if (!data.prioridad.length) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-black/5 text-center animate-in fade-in">
        <div className="w-16 h-16 bg-[var(--tertiary-color)] rounded-full flex items-center justify-center mx-auto mb-4 text-black/20">
          <BarChart3 size={32} />
        </div>
        <h3 className="text-black/50 font-medium">
          Sin estadísticas disponibles para esta área
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Abiertos */}
        <div className="bg-gradient-to-tr from-[#af9150]/30 via-white to-transparent backdrop-blur-md p-4 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4 transition-transform hover:scale-105">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--primary-color)]">
              {data.kpis.abiertos}
            </p>
            <p className="text-xs text-black/50 font-medium">
              Pendientes Gestión
            </p>
          </div>
        </div>

        {/* KPI 2: Urgentes */}
        <div className="bg-gradient-to-tr from-[#af9150]/30 via-white to-transparent p-4 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.02]">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--primary-color)]">
              {data.kpis.urgentes}
            </p>
            <p className="text-xs text-black/50 font-medium">
              Prioridad Crítica
            </p>
          </div>
        </div>

        {/* KPI 3: Sin Asignar */}
        <div className="bg-gradient-to-tr from-[#af9150]/30 via-white to-transparent p-4 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.02]">
          <div className="p-3 bg-gray-100 text-gray-600 rounded-xl">
            <Users size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--primary-color)]">
              {data.kpis.sinAsignar}
            </p>
            <p className="text-xs text-black/50 font-medium">Sin Agente</p>
          </div>
        </div>

        {/* KPI 4: Resueltos */}
        <div className="bg-gradient-to-tr from-[#af9150]/30 via-white to-transparent p-4 rounded-2xl border border-black/5 shadow-sm flex items-center gap-4 transition-transform hover:scale-[1.02]">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--primary-color)]">
              {data.kpis.resueltos}
            </p>
            <p className="text-xs text-black/50 font-medium">Resueltos (Mes)</p>
          </div>
        </div>
      </div>

      {/* CHART GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GRÁFICO 1: PRIORIDAD (Bar Chart) */}
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm flex flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--primary-color)]">
                Nivel de Urgencia
              </h3>
              <p className="text-xs text-black/50">
                Clasificación por prioridad
              </p>
            </div>
            <button className="p-1.5 hover:bg-black/5 rounded-lg transition-colors text-black/40">
              <TrendingUp size={18} />
            </button>
          </div>

          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.prioridad}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f0f0f0"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#f5f4f0" }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {data.prioridad.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        COLORS_PRIORIDAD[
                          entry.name as keyof typeof COLORS_PRIORIDAD
                        ] || "#1d1e1c"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* GRÁFICO 2: ESTADO (Donut Chart) */}
        <div className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm flex flex-col">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--primary-color)]">
                Estado del Flujo
              </h3>
              <p className="text-xs text-black/50">
                Distribución actual de tickets
              </p>
            </div>
            <div className="flex gap-2 text-black/40">
              <PieIcon size={18} />
            </div>
          </div>

          <div className="flex-1 w-full min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.estado}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.estado.map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS_ESTADO[index % COLORS_ESTADO.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-black/60 font-medium ml-1">
                      {value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centro del Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <span className="text-2xl font-bold text-[var(--primary-color)]">
                100%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
