// src/components/tareas/MultiCompletarTareasModal.tsx
import React, { useState } from "react";
import type { TareaAsignada } from "./tiposTareas";

type MultiCompletarTareasModalProps = {
  open: boolean;
  tareas: TareaAsignada[];
  filesMap: Record<number, File | null>;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onFileChange: (tareaId: number, file: File | null) => void;
  onConfirm: () => void;
  getRazonSocial: (rut?: string | null) => string | null;
  formatFecha: (iso?: string | null) => string;
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
}) => {
  if (!open) return null;

  const [hasBulkAssigned, setHasBulkAssigned] = useState(false);

  const totalConArchivo = tareas.filter(
    (t) => filesMap[t.id_tarea_asignada]
  ).length;

  // CARGA MASIVA: match por nombre (normalizado) + fallback por orden
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-black/10 transform-gpu transition-all duration-200 ease-out scale-100"
        style={{
          boxShadow:
            "0 18px 45px rgba(0,0,0,0.16), 0 8px 18px rgba(0,0,0,0.08)",
        }}
      >
        {/* HEADER */}
        <header className="px-5 py-4 border-b border-black/10 rounded-t-2xl flex items-start justify-between gap-3"
          style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.02), rgba(0,0,0,0))" }}
        >
          <div className="space-y-1">
            <h3
              className="text-sm font-semibold leading-tight"
              style={{ color: "var(--primary-color)" }}
            >
              Completar tareas seleccionadas
            </h3>
            <p className="text-[11px] text-black/60 leading-snug">
              Sube todos los archivos en un solo paso. Los asociamos
              automáticamente a cada tarea según el nombre (ignorando
              mayúsculas, tildes y pequeños errores). Luego puedes ajustar
              cualquier tarea manualmente.
            </p>
            <div className="flex flex-wrap gap-2 mt-1.5 text-[10px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-white"
                style={{
                  borderColor: "rgba(0,0,0,0.06)",
                  color: "var(--primary-color)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: "var(--primary-color)" }}
                />
                {totalConArchivo} de {tareas.length} tareas con archivo
              </span>
              {!!tareas.length && totalConArchivo < tareas.length && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
                  Falta archivo en{" "}
                  <strong className="font-semibold">
                    {tareas.length - totalConArchivo}
                  </strong>{" "}
                  tareas
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-[11px] px-2 py-1 rounded-md border border-transparent hover:border-black/10 hover:bg-black/5 text-black/45 hover:text-black/80 transition-colors disabled:opacity-40"
          >
            Cerrar
          </button>
        </header>

        {/* CARGA MASIVA */}
        <div className="px-5 pt-3 pb-2 border-b border-black/5 bg-white">
          <div
            className="rounded-xl px-3.5 py-3 border border-dashed transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
            style={{
              borderColor: "rgba(0,0,0,0.18)",
              background:
                "linear-gradient(135deg, rgba(0,0,0,0.01), rgba(0,0,0,0.04))",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p
                  className="text-[10px] font-semibold mb-0.5"
                  style={{ color: "var(--primary-color)" }}
                >
                  Subir archivos para todas las tareas
                </p>
                <p className="text-[10px] text-black/60 leading-snug max-w-sm">
                  Por ejemplo:&nbsp;
                  <span className="italic">
                    “Analisis cuentas por cobrar.pdf”, “Confeccion y Envio
                    F29.xlsx”
                  </span>
                  . Intentaremos vincularlos a la tarea correcta según el
                  nombre.
                </p>
              </div>
              <div className="shrink-0">
                <input
                  type="file"
                  multiple
                  disabled={isSubmitting || tareas.length === 0}
                  onChange={handleBulkFilesChange}
                  className="block w-full text-[10px] border rounded-lg px-2 py-1 file:text-[10px] file:px-2 file:py-1 file:border-0 file:mr-2 cursor-pointer transition focus:outline-none focus:ring-1"
                  style={{
                    borderColor: "rgba(0,0,0,0.2)",
                    boxShadow: "0 0 0 0 rgba(0,0,0,0)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* LISTA DE TAREAS */}
        <div className="flex-1 overflow-y-auto px-5 py-3 bg-white">
          {tareas.length === 0 && (
            <p className="text-[12px] text-black/60 text-center py-6">
              No hay tareas seleccionadas para completar.
            </p>
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
                    className={`rounded-xl px-3.5 py-2.5 text-[11px] transition-all duration-150 ease-out transform-gpu hover:-translate-y-0.5 hover:shadow-md`}
                    style={{
                      borderWidth: 1,
                      borderStyle: "solid",
                      borderColor: hasFile
                        ? "rgba(16, 185, 129, 0.35)"
                        : "rgba(0,0,0,0.10)",
                      background: hasFile
                        ? "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))"
                        : "rgba(0,0,0,0.01)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-mono text-[10px] text-black/55">
                            {t.rutCliente}
                          </span>
                          {razon && (
                            <span className="text-[10px] text-black/60">
                              — {razon}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-black/80">
                          {t.tareaPlantilla?.codigoDocumento && (
                            <span className="font-mono text-[10px] text-black/50 mr-1.5">
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
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border`}
                        style={{
                          backgroundColor: hasFile
                            ? "rgba(16,185,129,0.06)"
                            : "rgba(248,113,113,0.06)",
                          borderColor: hasFile
                            ? "rgba(16,185,129,0.35)"
                            : "rgba(248,113,113,0.35)",
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
                              className="inline-flex items-center px-2.5 py-1 rounded-lg border text-[10px] cursor-pointer transition-colors"
                              style={{
                                borderColor: "rgba(0,0,0,0.15)",
                                color: "var(--primary-color)",
                              }}
                            >
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
                          <label className="block text-[10px] font-semibold text-black/70 mb-1">
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
                            className="block w-full text-[10px] border rounded-lg px-2 py-1 file:text-[10px] file:px-2 file:py-1 file:border-0 file:bg-black/5 file:mr-2 cursor-pointer transition focus:outline-none focus:ring-1"
                            style={{ borderColor: "rgba(0,0,0,0.2)" }}
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
          <div className="px-5 py-2 text-[11px] text-rose-700 bg-rose-50 border-t border-rose-100">
            {errorMessage}
          </div>
        )}

        {/* FOOTER */}
        <footer className="px-5 py-3 border-t border-black/10 rounded-b-2xl flex items-center justify-between gap-3"
          style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.02), rgba(0,0,0,0))" }}
        >
          <div className="text-[10px] text-black/55">
            {tareas.length > 0 && (
              <>
                <span className="font-semibold" style={{ color: "var(--primary-color)" }}>
                  {totalConArchivo} / {tareas.length}
                </span>{" "}
                tareas tienen archivo asociado.
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 rounded-lg border text-[11px] text-black/70 bg-white hover:bg-black/[0.03] transition-all hover:-translate-y-0.5 hover:shadow-sm disabled:opacity-40"
              style={{ borderColor: "rgba(0,0,0,0.15)" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting || tareas.length === 0}
              className="px-3.5 py-1.5 rounded-lg text-[11px] font-semibold text-white shadow-md hover:shadow-lg transform-gpu transition-all hover:-translate-y-0.5 disabled:opacity-40"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              {isSubmitting ? "Completando..." : "Completar tareas"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MultiCompletarTareasModal;
