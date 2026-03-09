import React from "react";
import {
  uploadClientesMasivoExcel,
  type BulkExcelResponse,
} from "../../service/Clientes.service";
import { ModalShell } from "./ModalShell";

export default function UploadClientesExcelModal({
  canManage,
  onClose,
  onDone,
}: {
  canManage: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = React.useState(false);
  const [defaultActivo, setDefaultActivo] = React.useState(true);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<BulkExcelResponse | null>(null);

  async function runDryRun() {
    setError(null);
    setPreview(null);

    if (!canManage) return setError("Sin permisos.");
    if (!file) return setError("Debes seleccionar un archivo .xlsx.");

    setBusy(true);
    try {
      const res = await uploadClientesMasivoExcel({
        file,
        dryRun: true,
        updateExisting,
        defaultActivo,
      });
      setPreview(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Error validando Excel");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setError(null);

    if (!canManage) return setError("Sin permisos.");
    if (!file) return setError("Debes seleccionar un archivo .xlsx.");
    if (!preview) return setError("Primero valida (dry run).");

    setBusy(true);
    try {
      const res = await uploadClientesMasivoExcel({
        file,
        dryRun: false,
        updateExisting,
        defaultActivo,
      });

      if (res.data?.ok) onDone();
      else setError("No se pudo completar la carga.");
    } catch (e: any) {
      setError(e?.response?.data?.error || "Error cargando Excel");
    } finally {
      setBusy(false);
    }
  }

  const sum = preview?.summary;

  return (
    <ModalShell title="Carga masiva de clientes (Excel)" onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-200 p-3">
          <div className="text-sm font-medium text-gray-900">Archivo</div>

          <div className="mt-2">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={busy}
            />
          </div>

          <div className="mt-2 text-xs text-gray-600">
            Columnas requeridas: <span className="font-medium">rut</span> y{" "}
            <span className="font-medium">razonSocial</span> (o equivalentes como empresa/razon).
            Alias es opcional.
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                disabled={busy}
              />
              Actualizar existentes
            </label>
            <div className="mt-1 text-xs text-gray-600">
              Si está activo, actualizará razón social/alias según Excel.
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={defaultActivo}
                onChange={(e) => setDefaultActivo(e.target.checked)}
                disabled={busy}
              />
              Nuevos por defecto: Activos
            </label>
            <div className="mt-1 text-xs text-gray-600">Solo aplica a clientes nuevos.</div>
          </div>
        </div>

        {error && <div className="text-sm text-rose-700">{error}</div>}

        {preview && sum && (
          <div className="rounded-xl border border-gray-200 p-3 space-y-2">
            <div className="text-sm font-semibold">Validación</div>

            <div className="grid gap-2 md:grid-cols-3 text-sm">
              <div className="rounded-lg border border-gray-100 p-2">
                Total filas: <span className="font-medium">{sum.totalRows}</span>
              </div>
              <div className="rounded-lg border border-gray-100 p-2">
                Válidas: <span className="font-medium">{sum.validRows}</span>
              </div>
              <div className="rounded-lg border border-gray-100 p-2">
                Inválidas: <span className="font-medium">{sum.invalidCount}</span>
              </div>

              <div className="rounded-lg border border-gray-100 p-2">
                Duplicadas: <span className="font-medium">{sum.duplicatesInFileCount}</span>
              </div>
              <div className="rounded-lg border border-gray-100 p-2">
                A crear: <span className="font-medium">{sum.toCreateCount}</span>
              </div>
              <div className="rounded-lg border border-gray-100 p-2">
                A actualizar: <span className="font-medium">{sum.toUpdateCount}</span>
              </div>
            </div>

            {(preview.invalid?.length ?? 0) > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium text-gray-700 mb-1">Errores (primeros)</div>
                <div className="max-h-40 overflow-auto rounded-lg border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="p-2 text-left">Fila</th>
                        <th className="p-2 text-left">Error</th>
                        <th className="p-2 text-left">RUT</th>
                        <th className="p-2 text-left">Razón</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.invalid!.slice(0, 50).map((it, idx) => (
                        <tr key={idx} className="border-t border-gray-100">
                          <td className="p-2">{it.row}</td>
                          <td className="p-2">{it.error}</td>
                          <td className="p-2">{String(it.rutRaw ?? "")}</td>
                          <td className="p-2">{String(it.razonRaw ?? "")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            Cerrar
          </button>

          <button
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={runDryRun}
            disabled={busy || !file}
          >
            {busy ? "Procesando..." : "Validar (dry run)"}
          </button>

          <button
            className="rounded-xl bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={commit}
            disabled={busy || !file || !preview}
            title={!preview ? "Primero valida (dry run)" : "Aplicar cambios"}
          >
            {busy ? "Cargando..." : "Confirmar carga"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}