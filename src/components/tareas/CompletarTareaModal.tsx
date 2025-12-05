import React from "react";
import { AlertCircle, X, Loader2 } from "lucide-react";

type TareaResumen = {
  id_tarea_asignada: number;
  rutCliente?: string | null;
  clienteRazonSocial?: string | null;
  fechaProgramada: string; // ISO
  tareaPlantilla?: {
    nombre: string | null;
    codigoDocumento?: string | null;
  } | null;
};

type CompletarTareaModalProps = {
  open: boolean;
  tarea: TareaResumen | null;
  isSubmitting: boolean;
  /** true cuando ya hay archivo seleccionado en el padre */
  canConfirm: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onFileChange: (file: File | null) => void;
  onConfirm: () => void;
};

const formatFecha = (iso: string | undefined | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL");
};

const CompletarTareaModal: React.FC<CompletarTareaModalProps> = ({
  open,
  tarea,
  isSubmitting,
  canConfirm,
  errorMessage,
  onClose,
  onFileChange,
  onConfirm,
}) => {
  if (!open || !tarea) return null;

  const nombreTarea =
    tarea.tareaPlantilla?.nombre ?? "Tarea contable asignada";
  const codigoDoc = tarea.tareaPlantilla?.codigoDocumento;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-4 border border-black/5">
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <h3 className="text-sm font-semibold text-black">
              Completar tarea con archivo
            </h3>
            <p className="text-[11px] text-black/60 mt-0.5">
              Para completar esta tarea debes subir primero un archivo de
              respaldo. El archivo se guardará en la carpeta asignada en Drive.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-full hover:bg-black/5 text-black/50 hover:text-black/80 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* INFO TAREA */}
        <div className="mb-3 rounded-xl border border-black/5 bg-black/[0.02] px-3 py-2 text-[11px] space-y-0.5">
          <p className="text-black/70">
            <span className="font-semibold">RUT:&nbsp;</span>
            <span className="font-mono">{tarea.rutCliente ?? "-"}</span>
          </p>
          {tarea.clienteRazonSocial && (
            <p className="text-black/70">
              <span className="font-semibold">Cliente:&nbsp;</span>
              {tarea.clienteRazonSocial}
            </p>
          )}
          <p className="text-black/70">
            <span className="font-semibold">Tarea:&nbsp;</span>
            {nombreTarea}
          </p>
          {codigoDoc && (
            <p className="text-black/60 font-mono">
              <span className="font-semibold">Documento:&nbsp;</span>
              {codigoDoc}
            </p>
          )}
          <p className="text-black/70">
            <span className="font-semibold">Programada:&nbsp;</span>
            {formatFecha(tarea.fechaProgramada)}
          </p>
        </div>

        {/* FILE INPUT */}
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-black/75 mb-1">
            Archivo de respaldo
          </label>
          <input
            type="file"
            disabled={isSubmitting}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            accept="application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*,application/zip"
            className="block w-full text-[11px] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-[var(--primary-color)] file:text-white hover:file:brightness-105"
          />
          <p className="text-[10px] text-black/45 mt-1">
            Debes seleccionar un archivo para poder completar la tarea.
          </p>
        </div>

        {/* MENSAJE DE ERROR */}
        {errorMessage && (
          <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700 flex items-start gap-1.5">
            <AlertCircle className="w-3 h-3 mt-[2px] flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* FOOTER BOTONES */}
        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg border border-black/10 text-[11px] text-black/70 hover:bg-black/5 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting || !canConfirm}
            className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isSubmitting ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Subiendo…
              </span>
            ) : (
              "Subir y completar"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompletarTareaModal;
