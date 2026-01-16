// src/pages/creacion-tareas/tabs/ManualTab.tsx
import React from "react";
import {
  ClipboardList,
  Users,
  ListTodo,
  SlidersHorizontal,
  User,
  CheckCircle2,
  AlertTriangle,
  Info,
  Wand2,
  CalendarClock,
  Search,
  Pencil,
  Trash2,
  RefreshCcw,
  ShieldCheck,
  ChevronRight,
  BadgeCheck,
  Clock,
  FileText,
} from "lucide-react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const TonePill: React.FC<{ tone?: Tone; children: React.ReactNode }> = ({
  tone = "neutral",
  children,
}) => {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "warning"
      ? "bg-amber-50 text-amber-800 border-amber-100"
      : tone === "danger"
      ? "bg-rose-50 text-rose-700 border-rose-100"
      : tone === "info"
      ? "bg-sky-50 text-sky-700 border-sky-100"
      : "bg-black/5 text-black/70 border-black/10";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] ${cls}`}>
      {children}
    </span>
  );
};

const Callout: React.FC<{
  icon?: React.ReactNode;
  title: string;
  tone?: Tone;
  children: React.ReactNode;
}> = ({ icon, title, tone = "info", children }) => {
  const box =
    tone === "warning"
      ? "border-amber-100 bg-amber-50 text-amber-900"
      : tone === "danger"
      ? "border-rose-100 bg-rose-50 text-rose-900"
      : tone === "success"
      ? "border-emerald-100 bg-emerald-50 text-emerald-900"
      : "border-sky-100 bg-sky-50 text-sky-900";

  return (
    <div className={`rounded-2xl border p-3 ${box}`}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0">
          <div className="text-xs font-semibold">{title}</div>
          <div className="text-[11px] leading-relaxed opacity-90 mt-1">{children}</div>
        </div>
      </div>
    </div>
  );
};

const Step: React.FC<{ n: string; children: React.ReactNode }> = ({ n, children }) => (
  <div className="flex gap-2">
    <div className="shrink-0 w-6 h-6 rounded-full bg-black/5 text-black/70 flex items-center justify-center text-[11px] font-semibold">
      {n}
    </div>
    <div className="text-[11px] text-black/70 leading-relaxed">{children}</div>
  </div>
);

const MiniCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ icon, title, subtitle, children, badge }) => (
  <article className="group relative overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
    <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-black/5 blur-2xl transition group-hover:bg-black/10" />
    <header className="relative p-4 border-b border-black/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-black/5 text-black/70">{icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-black/85">{title}</h3>
              {badge}
            </div>
            <div className="text-[11px] text-black/55 mt-0.5">{subtitle}</div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[10px] text-black/45">
          <Wand2 className="w-3.5 h-3.5" />
          Guía
        </div>
      </div>
    </header>

    <div className="relative p-4">
      <div className="grid grid-cols-1 gap-2">{children}</div>
    </div>
  </article>
);

const FlowLine: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="rounded-2xl border border-black/5 bg-black/[0.02] p-3 text-[11px] text-black/70">
    <div className="flex flex-wrap items-center gap-2">
      {children}
    </div>
  </div>
);

const FlowItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl border border-black/10 bg-white text-[11px] text-black/70">
    {icon}
    <span className="font-semibold">{label}</span>
  </span>
);

const ManualTab: React.FC = () => {
  return (
    <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-black/5">
          <ClipboardList className="w-5 h-5 text-black/70" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold text-black/85">Manual de uso (Creación de tareas)</h2>
            <TonePill tone="info">
              <ShieldCheck className="w-3.5 h-3.5" /> Supervisor/Admin recomendado
            </TonePill>
          </div>
          <p className="text-xs text-black/55 mt-0.5">
            Objetivo: mantener <b>clientes</b> correctos, definir <b>plantillas</b>, y asegurar que las <b>tareas</b>{" "}
            se asignen bien (incluyendo excepciones <b>NO aplica</b>).
          </p>
        </div>
      </div>

      {/* Flujo simple */}
      <FlowLine>
        <FlowItem icon={<User className="w-4 h-4" />} label="Clientes" />
        <ChevronRight className="w-4 h-4 text-black/30" />
        <FlowItem icon={<ListTodo className="w-4 h-4" />} label="Plantillas" />
        <ChevronRight className="w-4 h-4 text-black/30" />
        <FlowItem icon={<Users className="w-4 h-4" />} label="Asignar manual" />
        <ChevronRight className="w-4 h-4 text-black/30" />
        <FlowItem icon={<SlidersHorizontal className="w-4 h-4" />} label="Edición por ejecutivo (NO aplica)" />
      </FlowLine>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-2">
        <TonePill tone="success">
          <CheckCircle2 className="w-3.5 h-3.5" /> Recomendado
        </TonePill>
        <TonePill tone="warning">
          <AlertTriangle className="w-3.5 h-3.5" /> Ojo
        </TonePill>
        <TonePill tone="neutral">
          <Info className="w-3.5 h-3.5" /> Tip
        </TonePill>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 0 Orden recomendado */}
        <MiniCard
          icon={<BadgeCheck className="w-5 h-5" />}
          title="Orden recomendado (para que todo funcione)"
          subtitle={
            <>
              Si sigues este orden, evitas errores de “no veo filas” o “no aparece la tarea”.
            </>
          }
          badge={<TonePill tone="success">Checklist</TonePill>}
        >
          <Step n="1">
            <b>Crea/actualiza el Cliente</b> (RUT, razón social, ejecutivo, cartera y estado).
          </Step>
          <Step n="2">
            <b>Crea la Plantilla</b> (área, nombre, detalle y frecuencia).
          </Step>
          <Step n="3">
            <b>Asigna manual</b> si es una tarea puntual (no esperar ciclo automático).
          </Step>
          <Step n="4">
            <b>Edición por ejecutivo</b>: usa <b>NO aplica</b> solo si la tarea <u>sí existe</u>, pero ese cliente no la hará.
          </Step>

          <Callout tone="info" icon={<Info className="w-4 h-4" />} title="Regla de oro">
            Si una tarea <b>no existe</b> (ya no se hace nunca), elimina/inhabilita la plantilla.  
            Si la tarea <b>sí existe</b> pero <b>ese cliente</b> no la hace, usa <b>NO aplica</b>.
          </Callout>
        </MiniCard>

        {/* 1 Clientes */}
        <MiniCard
          icon={<User className="w-5 h-5" />}
          title="1) Clientes"
          subtitle={
            <>
              Tab <b>Clientes</b> • Aquí se define quién es el cliente y a qué ejecutivo pertenece.
            </>
          }
          badge={<TonePill tone="info">Base</TonePill>}
        >
          <Step n="A">
            <b>Crear</b>: ingresa <b>RUT</b> + <b>Razón Social</b> y guarda.
          </Step>
          <Step n="B">
            <b>Editar</b>: usa <b>Editar</b> para setear <b>Ejecutivo</b> (agenteId), <b>Cartera</b> y <b>Estado</b>.
            <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-black/45">
              <Pencil className="w-3.5 h-3.5" /> Se aplica altiro
            </span>
          </Step>
          <Step n="C">
            <b>Buscar rápido</b>: escribe parte del RUT / razón / alias / cartera.
            <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-black/45">
              <Search className="w-3.5 h-3.5" /> Alias corto ayuda
            </span>
          </Step>

          <Callout tone="warning" icon={<AlertTriangle className="w-4 h-4" />} title="Cliente inactivo">
            No debería recibir nuevas asignaciones automáticas. Las tareas ya creadas pueden seguir existiendo.
          </Callout>
        </MiniCard>

        {/* 2 Plantillas */}
        <MiniCard
          icon={<ListTodo className="w-5 h-5" />}
          title="2) Tareas / Plantillas"
          subtitle={
            <>
              Tab <b>Tareas / plantillas</b> • Define la “tarea base” que luego se asigna a clientes.
            </>
          }
          badge={<TonePill tone="success">Automatiza</TonePill>}
        >
          <Step n="A">
            <b>Crear plantilla</b>: completa <b>Área</b>, <b>Nombre</b> y <b>Detalle</b> (obligatorio).
          </Step>
          <Step n="B">
            <b>Frecuencia</b>: Única / Semanal / Mensual.
            <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-black/45">
              <CalendarClock className="w-3.5 h-3.5" /> Define día de vencimiento si aplica
            </span>
          </Step>
          <Step n="C">
            <b>Detalle</b> (recomendación): escribe “qué hacer” + “qué evidencia subir”.
            <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-black/45">
              <FileText className="w-3.5 h-3.5" /> Ej: “adjuntar comprobante”
            </span>
          </Step>

          <Callout tone="danger" icon={<Trash2 className="w-4 h-4" />} title="Eliminar plantilla">
            Úsalo solo si la tarea deja de existir para todos. Puede afectar tareas relacionadas.
          </Callout>
        </MiniCard>

        {/* 3 Asignar manual */}
        <MiniCard
          icon={<Users className="w-5 h-5" />}
          title="3) Asignar manual"
          subtitle={
            <>
              Tab <b>Asignar manual</b> • Para tareas puntuales o urgentes (fuera del ciclo automático).
            </>
          }
          badge={<TonePill tone="info">Puntual</TonePill>}
        >
          <Step n="A">
            Selecciona <b>Cliente</b> → selecciona <b>Plantilla</b> → elige <b>Responsable</b>.
          </Step>
          <Step n="B">
            Define <b>Fecha de vencimiento</b>.
            <span className="inline-flex items-center gap-1 ml-2 text-[10px] text-black/45">
              <Clock className="w-3.5 h-3.5" /> Queda como fechaProgramada
            </span>
          </Step>
          <Step n="C">
            Presiona <b>Crear y asignar</b>. Debe aparecer en módulos de tareas/supervisión/KPIs.
          </Step>

          <Callout tone="success" icon={<CheckCircle2 className="w-4 h-4" />} title="Cuándo usarlo">
            Urgencias, solicitudes extraordinarias, correcciones, “one-shot”, documentación fuera de plazo.
          </Callout>
        </MiniCard>

        {/* 4 Edición por ejecutivo */}
        <MiniCard
          icon={<SlidersHorizontal className="w-5 h-5" />}
          title="4) Edición por ejecutivo (NO aplica)"
          subtitle={
            <>
              Tab <b>Edición por ejecutivo</b> • Controla excepciones por cliente (aplica / no aplica).
            </>
          }
          badge={<TonePill tone="warning">Excepciones</TonePill>}
        >
          <Step n="A">
            Selecciona <b>Ejecutivo</b> → se cargan sus clientes.
          </Step>
          <Step n="B">
            Selecciona <b>Cliente</b> → se muestran <b>solo tareas asignadas</b> a ese ejecutivo.
          </Step>
          <Step n="C">
            Marca <b>NO aplica</b> (ideal: escribe motivo) o vuelve a <b>Aplica</b>.
          </Step>

          <Callout tone="info" icon={<RefreshCcw className="w-4 h-4" />} title="Si no ves filas">
            Casi siempre es porque el cliente <b>no tiene tareas asignadas</b> para ese ejecutivo (según{" "}
            <code>/tareas/asignadas</code>). Asigna primero (manual o automático) y luego edita.
          </Callout>
        </MiniCard>
      </div>

      {/* Bottom tips */}
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-[11px] text-amber-900">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="leading-relaxed">
            <b>Tip rápido:</b> si algo “no aparece”, usa <b>Refrescar</b> en el tab correspondiente.  
            Si persiste: revisa (1) el <b>rol</b>, (2) que el backend responda OK, (3) que el cliente tenga tareas asignadas.
          </div>
        </div>
      </div>
    </section>
  );
};

export default ManualTab;
