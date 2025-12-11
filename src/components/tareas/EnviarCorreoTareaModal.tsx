// src/components/tareas/EnviarCorreoTareaModal.tsx
import React, { useEffect, useState } from "react";

export type TareaCorreoResumen = {
  id_tarea_asignada: number;
  rutCliente?: string | null;
  clienteRazonSocial?: string | null;
  clienteEmail?: string | null;
  fechaProgramada: string;
  tareaPlantilla?: {
    nombre: string | null;
    codigoDocumento?: string | null;
  } | null;
};

type Props = {
  open: boolean;
  tarea: TareaCorreoResumen | null;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSend: (payload: {
    para: string;
    asunto: string;
    mensaje: string;
    archivosCorreo: File[];
  }) => void;
};

const formatFecha = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("es-CL");
};

const EnviarCorreoTareaModal: React.FC<Props> = ({
  open,
  tarea,
  isSubmitting,
  errorMessage,
  onClose,
  onSend,
}) => {
  const [para, setPara] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);

  // Cuando cambie la tarea, inicializamos destinatario / asunto / mensaje
  useEffect(() => {
    if (!tarea) return;

    const fecha = formatFecha(tarea.fechaProgramada);
    const nombreTarea = tarea.tareaPlantilla?.nombre ?? "Tarea contable";
    const asuntoPorDefecto = `Entrega ${nombreTarea} – ${fecha}`;

    setPara(tarea.clienteEmail ?? "");
    setAsunto(asuntoPorDefecto);

    const cuerpo = `Estimada/o,

Adjunto envío la documentación correspondiente a la tarea "${nombreTarea}" del período ${fecha}.

Saludos cordiales.`;
    setMensaje(cuerpo);
    setArchivos([]);
  }, [tarea, open]);

  if (!open || !tarea) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    setArchivos(files);
    console.log("[Modal] Archivos seleccionados:", files);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[Modal] Enviando payload:", {
      para,
      asunto,
      mensaje,
      archivos,
    });

    onSend({
      para,
      asunto,
      mensaje,
      archivosCorreo: archivos,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-2 sm:p-4">
      <div className="w-full max-w-lg rounded-2xl shadow-2xl border border-[#D4AF37]/30 overflow-hidden bg-[#F9FAFB]">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 border-b border-black/5 bg-gradient-to-r from-[#D4AF37] via-[#FCE7A3] to-[#D4AF37] flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#1C1C1C] flex items-center gap-2">
              ✉️ Enviar correo al cliente
            </h3>
            <p className="text-[11px] text-[#1C1C1C]/80">
              Se enviará desde tu correo corporativo al destinatario que
              ingreses.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-full bg-black/5 hover:bg-black/10 text-[#1C1C1C]/70 font-medium transition"
          >
            Cerrar ✕
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="px-4 sm:px-5 py-4 flex flex-col gap-3 text-[11px] text-[#1C1C1C]"
        >
          {/* Resumen tarea */}
          <div className="bg-white rounded-2xl border border-[#D4AF37]/25 p-3 shadow-sm relative overflow-hidden">
            <span className="absolute inset-y-0 left-0 w-1 bg-[#D4AF37]" />
            <div className="flex items-start justify-between gap-2 pl-2">
              <div>
                <p className="font-semibold text-[#1C1C1C] text-[12px]">
                  {tarea.clienteRazonSocial ?? tarea.rutCliente}
                </p>
                <p className="text-[#1C1C1C]/70 mt-0.5">
                  Tarea:{" "}
                  <span className="font-medium text-[#1C1C1C]">
                    {tarea.tareaPlantilla?.nombre ?? "Tarea contable"}
                  </span>
                </p>
                <p className="text-[#1C1C1C]/70">
                  Período:{" "}
                  <span className="font-medium text-[#1C1C1C]">
                    {formatFecha(tarea.fechaProgramada)}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {tarea.tareaPlantilla?.codigoDocumento && (
                  <span className="inline-flex items-center rounded-full bg-[#FFF7D6] border border-[#D4AF37]/60 px-2 py-0.5 text-[10px] text-[#7C5A0B] font-mono">
                    {tarea.tareaPlantilla.codigoDocumento}
                  </span>
                )}
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] text-emerald-700">
                  ID tarea: {tarea.id_tarea_asignada}
                </span>
              </div>
            </div>
          </div>

          {/* Destinatario */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-[#1C1C1C] flex items-center gap-1">
              Para
              <span className="text-[9px] font-normal text-[#7C5A0B]">
                (correo del cliente)
              </span>
            </label>
            <div className="relative">
              <span className="absolute inset-y-0.left-3 flex items-center text-[11px] text-black/35">
                @
              </span>
              <input
                type="email"
                value={para}
                onChange={(e) => setPara(e.target.value)}
                placeholder="correo@cliente.cl"
                className="w-full pl-7 pr-3 py-2 rounded-lg border border-black/10 bg-white text-[11px] text-[#1C1C1C] placeholder:text-black/35 outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition"
                required
              />
            </div>
          </div>

          {/* Asunto */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-[#1C1C1C]">Asunto</label>
            <input
              type="text"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-[11px] text-[#1C1C1C] placeholder:text-black/35 outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] transition"
              required
            />
          </div>

          {/* Mensaje */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-[#1C1C1C]">Mensaje</label>
            <textarea
              rows={5}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white text-[11px] text-[#1C1C1C] placeholder:text-black/35 outline-none focus:ring-2 focus:ring-[#D4AF37] focus:border-[#D4AF37] resize-y min-h-[120px] transition"
              required
            />
          </div>

          {/* Archivos adjuntos */}
          <div className="flex flex-col gap-1">
            <label className="font-semibold text-[#1C1C1C]">
              Archivos adjuntos
            </label>

            <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#D4AF37]/70 bg-[#FFF9E6] text-[11px] text-[#7C5A0B] cursor-pointer hover:bg-[#FFF3C4] transition">
              <span className="text-sm">📎</span>
              <span>
                {archivos.length === 0
                  ? "Seleccionar archivos desde tu equipo"
                  : "Añadir más archivos"}
              </span>
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {archivos.length > 0 && (
              <div className="mt-1 rounded-lg bg-white border border-black/10 px-3 py-2 space-y-1 max-h-28 overflow-y-auto">
                <p className="text-[10px] text-black/60 mb-1">
                  Archivos seleccionados:
                </p>
                {archivos.map((f, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 text-[10px] text-[#1C1C1C]"
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="text-black/50">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errorMessage && (
            <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMessage}
            </p>
          )}

          {/* Footer */}
          <div className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-black/10 text-xs text-black/70 bg-white hover:bg-black/[0.03] disabled:opacity-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || archivos.length === 0 || !para}
              className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold bg-[#D4AF37] text-[#1C1C1C] border border-[#D4AF37] shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? "Enviando…" : "Enviar correo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EnviarCorreoTareaModal;
