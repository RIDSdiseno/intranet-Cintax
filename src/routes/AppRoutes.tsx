import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/login_page";
import PersonasPage from "../pages/personasPage";
import DrivePage from "../pages/DrivePage";
import TicketsPage from "../pages/ticketsPage";
import ConfigurarPage from "../pages/ConfigurarPage";
import SoportePage from "../pages/SoportePage";
import TareasPage from "../pages/TareasPage";
import TareasSupervisionPage from "../pages/TareasSupervisionPage";
import HomePage from "../pages/HomePage";
import ReleaseNotesPage from "../pages/ReleaseNotesPage";
import CreacionTareasPage from "../pages/creacion-tareas/CreacionTareasPage";

import AppShell from "../layout/AppShell";

// -------- auth helpers (puedes moverlos a /auth si quieres) --------
function isAuthed() {
  const token =
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token");
  return !!token;
}

type JwtFrontendPayload = {
  id: number;
  email: string;
  nombre?: string;
  nombreUsuario?: string;
  isSupervisorOrAdmin?: boolean;
  picture?: string;
  avatarUrl?: string;
};

export function getAuthPayload(): JwtFrontendPayload | null {
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

export function isSupervisorOrAdmin(): boolean {
  const payload = getAuthPayload();
  return Boolean(payload?.isSupervisorOrAdmin);
}

function NotFoundPage() {
  return (
    <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mt-6 text-center">
      <h2 className="text-lg font-semibold text-[var(--primary-color)]">
        Página no encontrada
      </h2>
      <p className="text-sm text-black/60">La ruta solicitada no existe.</p>
    </section>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return isAuthed() ? <>{children}</> : <Navigate to="/login" replace />;
}

function SupervisorRoute({ children }: { children: React.ReactNode }) {
  return isSupervisorOrAdmin() ? <>{children}</> : <NotFoundPage />;
}

// ---------------- Routes ----------------
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* App protegida con layout */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/home" replace />} />
        <Route path="inicio" element={<Navigate to="/home" replace />} />

        <Route path="home" element={<HomePage />} />
        <Route path="drive" element={<DrivePage />} />
        <Route path="tareas" element={<TareasPage />} />
        <Route path="soporte" element={<SoportePage />} />
        <Route path="configurar" element={<ConfigurarPage />} />

        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/:cat" element={<TicketsPage />} />

        <Route path="notas-version" element={<ReleaseNotesPage />} />

        {/* Supervisor/Admin */}
        <Route
          path="personas"
          element={
            <SupervisorRoute>
              <PersonasPage />
            </SupervisorRoute>
          }
        />
        <Route
          path="supervisor"
          element={
            <SupervisorRoute>
              <TareasSupervisionPage />
            </SupervisorRoute>
          }
        />
        <Route
          path="tareas/creacion"
          element={
            <SupervisorRoute>
              <CreacionTareasPage />
            </SupervisorRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
