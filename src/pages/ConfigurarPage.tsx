// src/pages/ConfigurarPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { User, Camera } from "lucide-react";

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

type Perfil = {
  id_trabajador: number;
  nombre: string;
  email: string;
  status: boolean;
  areaInterna?: string | null;        // ADMIN | CONTA | RRHH | TRIBUTARIO
  tipoRelacion?: string | null;
  carpetaDriveCodigo?: string | null; // ej: "A01" (código interno)
  codigoInterno?: string | null;      // alias opcional que puede venir del backend
  createdAt: string;
};

type LoadState = "idle" | "loading" | "success" | "error";

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
  return { Authorization: `Bearer ${token}` };
};

// Mapea el enum de Prisma a etiquetas legibles
const prettyArea = (area?: string | null): string => {
  if (!area) return "Sin área asignada";
  const map: Record<string, string> = {
    ADMIN: "Administración",
    CONTA: "Contabilidad",
    RRHH: "Recursos Humanos",
    TRIBUTARIO: "Tributario",
  };
  return map[area] ?? area;
};

const formatFechaCorta = (iso?: string): string => {
  if (!iso) return "No registrado";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "No registrado";
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const ConfigurarPage: React.FC = () => {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [loading, setLoading] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading("loading");
        setError(null);

        const resp = await axios.get(`${API_BASE_URL}/auth/profile`, {
          headers: getAuthHeaders(),
          withCredentials: true,
        });

        const data: any = resp.data;
        // Intentamos acomodarnos a varias posibles formas de respuesta
        const t: Perfil | undefined =
          data?.trabajador || data?.perfil || data?.user || data;

        if (!t || typeof t.nombre !== "string") {
          console.error(
            "[ConfigurarPage] Respuesta inesperada de /auth/me:",
            data
          );
          throw new Error("Formato de perfil no válido");
        }

        console.log("[ConfigurarPage] Perfil recibido:", t);

        setPerfil(t);
        setLoading("success");
      } catch (err) {
        console.error("Error cargando perfil", err);
        setError("No se pudo cargar la información del perfil.");
        setLoading("error");
      }
    };

    fetchProfile();
  }, []);

  const initialLetter =
    perfil?.nombre?.charAt(0).toUpperCase() ||
    perfil?.email?.charAt(0).toUpperCase() ||
    "U";

  const cargoTexto = prettyArea(perfil?.areaInterna); // ej: "Contabilidad"

  // 👇 Código interno: primero carpetaDriveCodigo, si no, el alias codigoInterno
  const codigoTexto =
    perfil?.carpetaDriveCodigo ??
    perfil?.codigoInterno ??
    "";

  const fechaIngreso = formatFechaCorta(perfil?.createdAt);

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-1">Configuración</h2>
      <p className="text-sm text-black/60 mb-6">
        Visualiza tus datos personales y de acceso. Por ahora, esta sección es
        solo de lectura.
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Tab lateral: Mi perfil (única opción por ahora) */}
        <div className="w-full max-w-xs">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-black/10 shadow-sm text-sm font-medium text-[var(--primary-color)]"
          >
            <User size={16} />
            <span>Mi Perfil</span>
          </button>
        </div>

        {/* Panel principal de perfil */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-black/10 shadow-sm overflow-hidden">
            {/* Header del panel */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
              <div>
                <h3 className="text-base font-semibold text-[var(--primary-color)]">
                  Mi Perfil
                </h3>
                <p className="text-xs text-black/50 mt-1">
                  Información personal del colaborador conectado.
                </p>
              </div>

              {/* Botón decorativo deshabilitado */}
              <button
                type="button"
                disabled
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-[var(--secondary-color)]/40 cursor-not-allowed"
              >
                Edición no disponible
              </button>
            </div>

            <div className="px-5 py-6 space-y-6">
              {/* Avatar + info extra */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-[var(--tertiary-color)] flex items-center justify-center text-2xl font-semibold text-[var(--secondary-color)] border border-black/10">
                    {initialLetter}
                  </div>
                  <button
                    type="button"
                    disabled
                    className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-white/70 border border-black/10 flex items-center justify-center shadow-sm text-black/30 cursor-not-allowed"
                  >
                    <Camera size={16} />
                  </button>
                </div>
                <div className="text-xs text-black/50 space-y-1">
                  <p>Próximamente podrás subir tu propia foto de perfil.</p>
                  <p>Por ahora mostramos tus iniciales automáticamente.</p>
                  {perfil && (
                    <p className="mt-1">
                      <span className="font-medium text-black/70">
                        Colaborador desde:
                      </span>{" "}
                      <span>{fechaIngreso}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Datos solo lectura */}
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Nombre */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-black/70">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={perfil?.nombre ?? ""}
                    readOnly
                    disabled
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[var(--tertiary-color)] cursor-not-allowed text-black/80"
                  />
                </div>

                {/* Código interno (A01, A04, etc.) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-black/70">
                    Código interno (cartera)
                  </label>
                  <input
                    type="text"
                    value={codigoTexto}
                    readOnly
                    disabled
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[var(--tertiary-color)] cursor-not-allowed text-black/80"
                    placeholder=""
                  />
                </div>

                {/* Correo */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-black/70">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={perfil?.email ?? ""}
                    readOnly
                    disabled
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[var(--tertiary-color)] cursor-not-allowed text-black/80"
                  />
                </div>

                {/* Cargo / área (Contabilidad, etc.) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-black/70">
                    Cargo / área interna
                  </label>
                  <input
                    type="text"
                    value={cargoTexto}
                    readOnly
                    disabled
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[var(--tertiary-color)] cursor-not-allowed text-black/80"
                  />
                </div>

                {/* Teléfono (placeholder a futuro) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-black/70">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={""}
                    readOnly
                    disabled
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[var(--tertiary-color)] cursor-not-allowed text-black/60 italic"
                    placeholder="No registrado"
                  />
                </div>

                {/* Estado (activo/inactivo) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-black/70">
                    Estado
                  </label>
                  <input
                    type="text"
                    value={perfil?.status ? "Activo" : "Inactivo"}
                    readOnly
                    disabled
                    className="w-full border border-black/10 rounded-lg px-3 py-2 text-sm bg-[var(--tertiary-color)] cursor-not-allowed text-black/80"
                  />
                </div>
              </div>

              {loading === "loading" && (
                <p className="text-xs text-black/50">Cargando perfil...</p>
              )}

              {loading === "success" && !perfil && !error && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  No se encontró información de perfil para este usuario.
                </p>
              )}

              {error && (
                <p className="text-xs text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigurarPage;
