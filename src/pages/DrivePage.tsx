import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Cloud,
  CloudOff,
  Folder as FolderIcon,
  FileText,
  Loader2,
  ExternalLink,
  ChevronRight,
  Upload,
} from "lucide-react";

type DriveFolder = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  categoria?: string | null;
  pathNames?: string[];   // ← viene del backend
  pathString?: string;    // ← "CINTAX / 2025 / CONTA / A01"
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
const YEARS = [currentYear, currentYear + 1].map(String); // ['2025', '2026']

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** === Traductor de mimeType a tipo legible === */
function getFileTypeLabel(mimeType: string, isFolder: boolean): string {
  if (isFolder) return "Carpeta";
  if (!mimeType) return "Archivo";

  // Google Docs / Sheets / Slides
  if (mimeType === "application/vnd.google-apps.document")
    return "Documento (Google Docs)";
  if (mimeType === "application/vnd.google-apps.spreadsheet")
    return "Hoja de cálculo (Sheets)";
  if (mimeType === "application/vnd.google-apps.presentation")
    return "Presentación (Slides)";

  // Office
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  )
    return "Documento Word";

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel"
  )
    return "Hoja de cálculo Excel";

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    mimeType === "application/vnd.ms-powerpoint"
  )
    return "Presentación PowerPoint";

  // Otros tipos comunes
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "Imagen";
  if (mimeType.startsWith("video/")) return "Video";
  if (mimeType.startsWith("audio/")) return "Audio";
  if (
    mimeType === "application/zip" ||
    mimeType === "application/x-zip-compressed"
  )
    return "Archivo ZIP";

  // Fallback: mostramos el mimeType crudo
  return mimeType;
}

export default function DrivePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [year, setYear] = useState(currentYear);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(
    null
  );
  const [noAccess, setNoAccess] = useState(false);


  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);

  const [connecting, setConnecting] = useState(false);
  const [driveConnected, setDriveConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // pila de carpetas abiertas para breadcrumb: CINTAX / año / CONTA / A01 / ...
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>(
    []
  );

  // === helper para obtener el token ===
  function getAccessToken(): string | null {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token")
    );
  }

  const isFolder = (mime: string) => mime === FOLDER_MIME;

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
      setFolderPath([]); // limpiamos breadcrumb al cambiar de año

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

      if (status === 400 || status === 500) {
        setDriveConnected(false);
      }

      setError(msg);
    } finally {
      setLoadingFolders(false);
    }
  };

  // === Cargar archivos dentro de una carpeta (por id) ===
  const fetchFiles = async (folderId: string, folderName: string) => {
  try {
    setLoadingFiles(true);
    setError(null);
    setNoAccess(false);

    setSelectedFolder({
      id: folderId,
      name: folderName,
      mimeType: FOLDER_MIME,
    } as DriveFolder);

    const token = getAccessToken();
    if (!token) {
      navigate("/login");
      return;
    }

    const res = await axios.get(
      `${API_BASE_URL}/drive/folder/${folderId}/files`,
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
    const status = err?.response?.status;
    const msg =
      err?.response?.data?.error || "Error cargando archivos de Drive";

    if (status === 403) {
      // 👇 sin permisos sobre esta carpeta
      setNoAccess(true);
      setFiles([]);
    } else {
      setError(msg);
    }
  } finally {
    setLoadingFiles(false);
  }
};

  // Abre una carpeta y actualiza la ruta (breadcrumb)
  const openFolder = async (
    folder: { id: string; name: string },
    resetPath: boolean
  ) => {
    if (resetPath) {
      setFolderPath([{ id: folder.id, name: folder.name }]);
    } else {
      setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    }
    await fetchFiles(folder.id, folder.name);
  };

  // Clic en breadcrumb para volver hacia atrás
  const handleBreadcrumbClick = async (index: number) => {
    const node = folderPath[index];
    setFolderPath((prev) => prev.slice(0, index + 1));
    await fetchFiles(node.id, node.name);
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
  try {
    if (!selectedFolder) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const token = getAccessToken();
    if (!token) {
      navigate("/login");
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    await axios.post(
      `${API_BASE_URL}/drive/folder/${selectedFolder.id}/upload`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      }
    );

    // recargar el contenido de la carpeta actual
    await fetchFiles(selectedFolder.id, selectedFolder.name);
  } catch (err: any) {
    console.error("Error subiendo archivo:", err);
    const msg =
      err?.response?.data?.error || "Error subiendo archivo a Drive";
    setError(msg);
  } finally {
    setUploading(false);
    // limpiar el input para poder subir el mismo archivo otra vez si se quiere
    e.target.value = "";
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

  const isLoading = loadingFolders || loadingFiles;
  const canUpload = Boolean(selectedFolder && driveConnected && !noAccess);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">
          Google Drive <span className="text-[var(--secondary-color)]">Cintax</span>
        </h1>
        <p className="text-sm text-black/60">
          Acceso directo a la estructura compartida de la empresa.
        </p>
      </header>

      {/* CARD DE ESTADO / FILTROS */}
      <section className="rounded-2xl bg-white border border-black/5 shadow-sm px-4 py-4 md:px-6 md:py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-[var(--tertiary-color)] p-2 text-[var(--secondary-color)]">
            {driveConnected ? <Cloud size={20} /> : <CloudOff size={20} />}
          </div>
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--primary-color)" }}
            >
              {driveConnected
                ? "Conectado a Google Drive"
                : "Google Drive no conectado"}
            </p>
            <p className="text-xs text-black/55 mt-1">
              Ruta base:&nbsp;
              <span className="font-mono">
                Mi unidad / CINTAX / {year}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
  value={year}
  onChange={handleChangeYear}
  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/40"
>
  {YEARS.map((y) => (
    <option key={y} value={y}>
      {y}
    </option>
  ))}
</select>


          {!driveConnected && (
            <button
              onClick={handleConnectDrive}
              disabled={connecting}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--secondary-color)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {connecting ? "Conectando…" : "Conectar Google Drive"}
            </button>
          )}

          {driveConnected && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Sincronizado
            </span>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {/* GRID PRINCIPAL */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,38%),minmax(0,62%)]">
        {/* LISTA DE CARPETAS (nivel CINTAX / año) */}
        <section className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 md:p-5 flex flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-black/70">
              Carpetas CINTAX / {year}
            </h2>
            {loadingFolders && (
              <span className="inline-flex items-center gap-1 text-[11px] text-black/50">
                <Loader2 className="h-3 w-3 animate-spin" />
                Cargando…
              </span>
            )}
          </div>

          {driveConnected === false && (
            <div className="mt-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-800">
              Para ver las carpetas compartidas, primero debes conectar tu
              Google Drive.
            </div>
          )}

          {folders.length === 0 && !loadingFolders && driveConnected && (
            <p className="text-sm text-black/50">
              No se encontraron carpetas en{" "}
              <span className="font-mono">CINTAX / {year}</span>.
            </p>
          )}

          {folders.length > 0 && (
  <ul className="mt-1 space-y-1">
    {folders.map((folder) => {
      const isActive = selectedFolder?.id === folder.id;
      return (
        <li key={folder.id}>
          <button
            onClick={() =>
              openFolder(
                {
                  id: folder.id,
                  name: folder.name,
                  // le pasamos también la ruta completa (si está)
                },
                true
              )
            }
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
              isActive
                ? "bg-[var(--primary-color)] text-white shadow-sm"
                : "hover:bg-black/5 text-black/80"
            }`}
          >
            <span className="flex flex-col gap-0.5 min-w-0">
              <span className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${
                    isActive
                      ? "border-white/20 bg-white/10"
                      : "border-black/10 bg-[var(--tertiary-color)] text-[var(--secondary-color)]"
                  }`}
                >
                  <FolderIcon size={16} />
                </span>
                <span className="truncate font-medium">
                  {folder.name}
                </span>
              </span>

              {/* Ruta completa */}
              <span
                className={`text-[11px] truncate ${
                  isActive ? "text-white/80" : "text-black/45"
                }`}
              >
                {folder.pathString
                  ? folder.pathString
                  : `CINTAX / ${year} / ${folder.categoria ?? ""} / ${
                      folder.name
                    }`}
              </span>
            </span>

            <span
              className={`text-[11px] ${
                isActive ? "text-white/70" : "text-black/45"
              }`}
            >
              {folder.modifiedTime
                ? new Date(folder.modifiedTime).toLocaleDateString()
                : ""}
            </span>
          </button>
        </li>
      );
    })}
  </ul>
)}

        </section>

        {/* LISTA DE ARCHIVOS / SUBCARPETAS */}
      <section className="rounded-2xl bg-white border border-black/5 shadow-sm p-4 md:p-5 flex flex-col min-h-[260px]">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-black/70">
              {selectedFolder
                ? `Contenido de: ${selectedFolder.name}`
                : "Selecciona una carpeta"}
            </h2>

            {/* Breadcrumb de ruta actual (Tu código existente) */}
            {folderPath.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[11px] text-black/50">
                <span className="font-mono">CINTAX / {year}</span>
                {folderPath.map((node, idx) => (
                  <React.Fragment key={node.id}>
                    <ChevronRight size={12} />
                    <button
                      type="button"
                      onClick={() =>
                        idx === folderPath.length - 1
                          ? null
                          : handleBreadcrumbClick(idx)
                      }
                      className={
                        idx === folderPath.length - 1
                          ? "font-medium text-black/70 cursor-default"
                          : "hover:text-[var(--secondary-color)]"
                      }
                    >
                      {node.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* === ZONA DE ACCIONES (Spinner de carga y Botón de Subir) === */}
          <div className="flex items-center gap-3">
            {loadingFiles && (
              <span className="inline-flex items-center gap-1 text-[11px] text-black/50">
                <Loader2 className="h-3 w-3 animate-spin" />
                Cargando…
              </span>
            )}

            {/* Solo mostramos el botón subir si hay una carpeta seleccionada y drive está conectado */}
            {canUpload && (
  <>
    <input
      type="file"
      ref={fileInputRef}
      onChange={handleUploadFile}
      className="hidden"
    />
    <button
      onClick={() => fileInputRef.current?.click()}
      disabled={uploading || loadingFiles}
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--secondary-color)] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black hover:shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
    >
      {uploading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Upload size={14} />
      )}
      {uploading ? "Subiendo..." : "Subir archivo"}
    </button>
  </>
)}

          </div>
        </div>

        {/* ... El resto de tu tabla de archivos ... */}

          {!selectedFolder && (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-black/50">
                Haz clic en una carpeta de la izquierda para ver sus archivos
                y subcarpetas.
              </p>
            </div>
          )}

          {selectedFolder && noAccess && !loadingFiles && (
  <div className="flex flex-1 items-center justify-center">
    <p className="text-sm text-black/50 text-center max-w-sm">
      No tienes permisos para ver el contenido de esta carpeta.
      <br />
      Si crees que es un error, contacta al administrador de la intranet.
    </p>
  </div>
)}

{selectedFolder && !noAccess && files.length === 0 && !loadingFiles && (
  <div className="flex flex-1 items-center justify-center">
    <p className="text-sm text-black/50">
      Esta carpeta no tiene contenido.
    </p>
  </div>
)}

          {selectedFolder && files.length > 0 && (
            <div className="overflow-x-auto mt-1">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-black/5 text-[11px] uppercase tracking-wide text-black/50">
                    <th className="px-2 py-2">Nombre</th>
                    <th className="px-2 py-2">Tipo</th>
                    <th className="px-2 py-2">Modificado</th>
                    <th className="px-2 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => {
                    const folderLike = isFolder(file.mimeType);
                    const typeLabel = getFileTypeLabel(
                      file.mimeType,
                      folderLike
                    );

                    return (
                      <tr
                        key={file.id}
                        className="border-b border-black/5 last:border-0"
                      >
                        {/* Nombre + icono */}
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              folderLike
                                ? openFolder(
                                    { id: file.id, name: file.name },
                                    false
                                  )
                                : undefined
                            }
                            className={`flex w-full items-center gap-2 text-left ${
                              folderLike
                                ? "hover:text-[var(--secondary-color)]"
                                : ""
                            }`}
                          >
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--tertiary-color)] text-[var(--secondary-color)]">
                              {folderLike ? (
                                <FolderIcon size={15} />
                              ) : (
                                <FileText size={15} />
                              )}
                            </span>
                            <span className="truncate">{file.name}</span>
                          </button>
                        </td>

                        {/* Tipo amigable */}
                        <td className="px-2 py-2 text-xs text-black/50">
                          {typeLabel}
                        </td>

                        {/* Fecha */}
                        <td className="px-2 py-2 text-xs text-black/50">
                          {file.modifiedTime
                            ? new Date(file.modifiedTime).toLocaleString()
                            : ""}
                        </td>

                        {/* Acciones */}
                        <td className="px-2 py-2 text-xs text-right space-x-2">
                          {folderLike && (
                            <button
                              type="button"
                              onClick={() =>
                                openFolder(
                                  { id: file.id, name: file.name },
                                  false
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-[11px] font-medium text-black/70 hover:bg-black/10"
                            >
                              Ver dentro
                            </button>
                          )}

                          {!folderLike && file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-color)] px-3 py-1 text-[11px] font-medium text-white hover:bg-black"
                            >
                              <ExternalLink size={12} />
                              Abrir
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {isLoading && (
        <p className="text-[11px] text-black/40">
          Actualizando contenido desde Google Drive…
        </p>
      )}
    </div>
  );
}
