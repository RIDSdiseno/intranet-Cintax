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

const ADMIN_USER: UserProfile = {
  id: "admin",
  name: "Administrador",
  email: "administrador@cintax.cl",
  role: "admin",
  avatar: "AD",
};

const INITIAL_DATA: Analista[] = [];

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
    XLSX.writeFile(wb, `Reporte_${periodo.replace(/\s/g, "_")}.xlsx`);
  };

  const viewData = useMemo(() => {
    let data = analistas;
    if (currentUser.role === "analyst") {
      data = analistas.filter((a) => a.email === currentUser.email);
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(
        (a) =>
          a.nombre.toLowerCase().includes(lower) ||
          a.clientes.some((c) => c.nombre.toLowerCase().includes(lower))
      );
    }
    return data;
  }, [analistas, currentUser, searchTerm]);

  const stats = useMemo(() => {
    let total = 0,
      completadas = 0,
      atrasadas = 0,
      nClientes = 0;
    viewData.forEach((a) => {
      total += a.cargaTotal;
      completadas += a.completadas;
      nClientes += a.clientes.length;
      a.clientes.forEach((c) =>
        c.tareas.forEach((t) => {
          if (new Date(t.vencimiento) < new Date() && t.estado !== "completado")
            atrasadas++;
        })
      );
    });
    const cumplimiento =
      total > 0 ? Math.round((completadas / total) * 100) : 0;
    return { total, completadas, atrasadas, nClientes, cumplimiento };
  }, [viewData]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
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

      {analistas.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-black/10 rounded-2xl bg-[var(--tertiary-color)]/20">
          <Briefcase size={48} className="mx-auto text-black/20 mb-4" />
          <h3 className="text-lg font-semibold text-black/60">
            Sin Analistas ni Clientes
          </h3>
          <p className="text-sm text-black/40 max-w-md mx-auto mt-1">
            Paso 1: Como Administrador, carga el documento de Analistas (Excel)
            para asignar las empresas a sus analistas correspondientes.
          </p>
          {currentUser.role === "admin" && (
            <button
              onClick={() => portfolioInputRef.current?.click()}
              className="mt-6 px-6 py-2 bg-[var(--secondary-color)] text-white rounded-xl font-medium shadow-sm hover:opacity-90"
            >
              Cargar Analistas y Clientes
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-black/40"
            />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-black/10 rounded-2xl outline-none focus:border-[var(--secondary-color)] shadow-sm"
            />
          </div>

          {viewData.map((analista) => (
            <div
              key={analista.id}
              className="bg-white border border-black/5 rounded-2xl shadow-sm overflow-hidden"
            >
              <div
                onClick={() =>
                  currentUser.role === "admin" && toggleAnalista(analista.id)
                }
                className={`flex items-center justify-between p-4 transition-colors ${
                  currentUser.role === "admin"
                    ? "cursor-pointer hover:bg-gray-50"
                    : "cursor-default bg-gray-50/30 border-b border-black/5"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--tertiary-color)] flex items-center justify-center text-[var(--secondary-color)] font-bold border border-black/5">
                    {analista.avatar}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--primary-color)]">
                      {analista.nombre}
                    </h3>
                    <p className="text-xs text-black/50">
                      {analista.clientes.length} Clientes Asignados
                    </p>
                    {analista.email && (
                      <p className="text-[10px] text-black/30">
                        {analista.email}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {currentUser.role === "admin" &&
                    (expandedAnalista === analista.id ? (
                      <ChevronDown size={20} className="text-black/40" />
                    ) : (
                      <ChevronRight size={20} className="text-black/40" />
                    ))}
                </div>
              </div>

              {expandedAnalista === analista.id && (
                <div className="bg-white">
                  {analista.clientes.map((cliente) => (
                    <div
                      key={cliente.id}
                      className="border-b border-black/5 last:border-0 p-4 pl-8 flex justify-between items-center"
                    >
                      <div>
                        <h4 className="text-sm font-medium text-black/80">
                          {cliente.nombre}
                        </h4>
                        <p className="text-xs text-black/40">
                          {cliente.rut} • {cliente.email}
                        </p>
                      </div>
                      <span className="text-xs text-black/30 italic">
                        {cliente.tareas.length === 0
                          ? "Sin tareas asignadas este mes"
                          : `${cliente.tareas.length} tareas`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
