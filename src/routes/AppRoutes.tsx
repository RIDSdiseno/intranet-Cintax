import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "../pages/login_page";
import PersonasPage from "../pages/personasPage";
import DrivePage from "../pages/DrivePage";
import TicketsPage from "../pages/ticketsPage";
import TicketDetailPage from "../modules/tickets/pages/TicketDetailPage";
import AutomationLayout from "../modules/tickets/automation/layout/AutomationLayout";
import AutomationPage from "../modules/tickets/automation/pages/AutomationPage";
import RuleEditorPage from "../modules/tickets/automation/pages/RuleEditorPage";
import TemplatesPage from "../modules/tickets/automation/pages/TemplatesPage";
import AutomationsSettingsPage from "../modules/tickets/settings/pages/AutomationsSettingsPage";
import AutomationsTemplatesPage from "../modules/tickets/settings/pages/AutomationsTemplatesPage";
import AgentsSettingsPage from "../modules/tickets/settings/pages/AgentsSettingsPage";
import GroupsSettingsPage from "../modules/tickets/settings/pages/GroupsSettingsPage";
import ConfigurarPage from "../pages/ConfigurarPage";
import SoportePage from "../pages/SoportePage";
import TareasPage from "../pages/TareasPage";
import TareasSupervisionPage from "../pages/TareasSupervisionPage";
import HomePage from "../pages/HomePage";
import ReleaseNotesPage from "../pages/ReleaseNotesPage";

// ✅ NUEVO: Módulo aislado de creación/asignación (pages/)
import TaskAssignmentPage from "../pages/TaskAssignmentPage";

// ✅ Bitácora
import BitacoraPage from "../pages/BitacoraPage";
import BitacoraEquipoPage from "../pages/BitacoraEquipoPage";

import AppShell from "../layout/AppShell";

// ✅ Clientes
import ClientesPage from "../pages/ClientesPage";

// -------- auth helpers --------
function isAuthed() {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
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
  isAdmin?: boolean;
  role?: "ADMIN" | "SUPERVISOR" | "AGENTE";
  picture?: string;
  avatarUrl?: string;
};

export function getAuthPayload(): JwtFrontendPayload | null {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
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
  return Boolean(
    payload?.isSupervisorOrAdmin ||
      payload?.role === "ADMIN" ||
      payload?.role === "SUPERVISOR" ||
      payload?.isAdmin === true
  );
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

        {/* ✅ Bitácora (todos) */}
        <Route path="bitacora" element={<BitacoraPage />} />

        {/* ✅ Bitácora equipo (solo supervisor/admin) */}
        <Route
          path="bitacora/equipo"
          element={
            <SupervisorRoute>
              <BitacoraEquipoPage />
            </SupervisorRoute>
          }
        />

        {/* ✅ Clientes (solo supervisor/admin) */}
        <Route
          path="clientes"
          element={
            <SupervisorRoute>
              <ClientesPage role={getAuthPayload()?.role ?? "AGENTE"} />
            </SupervisorRoute>
          }
        />

        {/* ✅ Tickets */}
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/automatizaciones" element={<AutomationLayout />}>
          <Route index element={<AutomationPage />} />
          <Route path="new" element={<RuleEditorPage mode="new" />} />
          <Route path=":id/edit" element={<RuleEditorPage mode="edit" />} />
          <Route path=":id/clone" element={<RuleEditorPage mode="clone" />} />
          <Route path="templates" element={<TemplatesPage />} />
        </Route>

        <Route
          path="tickets/settings/automations"
          element={<AutomationsSettingsPage />}
        />
        <Route
          path="tickets/settings/automations/templates"
          element={<AutomationsTemplatesPage />}
        />
        <Route path="tickets/settings/agents" element={<AgentsSettingsPage />} />
        <Route path="admin/agentes" element={<AgentsSettingsPage />} />
        <Route path="agentes" element={<AgentsSettingsPage />} />
        <Route path="tickets/settings/groups" element={<GroupsSettingsPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />

        <Route path="notas-version" element={<ReleaseNotesPage />} />

        {/* ✅ Supervisor/Admin */}
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

        {/* ✅ NUEVO: módulo aislado creación/asignación de tareas */}
        <Route
          path="task-assignment"
          element={
            <SupervisorRoute>
              <TaskAssignmentPage />
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