// src/pages/CreacionTareasPage.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  AlertCircle,
  Plus,
  User,
  ListTodo,
  Users,
  ClipboardList,
  SlidersHorizontal,
  Search,
  Ban,
  CheckCircle2,
} from "lucide-react";

const API_BASE_URL =
  // @ts-ignore
  (import.meta && import.meta.env && import.meta.env.VITE_API_BASE_URL) ||
  "http://localhost:3000/api";

type LoadState = "idle" | "loading" | "success" | "error";

// -----------------------------
// Helpers auth
// -----------------------------
const getAuthToken = () => {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token")
  );
};

const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

// -----------------------------
// Tipos
// -----------------------------
type Cliente = {
  id?: number;
  rut: string;
  razonSocial: string;
  alias?: string | null;
  codigoCartera?: string | null;
  agenteId?: number | null;
  activo?: boolean;
  email?: string | null;
};

type TrabajadorAPI = {
  id_trabajador?: number;
  id?: number;
  trabajadorId?: number;
  nombre?: string;
  name?: string;
  email?: string;
};

type Trabajador = {
  id_trabajador: number;
  nombre: string;
  email: string;
};

type Presentacion = "CLIENTE" | "INTERNO";
type Area = "CONTA" | "ADMIN" | "RRHH" | "TRIBUTARIO";
type FrecuenciaTarea = "MENSUAL" | "SEMANAL" | "UNICA";

type TareaPlantilla = {
  id_tarea_plantilla: number;
  area?: Area | string;
  nombre: string;
  detalle?: string;
  codigoDocumento?: string | null;
  presentacion?: Presentacion | string | null;
  frecuencia?: FrecuenciaTarea | string | null;
  activo: boolean;
  requiereDrive?: boolean;

  diaSemanaVencimiento?: number | null; // 1..7
  diaMesVencimiento?: number | null; // 1..31
};

type PlantillaConAplica = TareaPlantilla & {
  aplica: boolean;
  exclusion: null | {
    motivo: string | null;
    desdeFecha: string | null;
    activa?: boolean; // true=NO aplica explícito, false=APLICA explícito
  };
};

type TareaAsignadaAPI = {
  id_tarea_asignada: number;
  tareaPlantillaId: number;
  trabajadorId: number;
  rutCliente: string;
  estado: string;
  fechaProgramada: string | Date | null;
  fechaComplecion: string | Date | null;
  comentarios: string | null;
  driveTareaFolderId: string | null;
  plantilla: {
    id_tarea_plantilla: number;
    area: string | null;
    nombre: string;
    detalle: string | null;
    codigoDocumento: string | null;
    presentacion: string | null;
    frecuencia: string | null;
    activo: boolean;
    requiereDrive: boolean | null;
    diaSemanaVencimiento: number | null;
    diaMesVencimiento: number | null;
  };
};

type TabCreacion = "clientes" | "tareas" | "asignaciones" | "edicion";

// -----------------------------
// Helpers fecha (vencimiento)
// -----------------------------
const pad2 = (n: number) => String(n).padStart(2, "0");

const toISOAtNoonLocal = (d: Date) => {
  // Hora 12:00 para evitar que TZ te "mueva" el día
  const safe = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
  return safe.toISOString();
};

const endOfMonthDateString = (anio: number, mes: number) => {
  // mes: 1-12
  const last = new Date(anio, mes, 0);
  return `${last.getFullYear()}-${pad2(last.getMonth() + 1)}-${pad2(
    last.getDate()
  )}`;
};

const dateStringToISOAtNoon = (yyyyMMdd: string) => {
  const [y, m, d] = yyyyMMdd.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  return toISOAtNoonLocal(date);
};

const nombreMes = (m: number) =>
  [
    "",
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ][m] || `Mes ${m}`;

const CreacionTareasPage: React.FC = () => {
  const [tab, setTab] = useState<TabCreacion>("clientes");

  // =============================
  // Loading UI acciones
  // =============================
  const [creatingCliente, setCreatingCliente] = useState(false);
  const [creatingPlantilla, setCreatingPlantilla] = useState(false);

  // Eliminar plantilla: spinner por fila
  const [deletingRow, setDeletingRow] = useState<Record<number, boolean>>({});

  // =============================
  // CLIENTES
  // =============================
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState<LoadState>("idle");
  const [errorClientes, setErrorClientes] = useState<string | null>(null);

  const [nuevoRut, setNuevoRut] = useState("");
  const [nuevaRazonSocial, setNuevaRazonSocial] = useState("");
  const [nuevoEmailCliente, setNuevoEmailCliente] = useState("");

  const fetchClientes = async () => {
    setLoadingClientes("loading");
    setErrorClientes(null);
    try {
      const res = await fetch(`${API_BASE_URL}/clientes`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data: Cliente[] = await res.json();

      const uniqueByRut = Array.from(
        new Map((data || []).map((c) => [c.rut, c])).values()
      );
      setClientes(uniqueByRut);
      setLoadingClientes("success");
    } catch (err) {
      console.error("[Front] Error cargando clientes", err);
      setErrorClientes("No se pudieron cargar los clientes.");
      setLoadingClientes("error");
    }
  };

  const handleCrearCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoRut.trim() || !nuevaRazonSocial.trim()) return;

    try {
      setCreatingCliente(true);

      const body = {
        rut: nuevoRut.trim(),
        razonSocial: nuevaRazonSocial.trim(),
        email: nuevoEmailCliente.trim() || null,
      };

      const res = await fetch(`${API_BASE_URL}/clientes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const created: Cliente = await res.json();

      setClientes((prev) => {
        const map = new Map(prev.map((c) => [c.rut, c]));
        map.set(created.rut, created);
        return Array.from(map.values());
      });

      setNuevoRut("");
      setNuevaRazonSocial("");
      setNuevoEmailCliente("");
    } catch (err) {
      console.error("[Front] Error creando cliente", err);
      alert("No se pudo crear el cliente. Revisa los datos o intenta nuevamente.");
    } finally {
      setCreatingCliente(false);
    }
  };

  // =============================
  // TRABAJADORES
  // =============================
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loadingTrabajadores, setLoadingTrabajadores] =
    useState<LoadState>("idle");
  const [errorTrabajadores, setErrorTrabajadores] = useState<string | null>(
    null
  );

  const fetchTrabajadores = async () => {
    setLoadingTrabajadores("loading");
    setErrorTrabajadores(null);
    try {
      const res = await fetch(`${API_BASE_URL}/trabajadores`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const raw: unknown = await res.json();
      const arr = Array.isArray(raw) ? (raw as TrabajadorAPI[]) : [];

      const normalized: Trabajador[] = arr
        .map((t): Trabajador => {
          const id = Number(t.id_trabajador ?? t.id ?? t.trabajadorId);
          const nombre = String(t.nombre ?? t.name ?? "");
          const email = String(t.email ?? "");
          return { id_trabajador: id, nombre, email };
        })
        .filter(
          (t) =>
            Number.isFinite(t.id_trabajador) &&
            t.id_trabajador > 0 &&
            t.nombre.trim().length > 0
        );

      const uniq = Array.from(
        new Map(normalized.map((t) => [t.id_trabajador, t])).values()
      ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

      setTrabajadores(uniq);
      setLoadingTrabajadores("success");
    } catch (err) {
      console.error("[Front] Error cargando trabajadores", err);
      setErrorTrabajadores("No se pudieron cargar los trabajadores.");
      setLoadingTrabajadores("error");
    }
  };

  // =============================
  // TAREAS / PLANTILLAS
  // =============================
  const [plantillas, setPlantillas] = useState<TareaPlantilla[]>([]);
  const [loadingPlantillas, setLoadingPlantillas] = useState<LoadState>("idle");
  const [errorPlantillas, setErrorPlantillas] = useState<string | null>(null);

  const [nuevaArea, setNuevaArea] = useState<Area>("CONTA");
  const [nuevoNombreTarea, setNuevoNombreTarea] = useState("");
  const [nuevoDetalleTarea, setNuevoDetalleTarea] = useState("");
  const [nuevoCodigoDoc, setNuevoCodigoDoc] = useState("");
  const [nuevaPresentacion, setNuevaPresentacion] =
    useState<Presentacion>("CLIENTE");
  const [nuevaFrecuencia, setNuevaFrecuencia] =
    useState<FrecuenciaTarea>("UNICA");

  const [diaSemanaVencimiento, setDiaSemanaVencimiento] = useState<number>(1);
  const [diaMesVencimiento, setDiaMesVencimiento] = useState<number>(1);

  useEffect(() => {
    if (nuevaFrecuencia === "SEMANAL") setDiaMesVencimiento(1);
    if (nuevaFrecuencia === "MENSUAL") setDiaSemanaVencimiento(1);
    if (nuevaFrecuencia === "UNICA") {
      setDiaSemanaVencimiento(1);
      setDiaMesVencimiento(1);
    }
  }, [nuevaFrecuencia]);

  const fetchPlantillas = async () => {
    setLoadingPlantillas("loading");
    setErrorPlantillas(null);
    try {
      const res = await fetch(`${API_BASE_URL}/tareas/plantillas`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: TareaPlantilla[] = await res.json();
      setPlantillas((data || []).filter((p) => p.activo));
      setLoadingPlantillas("success");
    } catch (err) {
      console.error("[Front] Error cargando plantillas", err);
      setErrorPlantillas("No se pudieron cargar las tareas/plantillas.");
      setLoadingPlantillas("error");
    }
  };

  const handleCrearPlantilla = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombreTarea.trim()) return;
    if (!nuevoDetalleTarea.trim()) {
      alert("Debes ingresar el detalle (es obligatorio).");
      return;
    }

    try {
      setCreatingPlantilla(true);

      const body: Record<string, unknown> = {
        area: nuevaArea,
        nombre: nuevoNombreTarea.trim(),
        detalle: nuevoDetalleTarea.trim(),
        frecuencia: nuevaFrecuencia,
        presentacion: nuevaPresentacion,
        codigoDocumento: nuevoCodigoDoc.trim() || null,
        activo: true,
        ...(nuevaFrecuencia === "SEMANAL" ? { diaSemanaVencimiento } : {}),
        ...(nuevaFrecuencia === "MENSUAL" ? { diaMesVencimiento } : {}),
      };

      const res = await fetch(`${API_BASE_URL}/tareas/plantillas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      const created: TareaPlantilla = await res.json();
      setPlantillas((prev) => [...prev, created]);

      setNuevaArea("CONTA");
      setNuevoNombreTarea("");
      setNuevoDetalleTarea("");
      setNuevoCodigoDoc("");
      setNuevaPresentacion("CLIENTE");
      setNuevaFrecuencia("UNICA");
      setDiaSemanaVencimiento(1);
      setDiaMesVencimiento(1);

      alert("✅ Plantilla creada");
    } catch (err: unknown) {
      console.error("[Front] Error creando plantilla", err);
      const msg =
        err instanceof Error && err.message
          ? `No se pudo crear la plantilla. Detalle: ${err.message}`
          : "No se pudo crear la plantilla.";
      alert(msg);
    } finally {
      setCreatingPlantilla(false);
    }
  };

  // =============================
  // ELIMINAR PLANTILLA + TAREAS (cascade)
  // =============================
  const eliminarPlantillaCascade = async (id: number) => {
    if (!Number.isFinite(id) || id <= 0) {
      alert("ID inválido");
      return;
    }

    const ok = confirm("¿Eliminar la plantilla y TODAS sus tareas asignadas?");
    if (!ok) return;

    setDeletingRow((p) => ({ ...p, [id]: true }));

    try {
      const res = await fetch(`${API_BASE_URL}/tareas/plantillas/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });

      let payload: any = null;
      try {
        payload = await res.json();
      } catch {}

      if (!res.ok) {
        const msg = payload?.message || payload?.error || `Error ${res.status}`;
        throw new Error(msg);
      }

      if (payload?.plantillaId && Number(payload.plantillaId) !== id) {
        throw new Error("Respuesta inesperada: plantillaId no coincide.");
      }

      setPlantillas((prev) => prev.filter((p) => p.id_tarea_plantilla !== id));

      alert(
        `✅ Eliminada.\nTareas eliminadas: ${
          payload?.tareasEliminadas ?? "?"
        }\nExclusiones eliminadas: ${
          payload?.exclusionesEliminadas ?? "?"
        }\nNotificaciones eliminadas: ${payload?.notificacionesEliminadas ?? "?"}`
      );
    } catch (err: any) {
      console.error("[Front] Error eliminando plantilla cascade", err);
      alert(`No se pudo eliminar. ${err?.message || ""}`.trim());
    } finally {
      setDeletingRow((p) => ({ ...p, [id]: false }));
    }
  };

  // =============================
  // ASIGNAR / CREAR TAREA (manual)
  // =============================
  const [rutSeleccionado, setRutSeleccionado] = useState<string>("");
  const [busquedaCliente, setBusquedaCliente] = useState<string>("");

  const clientesFiltrados = useMemo(() => {
    const q = busquedaCliente.trim().toLowerCase();
    if (!q) return clientes;

    return clientes.filter((c) => {
      const rut = (c.rut || "").toLowerCase();
      const razon = (c.razonSocial || "").toLowerCase();
      const alias = (c.alias || "").toLowerCase();
      return rut.includes(q) || razon.includes(q) || alias.includes(q);
    });
  }, [clientes, busquedaCliente]);

  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] =
    useState<string>("");
  const [trabajadorSeleccionadoId, setTrabajadorSeleccionadoId] =
    useState<string>("");

  const now = new Date();
  const [anio, setAnio] = useState<number>(now.getFullYear());
  const [mes, setMes] = useState<number>(now.getMonth() + 1);

  const [fechaVencimiento, setFechaVencimiento] = useState<string>(() =>
    endOfMonthDateString(now.getFullYear(), now.getMonth() + 1)
  );

  useEffect(() => {
    setFechaVencimiento(endOfMonthDateString(anio, mes));
  }, [anio, mes]);

  const [asignando, setAsignando] = useState(false);

  const handleAsignarTarea = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rutSeleccionado || !plantillaSeleccionadaId || !trabajadorSeleccionadoId) {
      alert("Debes seleccionar cliente, tarea y trabajador.");
      return;
    }

    if (!fechaVencimiento) {
      alert("Debes seleccionar una fecha de vencimiento.");
      return;
    }

    const fechaProgramadaISO = dateStringToISOAtNoon(fechaVencimiento);
    if (!fechaProgramadaISO) {
      alert("Fecha de vencimiento inválida.");
      return;
    }

    try {
      setAsignando(true);

      const body = {
        tareaPlantillaId: Number(plantillaSeleccionadaId),
        rutClientes: [rutSeleccionado],
        fechaProgramada: fechaProgramadaISO,
        asignarAId: Number(trabajadorSeleccionadoId),
      };

      const res = await fetch(`${API_BASE_URL}/tareas/crear-desde-plantilla`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      const data: any = await res.json();
      alert(`✅ Tarea creada/asignada. Registros creados: ${data?.count ?? 1}`);

      setRutSeleccionado("");
      setPlantillaSeleccionadaId("");
      setTrabajadorSeleccionadoId("");
      setBusquedaCliente("");
    } catch (err: unknown) {
      console.error("[Front] Error creando/asignando tarea", err);
      const msg =
        err instanceof Error && err.message
          ? `No se pudo crear/asignar la tarea. Detalle: ${err.message}`
          : "No se pudo crear/asignar la tarea.";
      alert(msg);
    } finally {
      setAsignando(false);
    }
  };

  // =============================
  // EDICIÓN (Ejecutivo -> Cliente -> Tareas aplica / no aplica)
  // + mostrar SOLO tareas asignadas a ese cliente
  // =============================
  const [ejecutivoId, setEjecutivoId] = useState<string>("");
  const [clientesEjecutivo, setClientesEjecutivo] = useState<Cliente[]>([]);
  const [loadingClientesEjecutivo, setLoadingClientesEjecutivo] =
    useState<LoadState>("idle");
  const [errorClientesEjecutivo, setErrorClientesEjecutivo] =
    useState<string | null>(null);

  const [busquedaClienteEj, setBusquedaClienteEj] = useState<string>("");
  const [rutClienteEdicion, setRutClienteEdicion] = useState<string>("");

  const [plantillasConAplica, setPlantillasConAplica] = useState<PlantillaConAplica[]>([]);
  const [loadingPlantillasConAplica, setLoadingPlantillasConAplica] =
    useState<LoadState>("idle");
  const [errorPlantillasConAplica, setErrorPlantillasConAplica] =
    useState<string | null>(null);

  const [motivosDraft, setMotivosDraft] = useState<Record<number, string>>({});
  const [updatingRow, setUpdatingRow] = useState<Record<number, boolean>>({});

  // ✅ NUEVO: tareas asignadas para filtrar la tabla
  const [tareasAsignadasEdicion, setTareasAsignadasEdicion] = useState<TareaAsignadaAPI[]>([]);
  const [loadingTareasAsignadasEdicion, setLoadingTareasAsignadasEdicion] =
    useState<LoadState>("idle");
  const [errorTareasAsignadasEdicion, setErrorTareasAsignadasEdicion] =
    useState<string | null>(null);

  const fetchClientesPorEjecutivo = async (agenteId: number) => {
    setLoadingClientesEjecutivo("loading");
    setErrorClientesEjecutivo(null);

    // reset al cambiar ejecutivo
    setRutClienteEdicion("");
    setPlantillasConAplica([]);
    setLoadingPlantillasConAplica("idle");
    setErrorPlantillasConAplica(null);
    setMotivosDraft({});
    setUpdatingRow({});
    setTareasAsignadasEdicion([]);
    setLoadingTareasAsignadasEdicion("idle");
    setErrorTareasAsignadasEdicion(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/clientes?agenteId=${agenteId}&soloActivos=true&limit=500`,
        { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: Cliente[] = await res.json();
      const uniqueByRut = Array.from(
        new Map((data || []).map((c) => [c.rut, c])).values()
      );
      setClientesEjecutivo(uniqueByRut);
      setLoadingClientesEjecutivo("success");
    } catch (err) {
      console.error("[Front] Error cargando clientes por ejecutivo", err);
      setErrorClientesEjecutivo("No se pudieron cargar los clientes del ejecutivo.");
      setLoadingClientesEjecutivo("error");
    }
  };

  const clientesEjFiltrados = useMemo(() => {
    const q = busquedaClienteEj.trim().toLowerCase();
    if (!q) return clientesEjecutivo;

    return clientesEjecutivo.filter((c) => {
      const rut = (c.rut || "").toLowerCase();
      const razon = (c.razonSocial || "").toLowerCase();
      const alias = (c.alias || "").toLowerCase();
      return rut.includes(q) || razon.includes(q) || alias.includes(q);
    });
  }, [clientesEjecutivo, busquedaClienteEj]);

  const fetchPlantillasConAplica = async (rut: string) => {
    setLoadingPlantillasConAplica("loading");
    setErrorPlantillasConAplica(null);
    setMotivosDraft({});
    try {
      const res = await fetch(
        `${API_BASE_URL}/tareas/plantillas-con-aplica?rut=${encodeURIComponent(rut)}`,
        { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: PlantillaConAplica[] = await res.json();
      setPlantillasConAplica(data || []);
      setLoadingPlantillasConAplica("success");
    } catch (err) {
      console.error("[Front] Error cargando plantillas con aplica", err);
      setErrorPlantillasConAplica("No se pudo cargar la matriz de tareas del cliente.");
      setLoadingPlantillasConAplica("error");
    }
  };

  // ✅ NUEVO: traer tareas asignadas (para filtrar tabla)
  const fetchTareasAsignadasEdicion = async (rut: string, trabajadorId: number) => {
    setLoadingTareasAsignadasEdicion("loading");
    setErrorTareasAsignadasEdicion(null);

    try {
      // ✅ si tu backend quedó con doble "tareas", cambia aquí a:
      // `${API_BASE_URL}/tareas/tareas/asignadas?rut=...`
      const res = await fetch(
        `${API_BASE_URL}/tareas/asignadas?rut=${encodeURIComponent(
          rut
        )}&trabajadorId=${trabajadorId}&limit=1000`,
        { headers: { "Content-Type": "application/json", ...getAuthHeaders() } }
      );

      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data: unknown = await res.json();
      setTareasAsignadasEdicion(Array.isArray(data) ? (data as TareaAsignadaAPI[]) : []);
      setLoadingTareasAsignadasEdicion("success");
    } catch (err) {
      console.error("[Front] Error cargando tareas asignadas (edición)", err);
      setErrorTareasAsignadasEdicion("No se pudieron cargar las tareas asignadas del cliente.");
      setLoadingTareasAsignadasEdicion("error");
      setTareasAsignadasEdicion([]);
    }
  };

  // ✅ Filtrar: solo mostrar plantillas que estén asignadas al cliente (por trabajador seleccionado)
  const plantillasConAplicaFiltradas = useMemo(() => {
    if (!rutClienteEdicion) return [];
    if (!ejecutivoId) return [];
    if (loadingTareasAsignadasEdicion !== "success") return [];

    const setPlantillasAsignadas = new Set(
      (tareasAsignadasEdicion || []).map((t) => Number(t.tareaPlantillaId))
    );

    return (plantillasConAplica || []).filter((p) =>
      setPlantillasAsignadas.has(Number(p.id_tarea_plantilla))
    );
  }, [
    rutClienteEdicion,
    ejecutivoId,
    loadingTareasAsignadasEdicion,
    tareasAsignadasEdicion,
    plantillasConAplica,
  ]);

  // ✅ Nuevo: upsert de aplica / no aplica (modelo: default NO aplica)
  const upsertAplica = async (tareaPlantillaId: number, activa: boolean) => {
    if (!rutClienteEdicion) return;

    const motivo = (motivosDraft[tareaPlantillaId] ?? "").trim() || null;

    setUpdatingRow((p) => ({ ...p, [tareaPlantillaId]: true }));

    // optimistic
    setPlantillasConAplica((prev) =>
      prev.map((p) => {
        if (p.id_tarea_plantilla !== tareaPlantillaId) return p;

        const aplica = activa === false; // activa=false => APLICA

        return {
          ...p,
          aplica,
          exclusion: {
            motivo: activa ? motivo : null, // motivo solo tiene sentido en NO aplica
            desdeFecha: null,
            activa,
          },
        };
      })
    );

    try {
      const body = {
        rutCliente: rutClienteEdicion,
        tareaPlantillaId,
        activa, // true=NO aplica, false=APLICA
        motivo: activa ? motivo : null,
        desdeFecha: null,
      };

      const res = await fetch(`${API_BASE_URL}/tareas/exclusion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const j = await res.json();
          msg = j?.error || j?.message || msg;
        } catch {}
        throw new Error(msg);
      }

      // refrescar ambos
      await fetchPlantillasConAplica(rutClienteEdicion);
      await fetchTareasAsignadasEdicion(rutClienteEdicion, Number(ejecutivoId));
    } catch (err: unknown) {
      console.error("[Front] Error upsert aplica/no aplica", err);
      alert(`No se pudo actualizar. ${err instanceof Error ? err.message : ""}`);
      await fetchPlantillasConAplica(rutClienteEdicion);
      await fetchTareasAsignadasEdicion(rutClienteEdicion, Number(ejecutivoId));
    } finally {
      setUpdatingRow((p) => ({ ...p, [tareaPlantillaId]: false }));
    }
  };

  // =============================
  // Cargas iniciales (guard anti StrictMode double-run)
  // =============================
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    fetchClientes();
    fetchTrabajadores();
    fetchPlantillas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const anioActual = now.getFullYear();
  const opcionesAnios = useMemo(
    () => [anioActual - 1, anioActual, anioActual + 1],
    [anioActual]
  );

  // =============================
  // RENDER
  // =============================

    return (
    <div className="flex flex-col gap-4">
      {/* HEADER */}
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-black/70" />
          <div>
            <h1 className="text-lg font-semibold text-black/80">
              Creación de tareas
            </h1>
            <p className="text-xs text-black/50">
              Gestiona clientes, define plantillas, asigna tareas y configura
              “NO aplica” por cliente.
            </p>
          </div>
        </div>

        <div className="mt-3 inline-flex bg-black/5 rounded-full p-0.5 text-[11px] self-start flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setTab("clientes")}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
              tab === "clientes"
                ? "bg-white shadow text-black/80"
                : "text-black/60"
            }`}
          >
            <User className="w-3 h-3" />
            Clientes
          </button>

          <button
            type="button"
            onClick={() => setTab("tareas")}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
              tab === "tareas"
                ? "bg-white shadow text-black/80"
                : "text-black/60"
            }`}
          >
            <ListTodo className="w-3 h-3" />
            Tareas / plantillas
          </button>

          <button
            type="button"
            onClick={() => setTab("asignaciones")}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
              tab === "asignaciones"
                ? "bg-white shadow text-black/80"
                : "text-black/60"
            }`}
          >
            <Users className="w-3 h-3" />
            Asignar manual
          </button>

          <button
            type="button"
            onClick={() => setTab("edicion")}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1 ${
              tab === "edicion"
                ? "bg-white shadow text-black/80"
                : "text-black/60"
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            Edición por ejecutivo
          </button>
        </div>
      </section>

      {/* TAB CLIENTES */}
      {tab === "clientes" && (
        <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <form
              onSubmit={handleCrearCliente}
              className="w-full md:w-80 border border-black/5 rounded-xl p-3 bg-[#F9FAFB]"
            >
              <h2 className="text-sm font-semibold text-black/80 flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4" />
                Crear nuevo cliente
              </h2>

              <label className="block mb-2 text-[11px]">
                <span className="font-semibold text-black/70">RUT</span>
                <input
                  type="text"
                  value={nuevoRut}
                  onChange={(e) => setNuevoRut(e.target.value)}
                  placeholder="Ej: 76.511.417-9"
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#D4AF37] bg-white"
                  required
                />
              </label>

              <label className="block mb-2 text-[11px]">
                <span className="font-semibold text-black/70">Razón social</span>
                <input
                  type="text"
                  value={nuevaRazonSocial}
                  onChange={(e) => setNuevaRazonSocial(e.target.value)}
                  placeholder="Ej: ECO PACTO SPA"
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#D4AF37] bg-white"
                  required
                />
              </label>

              <label className="block mb-3 text-[11px]">
                <span className="font-semibold text-black/70">
                  Email de contacto (opcional)
                </span>
                <input
                  type="email"
                  value={nuevoEmailCliente}
                  onChange={(e) => setNuevoEmailCliente(e.target.value)}
                  placeholder="cliente@empresa.cl"
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#D4AF37] bg-white"
                />
              </label>

              <button
                type="submit"
                disabled={creatingCliente}
                className={`w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 text-white ${
                  creatingCliente
                    ? "bg-black/40 cursor-wait"
                    : "bg-[#D4AF37] hover:brightness-105"
                }`}
              >
                {creatingCliente ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                {creatingCliente ? "Creando..." : "Crear cliente"}
              </button>
            </form>

            <div className="flex-1">
              <h2 className="text-sm font-semibold text-black/80 mb-2">
                Clientes registrados
              </h2>

              {loadingClientes === "loading" && (
                <p className="text-xs text-black/50 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando clientes…
                </p>
              )}

              {errorClientes && (
                <p className="text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errorClientes}
                </p>
              )}

              {loadingClientes === "success" && clientes.length === 0 && (
                <p className="text-xs text-black/50">
                  Aún no tienes clientes registrados.
                </p>
              )}

              {loadingClientes === "success" && clientes.length > 0 && (
                <div className="mt-1 overflow-x-auto">
                  <table className="min-w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-black/[0.03]">
                        <th className="text-left px-3 py-2 border-b border-black/10">
                          RUT
                        </th>
                        <th className="text-left px-3 py-2 border-b border-black/10">
                          Razón social
                        </th>
                        <th className="text-left px-3 py-2 border-b border-black/10">
                          Cartera
                        </th>
                        <th className="text-left px-3 py-2 border-b border-black/10">
                          Ejecutivo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientes.map((c) => (
                        <tr key={c.id ?? c.rut} className="hover:bg-black/[0.02]">
                          <td className="px-3 py-2 border-b border-black/5 font-mono">
                            {c.rut}
                          </td>
                          <td className="px-3 py-2 border-b border-black/5">
                            {c.razonSocial}
                            {c.alias ? (
                              <span className="ml-2 text-[10px] text-black/40">
                                ({c.alias})
                              </span>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 border-b border-black/5">
                            {c.codigoCartera || "-"}
                          </td>
                          <td className="px-3 py-2 border-b border-black/5">
                            {typeof c.agenteId === "number" ? c.agenteId : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB TAREAS / PLANTILLAS */}
      {tab === "tareas" && (
        <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <form
              onSubmit={handleCrearPlantilla}
              className="w-full md:w-96 border border-black/5 rounded-xl p-3 bg-[#F9FAFB]"
            >
              <h2 className="text-sm font-semibold text-black/80 flex items-center gap-2 mb-2">
                <Plus className="w-4 h-4" />
                Crear nueva plantilla (TareaPlantilla)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <label className="block text-[11px]">
                  <span className="font-semibold text-black/70">Área</span>
                  <select
                    value={nuevaArea}
                    onChange={(e) => setNuevaArea(e.target.value as Area)}
                    className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="CONTA">CONTA</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="RRHH">RRHH</option>
                    <option value="TRIBUTARIO">TRIBUTARIO</option>
                  </select>
                </label>

                <label className="block text-[11px]">
                  <span className="font-semibold text-black/70">Frecuencia</span>
                  <select
                    value={nuevaFrecuencia}
                    onChange={(e) => {
                      const v = e.target.value as FrecuenciaTarea;
                      setNuevaFrecuencia(v);
                      if (v === "SEMANAL") setDiaSemanaVencimiento(1);
                      if (v === "MENSUAL") setDiaMesVencimiento(1);
                    }}
                    className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="UNICA">Única</option>
                    <option value="MENSUAL">Mensual</option>
                    <option value="SEMANAL">Semanal</option>
                  </select>
                </label>
              </div>

              {nuevaFrecuencia === "SEMANAL" && (
                <label className="block mt-2 text-[11px]">
                  <span className="font-semibold text-black/70">
                    Día de vencimiento semanal
                  </span>
                  <select
                    value={diaSemanaVencimiento}
                    onChange={(e) => setDiaSemanaVencimiento(Number(e.target.value))}
                    className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value={1}>Lunes</option>
                    <option value={2}>Martes</option>
                    <option value={3}>Miércoles</option>
                    <option value={4}>Jueves</option>
                    <option value={5}>Viernes</option>
                    <option value={6}>Sábado</option>
                    <option value={7}>Domingo</option>
                  </select>
                  <p className="mt-1 text-[10px] text-black/45">
                    Se usa para calcular el vencimiento semanal automático.
                  </p>
                </label>
              )}

              {nuevaFrecuencia === "MENSUAL" && (
                <label className="block mt-2 text-[11px]">
                  <span className="font-semibold text-black/70">
                    Día de vencimiento mensual
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={diaMesVencimiento}
                    onChange={(e) => setDiaMesVencimiento(Number(e.target.value))}
                    className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  />
                  <p className="mt-1 text-[10px] text-black/45">
                    Si el mes no tiene ese día, el backend debería ajustar al último
                    día.
                  </p>
                </label>
              )}

              <label className="block mt-2 text-[11px]">
                <span className="font-semibold text-black/70">Nombre de la tarea</span>
                <input
                  type="text"
                  value={nuevoNombreTarea}
                  onChange={(e) => setNuevoNombreTarea(e.target.value)}
                  placeholder="Ej: Convenios y/o postergaciones TGR"
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#D4AF37] bg-white"
                  required
                />
              </label>

              <label className="block mt-2 text-[11px]">
                <span className="font-semibold text-black/70">Detalle (obligatorio)</span>
                <textarea
                  value={nuevoDetalleTarea}
                  onChange={(e) => setNuevoDetalleTarea(e.target.value)}
                  placeholder="Describe qué debe hacerse para completar esta tarea..."
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-2 text-xs outline-none focus:border-[#D4AF37] bg-white min-h-[72px]"
                  required
                />
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <label className="block text-[11px]">
                  <span className="font-semibold text-black/70">
                    Código documento (opcional)
                  </span>
                  <input
                    type="text"
                    value={nuevoCodigoDoc}
                    onChange={(e) => setNuevoCodigoDoc(e.target.value)}
                    placeholder="Ej: F29, F50..."
                    className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-[#D4AF37] bg-white"
                  />
                </label>

                <label className="block text-[11px]">
                  <span className="font-semibold text-black/70">Presentación</span>
                  <select
                    value={nuevaPresentacion}
                    onChange={(e) => setNuevaPresentacion(e.target.value as Presentacion)}
                    className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    <option value="CLIENTE">Cliente</option>
                    <option value="INTERNO">Interno</option>
                  </select>
                </label>
              </div>

              <button
                type="submit"
                disabled={creatingPlantilla}
                className={`mt-3 w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 text-white ${
                  creatingPlantilla
                    ? "bg-black/40 cursor-wait"
                    : "bg-[#D4AF37] hover:brightness-105"
                }`}
              >
                {creatingPlantilla ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                {creatingPlantilla ? "Creando..." : "Crear plantilla"}
              </button>
            </form>

            <div className="flex-1">
              <h2 className="text-sm font-semibold text-black/80 mb-2">Plantillas activas</h2>

              {loadingPlantillas === "loading" && (
                <p className="text-xs text-black/50 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando plantillas…
                </p>
              )}

              {errorPlantillas && (
                <p className="text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errorPlantillas}
                </p>
              )}

              {loadingPlantillas === "success" && plantillas.length === 0 && (
                <p className="text-xs text-black/50">Aún no tienes plantillas activas.</p>
              )}

              {loadingPlantillas === "success" && plantillas.length > 0 && (
                <div className="mt-1 overflow-x-auto">
                  <table className="min-w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-black/[0.03]">
                        <th className="text-left px-3 py-2 border-b border-black/10">Área</th>
                        <th className="text-left px-3 py-2 border-b border-black/10">Código</th>
                        <th className="text-left px-3 py-2 border-b border-black/10">Nombre</th>
                        <th className="text-left px-3 py-2 border-b border-black/10">Pres.</th>
                        <th className="text-left px-3 py-2 border-b border-black/10">Freq.</th>
                        <th className="text-right px-3 py-2 border-b border-black/10">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plantillas.map((p) => {
                        const deleting = Boolean(deletingRow[p.id_tarea_plantilla]);
                        return (
                          <tr key={p.id_tarea_plantilla} className="hover:bg-black/[0.02]">
                            <td className="px-3 py-2 border-b border-black/5">{p.area || "-"}</td>
                            <td className="px-3 py-2 border-b border-black/5 font-mono">
                              {p.codigoDocumento || "-"}
                            </td>
                            <td className="px-3 py-2 border-b border-black/5">{p.nombre}</td>
                            <td className="px-3 py-2 border-b border-black/5">
                              {p.presentacion === "CLIENTE" ? "CLI" : "INT"}
                            </td>
                            <td className="px-3 py-2 border-b border-black/5">{p.frecuencia || "-"}</td>
                            <td className="px-3 py-2 border-b border-black/5 text-right">
                              <button
                                type="button"
                                disabled={deleting}
                                onClick={() => eliminarPlantillaCascade(p.id_tarea_plantilla)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                                  deleting
                                    ? "bg-black/10 text-black/40 cursor-wait"
                                    : "bg-rose-600 text-white hover:bg-rose-700"
                                }`}
                                title="Elimina la plantilla y todas sus tareas asignadas"
                              >
                                {deleting && <Loader2 className="w-3 h-3 animate-spin" />}
                                {deleting ? "Eliminando..." : "Eliminar"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TAB ASIGNACIONES */}
      {tab === "asignaciones" && (
        <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-4">
          <form
            onSubmit={handleAsignarTarea}
            className="border border-black/5 rounded-xl p-3 bg-[#F9FAFB] max-w-3xl"
          >
            <h2 className="text-sm font-semibold text-black/80 mb-2">
              Crear tarea asignada (manual)
            </h2>
            <p className="text-[11px] text-black/50 mb-3">
              Crea una tarea puntual en <b>TareaAsignada</b> usando{" "}
              <code>/tareas/crear-desde-plantilla</code>.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <label className="block">
                <span className="font-semibold text-black/70">
                  Cliente (RUT – Razón social)
                </span>

                <input
                  type="text"
                  value={busquedaCliente}
                  onChange={(e) => setBusquedaCliente(e.target.value)}
                  placeholder="Buscar por RUT, razón social o alias…"
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                />

                <select
                  value={rutSeleccionado}
                  onChange={(e) => setRutSeleccionado(e.target.value)}
                  className="mt-2 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  required
                >
                  <option value="">
                    {clientesFiltrados.length === 0
                      ? "Sin resultados…"
                      : "Selecciona un cliente…"}
                  </option>

                  {clientesFiltrados.map((c) => (
                    <option key={c.id ?? c.rut} value={c.rut}>
                      {c.rut} — {c.razonSocial}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-[10px] text-black/45">
                  Mostrando {clientesFiltrados.length} de {clientes.length}
                </p>
              </label>

              <label className="block">
                <span className="font-semibold text-black/70">Tarea / plantilla</span>
                <select
                  value={plantillaSeleccionadaId}
                  onChange={(e) => setPlantillaSeleccionadaId(e.target.value)}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  required
                >
                  <option value="">Selecciona una tarea…</option>
                  {plantillas.map((p) => {
                    const tag = p.presentacion === "CLIENTE" ? "CLI" : "INT";
                    const labelDocumento = p.codigoDocumento
                      ? `${p.codigoDocumento} — ${p.nombre}`
                      : p.nombre;
                    return (
                      <option
                        key={p.id_tarea_plantilla}
                        value={String(p.id_tarea_plantilla)}
                      >
                        {`[${tag}] ${labelDocumento}`}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="block">
                <span className="font-semibold text-black/70">Trabajador responsable</span>
                <select
                  value={trabajadorSeleccionadoId}
                  onChange={(e) => setTrabajadorSeleccionadoId(e.target.value)}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  required
                >
                  <option value="">Selecciona un trabajador…</option>
                  {trabajadores.map((t) => (
                    <option key={t.id_trabajador} value={String(t.id_trabajador)}>
                      {t.nombre} ({t.email})
                    </option>
                  ))}
                </select>

                {loadingTrabajadores === "loading" && (
                  <p className="mt-1 text-[10px] text-black/45 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Cargando…
                  </p>
                )}
                {errorTrabajadores && (
                  <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errorTrabajadores}
                  </p>
                )}
              </label>

              <label className="block">
                <span className="font-semibold text-black/70">Fecha de vencimiento</span>
                <input
                  type="date"
                  value={fechaVencimiento}
                  onChange={(e) => setFechaVencimiento(e.target.value)}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  required
                />
                <p className="mt-1 text-[10px] text-black/45">
                  Esta fecha se guarda en <b>fechaProgramada</b> (vencimiento).
                </p>
              </label>

              <div className="flex gap-3">
                <label className="block flex-1">
                  <span className="font-semibold text-black/70">Mes (atajo)</span>
                  <select
                    value={mes}
                    onChange={(e) => setMes(Number(e.target.value))}
                    className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {nombreMes(m)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block flex-1">
                  <span className="font-semibold text-black/70">Año (atajo)</span>
                  <select
                    value={anio}
                    onChange={(e) => setAnio(Number(e.target.value))}
                    className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  >
                    {opcionesAnios.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={asignando}
                className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 text-white ${
                  asignando
                    ? "bg-black/40 cursor-wait"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {asignando && <Loader2 className="w-3 h-3 animate-spin" />}
                {asignando ? "Creando..." : "Crear y asignar"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* TAB EDICIÓN */}
      {tab === "edicion" && (
        <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-4">
          <div className="border border-black/5 rounded-xl p-3 bg-[#F9FAFB]">
            <h2 className="text-sm font-semibold text-black/80 flex items-center gap-2 mb-2">
              <SlidersHorizontal className="w-4 h-4" />
              Edición de tareas por ejecutivo y cliente
            </h2>
            <p className="text-[11px] text-black/50">
              Flujo: <b>Ejecutivo → Cliente → marcar tareas como “NO aplica”</b>{" "}
              (exclusiones). Ahora solo se muestran las tareas que están asignadas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 text-[11px]">
              {/* Ejecutivo */}
              <label className="block">
                <span className="font-semibold text-black/70">Ejecutivo</span>
                <select
                  value={ejecutivoId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEjecutivoId(v);
                    setClientesEjecutivo([]);
                    setBusquedaClienteEj("");
                    setRutClienteEdicion("");
                    setPlantillasConAplica([]);
                    setMotivosDraft({});
                    setUpdatingRow({});
                    setTareasAsignadasEdicion([]);
                    setLoadingTareasAsignadasEdicion("idle");
                    setErrorTareasAsignadasEdicion(null);
                    setLoadingPlantillasConAplica("idle");
                    setErrorPlantillasConAplica(null);
                    if (v) fetchClientesPorEjecutivo(Number(v));
                  }}
                  className="mt-1 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                >
                  <option value="">Selecciona un ejecutivo…</option>
                  {trabajadores.map((t) => (
                    <option key={t.id_trabajador} value={String(t.id_trabajador)}>
                      {t.nombre} ({t.email})
                    </option>
                  ))}
                </select>

                {loadingClientesEjecutivo === "loading" && (
                  <p className="mt-2 text-[11px] text-black/50 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Cargando clientes del ejecutivo…
                  </p>
                )}
                {errorClientesEjecutivo && (
                  <p className="mt-2 text-[11px] text-rose-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {errorClientesEjecutivo}
                  </p>
                )}
              </label>

              {/* Cliente */}
              <label className="block">
                <span className="font-semibold text-black/70">Cliente</span>

                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Search className="w-3 h-3 absolute left-2 top-2.5 text-black/40" />
                    <input
                      type="text"
                      value={busquedaClienteEj}
                      onChange={(e) => setBusquedaClienteEj(e.target.value)}
                      placeholder="Buscar por RUT, razón social o alias…"
                      className="w-full border border-black/15 rounded-lg pl-7 pr-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                      disabled={!ejecutivoId || loadingClientesEjecutivo === "loading"}
                    />
                  </div>
                </div>

                <select
                  value={rutClienteEdicion}
                  onChange={async (e) => {
                    const rut = e.target.value;
                    setRutClienteEdicion(rut);
                    setPlantillasConAplica([]);
                    setTareasAsignadasEdicion([]);
                    setErrorTareasAsignadasEdicion(null);
                    setErrorPlantillasConAplica(null);

                    if (rut && ejecutivoId) {
                      await Promise.all([
                        fetchPlantillasConAplica(rut),
                        fetchTareasAsignadasEdicion(rut, Number(ejecutivoId)),
                      ]);
                    } else {
                      setLoadingPlantillasConAplica("idle");
                      setLoadingTareasAsignadasEdicion("idle");
                    }
                  }}
                  className="mt-2 w-full border border-black/15 rounded-lg px-2 py-1.5 text-[11px] outline-none focus:border-[#D4AF37] bg-white"
                  disabled={!ejecutivoId || loadingClientesEjecutivo !== "success"}
                >
                  <option value="">
                    {!ejecutivoId
                      ? "Primero selecciona un ejecutivo…"
                      : clientesEjFiltrados.length === 0
                      ? "Sin resultados…"
                      : "Selecciona un cliente…"}
                  </option>
                  {clientesEjFiltrados.map((c) => (
                    <option key={c.id ?? c.rut} value={c.rut}>
                      {c.rut} — {c.razonSocial}
                    </option>
                  ))}
                </select>

                <p className="mt-1 text-[10px] text-black/45">
                  Mostrando {clientesEjFiltrados.length} de {clientesEjecutivo.length}
                </p>
              </label>
            </div>
          </div>

          {/* Tabla tareas por cliente */}
          <div className="border border-black/5 rounded-xl p-3 bg-white">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold text-black/80">
                Tareas asignadas para el cliente (aplica / no aplica)
              </h3>

              {rutClienteEdicion && ejecutivoId && (
                <button
                  type="button"
                  onClick={async () => {
                    await Promise.all([
                      fetchPlantillasConAplica(rutClienteEdicion),
                      fetchTareasAsignadasEdicion(rutClienteEdicion, Number(ejecutivoId)),
                    ]);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 bg-black/5 text-black/70 hover:bg-black/10"
                >
                  <Loader2 className="w-3 h-3" />
                  Refrescar
                </button>
              )}
            </div>

            {!rutClienteEdicion && (
              <p className="text-[11px] text-black/50">
                Selecciona un ejecutivo y un cliente para ver/editar las tareas.
              </p>
            )}

            {/* Loading / errors de asignadas */}
            {rutClienteEdicion && loadingTareasAsignadasEdicion === "loading" && (
              <p className="text-xs text-black/50 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Cargando tareas asignadas…
              </p>
            )}

            {rutClienteEdicion && errorTareasAsignadasEdicion && (
              <p className="text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errorTareasAsignadasEdicion}
              </p>
            )}

            {/* Loading / errors de matriz */}
            {rutClienteEdicion && loadingPlantillasConAplica === "loading" && (
              <p className="text-xs text-black/50 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Cargando matriz de plantillas…
              </p>
            )}

            {rutClienteEdicion && errorPlantillasConAplica && (
              <p className="text-xs text-rose-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errorPlantillasConAplica}
              </p>
            )}

            {/* Caso: no tiene tareas asignadas */}
            {rutClienteEdicion &&
              loadingTareasAsignadasEdicion === "success" &&
              tareasAsignadasEdicion.length === 0 && (
                <p className="text-[11px] text-black/50">
                  Este cliente no tiene tareas asignadas para este ejecutivo, por eso no hay
                  filas para editar.
                </p>
              )}

            {/* Tabla filtrada */}
            {rutClienteEdicion &&
              loadingTareasAsignadasEdicion === "success" &&
              loadingPlantillasConAplica === "success" &&
              tareasAsignadasEdicion.length > 0 && (
                <>
                  {plantillasConAplicaFiltradas.length === 0 ? (
                    <p className="text-[11px] text-black/50">
                      Hay tareas asignadas, pero no se pudo cruzar con plantillas (revisa IDs).
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-black/[0.03]">
                            <th className="text-left px-3 py-2 border-b border-black/10">
                              Área
                            </th>
                            <th className="text-left px-3 py-2 border-b border-black/10">
                              Código
                            </th>
                            <th className="text-left px-3 py-2 border-b border-black/10">
                              Plantilla
                            </th>
                            <th className="text-left px-3 py-2 border-b border-black/10">
                              Estado
                            </th>
                            <th className="text-left px-3 py-2 border-b border-black/10">
                              Motivo (si no aplica)
                            </th>
                            <th className="text-right px-3 py-2 border-b border-black/10">
                              Acción
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {plantillasConAplicaFiltradas.map((p) => {
                            const isNoAplica = !p.aplica;
                            const busy = Boolean(updatingRow[p.id_tarea_plantilla]);

                            return (
                              <tr
                                key={p.id_tarea_plantilla}
                                className={`hover:bg-black/[0.02] ${
                                  isNoAplica ? "opacity-95" : ""
                                }`}
                              >
                                <td className="px-3 py-2 border-b border-black/5">
                                  {p.area || "-"}
                                </td>
                                <td className="px-3 py-2 border-b border-black/5 font-mono">
                                  {p.codigoDocumento || "-"}
                                </td>
                                <td className="px-3 py-2 border-b border-black/5">
                                  <div className="font-semibold text-black/75">{p.nombre}</div>
                                  <div className="text-[10px] text-black/45">
                                    {p.presentacion === "CLIENTE" ? "Cliente" : "Interno"} ·{" "}
                                    {p.frecuencia || "-"}
                                    {p.requiereDrive === false ? " · sin Drive" : ""}
                                  </div>
                                </td>
                                <td className="px-3 py-2 border-b border-black/5">
                                  {isNoAplica ? (
                                    <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                                      <Ban className="w-3 h-3" />
                                      NO aplica
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                      <CheckCircle2 className="w-3 h-3" />
                                      Aplica
                                    </span>
                                  )}
                                </td>

                                {/* Motivo */}
                                <td className="px-3 py-2 border-b border-black/5">
                                  <input
                                    value={
                                      motivosDraft[p.id_tarea_plantilla] ??
                                      p.exclusion?.motivo ??
                                      ""
                                    }
                                    onChange={(e) =>
                                      setMotivosDraft((prev) => ({
                                        ...prev,
                                        [p.id_tarea_plantilla]: e.target.value,
                                      }))
                                    }
                                    placeholder="Opcional…"
                                    disabled={busy}
                                    className="w-full border border-black/15 rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#D4AF37] bg-white disabled:bg-black/[0.03]"
                                  />
                                </td>

                                {/* Acciones */}
                                <td className="px-3 py-2 border-b border-black/5 text-right">
                                  {p.aplica ? (
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={() => upsertAplica(p.id_tarea_plantilla, true)} // true=NO aplica
                                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                                        busy
                                          ? "bg-black/10 text-black/40 cursor-wait"
                                          : "bg-rose-600 text-white hover:bg-rose-700"
                                      }`}
                                    >
                                      {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                                      {busy ? "Guardando..." : "Marcar NO aplica"}
                                    </button>
                                  ) : (
                                    <div className="inline-flex items-center gap-2 justify-end">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => upsertAplica(p.id_tarea_plantilla, false)} // false=APLICA
                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                                          busy
                                            ? "bg-black/10 text-black/40 cursor-wait"
                                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                                        }`}
                                      >
                                        {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                                        {busy ? "Guardando..." : "Hacer que aplique"}
                                      </button>

                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => upsertAplica(p.id_tarea_plantilla, true)} // guarda NO aplica + motivo
                                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-black/10 ${
                                          busy
                                            ? "bg-black/10 text-black/40 cursor-wait"
                                            : "bg-black/5 text-black/70 hover:bg-black/10"
                                        }`}
                                        title="Guarda el estado NO aplica y el motivo"
                                      >
                                        {busy && <Loader2 className="w-3 h-3 animate-spin" />}
                                        {busy ? "..." : "Guardar NO aplica"}
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <p className="mt-2 text-[10px] text-black/45">
                        Mostrando solo plantillas que tienen <b>TareaAsignada</b> para este
                        cliente (según <code>/tareas/asignadas</code>).
                      </p>
                    </div>
                  )}
                </>
              )}
          </div>
        </section>
      )}
    </div>
  );
};

export default CreacionTareasPage;

