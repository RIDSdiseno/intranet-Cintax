import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";

type DriveFolder = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
};

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  iconLink?: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://localhost:3000";

const currentYear = new Date().getFullYear().toString();

export default function DrivePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [year, setYear] = useState(currentYear);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(
    null
  );

  const [loadingFiles, setLoadingFiles] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);

  const [connecting, setConnecting] = useState(false);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // === helper para obtener el token ===
  function getAccessToken(): string | null {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token")
    );
  }

  // Si viene ?connected=1 desde el callback, marcamos como conectado
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("connected") === "1") {
      setDriveConnected(true);
    }
  }, [location.search]);

  // === Cargar carpetas CINTAX / año ===
  const fetchFolders = async (yearToLoad: string) => {
    try {
      setLoadingFolders(true);
      setError(null);
      setSelectedFolder(null);
      setFiles([]);

      const token = getAccessToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const res = await axios.get(
        `${API_BASE_URL}/drive/cintax/${yearToLoad}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        }
      );

      setFolders(res.data.folders || []);
      setDriveConnected(true);
    } catch (err: any) {
      console.error("Error cargando carpetas:", err);
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error || "Error cargando carpetas de Drive";

      // Si el backend falla porque no hay refresh token / Drive no conectado
      if (status === 400 || status === 500) {
        setDriveConnected(false);
      }

      setError(msg);
    } finally {
      setLoadingFolders(false);
    }
  };

  // === Cargar archivos dentro de una carpeta ===
  const fetchFiles = async (folder: DriveFolder) => {
    try {
      setLoadingFiles(true);
      setError(null);
      setSelectedFolder(folder);

      const token = getAccessToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const res = await axios.get(
        `${API_BASE_URL}/drive/folder/${folder.id}/files`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          withCredentials: true,
        }
      );

      setFiles(res.data.files || []);
    } catch (err: any) {
      console.error("Error cargando archivos:", err);
      const msg =
        err?.response?.data?.error || "Error cargando archivos de Drive";
      setError(msg);
    } finally {
      setLoadingFiles(false);
    }
  };

  // === Conectar Google Drive (flujo OAuth) ===
  const handleConnectDrive = async () => {
    try {
      setConnecting(true);
      setError(null);

      const token = getAccessToken();
      if (!token) {
        navigate("/login");
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/drive/connect`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      });

      const url = res.data.url as string;
      window.location.href = url; // redirige a Google
    } catch (err: any) {
      console.error("Error conectando Drive:", err);
      const msg =
        err?.response?.data?.error || "Error al conectar Google Drive";
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

  // cargar carpetas al entrar a la página
  useEffect(() => {
    fetchFolders(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangeYear = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const y = e.target.value;
    setYear(y);
    fetchFolders(y);
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Google Drive Cintax</h1>
          <p className="text-sm text-slate-400">
            Ruta fija: <span className="font-mono">Mi unidad / CINTAX / {year}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={handleChangeYear}
            className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
          >
            <option value={currentYear}>{currentYear}</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>

          {driveConnected === false && (
            <button
              onClick={handleConnectDrive}
              disabled={connecting}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-60"
            >
              {connecting ? "Conectando..." : "Conectar Google Drive"}
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/60 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* carpetas */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              Carpetas CINTAX / {year}
            </h2>
            {loadingFolders && (
              <span className="text-xs text-slate-400">Cargando...</span>
            )}
          </div>

          {folders.length === 0 && !loadingFolders ? (
            <p className="text-sm text-slate-500">
              No se encontraron carpetas. Si es la primera vez, conecta tu
              Google Drive.
            </p>
          ) : (
            <ul className="space-y-1">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <button
                    onClick={() => fetchFiles(folder)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-800/80 ${
                      selectedFolder?.id === folder.id ? "bg-slate-800/80" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>📁</span>
                      <span>{folder.name}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {folder.modifiedTime
                        ? new Date(folder.modifiedTime).toLocaleDateString()
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* archivos */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              {selectedFolder
                ? `Archivos en: ${selectedFolder.name}`
                : "Selecciona una carpeta"}
            </h2>
            {loadingFiles && (
              <span className="text-xs text-slate-400">Cargando...</span>
            )}
          </div>

          {!selectedFolder && (
            <p className="text-sm text-slate-500">
              Haz clic en una carpeta a la izquierda para ver sus archivos.
            </p>
          )}

          {selectedFolder && files.length === 0 && !loadingFiles && (
            <p className="text-sm text-slate-500">
              Esta carpeta no tiene archivos.
            </p>
          )}

          {selectedFolder && files.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-2 py-2">Nombre</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Modificado</th>
                    <th className="px-2 py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr
                      key={file.id}
                      className="border-b border-slate-900/60 last:border-0"
                    >
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span>📄</span>
                          <span>{file.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-400">
                        {file.mimeType}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-400">
                        {file.modifiedTime
                          ? new Date(file.modifiedTime).toLocaleString()
                          : ""}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-slate-800 px-3 py-1 text-xs text-emerald-300 hover:bg-slate-700"
                          >
                            Abrir
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
