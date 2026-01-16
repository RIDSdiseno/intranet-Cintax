import React from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

import Sidebar from "../components/sidebar/Sidebar";
import NotificationsBell from "../components/NotificationsBell";
import { Settings } from "lucide-react";

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

type JwtFrontendPayload = {
  id: number;
  email: string;
  nombre?: string;
  nombreUsuario?: string;
  isSupervisorOrAdmin?: boolean;
  picture?: string;
  avatarUrl?: string;
};

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
  } catch {
    return null;
  }
}

function isSupervisorOrAdmin(): boolean {
  return Boolean(getAuthPayload()?.isSupervisorOrAdmin);
}

export default function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const hideChrome =
    pathname.startsWith("/login") || pathname.startsWith("/recuperar-contrasena");

  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  const authPayload = getAuthPayload();
  const canSeeSupervisor = isSupervisorOrAdmin();

  const displayName =
    authPayload?.nombre ||
    authPayload?.nombreUsuario ||
    (authPayload?.email ? authPayload.email.split("@")[0] : "") ||
    "Usuario";

  const avatarUrl = authPayload?.avatarUrl || authPayload?.picture || null;
  const displayInitial = displayName.charAt(0).toUpperCase();

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
          --text-mini: 0.8rem; 
          --title-xl: 2rem; 
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
        .sidebar-mobile.open { transform: translateX(0); }
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

      <div className={hideChrome ? "min-h-screen" : "min-h-screen lg:pl-[260px]"}>
        {!hideChrome && sidebarOpen && (
          <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)} />
        )}

        {!hideChrome && (
          <button
            className="lg:hidden fixed top-4 left-4 z-50 bg-[var(--primary-color)] text-white rounded-full p-2.5 shadow-md hover:shadow-lg transition"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {!hideChrome && (
          <>
            {/* MOBILE */}
            <aside
              className={`sidebar-mobile ${sidebarOpen ? "open" : ""} bg-[var(--primary-color)] text-white px-4 py-5 lg:hidden`}
            >
              <Sidebar
                variant="mobile"
                canSeeSupervisor={canSeeSupervisor}
                onLogout={handleLogout}
                onNavigate={() => setSidebarOpen(false)}
              />
            </aside>

            {/* DESKTOP */}
            <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[260px] bg-[var(--primary-color)] text-white px-4 py-5 flex-col z-40 overflow-y-auto">
              <Sidebar
                variant="desktop"
                canSeeSupervisor={canSeeSupervisor}
                onLogout={handleLogout}
              />
            </aside>
          </>
        )}

        <main className={hideChrome ? "p-0" : "p-5 lg:p-6 pt-16 lg:pt-5"}>
          {!hideChrome && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
              <div>
                <h1 className="text-2xl sm:text-[var(--title-xl)] font-semibold">
                  Intranet <span className="text-[var(--secondary-color)]">Cintax</span>
                </h1>
                <p className="text-sm text-black/60 mt-1">Resumen general y accesos rápidos</p>
              </div>

              <div className="flex items-center gap-3">
                {authPayload && (
                  <div className="flex items-center gap-2 rounded-full bg-white border border-black/10 px-3 py-1.5 shadow-sm max-w-[260px]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--secondary-color)] text-white flex items-center justify-center text-sm font-semibold">
                        {displayInitial}
                      </div>
                    )}
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="text-[11px] text-black/40">Conectado como</span>
                      <span className="text-sm font-medium text-[var(--primary-color)] truncate">
                        {displayName}
                      </span>
                    </div>
                  </div>
                )}

                <NotificationsBell />
                <button
                  onClick={() => navigate("/configurar")}
                  className="rounded-xl bg-white border border-black/5 p-2 shadow-sm hover:shadow transition active:scale-95"
                  aria-label="Configurar"
                >
                  <Settings size={18} />
                </button>
              </div>
            </div>
          )}

          {/* ✅ aquí se renderizan las páginas */}
          <Outlet />

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
