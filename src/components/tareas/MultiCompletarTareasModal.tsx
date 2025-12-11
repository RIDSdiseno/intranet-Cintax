// src/components/tareas/MultiCompletarTareasModal.tsx
import React, { useState, useEffect } from "react";
import type { TareaAsignada } from "./tiposTareas";
import {
  CheckCircle2,
  UploadCloud,
  AlertTriangle,
  FileText,
} from "lucide-react";

type MultiCompletarTareasModalProps = {
  open: boolean;
  tareas: TareaAsignada[];
  filesMap: Record<number, File | null>;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onFileChange: (tareaId: number, file: File | null) => void;
  // el padre decide si, además de completar, hay que enviar correo
  onConfirm: (sendEmail: boolean) => void;
  getRazonSocial: (rut?: string | null) => string | null;
  formatFecha: (iso?: string | null) => string;
  // 👉 nuevos flags
  enableSmartAttach?: boolean;
  enableSendEmail?: boolean;
};

// Normaliza texto: minúsculas, sin acentos, sin extensión y sin símbolos raros
const normalizeText = (text: string | null | undefined): string => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};

const areTokensSimilar = (a: string, b: string): boolean => {
  if (!a || !b) return false;
  const lenA = a.length;
  const lenB = b.length;
  const maxLen = Math.max(lenA, lenB);
  const minLen = Math.min(lenA, lenB);

  if (Math.abs(lenA - lenB) > 2) return false;

  let matches = 0;
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }

  const similarity = matches / maxLen;
  return similarity >= 0.7;
};

const MultiCompletarTareasModal: React.FC<MultiCompletarTareasModalProps> = ({
  open,
  tareas,
  filesMap,
  isSubmitting,
  errorMessage,
  onClose,
  onFileChange,
  onConfirm,
  getRazonSocial,
  formatFecha,
  enableSmartAttach = true,
  enableSendEmail = true,
}) => {
  const [hasBulkAssigned, setHasBulkAssigned] = useState(false);
  const [showConfirmStep, setShowConfirmStep] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  useEffect(() => {
    if (!open) {
      setHasBulkAssigned(false);
      setShowConfirmStep(false);
      setSendEmail(false);
    }
  }, [open]);

  if (!open) return null;

  const totalConArchivo = tareas.filter(
    (t) => filesMap[t.id_tarea_asignada]
  ).length;

  const handleClose = () => {
    setShowConfirmStep(false);
    onClose();
  };

  const handlePrimaryClick = () => {
    if (!showConfirmStep) {
      setShowConfirmStep(true);
      return;
    }
    // si el envío de correo viene deshabilitado desde el padre, siempre false
    onConfirm(enableSendEmail ? sendEmail : false);
  };

  const handleBulkFilesChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const fileList = e.target.files;
    if (!fileList || !fileList.length) return;

    const files = Array.from(fileList);
    const tareasRestantes = new Set<number>(
      tareas.map((t) => t.id_tarea_asignada)
    );

    const tareasConClave = tareas.map((t) => {
      const nombre = normalizeText(t.tareaPlantilla?.nombre ?? "");
      const codigo = normalizeText(t.tareaPlantilla?.codigoDocumento ?? "");
      const clave = `${codigo} ${nombre}`.trim();
      const tokens = clave.split(" ").filter(Boolean);
      return {
        id: t.id_tarea_asignada,
        clave,
        tokens,
      };
    });

    const filesMatched = new Set<number>();

    // 1) Match inteligente por nombre
    files.forEach((file, fileIdx) => {
      const fileNameNorm = normalizeText(file.name);
      const fileTokens = fileNameNorm.split(" ").filter(Boolean);

      let mejorTareaId: number | null = null;
      let mejorScore = 0;

      tareasConClave.forEach((tInfo) => {
        if (!tareasRestantes.has(tInfo.id)) return;
        if (!tInfo.clave) return;

        let score = 0;

        if (fileNameNorm.includes(tInfo.clave)) {
          score += 3;
        }

        tInfo.tokens.forEach((tk) => {
          if (!tk) return;
          if (fileTokens.some((ft) => ft === tk)) {
            score += 2;
          } else if (fileTokens.some((ft) => areTokensSimilar(ft, tk))) {
            score += 1;
          }
        });

        if (score > mejorScore) {
          mejorScore = score;
          mejorTareaId = tInfo.id;
        }
      });

      if (mejorTareaId && mejorScore > 0) {
        onFileChange(mejorTareaId, file);
        tareasRestantes.delete(mejorTareaId);
        filesMatched.add(fileIdx);
      }
    });

    // 2) Fallback: asignar por orden a las tareas que queden
    const tareasRestantesArray = tareas.filter((t) =>
      tareasRestantes.has(t.id_tarea_asignada)
    );

    let idxTarea = 0;
    files.forEach((file, fileIdx) => {
      if (filesMatched.has(fileIdx)) return;

      const t = tareasRestantesArray[idxTarea];
      if (!t) return;

      onFileChange(t.id_tarea_asignada, file);
      idxTarea++;
    });

    setHasBulkAssigned(true);
  };

  const primaryDisabled = isSubmitting || tareas.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm px-2 sm:px-4">
      <div
        className="
          bg-white rounded-2xl shadow-2xl
          w-full 
          h-[95vh] sm:h-auto
          max-h-[95vh] sm:max-h-[90vh]
          max-w-5xl
          flex flex-col border border-black/10
          transform-gpu transition-all duration-200 ease-out scale-100
        "
        style={{
          boxShadow:
            "0 26px 60px rgba(0,0,0,0.22), 0 12px 28px rgba(0,0,0,0.12)",
        }}
      >
        {/* HEADER */}
        <header
          className="
            px-4 sm:px-5 py-3.5 sm:py-4 
            border-b border-black/10 rounded-t-2xl 
            flex items-start justify-between gap-3
          "
          style={{
            background:
              "linear-gradient(135deg, #050816, #1d1302, #7c4a00)",
          }}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 flex items-center justify-center w-9 h-9 rounded-xl bg-black/40 border border-amber-400/50 shadow-inner">
              <CheckCircle2 className="w-4 h-4 text-amber-300" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap.items-center gap-2">
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                  CINTAX · Task Closing
                </span>
                <span className="text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full bg-black/35 text-amber-100 border border-amber-400/40">
                  Lote de {tareas.length || 0} tarea(s)
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-semibold leading-tight text-white">
                Completar tareas
              </h3>
              <p className="text-[10px] sm:text-[11px] text-amber-50/80 leading-snug max-w-xl">
                Sube todos los archivos de respaldo tributario/contable en un
                paso. El sistema los vincula por nombre y código, y tú solamente
                validas antes de marcar como <strong>Completadas</strong>.
              </p>
              <div className="flex flex-wrap gap-2 mt-1 text-[9px] sm:text-[10px] text-amber-50/90">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-300/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                  {totalConArchivo} de {tareas.length} tareas con archivo
                </span>
                {tareas.length > 0 && totalConArchivo < tareas.length && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-300/80 text-amber-50">
                    <AlertTriangle className="w-3 h-3" />
                    Faltan archivos en{" "}
                    <strong className="font-semibold">
                      {tareas.length - totalConArchivo}
                    </strong>{" "}
                    tarea(s)
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-[10px] sm:text-[11px] px-2.5 py-1.5 rounded-md border border-amber-300/40 bg-black/30 text-amber-50 hover:bg-black/20 hover:text-white transition-colors disabled:opacity-40"
          >
            Cerrar
          </button>
        </header>

        {/* CARGA MASIVA (solo si enableSmartAttach) */}
        {enableSmartAttach && (
          <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-black/5 bg-gradient-to-b from-amber-50/80 via-white to-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="space-y-0.5">
                <p className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                  Carga masiva de respaldos
                </p>
                <p className="text-[10px] text-black/70 leading-snug max-w-md">
                  Usa nombres parecidos al código o nombre de la tarea. Ejemplo:{" "}
                  <span className="italic">
                    “A01 - Confeccion y envio F29 dic-2025.pdf”
                  </span>{" "}
                  o{" "}
                  <span className="italic">
                    “Analisis cuentas por cobrar - 2025-12.xlsx”.
                  </span>
                </p>
              </div>

              <label
                className={`group relative flex items-center gap-2 rounded-xl px-3 py-2 border cursor-pointer text-[10px] sm:text-[11px] shadow-sm hover:shadow-md transition-all ${
                  isSubmitting || tareas.length === 0
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:-translate-y-0.5"
                }`}
                style={{
                  borderColor: "rgba(180, 83, 9, 0.45)",
                  background:
                    "linear-gradient(135deg, #fffaf3, #fef3c7, #fef9c3)",
                }}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100/80 border border-amber-300/70">
                  <UploadCloud className="w-4 h-4 text-amber-800" />
                </div>
                <div className="flex flex-col.leading-tight">
                  <span className="font-semibold text-amber-900">
                    Seleccionar múltiples archivos
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-amber-800/90">
                    El motor CINTAX intentará vincularlos automáticamente por
                    nombre.
                  </span>
                </div>
                <input
                  type="file"
                  multiple
                  disabled={isSubmitting || tareas.length === 0}
                  onChange={handleBulkFilesChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
            </div>

            {hasBulkAssigned && (
              <div className="mt-2 text-[9px] sm:text-[10px] text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  Archivos asignados automáticamente a varias tareas. Revisa y
                  ajusta antes de confirmar el cierre dorado del período.
                </span>
              </div>
            )}
          </div>
        )}

        {/* LISTA DE TAREAS */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3 bg-white">
          {tareas.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="w-6 h-6 text-black/25 mb-2" />
              <p className="text-[12px] text-black/60">
                No hay tareas seleccionadas para completar.
              </p>
            </div>
          )}

          {tareas.length > 0 && (
            <ul className="space-y-3">
              {tareas.map((t) => {
                const razon = getRazonSocial(t.rutCliente) ?? "";
                const file = filesMap[t.id_tarea_asignada] ?? null;
                const inputId = `file-input-${t.id_tarea_asignada}`;
                const hasFile = !!file;

                return (
                  <li
                    key={t.id_tarea_asignada}
                    className="rounded-xl px-3.5 py-2.5 text-[10px] sm:text-[11px] transition-all duration-150 ease-out transform-gpu hover:-translate-y-0.5 hover:shadow-md bg-gradient-to-br from-white via-amber-50/40 to-slate-50"
                    style={{
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: hasFile
                        ? "rgba(245, 158, 11, 0.75)"
                        : "rgba(0,0,0,0.08)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-mono text-[10px] text-black/70">
                            {t.rutCliente}
                          </span>
                          {razon && (
                            <span className="text-[10px] text-black/60">
                              — {razon}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-black/85">
                          {t.tareaPlantilla?.codigoDocumento && (
                            <span className="font-mono text-[10px] text-amber-900 mr-1.5 inline-flex items-center bg-amber-100 px-1.5 py-0.5 rounded-md border border-amber-200">
                              {t.tareaPlantilla.codigoDocumento}
                            </span>
                          )}
                          {t.tareaPlantilla?.nombre ?? "Tarea contable"}
                        </p>
                        <p className="text-[10px] text-black/60">
                          Programada: {formatFecha(t.fechaProgramada)}
                        </p>
                      </div>

                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border"
                        style={{
                          backgroundColor: hasFile
                            ? "rgba(16,185,129,0.06)"
                            : "rgba(248,113,113,0.06)",
                          borderColor: hasFile
                            ? "rgba(16,185,129,0.40)"
                            : "rgba(248,113,113,0.45)",
                          color: hasFile ? "rgb(4,120,87)" : "rgb(185,28,28)",
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full mr-1"
                          style={{
                            backgroundColor: hasFile
                              ? "rgb(16,185,129)"
                              : "rgb(248,113,113)",
                          }}
                        />
                        {hasFile ? "Archivo asignado" : "Sin archivo"}
                      </span>
                    </div>

                    <div className="mt-1.5">
                      {hasBulkAssigned && file ? (
                        <>
                          <p className="text-[10px] text-emerald-800 mb-1">
                            Archivo actual:{" "}
                            <span className="font-medium break-all">
                              {file.name}
                            </span>
                          </p>
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={inputId}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] cursor-pointer transition-colors bg-white hover:bg-amber-50/70"
                              style={{
                                borderColor: "rgba(245, 158, 11, 0.8)",
                                color: "#92400e",
                              }}
                            >
                              <UploadCloud className="w-3 h-3" />
                              Cambiar archivo
                            </label>
                            <span className="text-[10px] text-black/40">
                              (opcional)
                            </span>
                          </div>
                          <input
                            id={inputId}
                            type="file"
                            disabled={isSubmitting}
                            onChange={(e) =>
                              onFileChange(
                                t.id_tarea_asignada,
                                e.target.files?.[0] ?? null
                              )
                            }
                            className="hidden"
                          />
                        </>
                      ) : (
                        <>
                          <label className="block text-[10px] font-semibold text-amber-900 mb-1">
                            {hasBulkAssigned
                              ? "Archivo para esta tarea (ajuste manual)"
                              : "Archivo para esta tarea"}
                          </label>
                          <input
                            id={inputId}
                            type="file"
                            disabled={isSubmitting}
                            onChange={(e) =>
                              onFileChange(
                                t.id_tarea_asignada,
                                e.target.files?.[0] ?? null
                              )
                            }
                            className="block w-full text-[10px] border rounded-lg px-2 py-1 file:text-[10px] file:px-2 file:py-1 file:border-0 file:bg-amber-50 file:mr-2 cursor-pointer transition focus:outline-none focus:ring-1 focus:ring-amber-500/80"
                            style={{ borderColor: "rgba(0,0,0,0.18)" }}
                          />
                          {file && (
                            <p className="mt-1 text-[10px] text-emerald-700">
                              Seleccionado:{" "}
                              <span className="font-medium break-all">
                                {file.name}
                              </span>
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ERROR */}
        {errorMessage && (
          <div className="px-4 sm:px-5 py-2 text-[10px] sm:text-[11px] text-rose-700 bg-rose-50 border-t border-rose-100 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-[2px]" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* CONFIRMACIÓN EXTRA */}
        {showConfirmStep && (
          <div className="px-4 sm:px-5 py-2 text-[10px] sm:text-[11px] text-amber-900 bg-amber-50 border-t border-amber-100 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-[2px]" />
            <span>
              ¿Confirmas subir estos archivos y marcar todas las tareas como{" "}
              <strong>Completadas</strong> en CINTAX? Esta acción no puede
              deshacerse y quedará como cierre dorado del período.
            </span>
          </div>
        )}

        {/* FOOTER */}
        <footer
          className="px-4 sm:px-5 py-3 border-t border-black/10 rounded-b-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3"
          style={{
            background:
              "linear-gradient(90deg, #fffbeb, #fef3c7, #fff7ed)",
          }}
        >
          <div className="flex flex-col gap-1">
            <div className="text-[9px] sm:text-[10px] text-amber-900/80">
              {tareas.length > 0 && (
                <>
                  <span className="font-semibold text-amber-900">
                    {totalConArchivo} / {tareas.length}
                  </span>{" "}
                  tareas tienen archivo asociado. Revisa que cada cliente tenga
                  respaldo antes de cerrar.
                </>
              )}
            </div>

            {/* Checkbox enviar correo – solo si enableSendEmail */}
            {enableSendEmail && tareas.length > 0 && (
              <label
                htmlFor="enviar-correo-cintax"
                className="inline-flex items-center gap-2 text-[9px] sm:text-[10px] text-amber-900 cursor-pointer select-none"
              >
                <input
                  id="enviar-correo-cintax"
                  type="checkbox"
                  className="w-3.5 h-3.5 rounded border border-amber-400 text-amber-700"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span>
                  Enviar correo al cliente al completar (se abrirá un resumen de
                  correo).
                </span>
              </label>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={
                showConfirmStep ? () => setShowConfirmStep(false) : handleClose
              }
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg border text-[10px] sm:text-[11px] text-amber-900 bg-white hover:bg-amber-50/70 transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-40"
              style={{ borderColor: "rgba(180, 83, 9, 0.45)" }}
            >
              {showConfirmStep ? "No, volver" : "Cancelar"}
            </button>
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={primaryDisabled}
              className="px-3.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-semibold text-white shadow-md hover:shadow-lg transform-gpu transition-all hover:-translate-y-0.5.disabled:opacity-40"
              style={{
                background:
                  "linear-gradient(135deg, #f59e0b, #d97706, #b45309)",
              }}
            >
              {isSubmitting
                ? "Completando..."
                : showConfirmStep
                ? "Sí, completar tareas"
                : "Completar tareas"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MultiCompletarTareasModal;
