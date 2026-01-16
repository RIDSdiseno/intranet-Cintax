// src/pages/ReleaseNotesPage.tsx
import React, { useMemo } from "react";
import { History, Sparkles } from "lucide-react";

type ReleaseNote = {
  version: string;
  date: string; // YYYY-MM-DD
  title: string;
  items: string[];
  tag?: "nuevo" | "mejora" | "fix";
};

const NOTES: ReleaseNote[] = [
  {
    version: "v1.4.0",
    date: "2025-12-18",
    title: "Supervisión, exportaciones y notificaciones",
    items: [
      "Se habilita la vista de supervisión con modo Comparativa entre agentes (KPIs + gráficos).",
      "Se agrega exportación a Excel/PDF para Comparativa, Dashboard y Empresas (según contexto).",
      "Se optimiza la carga de datos en supervisión con caché por agente para reducir llamadas repetidas.",
      "Se incorpora campana de notificaciones con filtro por mes/año y acción para marcar todas como leídas.",
      "Se mejora la edición por ejecutivo: ahora solo se muestran plantillas que tengan tareas asignadas al cliente (para editar Aplica/NO aplica).",
    ],
    tag: "nuevo",
  },
  {
    version: "v1.3.0",
    date: "2025-12-11",
    title: "Mejoras en envío de correos y perfil de usuario",
    items: [
      "Se integra el envío de correos directamente desde la vista por RUT.",
      "Se habilita el envío de múltiples archivos en vista por rut para que el sistema pueda redirigir correctamente cada archivo, el nombre de cada documento debe incluir el nombre de la tarea correspondiente.",
      "Se habilita el engranaje de perfil: ahora muestra la información básica del usuario (aún no editable).",
      "Se corrigen problemas de diseño y se mejora la presentación general de la intranet.",
      "Se recomienda probar internamente el flujo de envío de correos antes de utilizarlo con clientes reales.",
    ],
    tag: "nuevo",
  },
];

const tagLabel: Record<NonNullable<ReleaseNote["tag"]>, string> = {
  nuevo: "Novedad",
  mejora: "Mejora",
  fix: "Corrección",
};

const tagClass: Record<NonNullable<ReleaseNote["tag"]>, string> = {
  nuevo: "bg-emerald-100 text-emerald-700 border-emerald-200",
  mejora: "bg-sky-100 text-sky-700 border-sky-200",
  fix: "bg-amber-100 text-amber-700 border-amber-200",
};

const formatDateCL = (yyyyMmDd: string) => {
  const d = new Date(`${yyyyMmDd}T12:00:00`); // seguro para TZ
  return Number.isNaN(d.getTime())
    ? yyyyMmDd
    : d.toLocaleDateString("es-CL", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const ReleaseNotesPage: React.FC = () => {
  const notesSorted = useMemo(() => {
    return [...NOTES].sort((a, b) => b.date.localeCompare(a.date));
  }, []);

  const latest = notesSorted[0];

  return (
    <div className="space-y-6 mt-4">
      {/* HEADER */}
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <History size={22} />
          Notas de versión
        </h1>
        <p className="text-sm text-black/60">
          Registro de cambios y mejoras de la intranet Cintax.
        </p>
      </header>

      {/* ÚLTIMA VERSIÓN DESTACADA */}
      {latest && (
        <section className="rounded-2xl bg-white border border-black/5 shadow-sm px-4 py-4 md:px-6 md:py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-[var(--tertiary-color)] p-2 text-[var(--secondary-color)]">
                <Sparkles size={20} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--primary-color)" }}>
                  Última actualización
                </p>
                <p className="text-xs text-black/55">
                  Versión {latest.version} · {formatDateCL(latest.date)}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-black/45">
              Más abajo verás el historial de versiones.
            </span>
          </div>

          <p className="text-sm font-medium">{latest.title}</p>
          <ul className="text-sm text-black/70 list-disc pl-5 space-y-1">
            {latest.items.map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ul>
        </section>
      )}

      {/* HISTORIAL COMPLETO */}
      <section className="space-y-3">
        {notesSorted.map((note) => (
          <article
            key={note.version}
            className="rounded-2xl bg-white border border-black/5 shadow-sm px-4 py-4 md:px-5 md:py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-black/50">
                    {formatDateCL(note.date)}
                  </span>
                  {note.tag && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${tagClass[note.tag]}`}
                    >
                      {tagLabel[note.tag]}
                    </span>
                  )}
                </div>
                <h2 className="mt-1 text-sm font-semibold">
                  {note.version} · {note.title}
                </h2>
              </div>
            </div>

            <ul className="mt-2 text-sm text-black/70 list-disc pl-5 space-y-1">
              {note.items.map((it, idx) => (
                <li key={idx}>{it}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </div>
  );
};

export default ReleaseNotesPage;
