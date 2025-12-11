// ./src/components/NotificationsBell.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import axios from "axios";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";

const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL) || "http://localhost:3000/api";

interface Notification {
  id: string;
  mensaje: string;
  leida: boolean;
  createdAt: string;
  trabajadorId: number;
  tareaId: number | null;
  tarea?: {
    fechaProgramada: string;
  };
}

const getAuthToken = () =>
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("access_token");

const NotificationsBell: React.FC = () => {

  // ================================
  // DEFAULT: mes actual y año actual
  // ================================
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.leida).length,
    [notifications]
  );

  const totalCount = notifications.length;

  const fetchNotifications = async () => {
    const token = getAuthToken();
    if (!token) return;

    // Construir URL según mes/año
    let url = `${API_BASE_URL}/notificaciones`;

    if (selectedMonth && selectedYear) {
      url += `?mes=${selectedMonth}&anio=${selectedYear}`;
    }

    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las notificaciones.");
    }
  };

  // Recargar notificaciones cuando cambien mes/año
  useEffect(() => {
    fetchNotifications();
  }, [selectedMonth, selectedYear]);

  // Cerrar si se hace click afuera
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Marcar todas como leídas
  const handleMarkAllAsReadClick = async () => {
    const token = getAuthToken();
    if (!token || unreadCount === 0) return;

    const prev = [...notifications];
    setNotifications(prev.map((n) => ({ ...n, leida: true })));

    try {
      await axios.post(
        `${API_BASE_URL}/notificaciones/marcar-todas-leidas`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      console.error(err);
      setNotifications(prev);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="relative rounded-xl bg-white border border-black/5 p-2 shadow-sm hover:shadow transition"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border shadow-lg z-20">
          <header className="px-4 py-3 border-b flex justify-between items-center">
            <h3 className="text-sm font-semibold">
              Notificaciones ({totalCount})
            </h3>
          </header>

          {/* Selectores de MES y AÑO */}
          <div className="flex gap-2 px-3 py-2 border-b text-xs">
            <select
              className="border p-1 rounded w-1/2"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
            >
              <option value="">Mes</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <select
              className="border p-1 rounded w-1/2"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              <option value="">Año</option>
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - i).map(
                (y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {error && <p className="p-3 text-xs text-red-600">{error}</p>}

            {!error &&
              notifications.map((notif) => (
                <div key={notif.id} className="p-4 border-b text-sm">
                  {!notif.leida && (
                    <div className="h-2 w-2 bg-blue-500 rounded-full mb-1"></div>
                  )}
                  <p>{notif.mensaje}</p>

                  <p className="text-xs text-gray-400 mt-1">
                    Vencimiento:{" "}
                    {notif.tarea
                      ? new Date(notif.tarea.fechaProgramada).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              ))}
          </div>

          <footer className="p-2 border-t text-center">
            <button
              disabled={unreadCount === 0}
              onClick={handleMarkAllAsReadClick}
              className="text-xs text-blue-600 hover:underline disabled:opacity-40"
            >
              Marcar todas como leídas
            </button>
          </footer>
        </div>
      )}
    </div>
  );
};

export default NotificationsBell;
