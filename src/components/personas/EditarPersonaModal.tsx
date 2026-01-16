import React, { useEffect, useMemo, useState } from "react";
import { X, Save, Shield, UserCog } from "lucide-react";

export type Role = "ADMIN" | "SUPERVISOR" | "AGENTE";
export type Area = "ADMIN" | "CONTA" | "RRHH" | "TRIBUTARIO" | "SUPERVISOR";

export type PersonaEditable = {
  id_trabajador: number;
  nombre: string;
  email: string; // solo lectura
  areaInterna: Area | null;
  carpetaDriveCodigo: string | null;
  status: boolean;
};

type Props = {
  open: boolean;
  persona: PersonaEditable | null;
  actorRole: Role | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (payload: PersonaEditable) => void;
};

const AREAS: Array<{ value: Area | "NONE"; label: string }> = [
  { value: "NONE", label: "— Sin área —" },
  { value: "ADMIN", label: "ADMIN" },
  { value: "SUPERVISOR", label: "SUPERVISOR" },
  { value: "CONTA", label: "CONTA" },
  { value: "RRHH", label: "RRHH" },
  { value: "TRIBUTARIO", label: "TRIBUTARIO" },
];

export default function EditarPersonaModal({
  open,
  persona,
  actorRole,
  saving = false,
  onClose,
  onSave,
}: Props) {
  const canEdit = actorRole === "ADMIN" || actorRole === "SUPERVISOR";

  // política: supervisor NO debería poder asignar ADMIN
  const allowAdminAssign = actorRole === "ADMIN";

  const [nombre, setNombre] = useState("");
  const [areaInterna, setAreaInterna] = useState<Area | null>(null);
  const [carpetaDriveCodigo, setCarpetaDriveCodigo] = useState<string | null>(null);
  const [status, setStatus] = useState(true);

  useEffect(() => {
    if (!open || !persona) return;
    setNombre(persona.nombre ?? "");
    setAreaInterna(persona.areaInterna ?? null);
    setCarpetaDriveCodigo(persona.carpetaDriveCodigo ?? null);
    setStatus(Boolean(persona.status));
  }, [open, persona]);

  const areaOptions = useMemo(() => {
    // si es supervisor, ocultamos ADMIN para evitar escalación
    if (allowAdminAssign) return AREAS;
    return AREAS.filter((x) => x.value !== "ADMIN");
  }, [allowAdminAssign]);

  if (!open || !persona) return null;

  const disabled = !canEdit || saving;

  const submit = () => {
    if (!canEdit) return;

    const payload: PersonaEditable = {
      id_trabajador: persona.id_trabajador,
      nombre: nombre.trim() || persona.nombre,
      email: persona.email,
      areaInterna,
      carpetaDriveCodigo: (carpetaDriveCodigo ?? "").trim() || null,
      status,
    };

    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-[60]">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={disabled ? undefined : onClose}
      />

      {/* panel */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-black/10 overflow-hidden">
          {/* header */}
          <div className="px-5 py-4 border-b border-black/5 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <UserCog className="text-black/70" size={18} />
                <h3 className="text-lg font-semibold truncate">Editar usuario</h3>
              </div>
              <p className="text-sm text-black/60 mt-1 truncate">
                ID {persona.id_trabajador} · <span className="font-mono">{persona.email}</span>
              </p>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-black/10 hover:border-black/30 transition bg-white"
              disabled={saving}
              title="Cerrar"
            >
              <X size={18} />
            </button>
          </div>

          {/* body */}
          <div className="px-5 py-4 space-y-4">
            {!canEdit && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-sm flex items-start gap-2">
                <Shield size={16} className="mt-0.5" />
                <div>
                  No tienes permisos para editar usuarios (solo ADMIN/SUPERVISOR).
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* nombre */}
              <div className="space-y-1">
                <label className="text-xs text-black/50">Nombre</label>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  disabled={disabled}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                  placeholder="Nombre del usuario"
                />
              </div>

              {/* email (solo lectura) */}
              <div className="space-y-1">
                <label className="text-xs text-black/50">Email (no editable)</label>
                <input
                  value={persona.email}
                  disabled
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm bg-black/[0.03] text-black/70"
                />
              </div>

              {/* area interna */}
              <div className="space-y-1">
                <label className="text-xs text-black/50">Rol / Área interna</label>
                <select
                  value={(areaInterna ?? "NONE") as any}
                  onChange={(e) =>
                    setAreaInterna(e.target.value === "NONE" ? null : (e.target.value as Area))
                  }
                  disabled={disabled}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 bg-white"
                >
                  {areaOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {!allowAdminAssign && (
                  <p className="text-[11px] text-black/40">
                    Nota: SUPERVISOR no puede asignar ADMIN.
                  </p>
                )}
              </div>

              {/* status */}
              <div className="space-y-1">
                <label className="text-xs text-black/50">Estado</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setStatus(true)}
                    className={`px-3 py-2 rounded-xl border text-sm transition ${
                      status
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-black/10 bg-white text-black/70 hover:border-black/30"
                    }`}
                  >
                    Activo
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setStatus(false)}
                    className={`px-3 py-2 rounded-xl border text-sm transition ${
                      !status
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : "border-black/10 bg-white text-black/70 hover:border-black/30"
                    }`}
                  >
                    Inactivo
                  </button>
                </div>
              </div>

              {/* carpeta */}
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-black/50">CarpetaDriveCodigo</label>
                <input
                  value={carpetaDriveCodigo ?? ""}
                  onChange={(e) => setCarpetaDriveCodigo(e.target.value)}
                  disabled={disabled}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 font-mono"
                  placeholder="A01, A02, A03, A04"
                />
                <p className="text-[11px] text-black/40">
                  Tip: si lo dejas vacío, se guarda como null.
                </p>
              </div>
            </div>
          </div>

          {/* footer */}
          <div className="px-5 py-4 border-t border-black/5 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-black/10 hover:border-black/30 transition bg-white text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={submit}
              disabled={disabled}
              className="px-4 py-2 rounded-xl text-sm text-white flex items-center gap-2 disabled:opacity-60"
              style={{ backgroundColor: "var(--primary-color)" }}
            >
              <Save size={16} />
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
