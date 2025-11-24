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
  Default: {
    kpis: { abiertos: 0, urgentes: 0, sinAsignar: 0, resueltos: 0 },
    prioridad: [],
    estado: [],
  },
};

const COLORS_PRIORIDAD = {
  Baja: "#10b981",
  Media: "#3b82f6",
  Alta: "#f59e0b",
  Urgente: "#e11d48",
};

const COLORS_ESTADO = ["#1d1e1c", "#af9150", "#71717a", "#d4d4d8"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/90 backdrop-blur-sm p-3 border border-white/50 shadow-lg rounded-xl z-50">
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
  const data = useMemo(() => {
    return MOCK_DATA[area] || MOCK_DATA["Default"];
  }, [area]);

  if (!data.prioridad.length) {
    return (
      <div className="bg-white/40 backdrop-blur-md p-8 rounded-2xl border border-white/50 text-center animate-in fade-in shadow-sm">
        <div className="w-16 h-16 bg-white/50 rounded-full flex items-center justify-center mx-auto mb-4 text-black/20">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative overflow-hidden p-4 rounded-2xl border border-white/40 shadow-sm backdrop-blur-md bg-gradient-to-br from-white/90 to-white/40 flex items-center gap-4 transition-all hover:scale-[1.02] hover:shadow-lg hover:border-white/60">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full -mr-4 -mt-4 pointer-events-none"></div>
          <div className="p-3 bg-amber-50/80 text-amber-600 rounded-xl backdrop-blur-sm">
            <Clock size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-[var(--primary-color)]">
              {data.kpis.abiertos}
            </p>
            <p className="text-xs text-black/60 font-medium">
              Pendientes Gestión
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden p-4 rounded-2xl border border-white/40 shadow-sm backdrop-blur-md bg-gradient-to-br from-white/90 to-white/40 flex items-center gap-4 transition-all hover:scale-[1.02] hover:shadow-lg hover:border-white/60">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full -mr-4 -mt-4 pointer-events-none"></div>
          <div className="p-3 bg-rose-50/80 text-rose-600 rounded-xl backdrop-blur-sm">
            <AlertTriangle size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-[var(--primary-color)]">
              {data.kpis.urgentes}
            </p>
            <p className="text-xs text-black/60 font-medium">
              Prioridad Crítica
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden p-4 rounded-2xl border border-white/40 shadow-sm backdrop-blur-md bg-gradient-to-br from-white/90 to-white/40 flex items-center gap-4 transition-all hover:scale-[1.02] hover:shadow-lg hover:border-white/60">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full -mr-4 -mt-4 pointer-events-none"></div>
          <div className="p-3 bg-gray-100/80 text-gray-600 rounded-xl backdrop-blur-sm">
            <Users size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-[var(--primary-color)]">
              {data.kpis.sinAsignar}
            </p>
            <p className="text-xs text-black/60 font-medium">Sin Agente</p>
          </div>
        </div>

        <div className="relative overflow-hidden p-4 rounded-2xl border border-white/40 shadow-sm backdrop-blur-md bg-gradient-to-br from-white/90 to-white/40 flex items-center gap-4 transition-all hover:scale-[1.02] hover:shadow-lg hover:border-white/60">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-white/20 to-transparent rounded-bl-full -mr-4 -mt-4 pointer-events-none"></div>
          <div className="p-3 bg-emerald-50/80 text-emerald-600 rounded-xl backdrop-blur-sm">
            <CheckCircle2 size={24} />
          </div>
          <div className="relative z-10">
            <p className="text-2xl font-bold text-[var(--primary-color)]">
              {data.kpis.resueltos}
            </p>
            <p className="text-xs text-black/60 font-medium">Resueltos (Mes)</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white/60 p-6 rounded-2xl border border-white/40 shadow-sm flex flex-col backdrop-blur-md">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--primary-color)]">
                Nivel de Urgencia
              </h3>
              <p className="text-xs text-black/50">
                Clasificación por prioridad
              </p>
            </div>
            <button className="p-1.5 hover:bg-white/50 rounded-lg transition-colors text-black/40">
              <TrendingUp size={18} />
            </button>
          </div>

          <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.prioridad}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e5e5e5"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  dy={10}
                  interval={0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(255,255,255,0.5)" }}
                />
                <Bar
                  dataKey="value"
                  radius={[6, 6, 0, 0]}
                  barSize={40}
                  maxBarSize={60}
                >
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

        <div className="bg-white/60 p-6 rounded-2xl border border-white/40 shadow-sm flex flex-col backdrop-blur-md">
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

          <div className="flex-1 w-full min-h-[300px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.estado}
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="80%"
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

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-10">
              <span className="text-3xl font-bold text-[var(--primary-color)]">
                100%
              </span>
              <span className="text-xs text-black/40 font-medium uppercase tracking-wider mt-1">
                Total
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}