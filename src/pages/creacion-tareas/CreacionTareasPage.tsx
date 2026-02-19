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
  Upload,
  X,
  FileSpreadsheet,
  CheckCircle2,
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
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) || "http://localhost:3000/api";

type ExcelResponse = {
  ok: boolean;
  sheet?: string;
  requested?: number;
  created?: number;
  skipped?: number;
  results?: any[];
  error?: string;
  message?: string;
  note?: string | null;
};

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

  const normalizeTrabajador = (t: TrabajadorAPI): Trabajador => {
    const id = Number((t as any).id_trabajador ?? (t as any).id ?? (t as any).trabajadorId);
    const nombre = String((t as any).nombre ?? (t as any).name ?? "");
    const email = String((t as any).email ?? "");

    const carpetaDriveCodigoRaw =
      (t as any).carpetaDriveCodigo ??
      (t as any).codigoCartera ??
      (t as any).carteraCodigo ??
      (t as any).carpeta_drive_codigo ??
      null;

    const carpetaDriveCodigo =
      typeof carpetaDriveCodigoRaw === "string" && carpetaDriveCodigoRaw.trim()
        ? carpetaDriveCodigoRaw.trim()
        : null;

    const areaInternaRaw = (t as any).areaInterna ?? null;
    const areaInterna =
      typeof areaInternaRaw === "string" && areaInternaRaw.trim() ? areaInternaRaw.trim() : null;

    return { id_trabajador: id, nombre, email, carpetaDriveCodigo, areaInterna };
  };

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
        .map(normalizeTrabajador)
        .filter((t) => Number.isFinite(t.id_trabajador) && t.id_trabajador > 0 && t.nombre.trim().length > 0);

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
  // Excel uploader state (minimal)
  // -----------------------------
  const [excelOpen, setExcelOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);

  const [excelLoading, setExcelLoading] = useState(false);
  const [excelErr, setExcelErr] = useState<string | null>(null);
  const [excelResp, setExcelResp] = useState<ExcelResponse | null>(null);

  const resetExcelModal = () => {
    setExcelFile(null);
    setExcelErr(null);
    setExcelResp(null);
  };

  const openExcel = () => {
    resetExcelModal();
    setExcelOpen(true);
  };

  const closeExcel = () => {
    setExcelOpen(false);
  };

  const submitExcel = async () => {
    setExcelErr(null);
    setExcelResp(null);

    if (!excelFile) {
      setExcelErr("Selecciona un archivo .xlsx primero.");
      return;
    }

    // ✅ Minimal query: solo skipDuplicates=true
    const qs = new URLSearchParams();
    qs.set("skipDuplicates", "true");

    const url = `${API_BASE_URL}/tareas/masivo/excel?${qs.toString()}`;

    const fd = new FormData();
    fd.append("archivo", excelFile);

    setExcelLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          // No setear Content-Type en multipart: lo pone el browser
        } as any,
        body: fd,
      });

      const data: ExcelResponse = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        setExcelResp(data);
        setExcelErr(data?.error || data?.message || `Error ${res.status}`);
        return;
      }

      setExcelResp(data);
    } catch (e: any) {
      console.error("[Excel] Error subiendo archivo", e);
      setExcelErr("No se pudo subir el Excel (error de red o servidor).");
    } finally {
      setExcelLoading(false);
    }
  };

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
          <div className="min-w-0 flex-1">
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
                Clientes: <b>{canManageClientes ? "edición habilitada" : "solo lectura"}</b>
              </span>
            </div>
          </div>

          {/* Excel button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openExcel}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
              title="Subir Excel para crear/asignar tareas masivamente"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Subir Excel
            </button>
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
        <ClientesTab API_BASE_URL={API_BASE_URL} role={role} roleLoading={roleLoading} trabajadores={trabajadores} />
      )}

      {tab === "tareas" && <PlantillasTab API_BASE_URL={API_BASE_URL} />}

      {tab === "asignaciones" && <AsignarManualTab API_BASE_URL={API_BASE_URL} trabajadores={trabajadores} />}

      {tab === "edicion" && <EdicionEjecutivoTab API_BASE_URL={API_BASE_URL} trabajadores={trabajadores} />}

      {/* Excel Modal (Cintax / minimal) */}
      {excelOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={closeExcel} />

          <div className="absolute left-1/2 top-1/2 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 -translate-y-1/2">
            <div className="bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden">
              {/* header */}
              <div className="px-5 py-4 border-b border-black/5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-black/[0.06] flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-black/70" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-black/80">Carga masiva desde Excel</div>
                    <div className="text-[11px] text-black/50">
                      Sube un archivo <span className="font-mono">.xlsx</span> para crear/asignar tareas.
                    </div>
                    <div className="mt-1 text-[10px] text-black/40">
                      Endpoint: <span className="font-mono">POST /tareas/masivo/excel</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeExcel}
                  className="p-2 rounded-xl hover:bg-black/[0.06] text-black/60"
                  title="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* body */}
              <div className="px-5 py-4 flex flex-col gap-4">
                {/* uploader */}
                <div className="rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-black/75">Archivo Excel</div>
                    <div className="text-[11px] text-black/50">
                      Formato permitido: <span className="font-mono">.xlsx</span> (o .xls)
                    </div>
                  </div>

                  <div className="mt-3">
                    <label className="block">
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setExcelFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-[12px]
                          file:mr-3 file:rounded-xl file:border-0
                          file:bg-black/80 file:text-white file:px-4 file:py-2
                          hover:file:bg-black/90 cursor-pointer"
                      />
                    </label>

                    {excelFile ? (
                      <div className="mt-2 text-[11px] text-black/55">
                        Seleccionado: <span className="font-mono text-black/70">{excelFile.name}</span>
                      </div>
                    ) : (
                      <div className="mt-2 text-[11px] text-black/45">No hay archivo seleccionado.</div>
                    )}
                  </div>
                </div>

                {/* Error */}
                {excelErr && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5" />
                    <div className="min-w-0">{excelErr}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetExcelModal}
                    disabled={excelLoading}
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold border border-black/10 bg-white text-black/70 hover:bg-black/[0.04] disabled:opacity-50"
                  >
                    Limpiar
                  </button>

                  <button
                    type="button"
                    onClick={submitExcel}
                    disabled={excelLoading || !excelFile}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold
                      border border-black/10 bg-black/80 text-white hover:bg-black/90
                      disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!excelFile ? "Selecciona un archivo primero" : "Subir y procesar"}
                  >
                    {excelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Subir y procesar
                  </button>
                </div>

                {/* Result */}
                {excelResp && (
                  <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-black/75">
                      <CheckCircle2 className="w-4 h-4" />
                      Resultado
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[12px]">
                      <div className="rounded-xl bg-black/[0.03] p-2">
                        <div className="text-black/45 text-[10px]">Sheet</div>
                        <div className="font-mono text-black/75">{excelResp.sheet ?? "-"}</div>
                      </div>
                      <div className="rounded-xl bg-black/[0.03] p-2">
                        <div className="text-black/45 text-[10px]">Requested</div>
                        <div className="font-mono text-black/75">{excelResp.requested ?? "-"}</div>
                      </div>
                      <div className="rounded-xl bg-black/[0.03] p-2">
                        <div className="text-black/45 text-[10px]">Created</div>
                        <div className="font-mono text-black/75">{excelResp.created ?? "-"}</div>
                      </div>
                      <div className="rounded-xl bg-black/[0.03] p-2">
                        <div className="text-black/45 text-[10px]">Skipped</div>
                        <div className="font-mono text-black/75">{excelResp.skipped ?? "-"}</div>
                      </div>
                    </div>

                    {excelResp.note && <div className="mt-2 text-[11px] text-black/55">{excelResp.note}</div>}

                    {Array.isArray(excelResp.results) && excelResp.results.length > 0 && (
                      <div className="mt-4">
                        <div className="text-[11px] font-semibold text-black/70">Detalle por fila</div>

                        <div className="mt-2 max-h-[240px] overflow-auto rounded-2xl border border-black/5">
                          <table className="w-full text-[11px]">
                            <thead className="sticky top-0 bg-white border-b border-black/5">
                              <tr className="text-left text-black/50">
                                <th className="p-2">Fila</th>
                                <th className="p-2">RUT</th>
                                <th className="p-2">Estado</th>
                                <th className="p-2">Detalle</th>
                              </tr>
                            </thead>
                            <tbody>
                              {excelResp.results.slice(0, 200).map((r: any, i: number) => {
                                const row = r?.row ?? "-";
                                const rut = r?.rut ?? "-";
                                const isErr = typeof r?.error === "string" && r.error.length > 0;
                                const detail = isErr
                                  ? r.error
                                  : Array.isArray(r?.errors) && r.errors.length
                                  ? r.errors.join(" | ")
                                  : `tareas: ${r?.tareasRequested ?? "-"} (aprox)`;

                                return (
                                  <tr key={i} className="border-b border-black/5">
                                    <td className="p-2 font-mono">{row}</td>
                                    <td className="p-2 font-mono">{rut}</td>
                                    <td className="p-2">
                                      {isErr ? (
                                        <span className="text-rose-700">ERROR</span>
                                      ) : (
                                        <span className="text-black/70">OK</span>
                                      )}
                                    </td>
                                    <td className="p-2 text-black/70">{detail}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {excelResp.results.length > 200 && (
                          <div className="mt-1 text-[10px] text-black/45">Mostrando primeras 200 filas.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreacionTareasPage;
