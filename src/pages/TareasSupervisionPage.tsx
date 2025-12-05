// src/pages/TareasSupervisionPage.tsx
import React, { useEffect, useState } from "react";
import VistaPorRut from "../components/tareas/VistaPorRut";
import VistaPorTarea from "../components/tareas/VistaPorTarea";

type VistaTareas = "porRut" | "porTarea";

type ResumenAgente = {
  trabajadorId: number;
  nombre: string;
  email: string;
  pendientes: number;
  enProceso: number;
  vencidas: number;
  completadas: number;
};

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

const getAuthToken = () => {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token")
  );
};

const TareasSupervisionPage: React.FC = () => {
  const [vista, setVista] = useState<VistaTareas>("porRut");
  const [resumen, setResumen] = useState<ResumenAgente[]>([]);
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState<string | null>(null);

  const [agenteSeleccionadoId, setAgenteSeleccionadoId] = useState<number | "">(
    ""
  );

  useEffect(() => {
    const fetchResumen = async () => {
      setLoadingResumen(true);
      setErrorResumen(null);
      try {
        const token = getAuthToken();

        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(
          `${API_BASE_URL}/tareas/supervision/resumen`,
          { headers }
        );

        if (!res.ok) {
          if (res.status === 403) {
            // mensaje especial para cuando no es supervisor/admin
            throw new Error(
              "No tienes permisos para ver la supervisión de tareas. Esta vista es solo para supervisores o administradores."
            );
          }
          if (res.status === 401) {
            throw new Error("Sesión no válida. Vuelve a iniciar sesión.");
          }
          throw new Error(`Error ${res.status}`);
        }

        const data: ResumenAgente[] = await res.json();
        setResumen(data || []);
      } catch (err: any) {
        console.error("[Front] Error cargando resumen supervisión", err);
        setErrorResumen(
          err?.message || "No se pudo cargar el resumen de tareas."
        );
      } finally {
        setLoadingResumen(false);
      }
    };

    fetchResumen();
  }, []);

  const agenteSeleccionado = resumen.find(
    (r) => r.trabajadorId === agenteSeleccionadoId
  );

  // Si no tiene permisos, mostramos solo el mensaje de error
  if (errorResumen?.includes("permisos")) {
    return (
      <div className="mt-6 flex flex-col gap-3">
        <h1 className="text-xl font-semibold text-black/80">
          Supervisión de tareas
        </h1>
        <p className="text-xs text-black/50">
          Esta sección está restringida para usuarios con rol de supervisión o
          administración.
        </p>
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-xl px-4 py-3">
          {errorResumen}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* HEADER */}
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-black/80">
          Supervisión de tareas
        </h1>
        <p className="text-xs text-black/50">
          Revisa y supervisa las tareas asignadas a cada agente. Puedes ver por
          RUT o por tipo de tarea.
        </p>
      </header>

      {/* PANEL RESUMEN AGENTES */}
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--primary-color)" }}
            >
              Resumen por agente
            </h2>
            <p className="text-xs text-black/50">
              Selecciona un agente para ver sus tareas en detalle (vista de
              supervisión).
            </p>
          </div>

          <div className="w-full sm:w-72">
            <label className="block text-[11px] font-semibold text-black/70 mb-1">
              Agente
            </label>
            {loadingResumen && (
              <p className="text-xs text-black/50">Cargando agentes…</p>
            )}
            {errorResumen && !loadingResumen && (
              <p className="text-xs text-rose-600">{errorResumen}</p>
            )}
            {!errorResumen && !loadingResumen && (
              <select
                value={agenteSeleccionadoId}
                onChange={(e) =>
                  setAgenteSeleccionadoId(
                    e.target.value ? Number(e.target.value) : ""
                  )
                }
                className="w-full border border-black/15 rounded-lg px-3 py-2 text-xs outline-none focus:border-[var(--secondary-color)]"
              >
                <option value="">Selecciona un agente…</option>
                {resumen.map((r) => (
                  <option key={r.trabajadorId} value={r.trabajadorId}>
                    {r.nombre} ({r.email})
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {agenteSeleccionado && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] mt-2">
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <p className="font-semibold text-amber-700">Pendientes</p>
              <p className="text-amber-800/80 text-sm">
                {agenteSeleccionado.pendientes}
              </p>
            </div>
            <div className="bg-sky-50 border border-sky-100 rounded-xl px-3 py-2">
              <p className="font-semibold text-sky-700">En proceso</p>
              <p className="text-sky-800/80 text-sm">
                {agenteSeleccionado.enProceso}
              </p>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              <p className="font-semibold text-rose-700">Vencidas</p>
              <p className="text-rose-800/80 text-sm">
                {agenteSeleccionado.vencidas}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              <p className="font-semibold text-emerald-700">Completadas</p>
              <p className="text-emerald-800/80 text-sm">
                {agenteSeleccionado.completadas}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* selector de vista */}
      <div className="inline-flex bg-white rounded-full border border-black/5 p-1 self-start shadow-sm">
        <button
          type="button"
          onClick={() => setVista("porRut")}
          className={`px-4 py-1.5 text-xs rounded-full transition ${
            vista === "porRut"
              ? "bg-[var(--primary-color)] text-white shadow-sm"
              : "text-black/60 hover:bg-black/5"
          }`}
          disabled={!agenteSeleccionadoId}
        >
          Ver por RUT
        </button>
        <button
          type="button"
          onClick={() => setVista("porTarea")}
          className={`px-4 py-1.5 text-xs rounded-full transition ${
            vista === "porTarea"
              ? "bg-[var(--primary-color)] text-white shadow-sm"
              : "text-black/60 hover:bg-black/5"
          }`}
          disabled={!agenteSeleccionadoId}
        >
          Ver por tarea
        </button>
      </div>

      {!agenteSeleccionadoId && !loadingResumen && !errorResumen && (
        <p className="text-xs text-black/50">
          Selecciona un agente para ver su tablero de tareas en modo
          supervisión.
        </p>
      )}

      {agenteSeleccionadoId && (
        <p className="text-[11px] text-black/50">
          Estás viendo las tareas asignadas al agente seleccionado, no las
          tuyas.
        </p>
      )}

      {agenteSeleccionadoId && vista === "porRut" && (
        <VistaPorRut trabajadorIdFiltro={agenteSeleccionadoId} />
      )}

      {agenteSeleccionadoId && vista === "porTarea" && (
        <VistaPorTarea trabajadorIdFiltro={agenteSeleccionadoId} />
      )}
    </div>
  );
};

export default TareasSupervisionPage;
