import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Search,
  Calendar,
  Building2,
  RefreshCw,
  User,
  Shield,
  Users,
  FileUp,
  Briefcase,
} from "lucide-react";
import * as XLSX from "xlsx";

type UserRole = "admin" | "analyst";

type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
};

type TareaEstado = "pendiente" | "completado" | "atrasado";

type Tarea = {
  id: string;
  nombre: string;
  vencimiento: string;
  estado: TareaEstado;
  comentario?: string;
};

type Cliente = {
  id: string;
  nombre: string;
  rut: string;
  email?: string;
  progreso: number;
  tareas: Tarea[];
};

type Analista = {
  id: string;
  nombre: string;
  email: string;
  avatar: string;
  clientes: Cliente[];
  cargaTotal: number;
  completadas: number;
};

type TareaFila = {
  id: string;
  nombre: string;
  vencimiento: string;
  estado: TareaEstado;
  comentario?: string;

  analistaId: string;
  analistaNombre: string;
  analistaEmail: string;

  clienteId: string;
  clienteNombre: string;
  clienteRut: string;
  clienteEmail?: string;
};

const ADMIN_USER: UserProfile = {
  id: "admin",
  name: "Administrador",
  email: "administrador@cintax.cl",
  role: "admin",
  avatar: "AD",
};

const INITIAL_DATA: Analista[] = [];

// 👇 BASE URL para tu backend
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

const getCurrentPeriod = () => {
  const date = new Date();
  const month = date.toLocaleString("es-ES", { month: "long" });
  const year = date.getFullYear();
  return `${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`;
};

const ProgressBar = ({
  value,
  colorClass = "bg-[var(--secondary-color)]",
}: {
  value: number;
  colorClass?: string;
}) => (
  <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
    <div
      className={`h-full ${colorClass} transition-all duration-500`}
      style={{ width: `${value}%` }}
    />
  </div>
);

const StatusBadge = ({
  status,
  date,
}: {
  status: TareaEstado;
  date: string;
}) => {
  const vencimiento = new Date(date);
  const hoy = new Date();
  const isLate =
    !isNaN(vencimiento.getTime()) &&
    vencimiento < hoy &&
    status !== "completado";

  if (status === "completado")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase border border-emerald-100">
        <CheckCircle2 size={10} /> Listo
      </span>
    );
  if (isLate || status === "atrasado")
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[10px] font-bold uppercase border border-rose-100">
        <AlertCircle size={10} /> Atrasado
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-bold uppercase border border-amber-100">
      <Clock size={10} /> Pendiente
    </span>
  );
};

// 🔐 helper para leer el accessToken (ajusta la key si usas otra)
function getAccessToken(): string | null {
  try {
    return (localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token"))
  } catch {
    return null;
  }
}

// ✅ helper para pedir las tareas al backend con Authorization
async function fetchAnalistasConTareas(role: UserRole): Promise<Analista[]> {
  const params = new URLSearchParams();
  params.set("soloPendientes", "true"); // solo tareas pendientes/EN_PROCESO
  if (role === "admin") {
    params.set("todos", "true"); // admin ve todas las de todos
  }

  const base = API_BASE_URL.replace(/\/$/, "");
  const url = `${base}/auth/tareas-asignadas?${params.toString()}`;

  console.log("[Tareas] Fetch a:", url);

  const token = getAccessToken();

  if (!token) {
    // No hay token =>  simulamos error de sesión expirada
    throw new Error("No hay token de sesión. Inicia sesión nuevamente.");
  }

  const res = await fetch(url, {
    credentials: "include", // envía cookies (refresh)
    headers: {
      Authorization: `Bearer ${token}`, // 👈 IMPORTANTE
      "Content-Type": "application/json",
    },
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[Tareas] Respuesta NO OK:",
      res.status,
      res.statusText,
      "Body:",
      text.slice(0, 300)
    );

    if (res.status === 401) {
      throw new Error(
        "No autorizado. Tu sesión puede haber expirado, vuelve a iniciar sesión."
      );
    }

    throw new Error(
      `Error HTTP ${res.status} al obtener tareas asignadas (${res.statusText})`
    );
  }

  if (contentType.includes("text/html")) {
    const text = await res.text();
    console.error(
      "[Tareas] El backend devolvió HTML (probablemente index.html o error):",
      text.slice(0, 300)
    );
    throw new Error(
      "El backend devolvió HTML en vez de JSON. Revisa la URL /api/tareas-asignadas o el proxy."
    );
  }

  const data = await res.json();
  return data.analistas as Analista[];
}

export default function TareasPage() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(ADMIN_USER);
  const [periodo, setPeriodo] = useState(getCurrentPeriod());
  const [analistas, setAnalistas] = useState<Analista[]>(INITIAL_DATA);

  const [expandedAnalista, setExpandedAnalista] = useState<string | null>(null);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [isImportingPortfolio, setIsImportingPortfolio] = useState(false);
  const [isImportingTasks, setIsImportingTasks] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const tasksInputRef = useRef<HTMLInputElement>(null);

  const availableUsers = useMemo(() => {
    const users: UserProfile[] = [ADMIN_USER];
    if (!analistas.find((a) => a.email === "administrador@cintax.cl")) {
      users.push({
        id: "a-admin",
        name: "Administrador",
        email: "administrador@cintax.cl",
        role: "analyst",
        avatar: "SC",
      });
    }
    analistas.forEach((a) => {
      users.push({
        id: a.id,
        name: a.nombre,
        email: a.email || `${a.nombre.split(" ")[0].toLowerCase()}@cintax.cl`,
        role: "analyst",
        avatar: a.avatar,
      });
    });
    return users.filter(
      (v, i, a) => a.findIndex((t) => t.email === v.email) === i
    );
  }, [analistas]);

  // Carga tareas desde el backend cuando cambia el rol (admin / analyst)
  useEffect(() => {
    const cargarTareas = async () => {
      try {
        setIsLoading(true);
        setErrorMsg(null);
        const data = await fetchAnalistasConTareas(currentUser.role);
        setAnalistas(data);

        if (currentUser.role === "analyst" && data.length > 0) {
          setExpandedAnalista(data[0].id);
        }
      } catch (err: any) {
        console.error(err);
        setErrorMsg(
          err?.message ||
            "No se pudieron cargar las tareas desde el servidor. Intenta nuevamente."
        );
      } finally {
        setIsLoading(false);
      }
    };

    cargarTareas();
  }, [currentUser.role]);

  // Para el modo "Probar vistas" dentro del front
  useEffect(() => {
    if (currentUser.role === "analyst") {
      const myAnalystProfile = analistas.find(
        (a) => a.email === currentUser.email
      );
      if (myAnalystProfile) {
        setExpandedAnalista(myAnalystProfile.id);
      }
    } else {
      setExpandedAnalista(null);
    }
  }, [currentUser, analistas]);

  const toggleAnalista = (id: string) =>
    setExpandedAnalista((prev) => (prev === id ? null : id));
  const toggleCliente = (id: string) =>
    setExpandedCliente((prev) => (prev === id ? null : id));

  const handleToggleTask = (
    analistaId: string,
    clienteId: string,
    tareaId: string
  ) => {
    if (currentUser.role === "admin") {
      alert("Modo Supervisión: Solo lectura.");
      return;
    }
    const targetAnalyst = analistas.find((a) => a.id === analistaId);
    if (targetAnalyst?.email !== currentUser.email) {
      alert("No tienes permisos sobre las tareas de este analista.");
      return;
    }

    setAnalistas((prev) =>
      prev.map((a) => {
        if (a.id !== analistaId) return a;
        return {
          ...a,
          clientes: a.clientes.map((c) => {
            if (c.id !== clienteId) return c;
            const updatedTareas = c.tareas.map((t) => {
              if (t.id !== tareaId) return t;
              return {
                ...t,
                estado:
                  t.estado === "completado"
                    ? "pendiente"
                    : ("completado" as TareaEstado),
              };
            });
            const completed = updatedTareas.filter(
              (t) => t.estado === "completado"
            ).length;
            const progress = Math.round(
              (completed / updatedTareas.length) * 100
            );

            const delta =
              completed >
              c.tareas.filter((x) => x.estado === "completado").length
                ? 1
                : -1;
            a.completadas = Math.max(0, a.completadas + delta);

            return { ...c, tareas: updatedTareas, progreso: progress };
          }),
        };
      })
    );
  };

  const handlePortfolioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentUser.role !== "admin") return;
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingPortfolio(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        processPortfolioData(jsonData as any[][]);
      } catch (err) {
        console.error(err);
        setErrorMsg(
          "Error al leer el archivo Excel. Asegúrese de que sea válido."
        );
      } finally {
        setIsImportingPortfolio(false);
        if (portfolioInputRef.current) portfolioInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processPortfolioData = (rows: any[][]) => {
    if (rows.length < 2) {
      setErrorMsg("El archivo está vacío.");
      return;
    }

    const headers = rows[0].map((h) => String(h).trim().toLowerCase());
    const idxRutFicha = headers.findIndex((h) => h.includes("rut ficha"));
    const idxRazonSocial = headers.findIndex(
      (h) => h.includes("razón social") || h.includes("razon social")
    );
    const idxCorreoCliente = headers.findIndex((h) =>
      h.includes("correo cliente")
    );
    const idxNombreAnalista = headers.findIndex((h) =>
      h.includes("nombre analista")
    );
    const idxCorreoAnalista = headers.findIndex((h) =>
      h.includes("correo analista")
    );

    if (idxRutFicha === -1 || idxNombreAnalista === -1) {
      setErrorMsg(
        "No se encontraron las columnas requeridas (Rut Ficha, Nombre Analista). Verifique el formato."
      );
      return;
    }

    const mapAnalistas = new Map<string, Analista>();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rutCliente = row[idxRutFicha];
      const nombreCliente = row[idxRazonSocial] || "Cliente Sin Nombre";
      const correoCliente =
        idxCorreoCliente !== -1 ? row[idxCorreoCliente] : "";
      const nombreAnalista = row[idxNombreAnalista];
      const correoAnalista =
        idxCorreoAnalista !== -1 ? row[idxCorreoAnalista] : "";

      if (!nombreAnalista || !rutCliente) continue;

      const analistaKey = correoAnalista || nombreAnalista;

      if (!mapAnalistas.has(analistaKey)) {
        mapAnalistas.set(analistaKey, {
          id: `a-${Math.random().toString(36).substr(2, 5)}`,
          nombre: nombreAnalista,
          email: correoAnalista,
          avatar: String(nombreAnalista).charAt(0).toUpperCase(),
          clientes: [],
          cargaTotal: 0,
          completadas: 0,
        });
      }
      const analista = mapAnalistas.get(analistaKey)!;

      const clienteExists = analista.clientes.some((c) => c.rut === rutCliente);

      if (!clienteExists) {
        analista.clientes.push({
          id: `c-${String(rutCliente).replace(/\./g, "")}`,
          nombre: nombreCliente,
          rut: rutCliente,
          email: correoCliente,
          progreso: 0,
          tareas: [],
        });
      }
    }

    if (mapAnalistas.size === 0) {
      setErrorMsg("No se pudieron extraer datos válidos.");
      return;
    }

    setAnalistas(Array.from(mapAnalistas.values()));
    setSuccessMsg(
      `Cartera cargada: ${mapAnalistas.size} analistas procesados.`
    );
  };

  const handleTasksUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    alert(
      "Funcionalidad de 'Cargar Tareas' pendiente de implementación en el siguiente paso."
    );
  };

  const handleExport = () => {
    if (currentUser.role !== "admin") return;

    const wb = XLSX.utils.book_new();
    const data = [
      [
        "Analista",
        "Cliente",
        "RUT",
        "Tarea",
        "Vencimiento",
        "Estado",
        "Observación",
      ],
    ];

    analistas.forEach((a) => {
      a.clientes.forEach((c) => {
        c.tareas.forEach((t) => {
          data.push([
            a.nombre,
            c.nombre,
            c.rut,
            t.nombre,
            t.vencimiento,
            t.estado,
            t.comentario || "",
          ]);
        });
      });
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_${periodo.replace(/ /g, "_")}.xlsx`);

  };

  // solo pendientes/atrasadas, más filtro por analista / búsqueda
    // solo pendientes/atrasadas, + filtro por rol (admin/analyst)
  const viewData = useMemo(() => {
    let data = analistas;

    // si es analista, solo sus tareas
    if (currentUser.role === "analyst") {
      data = analistas.filter((a) => a.email === currentUser.email);
    }

    // dejamos sólo tareas pendientes o atrasadas
    data = data.map((a) => ({
      ...a,
      clientes: a.clientes.map((c) => ({
        ...c,
        tareas: c.tareas.filter(
          (t) => t.estado === "pendiente" || t.estado === "atrasado"
        ),
      })),
    }));

    return data;
  }, [analistas, currentUser]);

  // 🔹 FLAT LIST: convertimos analista -> cliente -> tarea en filas planas
  const tareasPlanas = useMemo<TareaFila[]>(() => {
    const rows: TareaFila[] = [];

    viewData.forEach((a) => {
      a.clientes.forEach((c) => {
        c.tareas.forEach((t) => {
          rows.push({
            id: t.id,
            nombre: t.nombre,
            vencimiento: t.vencimiento,
            estado: t.estado,
            comentario: t.comentario,

            analistaId: a.id,
            analistaNombre: a.nombre,
            analistaEmail: a.email,

            clienteId: c.id,
            clienteNombre: c.nombre,
            clienteRut: c.rut,
            clienteEmail: c.email,
          });
        });
      });
    });

    if (!searchTerm) return rows;

    const lower = searchTerm.toLowerCase();
    return rows.filter(
      (r) =>
        r.analistaNombre.toLowerCase().includes(lower) ||
        r.analistaEmail.toLowerCase().includes(lower) ||
        r.clienteNombre.toLowerCase().includes(lower) ||
        r.clienteRut.toLowerCase().includes(lower) ||
        r.nombre.toLowerCase().includes(lower)
    );
  }, [viewData, searchTerm]);

  const stats = useMemo(() => {
    const total = tareasPlanas.length;
    const atrasadas = tareasPlanas.filter(
      (t) =>
        new Date(t.vencimiento) < new Date() && t.estado !== "completado"
    ).length;

    // por ahora no tenemos completadas en esta vista (son solo pendientes/atrasadas)
    const completadas = 0;
    const nClientes = new Set(tareasPlanas.map((t) => t.clienteId)).size;

    const cumplimiento =
      total + completadas > 0
        ? Math.round((completadas / (total + completadas)) * 100)
        : 0;

    return { total, completadas, atrasadas, nClientes, cumplimiento };
  }, [tareasPlanas]);


    return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header sesión actual */}
      <div className="bg-black text-white p-4 rounded-xl flex flex-wrap items-center justify-between text-sm shadow-lg mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-[var(--secondary-color)]" />
          <div>
            <p className="text-xs opacity-60 uppercase font-bold tracking-wider">
              Sesión Actual
            </p>
            <p className="font-medium text-lg">{currentUser.name}</p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                currentUser.role === "admin"
                  ? "bg-purple-500 text-white"
                  : "bg-blue-500 text-white"
              }`}
            >
              {currentUser.role === "admin" ? "Super Admin" : "Analista"}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1">
          <p className="text-xs opacity-60 mr-1">Probar vistas:</p>
          <div className="flex flex-wrap gap-2 justify-end">
            {availableUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => setCurrentUser(u)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                  currentUser.id === u.id
                    ? "bg-[var(--secondary-color)] text-white shadow-sm ring-1 ring-white/20"
                    : "bg-white/10 hover:bg-white/20 text-white/80"
                }`}
              >
                {u.role === "admin" ? <Shield size={12} /> : <User size={12} />}
                {u.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Título + periodo + acciones */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-black/5 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary-color)]">
            {currentUser.role === "admin"
              ? "Panel de Planificación"
              : "Mis Tareas"}
          </h1>
          <p className="text-black/60 text-sm mt-1">
            {currentUser.role === "admin"
              ? "Gestión de Analistas y asignación de tareas mensuales."
              : `Hola ${currentUser.name}, este es tu plan mensual.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-white border border-[#af9150]/30 px-4 py-2 rounded-xl shadow-[0_2px_8px_rgba(175,145,80,0.15)] transition-all hover:shadow-[0_4px_12px_rgba(175,145,80,0.25)]">
            <div className="p-2 bg-[#af9150]/10 rounded-lg">
              <Calendar size={18} className="text-[#af9150]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[#af9150] uppercase tracking-widest leading-none mb-0.5">
                Periodo
              </span>
              <span className="text-sm font-bold text-[var(--primary-color)] leading-none">
                {periodo}
              </span>
            </div>
          </div>

          {currentUser.role === "admin" && (
            <>
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={portfolioInputRef}
                onChange={handlePortfolioUpload}
                className="hidden"
              />
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                ref={tasksInputRef}
                onChange={handleTasksUpload}
                className="hidden"
              />

              <button
                onClick={handleExport}
                className="bg-green-600 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-md hover:opacity-90 transition-opacity active:scale-95"
              >
                <FileSpreadsheet size={16} />
                Exportar Reporte
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mensajes */}
      {errorMsg && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl flex items-center gap-2 text-sm">
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      {isLoading && (
        <div className="text-center text-sm text-black/50 py-4">
          Cargando tareas pendientes...
        </div>
      )}

      {/* Contenido principal: vacío vs tabla */}
      {analistas.length === 0 && !isLoading ? (
        <div className="text-center py-16 border-2 border-dashed border-black/10 rounded-2xl bg-[var(--tertiary-color)]/20">
          <Briefcase size={48} className="mx-auto text-black/20 mb-4" />
          <h3 className="text-lg font-semibold text-black/60">
            Sin tareas asignadas
          </h3>
          <p className="text-sm text-black/40 max-w-md mx-auto mt-1">
            Aún no existen tareas asignadas para este periodo.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Buscador */}
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40"
            />
            <input
              type="text"
              placeholder="Buscar por analista, cliente, RUT o tarea..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-black/10 rounded-2xl outline-none focus:border-[var(--secondary-color)] shadow-sm"
            />
          </div>

          {/* Tabla de tareas planas */}
          <div className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 bg-gray-50/60">
              <div>
                <h2 className="text-sm font-semibold text-[var(--primary-color)]">
                  Tareas pendientes / atrasadas
                </h2>
                <p className="text-xs text-black/40">
                  {tareasPlanas.length === 0
                    ? "No hay tareas pendientes para mostrar."
                    : `${tareasPlanas.length} tareas encontradas (${stats.atrasadas} atrasadas)`}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-black/5 bg-black/5 text-[10px] uppercase tracking-wide text-black/50">
                    <th className="px-3 py-2 text-left">Analista</th>
                    <th className="px-3 py-2 text-left">Cliente</th>
                    <th className="px-3 py-2 text-left">Tarea</th>
                    <th className="px-3 py-2 text-left">Vencimiento</th>
                    <th className="px-3 py-2 text-left">Estado</th>
                    {currentUser.role === "analyst" && (
                      <th className="px-3 py-2 text-right">Acciones</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tareasPlanas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={currentUser.role === "analyst" ? 7 : 6}
                        className="px-4 py-4 text-center text-xs text-black/40"
                      >
                        No hay tareas pendientes que coincidan con el filtro.
                      </td>
                    </tr>
                  ) : (
                    tareasPlanas.map((t) => (
                      <tr
                        key={t.id}
                        className="border-b border-black/5 hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium text-[var(--primary-color)]">
                              {t.analistaNombre}
                            </span>
                            <span className="text-[10px] text-black/40">
                              {t.analistaEmail}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium text-black/80">
                              {t.clienteNombre}
                            </span>
                            {t.clienteEmail && (
                              <span className="text-[10px] text-black/40">
                                {t.clienteEmail}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-black/80">
                          {t.nombre}
                        </td>
                        <td className="px-3 py-2 text-black/70">
                          {new Date(t.vencimiento).toLocaleDateString("es-CL")}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            status={t.estado}
                            date={t.vencimiento}
                          />
                        </td>
                        {currentUser.role === "analyst" && (
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() =>
                                handleToggleTask(
                                  t.analistaId,
                                  t.clienteId,
                                  t.id
                                )
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-[var(--secondary-color)] text-white hover:opacity-90 active:scale-95"
                            >
                              <CheckCircle2 size={12} />
                              Marcar lista
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
