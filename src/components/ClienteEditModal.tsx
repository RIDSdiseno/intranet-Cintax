import React, { useMemo } from "react";
import { Loader2 } from "lucide-react";

type Cliente = {
  id?: number;
  rut: string;
  razonSocial: string;
  alias?: string | null;

  // ✅ este es el campo en Cliente (lo guardas en DB)
  codigoCartera?: string | null;

  agenteId?: number | null;
  activo?: boolean;
};

type Trabajador = {
  id_trabajador: number;
  nombre: string;
  email: string;

  // ✅ este es el “código de cartera” real del ejecutivo en tu modelo Trabajador
  // (en Prisma: carpetaDriveCodigo)
  carpetaDriveCodigo?: string | null;
};

type Props = {
  open: boolean;
  canManageClientes: boolean; // ADMIN/SUPERVISOR
  saving: boolean;

  editingCliente: Cliente | null;
  setEditingCliente: React.Dispatch<React.SetStateAction<Cliente | null>>;

  trabajadores: Trabajador[];

  onClose: () => void;
  onSave: () => void;
};

const ClienteEditModal: React.FC<Props> = ({
  open,
  canManageClientes,
  saving,
  editingCliente,
  setEditingCliente,
  trabajadores,
  onClose,
  onSave,
}) => {
  if (!open || !editingCliente) return null;

  const setField = <K extends keyof Cliente>(key: K, value: Cliente[K]) => {
    setEditingCliente((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const agenteSeleccionado = useMemo(() => {
    const id = editingCliente.agenteId;
    if (id == null) return null;
    return trabajadores.find((t) => t.id_trabajador === id) ?? null;
  }, [editingCliente.agenteId, trabajadores]);

  // ✅ helper: al cambiar ejecutivo, auto-set de codigoCartera desde carpetaDriveCodigo
  const handleChangeAgente = (raw: string) => {
    const nextAgenteId = raw ? Number(raw) : null;

    if (raw && !Number.isFinite(nextAgenteId)) {
      // si por algún motivo llega algo raro, no rompas el state
      setField("agenteId", null);
      return;
    }

    // set agenteId
    setEditingCliente((prev) => {
      if (!prev) return prev;

      const updated: Cliente = { ...prev, agenteId: nextAgenteId };

      // ✅ si selecciona un agente, copiamos su carpetaDriveCodigo -> codigoCartera
      if (nextAgenteId != null) {
        const ag = trabajadores.find((t) => t.id_trabajador === nextAgenteId);
        const code =
          typeof ag?.carpetaDriveCodigo === "string" && ag.carpetaDriveCodigo.trim()
            ? ag.carpetaDriveCodigo.trim()
            : null;

        // si hay código, lo seteamos; si no hay, lo dejamos como estaba (para no borrar sin querer)
        if (code) updated.codigoCartera = code;
      }

      // ✅ si lo deja "sin asignar", opcional: limpiar cartera
      // (si prefieres mantenerla, comenta la línea de abajo)
      if (nextAgenteId == null) updated.codigoCartera = null;

      return updated;
    });
  };

  const carteraReadonly =
    !!editingCliente.agenteId && !!agenteSeleccionado?.carpetaDriveCodigo;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-black/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-black/80">Editar cliente</h3>
            <p className="text-[11px] text-black/50">
              {canManageClientes
                ? "Admin/Supervisor pueden editar y reasignar ejecutivo."
                : "Solo lectura: tu rol no permite editar ni reasignar."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[11px] px-3 py-1.5 rounded-lg border border-black/10 bg-black/5 hover:bg-black/10"
            disabled={saving}
          >
            Cerrar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-[11px]">
          {/* RUT */}
          <label className="block">
            <span className="font-semibold text-black/70">RUT</span>
            <input
              value={editingCliente.rut}
              onChange={(e) => setField("rut", e.target.value)}
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              disabled={saving || !canManageClientes}
            />
          </label>

          {/* Razón social */}
          <label className="block">
            <span className="font-semibold text-black/70">Razón social</span>
            <input
              value={editingCliente.razonSocial}
              onChange={(e) => setField("razonSocial", e.target.value)}
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              disabled={saving || !canManageClientes}
            />
          </label>

          {/* Alias */}
          <label className="block">
            <span className="font-semibold text-black/70">Alias</span>
            <input
              value={editingCliente.alias ?? ""}
              onChange={(e) => setField("alias", e.target.value ? e.target.value : null)}
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              disabled={saving || !canManageClientes}
            />
          </label>

          {/* Código cartera */}
          <label className="block">
            <span className="font-semibold text-black/70">Código cartera</span>
            <input
              value={editingCliente.codigoCartera ?? ""}
              onChange={(e) => setField("codigoCartera", e.target.value ? e.target.value : null)}
              placeholder='Ej: "CONTA/A01"'
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              disabled={saving || !canManageClientes || carteraReadonly}
            />
            {carteraReadonly ? (
              <p className="mt-1 text-[10px] text-black/45">
                Se autocompleta desde el ejecutivo seleccionado.
              </p>
            ) : (
              <p className="mt-1 text-[10px] text-black/45">
                Si asignas un ejecutivo con código, se completa automáticamente.
              </p>
            )}
          </label>

          {/* Ejecutivo */}
          {canManageClientes ? (
            <label className="block">
              <span className="font-semibold text-black/70">Ejecutivo (agente)</span>
              <select
                value={editingCliente.agenteId == null ? "" : String(editingCliente.agenteId)}
                onChange={(e) => handleChangeAgente(e.target.value)}
                className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                disabled={saving}
              >
                <option value="">Sin asignar</option>
                {trabajadores.map((t) => (
                  <option key={t.id_trabajador} value={String(t.id_trabajador)}>
                    {t.nombre}
                    {t.carpetaDriveCodigo ? ` · ${t.carpetaDriveCodigo}` : ""}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-[10px] text-black/45">
                Al cambiar ejecutivo, se toma su <b>carpetaDriveCodigo</b> como código de cartera.
              </p>
            </label>
          ) : (
            <div className="text-[11px]">
              <span className="font-semibold text-black/70">Ejecutivo (agente)</span>
              <div className="mt-1 border border-black/10 rounded-lg px-2 py-1.5 bg-black/[0.03] text-black/60">
                {editingCliente.agenteId != null ? editingCliente.agenteId : "Sin asignar"}
              </div>
            </div>
          )}

          {/* Estado */}
          <label className="block">
            <span className="font-semibold text-black/70">Estado</span>
            <select
              value={editingCliente.activo === false ? "false" : "true"}
              onChange={(e) => setField("activo", e.target.value === "true")}
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
              disabled={saving || !canManageClientes}
            >
              <option value="true">Activo</option>
              <option value="false">Inactivo</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
            disabled={saving}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving || !canManageClientes}
            className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 text-white ${
              saving || !canManageClientes
                ? "bg-black/40 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700"
            }`}
            title={!canManageClientes ? "Tu rol no permite editar" : "Guardar cambios"}
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClienteEditModal;
