// src/pages/CreacionTareasPage.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  ClipboardList,
  ListTodo,
  SlidersHorizontal,
  User,
  Users,
  BookOpen,
  Loader2,
  AlertCircle,
} from "lucide-react";

import type { Trabajador, TrabajadorAPI, LoadState } from "./shared/types";
import type { Role } from "./shared/auth";
import { fetchRoleFromBackend, getRoleFromToken, getAuthHeaders } from "./shared/auth";

import ManualTab from "./tabs/ManualTab";
import ClientesTab from "./tabs/ClientesTab";
import PlantillasTab from "./tabs/PlantillasTab";
import AsignarManualTab from "./tabs/AsignarManualTab";
import EdicionEjecutivoTab from "./tabs/EdicionEjecutivoTab";

type TabCreacion = "manual" | "clientes" | "tareas" | "asignaciones" | "edicion";

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

const CreacionTareasPage: React.FC = () => {
  const [tab, setTab] = useState<TabCreacion>("manual");

  // -----------------------------
  // Role (JWT -> /me fallback)
  // -----------------------------
  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  const canManageClientes = role === "ADMIN" || role === "SUPERVISOR";

  const resolveRole = async () => {
    setRoleLoading(true);
    try {
      const r1 = getRoleFromToken();
      if (r1) {
        setRole(r1);
        return;
      }
      const r2 = await fetchRoleFromBackend(API_BASE_URL);
      setRole(r2);
      if (!r2) console.warn("[AUTH] No pude resolver role. UI en modo solo lectura.");
    } finally {
      setRoleLoading(false);
    }
  };

  // -----------------------------
  // Trabajadores
  // -----------------------------
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loadingTrabajadores, setLoadingTrabajadores] = useState<LoadState>("idle");
  const [errorTrabajadores, setErrorTrabajadores] = useState<string | null>(null);

  const fetchTrabajadores = async () => {
    setLoadingTrabajadores("loading");
    setErrorTrabajadores(null);

    try {
      const res = await fetch(`${API_BASE_URL}/trabajadores`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const raw: unknown = await res.json();

      const arr: TrabajadorAPI[] = Array.isArray((raw as any)?.items)
        ? (raw as any).items
        : Array.isArray((raw as any)?.data)
        ? (raw as any).data
        : Array.isArray(raw)
        ? (raw as TrabajadorAPI[])
        : [];

      const normalized: Trabajador[] = arr
        .map((t): Trabajador => {
          const id = Number(t.id_trabajador ?? t.id ?? t.trabajadorId);
          const nombre = String(t.nombre ?? t.name ?? "");
          const email = String(t.email ?? "");
          return { id_trabajador: id, nombre, email };
        })
        .filter(
          (t) =>
            Number.isFinite(t.id_trabajador) &&
            t.id_trabajador > 0 &&
            t.nombre.trim().length > 0
        );

      const uniq = Array.from(new Map(normalized.map((t) => [t.id_trabajador, t])).values()).sort(
        (a, b) => a.nombre.localeCompare(b.nombre, "es")
      );

      setTrabajadores(uniq);
      setLoadingTrabajadores("success");
    } catch (e: any) {
      console.error("[Front] Error cargando trabajadores", e);
      setTrabajadores([]);
      setErrorTrabajadores("No se pudieron cargar trabajadores.");
      setLoadingTrabajadores("error");
    }
  };

  // -----------------------------
  // Init anti StrictMode
  // -----------------------------
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    resolveRole();
    fetchTrabajadores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------
  // UI helpers
  // -----------------------------
  const TabButton = ({
    id,
    label,
    Icon,
    disabled,
  }: {
    id: TabCreacion;
    label: string;
    Icon: any;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-full flex items-center gap-1 transition ${
        tab === id ? "bg-white shadow text-black/80" : "text-black/60"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/60"}`}
      title={disabled ? "Cargando datos necesarios..." : label}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );

  const showWorkersWarning = tab === "tareas" || tab === "asignaciones" || tab === "edicion";

  return (
    <div className="flex flex-col gap-4">
      {/* HEADER */}
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-black/70" />
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-black/80">Creación de tareas</h1>
            <p className="text-xs text-black/50">
              Gestiona clientes, define plantillas, asigna tareas y configura “NO aplica” por cliente.
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-black/45">
              <span>
                Rol: <b>{roleLoading ? "verificando..." : role ?? "no detectado"}</b>
              </span>
              <span className="text-black/25">•</span>
              <span>
                Clientes:{" "}
                <b>{canManageClientes ? "edición habilitada" : "solo lectura"}</b>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 inline-flex bg-black/5 rounded-full p-0.5 text-[11px] self-start flex-wrap gap-1">
          <TabButton id="manual" label="Manual" Icon={BookOpen} />
          <TabButton id="clientes" label="Clientes" Icon={User} />
          <TabButton id="tareas" label="Tareas / plantillas" Icon={ListTodo} />
          <TabButton id="asignaciones" label="Asignar manual" Icon={Users} />
          <TabButton id="edicion" label="Edición por ejecutivo" Icon={SlidersHorizontal} />
        </div>

        {/* Workers banner */}
        {showWorkersWarning && loadingTrabajadores === "loading" && (
          <div className="mt-2 text-[11px] text-black/60 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Cargando trabajadores (afecta selects de responsable/ejecutivo)…
          </div>
        )}

        {showWorkersWarning && loadingTrabajadores === "error" && (
          <div className="mt-2 text-[11px] text-rose-600 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errorTrabajadores || "No se pudieron cargar trabajadores (afecta selects)."}
            </span>
            <button
              type="button"
              onClick={fetchTrabajadores}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
            >
              <Loader2 className="w-3 h-3" />
              Reintentar
            </button>
          </div>
        )}
      </section>

      {/* CONTENT */}
      {tab === "manual" && <ManualTab />}

      {tab === "clientes" && (
        <ClientesTab
          API_BASE_URL={API_BASE_URL}
          role={role}
          roleLoading={roleLoading}
          trabajadores={trabajadores}
        />
      )}

      {tab === "tareas" && <PlantillasTab API_BASE_URL={API_BASE_URL} />}

      {tab === "asignaciones" && (
        <AsignarManualTab API_BASE_URL={API_BASE_URL} trabajadores={trabajadores} />
      )}

      {tab === "edicion" && (
        <EdicionEjecutivoTab API_BASE_URL={API_BASE_URL} trabajadores={trabajadores} />
      )}
    </div>
  );
};

export default CreacionTareasPage;
