// src/pages/TareasPage.tsx
import React, { useState, useEffect } from "react";
import VistaPorRut from "../components/tareas/VistaPorRut";
import VistaPorTarea from "../components/tareas/VistaPorTarea";

type VistaTareas = "porRut" | "porTarea";

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

const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
};

const TareasPage: React.FC = () => {
  const [vista, setVista] = useState<VistaTareas>("porRut");
  const [trabajadorNombre, setTrabajadorNombre] = useState<string | null>(null);

  // Cargar nombre del trabajador autenticado
  useEffect(() => {
    // 1) Intento leer desde localStorage (por si ya lo guardas ahí)
    const storedName =
      localStorage.getItem("user_name") ||
      localStorage.getItem("trabajadorNombre") ||
      localStorage.getItem("nombre_usuario");

    if (storedName) {
      setTrabajadorNombre(storedName);
    }

    // 2) Intento pedirlo al backend (ajusta la URL si tu endpoint es otro)
    const fetchMe = async () => {
      try {
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        };

        const res = await fetch(`${API_BASE_URL}/auth/me`, { headers });
        if (!res.ok) return; // si falla, nos quedamos con lo de localStorage

        const data = await res.json();
        // Ajusta estos campos según tu payload real
        const nombreBackend =
          data.nombre ||
          data.name ||
          data.fullName ||
          data.trabajadorNombre ||
          null;

        if (nombreBackend) {
          setTrabajadorNombre(nombreBackend);
          // opcional: guardarlo también en localStorage
          localStorage.setItem("user_name", nombreBackend);
        }
      } catch (err) {
        console.error("[Front] No se pudo obtener el nombre del trabajador", err);
      }
    };

    fetchMe();
  }, []);

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* HEADER: título + nombre trabajador + selector de vista */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-black">
            Tareas
          </h1>
          {trabajadorNombre && (
            <p className="text-xs text-black/60">
              Trabajador a cargo:{" "}
              <span className="font-medium">{trabajadorNombre}</span>
            </p>
          )}
        </div>

        {/* selector de vista */}
        <div className="inline-flex bg-white rounded-full border border-black/5 p-1 self-start sm:self-auto shadow-sm">
          <button
            type="button"
            onClick={() => setVista("porRut")}
            className={`px-4 py-1.5 text-xs rounded-full transition ${
              vista === "porRut"
                ? "bg-[var(--primary-color)] text-white shadow-sm"
                : "text-black/60 hover:bg-black/5"
            }`}
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
          >
            Ver por tarea
          </button>
        </div>
      </div>

      {vista === "porRut" && <VistaPorRut />}
      {vista === "porTarea" && <VistaPorTarea />}
    </div>
  );
};

export default TareasPage;
