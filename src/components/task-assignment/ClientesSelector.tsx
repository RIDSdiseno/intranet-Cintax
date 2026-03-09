import React from "react";
import { listClientes, type ClienteRow } from "../../service/Clientes.service"; // ajusta ruta

type Props = {
  selectedRuts: string[];
  onChange: (next: string[]) => void;
  trabajadorId: number | "";
};

function uniq(xs: string[]) {
  return Array.from(new Set(xs));
}

export default function ClientesSelector({ selectedRuts, onChange, trabajadorId }: Props) {
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<ClienteRow[]>([]);
  const [total, setTotal] = React.useState(0);

  const take = 30;

  async function fetchList() {
    if (trabajadorId === "") {
      setItems([]);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await listClientes({
        search: q.trim() ? q.trim() : undefined,
        agenteId: Number(trabajadorId),
        soloActivos: true,
        limit: take,
        skip: 0,
      });

      setItems(res.data.items ?? []);
      setTotal(res.data.total ?? 0);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "No se pudo cargar clientes");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  // ✅ cuando cambia el trabajador, recarga y limpia selección
  React.useEffect(() => {
    onChange([]);
    void fetchList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajadorId]);

  function toggleRut(rut: string) {
    const exists = selectedRuts.includes(rut);
    onChange(exists ? selectedRuts.filter((r) => r !== rut) : uniq([...selectedRuts, rut]));
  }

  function selectVisible() {
    onChange(uniq([...selectedRuts, ...items.map((i) => i.rut)]));
  }

  function clear() {
    onChange([]);
  }

  const disabled = trabajadorId === "";

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
        <div className="flex gap-2 flex-col sm:flex-row sm:items-center">
          <input
            className="w-full sm:w-[360px] border rounded-xl px-3 py-2 text-sm"
            placeholder={disabled ? "Selecciona un trabajador primero" : "Buscar por RUT o razón social"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={disabled}
            onKeyDown={(e) => {
              if (e.key === "Enter") void fetchList();
            }}
          />
          <button
            type="button"
            onClick={() => void fetchList()}
            className="border rounded-xl px-3 py-2 text-sm hover:bg-gray-50"
            disabled={disabled || loading}
          >
            Buscar
          </button>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectVisible}
            className="border rounded-xl px-3 py-2 text-sm hover:bg-gray-50"
            disabled={disabled || loading || items.length === 0}
          >
            Seleccionar visibles
          </button>
          <button
            type="button"
            onClick={clear}
            className="border rounded-xl px-3 py-2 text-sm hover:bg-gray-50"
            disabled={selectedRuts.length === 0}
          >
            Limpiar
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      {disabled ? (
        <div className="text-sm text-gray-600 border rounded-xl p-3 bg-gray-50">
          Primero selecciona un trabajador para cargar su cartera.
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <div className="max-h-[320px] overflow-auto">
            {loading && items.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">Cargando...</div>
            ) : items.length === 0 ? (
              <div className="p-3 text-sm text-gray-500">No hay clientes para este trabajador.</div>
            ) : (
              <ul className="divide-y">
                {items.map((c) => {
                  const checked = selectedRuts.includes(c.rut);
                  return (
                    <li key={c.id} className="p-3 hover:bg-gray-50">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => toggleRut(c.rut)}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm">{c.rut}</span>
                            <span className="text-sm text-gray-700 truncate">{c.razonSocial}</span>
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="p-3 text-sm bg-gray-50 flex items-center justify-between">
            <span>
              Seleccionados: <b>{selectedRuts.length}</b>
            </span>
            <span className="text-gray-600">
              Mostrando: <b>{items.length}</b> de <b>{total}</b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}