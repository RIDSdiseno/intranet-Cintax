// src/components/clientes/CreateClienteModal.tsx
import React from "react";
import { createCliente, type TrabajadorLite } from "../../service/Clientes.service";
import { Field, ModalShell } from "./ModalShell";

/* =========================
   Formateo de RUT en vivo
   - Puntos automáticos (miles) desde la derecha
   - Guion automático cuando body >= 7
   - DV opcional (0-9 o K)
========================= */
function formatRutInput(value: string) {
  // Solo números y K, máximo 8 cuerpo + 1 dv
  const raw = value
    .toUpperCase()
    .replace(/[^0-9K]/g, "")
    .slice(0, 9);

  if (!raw) return "";

  const last = raw.slice(-1);

  // Hay DV si:
  // - último es K, o
  // - largo total llegó a 9 (8 cuerpo + 1 dv)
  const hasDv = last === "K" || raw.length === 9;

  const body = hasDv ? raw.slice(0, -1) : raw; // solo dígitos
  const dv = hasDv ? last : "";

  // Puntos desde la derecha: 777777 -> 777.777, 76401040 -> 76.401.040
  const bodyFmt = body.length > 3 ? body.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : body;

  // Guion:
  // - si hay DV: bodyFmt-DV
  // - si no hay DV pero body >= 7: bodyFmt-
  if (dv) return `${bodyFmt}-${dv}`;
  if (body.length >= 7) return `${bodyFmt}-`;
  return bodyFmt;
}

export default function CreateClienteModal({
  canManage,
  trabajadores,
  onClose,
  onCreated,
}: {
  canManage: boolean;
  trabajadores: TrabajadorLite[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [rut, setRut] = React.useState("");
  const [razonSocial, setRazonSocial] = React.useState("");
  const [alias, setAlias] = React.useState("");
  const [activo, setActivo] = React.useState(true);
  const [agenteValue, setAgenteValue] = React.useState<string>("none");

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // UX: muestra una ayuda de que la cartera se asigna automáticamente
  const selectedAgente = React.useMemo(() => {
    if (agenteValue === "none") return null;
    const id = Number(agenteValue);
    if (!Number.isFinite(id)) return null;
    return trabajadores.find((t) => t.id_trabajador === id) ?? null;
  }, [agenteValue, trabajadores]);

  function handleRutChange(e: React.ChangeEvent<HTMLInputElement>) {
    setRut(formatRutInput(e.target.value));
  }

  async function save() {
    setError(null);

    if (!canManage) return setError("Sin permisos.");
    if (!rut.trim() || !razonSocial.trim()) {
      return setError("RUT y Razón Social son obligatorios.");
    }

    setSaving(true);
    try {
      const agenteId = agenteValue === "none" ? null : Number(agenteValue);

      await createCliente({
        rut: rut.trim(),
        razonSocial: razonSocial.trim(),
        alias: alias.trim() ? alias.trim() : null,
        // ✅ NO enviamos codigoCartera: el backend la calcula desde el agente (carpetaDriveCodigo)
        agenteId: agenteId !== null && Number.isFinite(agenteId) ? agenteId : null,
        activo,
      });

      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Error creando cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Nuevo cliente" onClose={onClose}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="RUT">
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={rut}
            onChange={handleRutChange}
            placeholder="Ej: 76.401.040-K"
            inputMode="numeric"
            autoComplete="off"
            disabled={saving}
          />
        </Field>

        <Field label="Estado">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              disabled={saving}
            />
            Activo
          </label>
        </Field>

        <div className="md:col-span-2">
          <Field label="Razón Social">
            <input
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
              value={razonSocial}
              onChange={(e) => setRazonSocial(e.target.value)}
              placeholder="Empresa SpA"
              disabled={saving}
            />
          </Field>
        </div>

        <Field label="Alias">
          <input
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Opcional"
            disabled={saving}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Agente (opcional)">
            <select
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm bg-white"
              value={agenteValue}
              onChange={(e) => setAgenteValue(e.target.value)}
              disabled={saving}
            >
              <option value="none">Sin asignar</option>
              {trabajadores.map((t) => (
                <option key={t.id_trabajador} value={t.id_trabajador}>
                  {t.nombre} ({t.email})
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-gray-500">
              La cartera se asigna automáticamente según el agente seleccionado.
              {selectedAgente ? (
                <>
                  {" "}
                  Se usará la carpeta Drive configurada del agente{" "}
                  <span className="font-medium text-gray-700">{selectedAgente.nombre}</span>.
                </>
              ) : (
                <>
                  {" "}
                  Si no asignas agente, el cliente quedará sin cartera hasta que lo asignes.
                </>
              )}
            </p>
          </Field>
        </div>
      </div>

      {error && <div className="mt-3 text-sm text-rose-700">{error}</div>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50"
          onClick={onClose}
          disabled={saving}
        >
          Cancelar
        </button>
        <button
          className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={save}
          disabled={saving}
        >
          {saving ? "Creando..." : "Crear"}
        </button>
      </div>
    </ModalShell>
  );
}