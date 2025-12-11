import React from "react";
import {
  Home,
  Users,
  FileText,
  FolderKanban,
  LifeBuoy,
  Settings,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Folder,
  X,
  BookCheck,
  ChevronDown,
  HandHelping,
  History, // 👈 NUEVO
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
import DrivePage from "./pages/DrivePage";
import TicketsPage from "./pages/ticketsPage";
import ConfigurarPage from "./pages/ConfigurarPage";
import SoportePage from "./pages/SoportePage";
import TareasPage from "./pages/TareasPage";
import TareasSupervisionPage from "./pages/TareasSupervisionPage";
import ReleaseNotesPage from "./pages/ReleaseNotesPage"; // 👈 NUEVO

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "https://localhost:3000";

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

const KpiCard: React.FC<{
  title: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
}> = ({ title, value, helper, icon }) => (
  <div className="group relative overflow-hidden rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-white/40 bg-white/60 backdrop-blur-xl shadow-lg">
    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#af9150]/10 blur-2xl transition-all group-hover:bg-[#af9150]/20" />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-black/50 tracking-wide">
          {title}
        </p>
        <h3
          className="mt-3 text-3xl font-bold"
          style={{ color: "var(--primary-color)" }}
        >
          {value}
        </h3>
      </div>
      <div className="rounded-xl bg-white/50 p-3 text-[#af9150] shadow-sm ring-1 ring-black/5 backdrop-blur-md">
        {icon}
      </div>
    </div>
    {helper && (
      <div className="mt-4 flex items-center gap-1 text-xs font-medium text-black/40">
        {helper}
      </div>
    )}
  </div>
);

const SideLink: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
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

const TicketsNav: React.FC<{
  onNavigate?: () => void;
}> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = React.useState(true);

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-white/70 uppercase text-[10px] tracking-wider hover:text-white hover:bg-white/5 rounded-lg transition-all group"
      >
        <span>Tickets</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-300 ${
            isOpen ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>

      <div
        className={`pl-3 flex flex-col gap-1 overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[400px] opacity-100 mt-1" : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <NavLink
          to="/tickets"
          end
          className={({ isActive }) =>
            `text-sm px-3 py-2 rounded-lg transition-colors block ${
              isActive
                ? "text-white bg-white/10"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`
          }
          onClick={onNavigate}
        >
          Todos
        </NavLink>
        <NavLink
          to="/tickets/comercial"
          className={({ isActive }) =>
            `text-sm px-3 py-2 rounded-lg transition-colors block ${
              isActive
                ? "text-white bg-white/10"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`
          }
          onClick={onNavigate}
        >
          Comercial y Marketing
        </NavLink>
        <NavLink
          to="/tickets/contabilidad"
          className={({ isActive }) =>
            `text-sm px-3 py-2 rounded-lg transition-colors block ${
              isActive
                ? "text-white bg-white/10"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`
          }
          onClick={onNavigate}
        >
          Contabilidad
        </NavLink>
        <NavLink
          to="/tickets/gerencia"
          className={({ isActive }) =>
            `text-sm px-3 py-2 rounded-lg transition-colors block ${
              isActive
                ? "text-white bg-white/10"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`
          }
          onClick={onNavigate}
        >
          Gerencia
        </NavLink>
        <NavLink
          to="/tickets/rrhh"
          className={({ isActive }) =>
            `text-sm px-3 py-2 rounded-lg transition-colors block ${
              isActive
                ? "text-white bg-white/10"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`
          }
          onClick={onNavigate}
        >
          Recursos Humanos
        </NavLink>
        <NavLink
          to="/tickets/otros"
          className={({ isActive }) =>
            `text-sm px-3 py-2 rounded-lg transition-colors block ${
              isActive
                ? "text-white bg-white/10"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`
          }
          onClick={onNavigate}
        >
          Entre otros
        </NavLink>
      </div>
    </div>
  );
};

const TaskRow: React.FC<{
  idx: number;
  title: string;
  owner: string;
  status: "En curso" | "Completada" | "Bloqueada";
  due: string;
}> = ({ idx, title, owner, status, due }) => {
  const tone =
    status === "Completada"
      ? "success"
      : status === "Bloqueada"
      ? "danger"
      : "warning";
  const Icon =
    status === "Completada"
      ? CheckCircle2
      : status === "Bloqueada"
      ? AlertTriangle
      : Clock;
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
      <p className="text-[10px] uppercase tracking-wider text-black/40 mt-1">
        {time}
      </p>
    </div>
  </div>
);

const TASKS = [
  {
    title: "Actualizar política de vacaciones 2026",
    owner: "RR.HH.",
    status: "En curso" as const,
    due: "15 Nov 2025",
  },
  {
    title: "Cierre de sprint #12 - Intranet Cintax",
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

function HomePage() {
  const [activeModal, setActiveModal] = React.useState<string | null>(null);

  const modals: Record<
    string,
    {
      title: string;
      hint: string;
      fields: Array<{ label: string; type: string; placeholder: string }>;
    }
  > = {
    "Nueva solicitud": {
      title: "Nueva solicitud",
      hint: "Permisos, licencias",
      fields: [
        {
          label: "Tipo de solicitud",
          type: "select",
          placeholder: "Selecciona...",
        },
        {
          label: "Descripción",
          type: "textarea",
          placeholder: "Describe tu solicitud...",
        },
        { label: "Fecha requerida", type: "date", placeholder: "" },
      ],
    },
    "Subir documento": {
      title: "Subir documento",
      hint: "PDF, DOCX, XLSX",
      fields: [
        {
          label: "Nombre del documento",
          type: "text",
          placeholder: "ej: Reporte Q4 2025",
        },
        { label: "Categoría", type: "select", placeholder: "Selecciona..." },
        { label: "Archivo", type: "file", placeholder: "" },
      ],
    },
    "Crear proyecto": {
      title: "Crear proyecto",
      hint: "Kanban, tareas",
      fields: [
        {
          label: "Nombre del proyecto",
          type: "text",
          placeholder: "ej: Onboarding 2026",
        },
        { label: "Tipo", type: "select", placeholder: "Kanban / Tareas" },
        {
          label: "Descripción",
          type: "textarea",
          placeholder: "Descripción del proyecto...",
        },
      ],
    },
    "Soporte TI": {
      title: "Reporte de incidencia",
      hint: "Incidencias",
      fields: [
        {
          label: "Tipo de incidencia",
          type: "select",
          placeholder: "Hardware / Software / Red",
        },
        {
          label: "Descripción del problema",
          type: "textarea",
          placeholder: "Describe el problema...",
        },
        {
          label: "Prioridad",
          type: "select",
          placeholder: "Baja / Media / Alta",
        },
      ],
    },
  };

  return (
    <>
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Nueva solicitud", hint: "Permisos, licencias" },
          { label: "Subir documento", hint: "PDF, DOCX, XLSX" },
          { label: "Crear proyecto", hint: "Kanban, tareas" },
          { label: "Soporte TI", hint: "Incidencias" },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => setActiveModal(a.label)}
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

      {activeModal && modals[activeModal] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-lg z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "var(--primary-color)" }}
                >
                  {modals[activeModal].title}
                </h3>
                <p className="text-xs text-black/50 mt-1">
                  {modals[activeModal].hint}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1 rounded hover:bg-black/5"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setActiveModal(null);
                alert(`${activeModal} enviada exitosamente`);
              }}
              className="flex flex-col gap-4"
            >
              {modals[activeModal].fields.map((field) => (
                <div key={field.label}>
                  <label className="block text-xs font-medium text-black/70 mb-1.5">
                    {field.label}
                  </label>
                  {field.type === "select" && (
                    <select className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors bg-white">
                      <option value="">{field.placeholder}</option>
                      <option value="opt1">Opción 1</option>
                      <option value="opt2">Opción 2</option>
                    </select>
                  )}
                  {field.type === "textarea" && (
                    <textarea
                      className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors resize-none"
                      rows={3}
                      placeholder={field.placeholder}
                      required
                    />
                  )}
                  {field.type === "file" && (
                    <input
                      type="file"
                      className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors"
                      required
                    />
                  )}
                  {field.type === "date" && (
                    <input
                      type="date"
                      className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors"
                      required
                    />
                  )}
                  {field.type === "text" && (
                    <input
                      type="text"
                      className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[var(--secondary-color)] transition-colors"
                      placeholder={field.placeholder}
                      required
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm font-medium text-white transition"
                  style={{ background: "var(--secondary-color)" }}
                >
                  Enviar
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal(null)}
                  className="flex-1 rounded-lg px-3 py-2.5 text-sm font-medium border border-black/10 bg-white hover:border-black/20 transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      <div className="mt-6 grid xl:grid-cols-3 gap-6">
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
                title="María cargó “Política de Gastos v2.pdf”"
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
                hint="Incidente VPN - resuelto"
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
      <p className="text-sm text-black/60">La ruta solicitada no existe.</p>
    </section>
  );
}

function isAuthed() {
  const token =
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token");
  return !!token;
}

/** Tipo aproximado del payload que manda tu backend */
type JwtFrontendPayload = {
  id: number;
  email: string;
  nombre?: string;
  nombreUsuario?: string;
  isSupervisorOrAdmin?: boolean;
};

/**
 * Lee el payload del JWT guardado en el storage.
 */
function getAuthPayload(): JwtFrontendPayload | null {
  const token =
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token");

  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload) as JwtFrontendPayload;
  } catch (e) {
    console.error("[Auth] Error decodificando JWT:", e);
    return null;
  }
}

/**
 * Ahora usamos el flag que viene directo del backend: payload.isSupervisorOrAdmin
 */
function isSupervisorOrAdmin(): boolean {
  const payload = getAuthPayload();
  if (!payload) return false;

  return Boolean(payload.isSupervisorOrAdmin);
}

function PrivateRoute({ element }: { element: JSX.Element }) {
  return isAuthed() ? element : <Navigate to="/login" replace />;
}

export default function CintaxIntranetMockup() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hideChrome =
    pathname.startsWith("/login") ||
    pathname.startsWith("/recuperar-contrasena");
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const authPayload = getAuthPayload();
  const canSeeSupervisor = isSupervisorOrAdmin();

  // 👉 nombre que se va a mostrar en el header
  const displayName =
    authPayload?.nombre ||
    authPayload?.nombreUsuario ||
    (authPayload?.email ? authPayload.email.split("@")[0] : "") ||
    "Usuario";

  const handleLogout = async () => {
    try {
      const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token");

      await axios.post(
        `${API_BASE_URL}/auth/logout`,
        {},
        {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
    } catch (err) {
      console.error("Error al cerrar sesión", err);
    } finally {
      localStorage.removeItem("access_token");
      sessionStorage.removeItem("access_token");
      localStorage.removeItem("auth_token");
      sessionStorage.removeItem("auth_token");
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen overflow-hidden relative">
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
        .sidebar-mobile {
          position: fixed;
          top: 0;
          left: 0;
          width: 80vw;
          max-width: 320px;
          height: 100vh;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          overflow-y: auto;
        }
        .sidebar-mobile.open {
          transform: translateX(0);
        }
        .sidebar-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.4);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s ease;
          z-index: 40;
        }
        .sidebar-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }
      `}</style>

      <div
        className={
          hideChrome
            ? "min-h-screen"
            : "grid lg:grid-cols-[260px_1fr] min-h-screen"
        }
      >
        {!hideChrome && sidebarOpen && (
          <div
            className="sidebar-overlay open"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {!hideChrome && (
          <button
            className="lg:hidden fixed top-4 left-4 z-50 bg-[var(--primary-color)] text-white rounded-full p-2.5 shadow-md hover:shadow-lg transition"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <svg
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {!hideChrome && (
          <>
            {/* SIDEBAR MOBILE */}
            <aside
              className={`sidebar-mobile ${
                sidebarOpen ? "open" : ""
              } bg-[var(--primary-color)] text-white px-4 py-5 flex flex-col gap-4 lg:hidden`}
            >
              <div className="flex items-center justify-between">
                <img
                  src="https://cintax.cl/wp-content/themes/cintax/assets/images/logo-cintax.svg"
                  alt="Cintax"
                  className="h-8 w-auto"
                />
                <button
                  className="text-white/70 hover:text-white p-2 -mr-2"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Cerrar menú"
                >
                  <svg
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              <nav className="mt-2 space-y-1 flex-1 overflow-y-auto">
                <NavLink
                  to="/home"
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                      isActive
                        ? "bg-white text-[var(--primary-color)] shadow-sm"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
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
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="shrink-0">
                    <Users size={18} />
                  </span>
                  <span className="truncate text-left">Personas</span>
                </NavLink>
                <NavLink
                  to="/drive"
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                      isActive
                        ? "bg-white text-[var(--primary-color)] shadow-sm"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="shrink-0">
                    <Folder size={18} />
                  </span>
                  <span className="truncate text-left">Google Drive</span>
                </NavLink>

                {/* LINK TAREAS (AGENTES) */}
                <NavLink
                  to="/tareas"
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                      isActive
                        ? "bg-white text-[var(--primary-color)] shadow-sm"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="shrink-0">
                    <BookCheck size={18} />
                  </span>
                  <span className="truncate text-left">Tareas</span>
                </NavLink>

                {/* LINK SUPERVISOR SOLO SI PUEDE VERLO */}
                {canSeeSupervisor && (
                  <NavLink
                    to="/supervisor"
                    className={({ isActive }) =>
                      `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                        isActive
                          ? "bg-white text-[var(--primary-color)] shadow-sm"
                          : "text-white/80 hover:text-white hover:bg-white/10"
                      }`
                    }
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="shrink-0">
                      <Users size={18} />
                    </span>
                    <span className="truncate text-left">
                      Supervisión tareas
                    </span>
                  </NavLink>
                )}

                {/* 👇 NUEVO LINK: Notas de versión (MOBILE) */}
                <NavLink
                  to="/notas-version"
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                      isActive
                        ? "bg-white text-[var(--primary-color)] shadow-sm"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="shrink-0">
                    <History size={18} />
                  </span>
                  <span className="truncate text-left">Notas de versión</span>
                </NavLink>

                <TicketsNav onNavigate={() => setSidebarOpen(false)} />
                <SideLink
                  icon={<LifeBuoy size={18} />}
                  label="Soporte"
                  onClick={() => {
                    setSidebarOpen(false);
                    navigate("/soporte");
                  }}
                />
              </nav>

              <div className="border-t border-white/10 pt-4">
                <button
                  onClick={() => {
                    setSidebarOpen(false);
                    handleLogout();
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition shadow-sm hover:shadow-md"
                >
                  Cerrar sesión
                </button>
              </div>
            </aside>

            {/* SIDEBAR DESKTOP */}
            <aside className="hidden lg:flex bg-[var(--primary-color)] text-white px-4 py-5 flex-col gap-4 min-h-screen">
              <div className="flex items-center gap-2 px-3">
                <img
                  src="https://cintax.cl/wp-content/themes/cintax/assets/images/logo-cintax.svg"
                  alt="Cintax"
                  className="h-8 w-auto"
                />
              </div>

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
                <NavLink
                  to="/drive"
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                      isActive
                        ? "bg-white text-[var(--primary-color)] shadow-sm"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  <span className="shrink-0">
                    <Folder size={18} />
                  </span>
                  <span className="truncate text-left">Google Drive</span>
                </NavLink>

                {/* LINK TAREAS (AGENTES) */}
                <NavLink
                  to="/tareas"
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                      isActive
                        ? "bg-white text-[var(--primary-color)] shadow-sm"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  <span className="shrink-0">
                    <BookCheck size={18} />
                  </span>
                  <span className="truncate text-left">Tareas</span>
                </NavLink>

                {/* LINK SUPERVISOR SOLO SI PUEDE VERLO */}
                {canSeeSupervisor && (
                  <NavLink
                    to="/supervisor"
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
                    <span className="truncate text-left">
                      Supervisión tareas
                    </span>
                  </NavLink>
                )}

                {/* 👇 NUEVO LINK: Notas de versión (DESKTOP) */}
                <NavLink
                  to="/notas-version"
                  className={({ isActive }) =>
                    `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
                      isActive
                        ? "bg-white text-[var(--primary-color)] shadow-sm"
                        : "text-white/80 hover:text-white hover:bg-white/10"
                    }`
                  }
                >
                  <span className="shrink-0">
                    <History size={18} />
                  </span>
                  <span className="truncate text-left">Notas de versión</span>
                </NavLink>

                <TicketsNav />
                <SideLink
                  icon={<HandHelping size={18} />}
                  label="Soporte RIDS"
                  onClick={() => navigate("/soporte")}
                />
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
          </>
        )}

        <main className={hideChrome ? "p-0" : "p-5 lg:p-6 pt-16 lg:pt-5"}>
          {!hideChrome && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div>
                <h1 className="text-2xl sm:text-[var(--title-xl)] font-semibold">
                  Intranet{" "}
                  <span className="text-[var(--secondary-color)]">Cintax</span>
                </h1>
                <p className="text-sm text-black/60 mt-1">
                  Resumen general y accesos rápidos
                </p>
              </div>

              {/* 👉 info del trabajador logeado + botón config */}
              <div className="flex items-center gap-3">
                {authPayload && (
                  <div className="flex items-center gap-2 rounded-full bg-white border border-black/10 px-3 py-1.5 shadow-sm max-w-[220px] sm:max-w-xs">
                    <div className="w-8 h-8 rounded-full bg-[var(--secondary-color)] text-white flex items-center justify-center text-sm font-semibold">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="text-[11px] text-black/40">
                        Conectado como
                      </span>
                      <span className="text-sm font-medium text-[var(--primary-color)] truncate">
                        {displayName}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => navigate("/configurar")}
                  className="rounded-xl bg-white border border-black/5 p-2 shadow-sm hover:shadow transition active:scale-95"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>
          )}

          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/home"
              element={<PrivateRoute element={<HomePage />} />}
            />
            <Route
              path="/personas"
              element={<PrivateRoute element={<PersonasPage />} />}
            />
            <Route path="/drive" element={<DrivePage />} />
            <Route
              path="/tickets"
              element={<PrivateRoute element={<TicketsPage />} />}
            />
            <Route
              path="/tickets/:cat"
              element={<PrivateRoute element={<TicketsPage />} />}
            />

            {/* 👇 NUEVA RUTA: Notas de versión */}
            <Route
              path="/notas-version"
              element={<PrivateRoute element={<ReleaseNotesPage />} />}
            />

            {/* RUTA SUPERVISOR PROTEGIDA */}
            <Route
              path="/supervisor"
              element={
                <PrivateRoute
                  element={
                    isSupervisorOrAdmin() ? (
                      <TareasSupervisionPage />
                    ) : (
                      <NotFoundPage />
                    )
                  }
                />
              }
            />

            <Route
              path="/configurar"
              element={<PrivateRoute element={<ConfigurarPage />} />}
            />
            <Route
              path="/soporte"
              element={<PrivateRoute element={<SoportePage />} />}
            />
            <Route
              path="/tareas"
              element={<PrivateRoute element={<TareasPage />} />}
            />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/inicio" element={<Navigate to="/home" replace />} />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>

          {!hideChrome && (
            <footer className="mt-8 text-center text-xs text-black/50">
              © {new Date().getFullYear()} Cintax - Intranet Cintax
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
