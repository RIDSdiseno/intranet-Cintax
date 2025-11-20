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
  LogOut,
  Users,
} from "lucide-react";

// --- TIPOS DE DATOS ---
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
  progreso: number;
  tareas: Tarea[];
};

type Analista = {
  id: string;
  nombre: string;
  avatar: string;
  clientes: Cliente[];
  cargaTotal: number;
  completadas: number;
};

// --- ADMIN POR DEFECTO ---
const ADMIN_USER: UserProfile = {
  id: "admin",
  name: "Administrador",
  email: "admin@cintax.cl",
  role: "admin",
  avatar: "AD",
};

// --- DATOS INICIALES VACÍOS (REQUERIMIENTO) ---
const INITIAL_DATA: Analista[] = [];

// --- COMPONENTES UI ---
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
  // Si vence hoy o antes y no está listo, es atrasado (o urgente)
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
  // Estado de Sesión
  const [currentUser, setCurrentUser] = useState<UserProfile>(ADMIN_USER);

  // Estados de Datos
  const [periodo, setPeriodo] = useState("Marzo 2025");
  const [analistas, setAnalistas] = useState<Analista[]>(INITIAL_DATA);

  // Estados UI
  const [expandedAnalista, setExpandedAnalista] = useState<string | null>(null);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generar lista de usuarios disponibles para simulación basada en los datos cargados
  const availableUsers = useMemo(() => {
    const users: UserProfile[] = [ADMIN_USER];
    analistas.forEach((a) => {
      users.push({
        id: a.id,
        name: a.nombre,
        email: `${a.nombre.split(" ")[0].toLowerCase()}@cintax.cl`, // Generar email fake
        role: "analyst",
        avatar: a.avatar,
      });
    });
    return users;
  }, [analistas]);

  // Efecto de vista según rol
  useEffect(() => {
    if (currentUser.role === "analyst") {
      setExpandedAnalista(currentUser.id);
    } else {
      setExpandedAnalista(null);
    }
  }, [currentUser]);

  const toggleAnalista = (id: string) =>
    setExpandedAnalista((prev) => (prev === id ? null : id));
  const toggleCliente = (id: string) =>
    setExpandedCliente((prev) => (prev === id ? null : id));

  // --- LÓGICA: CHECK TAREA ---
  const handleToggleTask = (
    analistaId: string,
    clienteId: string,
    tareaId: string
  ) => {
    if (currentUser.role === "admin") {
      alert("Modo Supervisión: Solo lectura.");
      return;
    }
    if (currentUser.id !== analistaId) {
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

  // --- IMPORTADOR CSV ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (currentUser.role !== "admin") return;
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        processCSV(event.target?.result as string);
      } catch (err) {
        setErrorMsg("Error procesando archivo.");
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file, "ISO-8859-1");
  };

  const processCSV = (csvText: string) => {
    const lines = csvText.split(/\r\n|\n/);
    if (lines.length < 2) {
      setErrorMsg("Archivo vacío");
      return;
    }

    // Detectar separador (excel en español usa punto y coma)
    const separator =
      (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length
        ? ";"
        : ",";
    const mapAnalistas = new Map<string, Analista>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const row = line
        .split(separator)
        .map((cell) => cell.replace(/^"|"$/g, "").trim());
      if (row.length < 5) continue;

      // Formato esperado: Analista, Cliente, RUT, Tarea, Vencimiento
      const [
        nombreAnalista,
        nombreCliente,
        rutCliente,
        nombreTarea,
        fechaVencimiento,
        estadoRaw,
        obs,
      ] = row;

      if (!nombreAnalista || !nombreCliente) continue;

      // 1. Crear Analista si no existe
      if (!mapAnalistas.has(nombreAnalista)) {
        // Generamos un ID basado en el nombre para consistencia simple
        const generatedId = `a-${nombreAnalista
          .replace(/\s+/g, "")
          .toLowerCase()}`;
        mapAnalistas.set(nombreAnalista, {
          id: generatedId,
          nombre: nombreAnalista,
          avatar: nombreAnalista.charAt(0).toUpperCase(),
          clientes: [],
          cargaTotal: 0,
          completadas: 0,
        });
      }
      const analista = mapAnalistas.get(nombreAnalista)!;

      // 2. Crear Cliente
      let cliente = analista.clientes.find((c) => c.nombre === nombreCliente);
      if (!cliente) {
        cliente = {
          id: `c-${nombreCliente.replace(/\s+/g, "")}-${Math.random()}`,
          nombre: nombreCliente,
          rut: rutCliente || "S/I",
          progreso: 0,
          tareas: [],
        };
        analista.clientes.push(cliente);
      }

      // 3. Tarea
      const estadoNormalizado = estadoRaw?.toLowerCase().includes("completado")
        ? "completado"
        : "pendiente";
      cliente.tareas.push({
        id: `t-${Math.random()}`,
        nombre: nombreTarea,
        vencimiento: fechaVencimiento || new Date().toISOString(),
        estado: estadoNormalizado as TareaEstado,
        comentario: obs || "",
      });

      analista.cargaTotal++;
      if (estadoNormalizado === "completado") analista.completadas++;
    }

    // Recalcular progresos de clientes
    mapAnalistas.forEach((analista) => {
      analista.clientes.forEach((cliente) => {
        const done = cliente.tareas.filter(
          (t) => t.estado === "completado"
        ).length;
        cliente.progreso =
          cliente.tareas.length > 0
            ? Math.round((done / cliente.tareas.length) * 100)
            : 0;
      });
    });

    setAnalistas(Array.from(mapAnalistas.values()));
    alert(
      "Carga exitosa. Ahora puedes simular la sesión de los analistas importados."
    );
  };

  // --- EXPORTAR ---
  const handleExport = () => {
    if (currentUser.role !== "admin") return;
    const rows = [
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
          rows.push([
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
    const csvContent = rows
      .map((e) => e.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Tareas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtros de vista
  const viewData = useMemo(() => {
    let data = analistas;
    if (currentUser.role === "analyst") {
      data = analistas.filter((a) => a.id === currentUser.id);
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

  // Stats
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
      {/* === SIMULADOR DE SESIÓN DINÁMICO === */}
      <div className="bg-black text-white p-4 rounded-xl flex flex-wrap items-center justify-between text-sm shadow-lg mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Shield size={18} className="text-[var(--secondary-color)]" />
          <div>
            <p className="text-xs opacity-60 uppercase font-bold tracking-wider">
              Usuario Actual
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
          <p className="text-xs opacity-60 mr-1">Cambiar perfil para probar:</p>
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

      {/* === HEADER === */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-black/5 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary-color)]">
            {currentUser.role === "admin"
              ? "Panel de Planificación"
              : "Mis Tareas"}
          </h1>
          <p className="text-black/60 text-sm mt-1">
            {currentUser.role === "admin"
              ? "Importa el CSV del CRM para asignar cargas."
              : `Hola ${currentUser.name}, este es tu plan mensual.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-black/10 px-3 py-2 rounded-xl shadow-sm">
            <Calendar size={16} className="text-black/40" />
            <span className="text-sm font-medium text-[var(--primary-color)]">
              {periodo}
            </span>
          </div>

          {currentUser.role === "admin" && (
            <>
              <input
                type="file"
                accept=".csv,.txt"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-sm border ${
                  isImporting
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-white text-[var(--primary-color)] border-black/10 hover:border-black/20"
                }`}
              >
                {isImporting ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <UploadCloud size={16} />
                )}
                {analistas.length > 0
                  ? "Actualizar Planificación"
                  : "Cargar Planificación"}
              </button>

              <button
                onClick={handleExport}
                disabled={analistas.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white shadow-md hover:opacity-90 transition-opacity active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "var(--secondary-color)" }}
              >
                <FileSpreadsheet size={16} /> Exportar reporte
              </button>
            </>
          )}
        </div>
      </div>

      {/* === ESTADÍSTICAS === */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-xs text-black/50 font-medium uppercase">
            {currentUser.role === "admin" ? "Cumplimiento Global" : "Mi Avance"}
          </p>
          <div className="mt-1 text-3xl font-bold text-[var(--primary-color)]">
            {stats.cumplimiento}%
          </div>
          <div className="mt-2">
            <ProgressBar value={stats.cumplimiento} />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-xs text-black/50 font-medium uppercase">
            Total Clientes
          </p>
          <p className="mt-1 text-3xl font-bold text-[var(--primary-color)]">
            {stats.nClientes}
          </p>
          <p className="text-xs text-black/40 mt-1">Asignados</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-xs text-black/50 font-medium uppercase">
            Pendientes
          </p>
          <p className="mt-1 text-3xl font-bold text-amber-600">
            {stats.total - stats.completadas}
          </p>
          <p className="text-xs text-black/40 mt-1">Tareas en cola</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm">
          <p className="text-xs text-black/50 font-medium uppercase">Atrasos</p>
          <p
            className={`mt-1 text-3xl font-bold ${
              stats.atrasadas > 0 ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            {stats.atrasadas}
          </p>
          <p className="text-xs text-black/40 mt-1">Atención requerida</p>
        </div>
      </div>

      {/* === CONTENIDO === */}
      {errorMsg && (
        <div className="bg-rose-50 text-rose-700 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {analistas.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-black/10 rounded-2xl bg-[var(--tertiary-color)]/20">
          <UploadCloud size={48} className="mx-auto text-black/20 mb-4" />
          <h3 className="text-lg font-semibold text-black/60">
            Sin Planificación
          </h3>
          <p className="text-sm text-black/40 max-w-md mx-auto mt-1">
            El panel está vacío. Como Administrador, carga el archivo CSV
            generado por el CRM para comenzar el ciclo mensual.
          </p>
          {currentUser.role === "admin" && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 px-6 py-2 bg-[var(--secondary-color)] text-white rounded-xl font-medium shadow-sm hover:opacity-90"
            >
              Subir Archivo CSV
            </button>
          )}
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
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-black/10 rounded-2xl outline-none focus:border-[var(--secondary-color)] shadow-sm"
            />
          </div>

          {/* Listado de Analistas */}
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
                      {analista.clientes.length} Clientes
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="hidden md:block text-right">
                    <div className="w-32">
                      <ProgressBar
                        value={
                          analista.cargaTotal > 0
                            ? (analista.completadas / analista.cargaTotal) * 100
                            : 0
                        }
                      />
                    </div>
                  </div>
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
                      className="border-b border-black/5 last:border-0"
                    >
                      <div
                        onClick={() => toggleCliente(cliente.id)}
                        className="flex items-center justify-between px-4 py-3 pl-8 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Building2
                            size={18}
                            className={`text-black/30 ${
                              expandedCliente === cliente.id
                                ? "text-[var(--secondary-color)]"
                                : ""
                            }`}
                          />
                          <div>
                            <h4
                              className={`text-sm font-medium ${
                                expandedCliente === cliente.id
                                  ? "text-[var(--secondary-color)]"
                                  : "text-black/70"
                              }`}
                            >
                              {cliente.nombre}
                            </h4>
                            <p className="text-[10px] text-black/40 font-mono">
                              {cliente.rut}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-20 hidden sm:block">
                            <ProgressBar
                              value={cliente.progreso}
                              colorClass={
                                cliente.progreso === 100
                                  ? "bg-emerald-500"
                                  : "bg-blue-500"
                              }
                            />
                          </div>
                          {expandedCliente === cliente.id ? (
                            <ChevronDown size={16} className="text-black/30" />
                          ) : (
                            <ChevronRight size={16} className="text-black/30" />
                          )}
                        </div>
                      </div>

                      {expandedCliente === cliente.id && (
                        <div className="bg-gray-50/50 px-4 py-2 pl-4 md:pl-12 pb-4 border-t border-black/5 animate-in slide-in-from-top-1">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-[10px] uppercase text-black/40 border-b border-black/5">
                                <th className="py-2 w-8">Ok</th>
                                <th className="py-2">Tarea</th>
                                <th className="py-2">Vence</th>
                                <th className="py-2 hidden sm:table-cell">
                                  Estado
                                </th>
                                {currentUser.role === "admin" && (
                                  <th className="py-2 text-right">Obs</th>
                                )}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {cliente.tareas.map((t) => (
                                <tr
                                  key={t.id}
                                  className={
                                    t.estado === "completado"
                                      ? "bg-emerald-50/20"
                                      : ""
                                  }
                                >
                                  <td className="py-2">
                                    <button
                                      onClick={() =>
                                        handleToggleTask(
                                          analista.id,
                                          cliente.id,
                                          t.id
                                        )
                                      }
                                      disabled={currentUser.role === "admin"}
                                      className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                        t.estado === "completado"
                                          ? "bg-emerald-500 border-emerald-500 text-white"
                                          : currentUser.role === "admin"
                                          ? "bg-gray-100 border-black/10 cursor-not-allowed"
                                          : "bg-white border-black/20 hover:border-[var(--secondary-color)]"
                                      }`}
                                    >
                                      {t.estado === "completado" && (
                                        <CheckCircle2 size={12} />
                                      )}
                                    </button>
                                  </td>
                                  <td
                                    className={`py-2 ${
                                      t.estado === "completado"
                                        ? "text-emerald-800 line-through opacity-70"
                                        : ""
                                    }`}
                                  >
                                    {t.nombre}
                                  </td>
                                  <td className="py-2 text-xs font-mono text-black/60">
                                    {t.vencimiento}
                                  </td>
                                  <td className="py-2 hidden sm:table-cell">
                                    <StatusBadge
                                      status={t.estado}
                                      date={t.vencimiento}
                                    />
                                  </td>
                                  {currentUser.role === "admin" && (
                                    <td className="py-2 text-right text-xs text-black/40 italic">
                                      {t.comentario || "-"}
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
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
