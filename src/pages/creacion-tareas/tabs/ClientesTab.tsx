// src/pages/creacion-tareas/tabs/ClientesTab.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Plus, Search, User, Users, Filter } from "lucide-react";
import type { Cliente, LoadState, Trabajador } from "../shared/types";
import type { Role } from "../shared/auth";
import { getAuthHeaders } from "../shared/auth";

type Props = {
  API_BASE_URL: string;
  role: Role | null;
  roleLoading: boolean;
  trabajadores: Trabajador[];
};

const TAKE_ALL = 500;

const ClientesTab: React.FC<Props> = ({ API_BASE_URL, role, roleLoading, trabajadores }) => {
  const canManageClientes = role === "ADMIN" || role === "SUPERVISOR";

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState<LoadState>("idle");
  const [errorClientes, setErrorClientes] = useState<string | null>(null);

  const [clientesMeta, setClientesMeta] = useState({ total: 0, take: TAKE_ALL, skip: 0 });

  const [nuevoRut, setNuevoRut] = useState("");
  const [nuevaRazonSocial, setNuevaRazonSocial] = useState("");
  const [creatingCliente, setCreatingCliente] = useState(false);

  const [busquedaClientesTabla, setBusquedaClientesTabla] = useState("");

  // filtro y vista
  const [agenteFiltro, setAgenteFiltro] = useState<string>("ALL");
  const [modoVista, setModoVista] = useState<"LISTA" | "AGRUPADO">("AGRUPADO");

  // modal edición
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [savingCliente, setSavingCliente] = useState(false);

  // -----------------------------
  // Helpers
  // -----------------------------
  const rutKey = (c: Cliente) => {
    const r = (c.rut || "").trim();
    if (r) return r;
    return `ID:${String(c.id ?? Math.random())}`;
  };

  const parseClientesResponse = (raw: any, fallbackTake: number, fallbackSkip: number) => {
    const items: Cliente[] = Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw?.clientes)
      ? raw.clientes
      : Array.isArray(raw)
      ? raw
      : [];

    const total = Number(raw?.total ?? raw?.meta?.total ?? items.length ?? 0);
    const take = Number(raw?.take ?? raw?.meta?.take ?? fallbackTake);
    const skip = Number(raw?.skip ?? raw?.meta?.skip ?? fallbackSkip);

    return { items, meta: { total, take, skip } };
  };

  const fetchClientesPage = async (opts?: {
    search?: string;
    agenteId?: number;
    soloActivos?: boolean;
    limit?: number;
    skip?: number;
  }) => {
    const qs = new URLSearchParams();
    if (opts?.search?.trim()) qs.set("search", opts.search.trim());
    if (typeof opts?.agenteId === "number") qs.set("agenteId", String(opts.agenteId));
    if (typeof opts?.soloActivos === "boolean") qs.set("soloActivos", String(opts.soloActivos));
    if (typeof opts?.limit === "number") qs.set("limit", String(opts.limit));
    if (typeof opts?.skip === "number") qs.set("skip", String(opts.skip));

    const url = `${API_BASE_URL}/clientes${qs.toString() ? `?${qs.toString()}` : ""}`;

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    });

    if (!res.ok) {
      let msg = `Error ${res.status}`;
      try {
        const j = await res.json();
        msg = j?.message || j?.error || msg;
      } catch {}
      throw new Error(msg);
    }

    const raw = await res.json();
    return parseClientesResponse(raw, opts?.limit ?? TAKE_ALL, opts?.skip ?? 0);
  };

  // ✅ Cargar TODOS
  const fetchAllClientes = async () => {
    setLoadingClientes("loading");
    setErrorClientes(null);

    try {
      let skip = 0;
      const take = TAKE_ALL;

      const acc: Cliente[] = [];
      let total = 0;

      for (let guard = 0; guard < 200; guard++) {
        const page = await fetchClientesPage({ limit: take, skip });
        total = page.meta.total || total;

        acc.push(...page.items);

        if (page.items.length < take) break;
        skip += take;

        if (total && acc.length >= total) break;
      }

      const uniqueByRut = Array.from(new Map(acc.map((c) => [rutKey(c), c])).values());

      setClientes(uniqueByRut);
      setClientesMeta({ total: total || uniqueByRut.length, take, skip: 0 });
      setLoadingClientes("success");
    } catch (err) {
      console.error("[Front] Error cargando clientes (ALL)", err);
      setErrorClientes("No se pudieron cargar los clientes.");
      setLoadingClientes("error");
    }
  };

  // -----------------------------
  // Auto load
  // -----------------------------
  const didInit = useRef(false);
  useEffect(() => {
    if (roleLoading) return;
    if (didInit.current) return;
    didInit.current = true;

    fetchAllClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleLoading, API_BASE_URL]);

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoRut.trim() || !nuevaRazonSocial.trim()) return;

    try {
      setCreatingCliente(true);

      const body = { rut: nuevoRut.trim(), razonSocial: nuevaRazonSocial.trim() };

      const res = await fetch(`${API_BASE_URL}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message || j?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const created: Cliente = await res.json();

      setClientes((prev) => {
        const map = new Map(prev.map((c) => [rutKey(c), c]));
        map.set(rutKey(created), created);
        return Array.from(map.values());
      });

      setClientesMeta((m) => ({ ...m, total: (m.total || 0) + 1 }));

      setNuevoRut("");
      setNuevaRazonSocial("");
    } catch (err) {
      console.error("[Front] Error creando cliente", err);
      alert("No se pudo crear el cliente. Revisa los datos o intenta nuevamente.");
    } finally {
      setCreatingCliente(false);
    }
  };

  const openEditarCliente = (c: Cliente) => {
    setEditingCliente({
      id: c.id,
      rut: c.rut,
      razonSocial: c.razonSocial,
      alias: c.alias ?? null,
      codigoCartera: c.codigoCartera ?? null,
      agenteId: typeof c.agenteId === "number" ? c.agenteId : null,
      activo: c.activo ?? true,
    });
  };

  const closeEditarCliente = () => setEditingCliente(null);

  // ✅ obtiene el "codigo de cartera" desde el trabajador (aquí usamos carpetaDriveCodigo)
  const getCodigoCarteraFromAgente = (agenteId: number | null) => {
    if (!agenteId) return null;
    const t = trabajadores.find((x) => x.id_trabajador === agenteId);
    const code = (t as any)?.carpetaDriveCodigo as string | null | undefined;
    return (code ?? "").trim() ? (code ?? null) : null;
  };

  const saveEditarCliente = async () => {
    if (!editingCliente?.id) return;
    if (!canManageClientes) return;

    const id = editingCliente.id;
    const prev = clientes.find((c) => c.id === id);
    const prevKey = prev ? rutKey(prev) : rutKey(editingCliente);

    try {
      setSavingCliente(true);

      // 👇 OJO: NO mandamos codigoCartera manual
      // El backend lo asigna en base al agenteId (o lo dejamos consistente con la lógica)
      const body: any = {
        rut: (editingCliente.rut || "").trim(),
        razonSocial: (editingCliente.razonSocial || "").trim(),
        alias: editingCliente.alias ?? null,
        agenteId: editingCliente.agenteId ?? null,
        activo: Boolean(editingCliente.activo),
      };

      const res = await fetch(`${API_BASE_URL}/clientes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message || j?.error || msg;
        } catch {}
        throw new Error(msg);
      }

      const updated: Cliente = await res.json();

      setClientes((prevList) => {
        const map = new Map(prevList.map((c) => [rutKey(c), c]));
        const nextKey = rutKey(updated);
        if (prevKey && prevKey !== nextKey) map.delete(prevKey);
        map.set(nextKey, updated);
        return Array.from(map.values());
      });

      closeEditarCliente();
    } catch (err: any) {
      console.error("[Front] Error guardando cliente", err);
      alert(`No se pudo guardar. ${err?.message || ""}`.trim());
    } finally {
      setSavingCliente(false);
    }
  };

  const getNombreEjecutivo = (agenteId?: number | null) => {
    if (!agenteId) return "Sin asignar";
    const t = trabajadores.find((x) => x.id_trabajador === agenteId);
    return t ? t.nombre : String(agenteId);
  };

  // ✅ Aplicar filtro por agente + búsqueda
  const clientesFiltrados = useMemo(() => {
    const q = busquedaClientesTabla.trim().toLowerCase();

    return clientes.filter((c) => {
      if (agenteFiltro === "UNASSIGNED") {
        if (c.agenteId !== null && typeof c.agenteId !== "undefined") return false;
      } else if (agenteFiltro !== "ALL") {
        const id = Number(agenteFiltro);
        if (!Number.isFinite(id)) return true;
        if (Number(c.agenteId ?? -1) !== id) return false;
      }

      if (!q) return true;

      const rut = (c.rut || "").toLowerCase();
      const razon = (c.razonSocial || "").toLowerCase();
      const alias = (c.alias || "").toLowerCase();
      const cartera = (c.codigoCartera || "").toLowerCase();
      const ejecutivo = getNombreEjecutivo(c.agenteId).toLowerCase();

      return rut.includes(q) || razon.includes(q) || alias.includes(q) || cartera.includes(q) || ejecutivo.includes(q);
    });
  }, [clientes, busquedaClientesTabla, agenteFiltro, trabajadores]);

  // ✅ Agrupado por agente
  const gruposPorAgente = useMemo(() => {
    const map = new Map<string, { label: string; agenteId: number | null; items: Cliente[] }>();

    const keyOf = (agenteId: number | null | undefined) =>
      agenteId === null || typeof agenteId === "undefined" ? "UNASSIGNED" : `A:${agenteId}`;

    for (const c of clientesFiltrados) {
      const k = keyOf(c.agenteId as any);
      if (!map.has(k)) {
        const id = k === "UNASSIGNED" ? null : Number(String(k).slice(2));
        const label = id === null ? "Sin asignar" : getNombreEjecutivo(id);
        map.set(k, { label, agenteId: id, items: [] });
      }
      map.get(k)!.items.push(c);
    }

    const arr = Array.from(map.values()).map((g) => ({
      ...g,
      items: g.items.sort((a, b) => (a.razonSocial || "").localeCompare(b.razonSocial || "", "es")),
    }));

    arr.sort((a, b) => {
      const aUn = a.agenteId === null;
      const bUn = b.agenteId === null;
      if (aUn && !bUn) return 1;
      if (!aUn && bUn) return -1;
      return b.items.length - a.items.length;
    });

    return arr;
  }, [clientesFiltrados, trabajadores]);

  const conteoPorAgente = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of clientes) {
      const k = c.agenteId === null || typeof c.agenteId === "undefined" ? "UNASSIGNED" : String(c.agenteId);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return counts;
  }, [clientes]);

  return (
    <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Crear */}
        <form
          onSubmit={handleCrearCliente}
          className="w-full md:w-80 border border-black/5 rounded-xl p-3 bg-[#F9FAFB]"
        >
          <h2 className="text-sm font-semibold text-black/80 flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4" />
            Crear nuevo cliente
          </h2>

          {!canManageClientes && (
            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mb-2">
              Tu rol no permite crear/editar clientes.
            </p>
          )}

          <label className="block mb-2 text-[11px]">
            <span className="font-semibold text-black/70">RUT</span>
            <input
              type="text"
              value={nuevoRut}
              onChange={(e) => setNuevoRut(e.target.value)}
              placeholder="Ej: 76.511.417-9"
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#D4AF37] bg-white"
              required
              disabled={!canManageClientes}
            />
          </label>

          <label className="block mb-3 text-[11px]">
            <span className="font-semibold text-black/70">Razón social</span>
            <input
              type="text"
              value={nuevaRazonSocial}
              onChange={(e) => setNuevaRazonSocial(e.target.value)}
              placeholder="Ej: ECO PACTO SPA"
              className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#D4AF37] bg-white"
              required
              disabled={!canManageClientes}
            />
          </label>

          <button
            type="submit"
            disabled={creatingCliente || !canManageClientes}
            className={`w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 text-white ${
              creatingCliente || !canManageClientes ? "bg-black/40 cursor-not-allowed" : "bg-[#D4AF37] hover:brightness-105"
            }`}
          >
            {creatingCliente ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            {creatingCliente ? "Creando..." : "Crear cliente"}
          </button>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={fetchAllClientes}
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
            >
              <Loader2 className={`w-3 h-3 ${loadingClientes === "loading" ? "animate-spin" : ""}`} />
              Cargar TODO
            </button>
          </div>

          <p className="text-[10px] text-black/45 mt-2">
            Rol: <b>{roleLoading ? "verificando..." : role ?? "no detectado"}</b>{" "}
            {canManageClientes ? "· Puedes editar/asignar clientes" : "· Solo lectura de clientes"}
          </p>
        </form>

        {/* Lista / agrupado */}
        <div className="flex-1">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 mb-2">
            <h2 className="text-sm font-semibold text-black/80 flex items-center gap-2">
              <User className="w-4 h-4 text-black/60" />
              Clientes registrados
            </h2>

            <div className="flex flex-wrap items-center gap-2">
              {/* filtro agente */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-black/10 bg-white">
                <Filter className="w-3.5 h-3.5 text-black/50" />
                <select
                  value={agenteFiltro}
                  onChange={(e) => setAgenteFiltro(e.target.value)}
                  className="text-[11px] outline-none bg-transparent"
                >
                  <option value="ALL">Todos ({clientes.length})</option>
                  <option value="UNASSIGNED">Sin asignar ({conteoPorAgente.get("UNASSIGNED") || 0})</option>
                  {trabajadores.map((t) => (
                    <option key={t.id_trabajador} value={String(t.id_trabajador)}>
                      {t.nombre} ({conteoPorAgente.get(String(t.id_trabajador)) || 0})
                    </option>
                  ))}
                </select>
              </div>

              {/* modo vista */}
              <div className="inline-flex items-center gap-1 p-1 rounded-lg border border-black/10 bg-white">
                <button
                  type="button"
                  onClick={() => setModoVista("AGRUPADO")}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold ${
                    modoVista === "AGRUPADO" ? "bg-black/10" : "hover:bg-black/5"
                  }`}
                >
                  <Users className="w-3 h-3 inline mr-1" />
                  Agrupado
                </button>
                <button
                  type="button"
                  onClick={() => setModoVista("LISTA")}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold ${
                    modoVista === "LISTA" ? "bg-black/10" : "hover:bg-black/5"
                  }`}
                >
                  Lista
                </button>
              </div>

              {/* search */}
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2 top-2.5 text-black/40" />
                <input
                  value={busquedaClientesTabla}
                  onChange={(e) => setBusquedaClientesTabla(e.target.value)}
                  placeholder="Buscar rut/razón/alias/cartera/ejecutivo…"
                  className="w-72 max-w-[70vw] border border-black/15 rounded-lg pl-7 pr-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                />
              </div>

              <button
                type="button"
                onClick={fetchAllClientes}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
                title="Refrescar"
              >
                <Loader2 className={`w-3 h-3 ${loadingClientes === "loading" ? "animate-spin" : ""}`} />
                Refrescar
              </button>
            </div>
          </div>

          {loadingClientes === "loading" && (
            <p className="text-xs text-black/50 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Cargando clientes… (trayendo TODO)
            </p>
          )}

          {errorClientes && (
            <p className="text-xs text-rose-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {errorClientes}
            </p>
          )}

          {loadingClientes === "success" && clientes.length === 0 && (
            <p className="text-xs text-black/50">Aún no tienes clientes registrados.</p>
          )}

          {/* Vista Agrupada */}
          {loadingClientes === "success" && modoVista === "AGRUPADO" && (
            <div className="mt-2 flex flex-col gap-3">
              {gruposPorAgente.length === 0 ? (
                <div className="text-xs text-black/50">No hay resultados con los filtros actuales.</div>
              ) : (
                gruposPorAgente.map((g) => (
                  <div key={String(g.agenteId ?? "UNASSIGNED")} className="border border-black/10 rounded-xl bg-white">
                    <div className="px-3 py-2 border-b border-black/5 flex items-center justify-between">
                      <div className="text-[12px] font-semibold text-black/80">
                        {g.label}
                        <span className="ml-2 text-[11px] text-black/45 font-normal">({g.items.length})</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAgenteFiltro(g.agenteId !== null ? String(g.agenteId) : "UNASSIGNED")}
                        className="text-[11px] px-3 py-1.5 rounded-lg border border-black/10 bg-black/5 hover:bg-black/10"
                        title="Filtrar"
                      >
                        Ver solo
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-black/[0.02]">
                            <th className="text-left px-3 py-2 border-b border-black/5">RUT</th>
                            <th className="text-left px-3 py-2 border-b border-black/5">Razón social</th>
                            <th className="text-left px-3 py-2 border-b border-black/5">Cartera</th>
                            <th className="text-left px-3 py-2 border-b border-black/5">Estado</th>
                            <th className="text-right px-3 py-2 border-b border-black/5">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map((c) => (
                            <tr key={String(c.id ?? c.rut ?? rutKey(c))} className="hover:bg-black/[0.02]">
                              <td className="px-3 py-2 border-b border-black/5 font-mono">{c.rut || "-"}</td>
                              <td className="px-3 py-2 border-b border-black/5">
                                {c.razonSocial}
                                {c.alias ? <span className="ml-2 text-[10px] text-black/40">({c.alias})</span> : null}
                              </td>
                              <td className="px-3 py-2 border-b border-black/5">{c.codigoCartera || "-"}</td>
                              <td className="px-3 py-2 border-b border-black/5">
                                {c.activo === false ? (
                                  <span className="text-rose-700 font-semibold">Inactivo</span>
                                ) : (
                                  <span className="text-emerald-700 font-semibold">Activo</span>
                                )}
                              </td>
                              <td className="px-3 py-2 border-b border-black/5 text-right">
                                <button
                                  type="button"
                                  disabled={!canManageClientes}
                                  onClick={() => openEditarCliente(c)}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                                    canManageClientes
                                      ? "bg-black/5 text-black/70 hover:bg-black/10"
                                      : "bg-black/10 text-black/40 cursor-not-allowed"
                                  }`}
                                >
                                  Editar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Vista Lista */}
          {loadingClientes === "success" && modoVista === "LISTA" && (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-black/[0.03]">
                    <th className="text-left px-3 py-2 border-b border-black/10">RUT</th>
                    <th className="text-left px-3 py-2 border-b border-black/10">Razón social</th>
                    <th className="text-left px-3 py-2 border-b border-black/10">Cartera</th>
                    <th className="text-left px-3 py-2 border-b border-black/10">Ejecutivo</th>
                    <th className="text-left px-3 py-2 border-b border-black/10">Estado</th>
                    <th className="text-right px-3 py-2 border-b border-black/10">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map((c) => (
                    <tr key={String(c.id ?? c.rut ?? rutKey(c))} className="hover:bg-black/[0.02]">
                      <td className="px-3 py-2 border-b border-black/5 font-mono">{c.rut || "-"}</td>
                      <td className="px-3 py-2 border-b border-black/5">
                        {c.razonSocial}
                        {c.alias ? <span className="ml-2 text-[10px] text-black/40">({c.alias})</span> : null}
                      </td>
                      <td className="px-3 py-2 border-b border-black/5">{c.codigoCartera || "-"}</td>
                      <td className="px-3 py-2 border-b border-black/5">{getNombreEjecutivo(c.agenteId)}</td>
                      <td className="px-3 py-2 border-b border-black/5">
                        {c.activo === false ? (
                          <span className="text-rose-700 font-semibold">Inactivo</span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">Activo</span>
                        )}
                      </td>
                      <td className="px-3 py-2 border-b border-black/5 text-right">
                        <button
                          type="button"
                          disabled={!canManageClientes}
                          onClick={() => openEditarCliente(c)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                            canManageClientes
                              ? "bg-black/5 text-black/70 hover:bg-black/10"
                              : "bg-black/10 text-black/40 cursor-not-allowed"
                          }`}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="mt-2 text-[10px] text-black/45">
                Mostrando {clientesFiltrados.length} de {clientesMeta.total || clientes.length}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL EDITAR CLIENTE */}
      {editingCliente && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg border border-black/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-black/80">Editar cliente</h3>
                <p className="text-[11px] text-black/50">
                  {canManageClientes
                    ? "Admin/Supervisor pueden editar todo y reasignar ejecutivo."
                    : "Solo lectura: tu rol no permite editar ni reasignar."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditarCliente}
                className="text-[11px] px-3 py-1.5 rounded-lg border border-black/10 bg-black/5 hover:bg-black/10"
                disabled={savingCliente}
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-[11px]">
              <label className="block">
                <span className="font-semibold text-black/70">RUT</span>
                <input
                  value={editingCliente.rut}
                  onChange={(e) => setEditingCliente((p) => (p ? { ...p, rut: e.target.value } : p))}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  disabled={savingCliente || !canManageClientes}
                />
              </label>

              <label className="block">
                <span className="font-semibold text-black/70">Razón social</span>
                <input
                  value={editingCliente.razonSocial}
                  onChange={(e) => setEditingCliente((p) => (p ? { ...p, razonSocial: e.target.value } : p))}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  disabled={savingCliente || !canManageClientes}
                />
              </label>

              <label className="block">
                <span className="font-semibold text-black/70">Alias</span>
                <input
                  value={editingCliente.alias ?? ""}
                  onChange={(e) => setEditingCliente((p) => (p ? { ...p, alias: e.target.value || null } : p))}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  disabled={savingCliente || !canManageClientes}
                />
              </label>

              <label className="block">
                <span className="font-semibold text-black/70">Código cartera</span>
                <input
                  value={editingCliente.codigoCartera ?? ""}
                  readOnly
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none bg-black/[0.03] text-black/70"
                  title="Se asigna automáticamente según el ejecutivo"
                />
                <p className="mt-1 text-[10px] text-black/45">
                  Se completa automáticamente desde el ejecutivo seleccionado.
                </p>
              </label>

              <label className="block">
                <span className="font-semibold text-black/70">Ejecutivo (agente)</span>
                <select
                  value={editingCliente.agenteId === null ? "" : String(editingCliente.agenteId)}
                  onChange={(e) => {
                    const newAgenteId = e.target.value ? Number(e.target.value) : null;

                    setEditingCliente((p) => {
                      if (!p) return p;

                      const newCodigo = getCodigoCarteraFromAgente(newAgenteId);
                      return { ...p, agenteId: newAgenteId, codigoCartera: newCodigo };
                    });
                  }}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  disabled={savingCliente || !canManageClientes}
                >
                  <option value="">Sin asignar</option>
                  {trabajadores.map((t) => (
                    <option key={t.id_trabajador} value={String(t.id_trabajador)}>
                      {t.nombre} ({t.email})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="font-semibold text-black/70">Estado</span>
                <select
                  value={editingCliente.activo === false ? "false" : "true"}
                  onChange={(e) => setEditingCliente((p) => (p ? { ...p, activo: e.target.value === "true" } : p))}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  disabled={savingCliente || !canManageClientes}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditarCliente}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
                disabled={savingCliente}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={saveEditarCliente}
                disabled={savingCliente || !canManageClientes}
                className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 text-white ${
                  savingCliente || !canManageClientes ? "bg-black/40 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {savingCliente && <Loader2 className="w-3 h-3 animate-spin" />}
                {savingCliente ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ClientesTab;
