import React from "react";
import {
  Home,
  Users,
  FileText,
  FolderKanban,
  LifeBuoy,
  Bell,
  Search,
  Settings,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import {
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import axios from "axios";
import LoginPage from "./pages/login_page";
import PersonasPage from "./pages/personasPage";
import TicketsPage from "./pages/ticketsPage";

/**
 * Cintax Intranet Mockup (single-file TSX)
 * - TailwindCSS for styling
 * - Uses CSS variables with the provided brand tokens
 * - Responsive dashboard layout: sidebar + header + content (KPIs, table, activity)
 * - No external UI deps beyond lucide-react (icons)
 */

// --- Helper chips ---
const Chip: React.FC<{
  children: React.ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}> = ({ children, tone = "neutral" }) => {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--tertiary-color)] text-[var(--primary-color)]",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[var(--text-mini)] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

// --- KPI Card ---
const KpiCard: React.FC<{
  title: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
}> = ({ title, value, helper, icon }) => (
  <div className="group relative rounded-2xl bg-white shadow-sm p-5 border border-black/5 hover:shadow-md hover:-translate-y-[1px] transition-[transform,box-shadow] duration-300">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-black/50 tracking-wide">{title}</p>
        <h3
          className="mt-2 text-3xl font-semibold"
          style={{ color: "var(--primary-color)" }}
        >
          {value}
        </h3>
      </div>
      <div className="opacity-70 group-hover:opacity-100 transition-opacity">
        {icon}
      </div>
    </div>
    {helper && <p className="mt-3 text-xs text-black/50">{helper}</p>}
  </div>
);

// --- Sidebar Link (solo para "Soporte", los demás serán NavLink) ---
const SideLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}> = ({ icon, label, active }) => (
  <button
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
      active
        ? "bg-white text-[var(--primary-color)] shadow-sm"
        : "text-white/80 hover:text-white hover:bg-white/10"
    }`}
  >
    <span className="shrink-0">{icon}</span>
    <span className="truncate text-left">{label}</span>
  </button>
);

// --- Table Row ---
const TaskRow: React.FC<{
  idx: number;
  title: string;
  owner: string;
  status: "En curso" | "Completada" | "Bloqueada";
  due: string;
}> = ({ idx, title, owner, status, due }) => {
  const tone =
    status === "Completada" ? "success" : status === "Bloqueada" ? "danger" : "warning";
  const Icon =
    status === "Completada" ? CheckCircle2 : status === "Bloqueada" ? AlertTriangle : Clock;
  return (
    <tr className="border-b last:border-b-0">
      <td className="py-3 px-3 text-black/70">
        #{idx.toString().padStart(3, "0")}
      </td>
      <td className="py-3 px-3">
        <div className="font-medium" style={{ color: "var(--primary-color)" }}>
          {title}
        </div>
        <div className="text-xs text-black/50">Responsable: {owner}</div>
      </td>
      <td className="py-3 px-3">
        <Chip tone={tone as any}>
          <Icon size={14} /> {status}
        </Chip>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="text-sm text-black/70">{due}</span>
      </td>
    </tr>
  );
};

// --- Activity Item ---
const ActivityItem: React.FC<{
  title: string;
  time: string;
  icon: React.ReactNode;
  hint?: string;
}> = ({ title, time, icon, hint }) => (
  <div className="flex gap-3 items-start">
    <div className="mt-0.5 shrink-0 rounded-xl p-2 bg-white border border-black/5 shadow-sm">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-sm" style={{ color: "var(--primary-color)" }}>
        {title}
      </p>
      {hint && <p className="text-xs text-black/50 mt-0.5">{hint}</p>}
      <p className="text-[10px] uppercase tracking-wider text-black/40 mt-1">{time}</p>
    </div>
  </div>
);

// --- DATA (mock) ---
const TASKS = [
  {
    title: "Actualizar política de vacaciones 2026",
    owner: "RR.HH.",
    status: "En curso" as const,
    due: "15 Nov 2025",
  },
  {
    title: "Cierre de sprint #12 – Intranet Cintax",
    owner: "TI",
    status: "Completada" as const,
    due: "08 Nov 2025",
  },
  {
    title: "Revisión de contratos de proveedores",
    owner: "Legal",
    status: "Bloqueada" as const,
    due: "20 Nov 2025",
  },
  {
    title: "Capacitación de inducción (cohorte 11)",
    owner: "Personas",
    status: "En curso" as const,
    due: "22 Nov 2025",
  },
];

const ANNOUNCEMENTS = [
  {
    title: "Feriado institucional 02 Dic",
    copy: "El 02 de diciembre habrá cierre parcial. Revise turnos.",
    cta: "Ver calendario",
  },
  {
    title: "Nueva política de gastos",
    copy: "Reembolsos vía módulo Finanzas desde el 15 de noviembre.",
    cta: "Leer guía",
  },
];

// ---------- PÁGINAS ----------
function HomePage() {
  return (
    <>
      {/* Quick actions */}
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Nueva solicitud", hint: "Permisos, licencias" },
          { label: "Subir documento", hint: "PDF, DOCX, XLSX" },
          { label: "Crear proyecto", hint: "Kanban, tareas" },
          { label: "Soporte TI", hint: "Incidencias" },
        ].map((a) => (
          <button
            key={a.label}
            className="group flex items-center justify-between rounded-2xl bg-white border border-black/5 px-4 py-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-[transform,box-shadow] duration-300"
          >
            <div>
              <p className="text-sm text-black/60">{a.hint}</p>
              <p
                className="font-medium"
                style={{ color: "var(--primary-color)" }}
              >
                {a.label}
              </p>
            </div>
            <div className="rounded-full p-2 bg-[var(--tertiary-color)] text-[var(--secondary-color)]">
              <ChevronRight size={18} />
            </div>
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="mt-6 grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Colaboradores activos"
          value="312"
          helper="Últimos 30 días"
          icon={<Users />}
        />
        <KpiCard
          title="Documentos nuevos"
          value="128"
          helper="Esta semana"
          icon={<FileText />}
        />
        <KpiCard
          title="Proyectos en curso"
          value="17"
          helper="Área TI y Operaciones"
          icon={<FolderKanban />}
        />
        <KpiCard
          title="Tickets abiertos"
          value="9"
          helper="Soporte TI"
          icon={<LifeBuoy />}
        />
      </div>

      {/* Content grid */}
      <div className="mt-6 grid xl:grid-cols-3 gap-6">
        {/* Table */}
        <section className="xl:col-span-2 bg-white rounded-2xl border border-black/5 shadow-sm">
          <header className="flex items-center justify-between px-4 py-4 border-b border-black/5">
            <div>
              <h2
                className="text-lg font-semibold"
                style={{ color: "var(--primary-color)" }}
              >
                Tareas pendientes
              </h2>
              <p className="text-xs text-black/50">
                Lo más urgente para esta quincena
              </p>
            </div>
            <button className="text-sm rounded-xl px-3 py-1.5 border border-black/10 hover:border-black/20 transition">
              Ver todas
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
                {TASKS.map((t, i) => (
                  <TaskRow
                    key={t.title}
                    idx={i + 1}
                    title={t.title}
                    owner={t.owner}
                    status={t.status}
                    due={t.due}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Activity & Announcements */}
        <section className="space-y-6">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: "var(--primary-color)" }}
            >
              Actividad reciente
            </h2>
            <div className="space-y-4">
              <ActivityItem
                title='María cargó “Política de Gastos v2.pdf”'
                time="Hoy, 11:20"
                icon={
                  <FileText
                    size={16}
                    className="text-[var(--secondary-color)]"
                  />
                }
                hint="Finanzas / Políticas"
              />
              <ActivityItem
                title="Equipo TI cerró ticket #2381"
                time="Ayer, 18:44"
                icon={
                  <LifeBuoy
                    size={16}
                    className="text-[var(--secondary-color)]"
                  />
                }
                hint="Incidente VPN – resuelto"
              />
              <ActivityItem
                title="Se creó el proyecto ‘Onboarding 2026’"
                time="Ayer, 09:02"
                icon={
                  <FolderKanban
                    size={16}
                    className="text-[var(--secondary-color)]"
                  />
                }
                hint="Personas / Capacitación"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-4">
            <h2
              className="text-lg font-semibold mb-3"
              style={{ color: "var(--primary-color)" }}
            >
              Anuncios
            </h2>
            <div className="space-y-3">
              {ANNOUNCEMENTS.map((a) => (
                <div
                  key={a.title}
                  className="flex items-start justify-between gap-3 rounded-xl p-3 bg-[var(--tertiary-color)]"
                >
                  <div>
                    <p
                      className="font-medium"
                      style={{ color: "var(--primary-color)" }}
                    >
                      {a.title}
                    </p>
                    <p className="text-sm text-black/60">{a.copy}</p>
                  </div>
                  <button className="text-sm text-[var(--secondary-color)] hover:underline shrink-0">
                    {a.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function NotFoundPage() {
  return (
    <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mt-6 text-center">
      <h2
        className="text-lg font-semibold"
        style={{ color: "var(--primary-color)" }}
      >
        Página no encontrada
      </h2>
      <p className="text-sm text-black/60">
        La ruta solicitada no existe.
      </p>
    </section>
  );
}

// ======= Auth helpers =======
function isAuthed() {
  const token =
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") || // por compatibilidad con el mock antiguo
    sessionStorage.getItem("auth_token");
  return !!token;
}

function PrivateRoute({ element }: { element: JSX.Element }) {
  return isAuthed() ? element : <Navigate to="/login" replace />;
}

// ---------- APP ----------
export default function CintaxIntranetMockup() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hideChrome = pathname.startsWith("/login");

  const handleLogout = async () => {
    try {
      await axios.post(
        "http://localhost:3000/api/auth/logout",
        {},
        { withCredentials: true }
      );
    } catch (err) {
      console.error("Error al cerrar sesión", err);
    } finally {
      // limpiar tokens tanto nuevos como antiguos
      localStorage.removeItem("access_token");
      sessionStorage.removeItem("access_token");
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");

      navigate("/login", { replace: true });
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--tertiary-color)" }}
    >
      {/* Brand tokens */}
      <style>{`
        :root{ 
          --primary-font: "Loew", sans-serif; 
          --base-size-font: 15px; 
          --primary-color: #1d1e1c; 
          --secondary-color: #af9150; 
          --tertiary-color: #f5f4f0; 
          --transition: all 0.4s ease; 
          --custom-transition: all 0.6s cubic-bezier(0.645,0.045,0.355,1);
          --box-shadow: 0px 2.5896813869px 10.3587255478px 0px #0000001f; 
          --border-radius: 10px; 
          --title-m: 1.7rem; 
          --title-m-mini: 1.5rem; 
          --title-xl: 2rem; 
          --title-m-responsive: 2rem; 
          --text-mini: 0.8rem; 
          --text-content-size: 1rem; 
        }
        html { font-size: var(--base-size-font); }
        body { font-family: var(--primary-font); color: var(--primary-color); }
      `}</style>

      <div
        className={
          hideChrome
            ? "min-h-screen"
            : "grid lg:grid-cols-[260px_1fr] min-h-screen"
        }
      >
        {/* Sidebar */}
        {!hideChrome && (
          <aside className="bg-[var(--primary-color)] text-white px-4 py-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 px-3">
              <img
                src="https://cintax.cl/wp-content/themes/cintax/assets/images/logo-cintax.svg"
                alt="Cintax"
                className="h-8 w-auto"
              />
            </div>

            {/* NAV */}
            <nav className="mt-2 space-y-1">
              <NavLink
                to="/home"
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                    isActive
                      ? "bg-white text-[var(--primary-color)] shadow-sm"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`
                }
              >
                <span className="shrink-0">
                  <Home size={18} />
                </span>
                <span className="truncate text-left">Inicio</span>
              </NavLink>

              <NavLink
                to="/personas"
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                    isActive
                      ? "bg-white text-[var(--primary-color)] shadow-sm"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`
                }
              >
                <span className="shrink-0">
                  <Users size={18} />
                </span>
                <span className="truncate text-left">Personas</span>
              </NavLink>

              {/* Tickets */}
              <div className="px-3 py-2 text-white/70 uppercase text-[10px] tracking-wider">
                Tickets
              </div>
              <div className="pl-3 flex flex-col gap-1">
                <NavLink
                  to="/tickets/contabilidad"
                  className={({ isActive }) =>
                    `text-sm px-3 py-2 rounded-lg ${
                      isActive
                        ? "text-white bg-white/10"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  Contabilidad
                </NavLink>

                <NavLink
                  to="/tickets/tributario"
                  className={({ isActive }) =>
                    `text-sm px-3 py-2 rounded-lg ${
                      isActive
                        ? "text-white bg-white/10"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  Tributario
                </NavLink>

                <NavLink
                  to="/tickets/otros"
                  className={({ isActive }) =>
                    `text-sm px-3 py-2 rounded-lg ${
                      isActive
                        ? "text-white bg-white/10"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  Entre otros
                </NavLink>
              </div>

              <SideLink icon={<LifeBuoy size={18} />} label="Soporte" />
              
            </nav>

            <div className="mt-auto border-t border-white/10 pt-4">
              <button
      onClick={handleLogout}
      className="w-full rounded-xl px-3 py-2 text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition shadow-sm hover:shadow-md"
    >
      Cerrar sesión
    </button>
            </div>
            
          </aside>
        )}

        {/* Main */}
        <main className={hideChrome ? "p-0" : "p-5 lg:p-8"}>
          {/* Header */}
          {!hideChrome && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div>
                <h1 className="text-2xl sm:text-[var(--title-xl)] font-semibold">
                  Intranet{" "}
                  <span className="text-[var(--secondary-color)]">Cintax</span>
                </h1>
                <p className="text-sm text-black/60 mt-1">
                  Resumen general y accesos rápidos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center gap-2 bg-white rounded-xl border border-black/5 px-3 py-2 w-[280px] shadow-sm">
                  <Search size={16} className="text-black/50" />
                  <input
                    className="w-full outline-none text-sm placeholder:text-black/40"
                    placeholder="Buscar en Cintax…"
                  />
                </div>
                <button className="relative rounded-xl bg-white border border-black/5 p-2 shadow-sm hover:shadow transition">
                  <Bell size={18} />
                  <span className="absolute -top-1 -right-1 h-4 w-4 text-[10px] grid place-items-center rounded-full bg-[var(--secondary-color)] text-white">
                    3
                  </span>
                </button>
                <button className="rounded-xl bg-white border border-black/5 p-2 shadow-sm hover:shadow transition">
                  <Settings size={18} />
                </button>
                {/* BOTÓN LOGOUT */}
                
              </div>
            </div>
          )}

          {/* RUTAS */}
          <Routes>
            {/* Login sin chrome */}
            <Route path="/login" element={<LoginPage />} />

            {/* App con chrome (protegidas) */}
            <Route path="/home" element={<PrivateRoute element={<HomePage />} />} />
            <Route
              path="/personas"
              element={<PrivateRoute element={<PersonasPage />} />}
            />
            <Route
              path="/tickets"
              element={<PrivateRoute element={<TicketsPage />} />}
            />
            <Route
              path="/tickets/:cat"
              element={<PrivateRoute element={<TicketsPage />} />}
            />

            {/* Redirecciones */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/inicio" element={<Navigate to="/home" replace />} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>

          {/* Footer */}
          {!hideChrome && (
            <footer className="mt-8 text-center text-xs text-black/50">
              © {new Date().getFullYear()} Cintax — Intranet Cintax
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
