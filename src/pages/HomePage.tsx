import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { KpiCard, TaskRow } from "../App";
import { getAuthPayload } from "../App";
import {
  Users,
  FileText,
  LifeBuoy,
  Clock,
} from "lucide-react";

// --- TIPOS DE DATOS DEL BACKEND ---
interface BackendTask {
  id_tarea_asignada: number;
  estado: "PENDIENTE" | "VENCIDA" | "COMPLETADA";
  fechaProgramada: string;
  tareaPlantilla: {
    nombre: string;
  };
}

interface Activity {
  id: number;
  mensaje: string;
  leida: boolean;
  createdAt: string;
}

interface Announcement {
  id: number;
  titulo: string;
  contenido: string;
}

// --- TIPOS DE DATOS PARA LA UI ---
interface Task {
  id: number;
  title: string;
  owner: string;
  status: "En curso" | "Completada" | "Bloqueada";
  due: string;
}

interface Kpi {
  title: string;
  value: string;
  helper?: string;
  icon: React.ReactNode;
}

// --- HELPERS ---
const mapTaskStatus = (status: BackendTask['estado']): Task['status'] => {
  switch (status) {
    case 'PENDIENTE': return 'En curso';
    case 'COMPLETADA': return 'Completada';
    case 'VENCIDA': return 'Bloqueada'; // 'Bloqueada' usa el estilo rojo de peligro
    default: return 'En curso';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("es-CL", { day: '2-digit', month: 'short', year: 'numeric' });
};

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL) || "http://localhost:3000/api";
const getAuthToken = () => localStorage.getItem("access_token") || sessionStorage.getItem("access_token");

/**
 * Hook para obtener los datos del dashboard del usuario.
 * Debería obtener KPIs, Tareas, Clientes, etc.
 */
const useDashboardData = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [kpis, setKpis] = useState<Kpi[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        setError("No autenticado.");
        return;
      }

      const authPayload = getAuthPayload();
      const userName = authPayload?.nombre || authPayload?.nombreUsuario || "Usuario";

      try {
        setLoading(true);
        const [tasksResponse, kpisResponse, activityResponse, announcementsResponse] = await Promise.all([
          axios.get(`${API_BASE_URL}/dashboard/my-tasks`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/dashboard/my-kpis`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/dashboard/activity`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_BASE_URL}/dashboard/announcements`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        // 1. Mapear Tareas
        const mappedTasks: Task[] = tasksResponse.data.map((task: BackendTask) => ({
          id: task.id_tarea_asignada,
          title: task.tareaPlantilla.nombre,
          owner: userName,
          status: mapTaskStatus(task.estado),
          due: formatDate(task.fechaProgramada),
        }));
        setTasks(mappedTasks);

        // 2. Mapear KPIs
        const kpiData = kpisResponse.data;
        const formattedKpis: Kpi[] = [
          { title: "Colaboradores activos", value: String(kpiData.clientesACargo ?? 0), icon: <Users /> },
          { title: "Tareas Pendientes", value: String(kpiData.tareasPendientes ?? 0), icon: <Clock /> },
          { title: "Documentos Recientes", value: String(kpiData.documentosRecientes ?? 0), icon: <FileText /> },
          { title: "Tickets Abiertos", value: String(kpiData.ticketsAbiertos ?? 0), icon: <LifeBuoy /> },
        ];
        setKpis(formattedKpis);
        
        // 3. & 4. Setear Actividad y Anuncios
        setActivity(activityResponse.data);
        setAnnouncements(announcementsResponse.data);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("No se pudieron cargar los datos del dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return { tasks, kpis, activity, announcements, loading, error };
};

// --- SKELETON COMPONENTS ---
const KpiCardSkeleton: React.FC = () => (
  <div className="rounded-2xl p-6 border border-gray-200 bg-white shadow-lg">
    <div className="flex items-start justify-between">
      <div>
        <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-9 w-20 bg-gray-200 rounded animate-pulse mt-3"></div>
      </div>
      <div className="h-12 w-12 bg-gray-200 rounded-xl animate-pulse"></div>
    </div>
  </div>
);

const WidgetSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 animate-pulse">
    <div className="h-6 w-1/2 bg-gray-200 rounded mb-4"></div>
    <div className="space-y-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="flex gap-3 items-start">
          <div className="h-10 w-10 bg-gray-200 rounded-xl shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const TaskTableSkeleton: React.FC = () => (
  <section className="xl:col-span-2 bg-white rounded-2xl border border-black/5 shadow-sm animate-pulse">
    <header className="flex items-center justify-between px-4 py-4 border-b border-black/5">
      <div>
        <div className="h-6 w-48 bg-gray-200 rounded"></div>
        <div className="h-3 w-64 bg-gray-200 rounded mt-2"></div>
      </div>
      <div className="h-8 w-32 bg-gray-200 rounded-xl"></div>
    </header>
    <div className="p-4 space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center">
          <div className="h-5 w-10 bg-gray-200 rounded"></div>
          <div className="h-5 w-1/3 bg-gray-200 rounded"></div>
          <div className="h-5 w-1/4 bg-gray-200 rounded"></div>
          <div className="h-5 w-1/6 bg-gray-200 rounded"></div>
        </div>
      ))}
    </div>
  </section>
);

const DashboardSkeleton: React.FC = () => (
  <>
    <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
      <KpiCardSkeleton />
    </div>
    <div className="mt-6 grid xl:grid-cols-3 gap-6">
      <TaskTableSkeleton />
      <div className="space-y-6">
        <WidgetSkeleton lines={4} />
        <WidgetSkeleton lines={2} />
      </div>
    </div>
  </>
);

// --- WIDGET COMPONENTS ---
const ActivityWidget: React.FC<{ activities: Activity[] }> = ({ activities }) => {
  if (!activities || activities.length === 0) {
    return null;
  }
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--primary-color)" }}>
        Actividad reciente
      </h2>
      <div className="space-y-4">
        {activities.map(activity => (
          <div key={activity.id} className="flex gap-3 items-start">
            <div className={`mt-1.5 shrink-0 h-2 w-2 rounded-full ${!activity.leida ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
            <div className="min-w-0">
              <p className="text-sm" style={{ color: "var(--primary-color)" }}>
                {activity.mensaje}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mt-1">
                {new Date(activity.createdAt).toLocaleString('es-CL')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AnnouncementsWidget: React.FC<{ announcements: Announcement[] }> = ({ announcements }) => {
  if (!announcements || announcements.length === 0) {
    return null;
  }
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
      <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--primary-color)" }}>
        Anuncios
      </h2>
      <div className="space-y-3">
        {announcements.map(a => (
          <div key={a.id} className="rounded-xl p-3 bg-[var(--tertiary-color)]">
            <p className="font-medium" style={{ color: "var(--primary-color)" }}>
              {a.titulo}
            </p>
            <p className="text-sm text-black/60 mt-1">{a.contenido}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const HomePage: React.FC = () => {
  const { tasks, kpis, activity, announcements, loading, error } = useDashboardData();
  const navigate = useNavigate();

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <div className="mt-6 text-red-500">{error}</div>;
  }

  return (
    <>
      {announcements && announcements.length > 0 && (
        <div className="mt-6">
          <AnnouncementsWidget announcements={announcements} />
        </div>
      )}

      <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
          />
        ))}
      </div>

      <div className="mt-6 grid xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 bg-white rounded-2xl border border-black/5 shadow-sm">
          <header className="flex items-center justify-between px-4 py-4 border-b border-black/5">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: "var(--primary-color)" }}>
                Mis Tareas Urgentes
              </h2>
              <p className="text-xs text-black/50">
                Tus 5 asignaciones más próximas a vencer.
              </p>
            </div>
            <button
              onClick={() => navigate('/tareas')}
              className="text-sm rounded-xl px-3 py-1.5 border border-black/10 hover:border-black/20 transition"
            >
              Ver todas mis tareas
            </button>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-black/50 text-xs">
                  <th className="py-3 px-3 font-medium">ID</th>
                  <th className="py-3 px-3 font-medium">Tarea</th>
                  <th className="py-3 px-3 font-medium">Estado</th>
                  <th className="py-3 px-3 font-medium text-right">Vence</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length > 0 ? (
                  tasks.map((t) => (
                    <TaskRow key={t.id} idx={t.id} title={t.title} owner={t.owner} status={t.status} due={t.due} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-sm text-black/50">
                      ¡No tienes tareas pendientes! 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-6">
          <ActivityWidget activities={activity} />
        </section>
      </div>
    </>
  );
};

export default HomePage;