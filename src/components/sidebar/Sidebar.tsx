import React from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import type { TicketGroup } from "../../modules/tickets/types";
import { getGroups } from "../../modules/tickets/services/ticketsApi";
import {
  Home,
  Users,
  Folder,
  BookCheck,
  ClipboardList,
  History,
  ChevronDown,
  LifeBuoy,
  HandHelping,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
  supervisorOnly?: boolean;
};

function clsActive(isActive: boolean) {
  return `w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition ${
    isActive
      ? "bg-white text-[var(--primary-color)] shadow-sm"
      : "text-white/80 hover:text-white hover:bg-white/10"
  }`;
}

const TicketsNav: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = React.useState(true);
  const location = useLocation();
  const [groups, setGroups] = React.useState<TicketGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = React.useState(false);

  const currentGroup = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("area") || "all";
  }, [location.search]);

  React.useEffect(() => {
    const load = async () => {
      try {
        setLoadingGroups(true);
        const res = await getGroups();
        setGroups(res.data.groups);
      } catch (err) {
        console.error("Error cargando grupos de tickets:", err);
      } finally {
        setLoadingGroups(false);
      }
    };

    load();
  }, []);

  const items = groups.map((group) => ({
    slug: group.slug,
    to: `/tickets?area=${group.slug}`,
    label: group.name,
  }));

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
        {loadingGroups && (
          <div className="text-xs text-white/50 px-3 py-2">Cargando...</div>
        )}
        {!loadingGroups && items.length === 0 && (
          <Link
            to="/tickets"
            className="text-sm px-3 py-2 rounded-lg transition-colors block text-white/80 hover:text-white hover:bg-white/10"
            onClick={onNavigate}
          >
            Tickets
          </Link>
        )}
        {!loadingGroups &&
          items.map((item) => {
          const isActive =
            item.slug === "all"
              ? currentGroup === "all"
              : currentGroup === item.slug;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`text-sm px-3 py-2 rounded-lg transition-colors block ${
                isActive
                  ? "text-white bg-white/10"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
              onClick={onNavigate}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default function Sidebar({
  canSeeSupervisor,
  onLogout,
  onNavigate,
  variant = "desktop",
}: {
  canSeeSupervisor: boolean;
  onLogout: () => void;
  onNavigate?: () => void; // para cerrar sidebar móvil al click
  variant?: "desktop" | "mobile";
}) {
  const navigate = useNavigate();

  const navItems: NavItem[] = [
    { to: "/home", label: "Inicio", icon: <Home size={18} /> },
    {
      to: "/personas",
      label: "Personas",
      icon: <Users size={18} />,
      supervisorOnly: true,
    },
    { to: "/drive", label: "Google Drive", icon: <Folder size={18} /> },
    { to: "/tareas", label: "Tareas", icon: <BookCheck size={18} /> },
    {
      to: "/tareas/creacion",
      label: "Crear tareas",
      icon: <ClipboardList size={18} />,
      supervisorOnly: true,
    },
    {
      to: "/supervisor",
      label: "Supervisión tareas",
      icon: <Users size={18} />,
      supervisorOnly: true,
    },
    { to: "/notas-version", label: "Notas de versión", icon: <History size={18} /> },
  ];

  const visible = navItems.filter((x) => !x.supervisorOnly || canSeeSupervisor);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2 px-3">
        <img
          src="https://cintax.cl/wp-content/themes/cintax/assets/images/logo-cintax.svg"
          alt="Cintax"
          className="h-8 w-auto"
        />
      </div>

      <nav className="mt-2 space-y-1 flex-1 overflow-y-auto no-scrollbar">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => clsActive(isActive)}
            onClick={onNavigate}
            end={item.to === "/tickets"}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="truncate text-left">{item.label}</span>
          </NavLink>
        ))}

        <TicketsNav onNavigate={onNavigate} />

        <button
          onClick={() => {
            navigate("/soporte");
            onNavigate?.();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition text-white/80 hover:text-white hover:bg-white/10"
        >
          <span className="shrink-0">
            {variant === "desktop" ? <HandHelping size={18} /> : <LifeBuoy size={18} />}
          </span>
          <span className="truncate text-left">
            {variant === "desktop" ? "Soporte RIDS" : "Soporte"}
          </span>
        </button>
      </nav>

      <div className="border-t border-white/10 pt-4">
        <button
          onClick={onLogout}
          className="w-full rounded-xl px-3 py-2 text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition shadow-sm hover:shadow-md"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
