import {
  CheckCircle2,
  ClipboardList,
  Square,
  Users,
  ClipboardX,
} from "lucide-react";

type Props = {
  onSelectMode: (mode: "tarea" | "agente" | "desactivadas") => void;
};

type ModeCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
};

function ModeCard({
  eyebrow,
  title,
  description,
  icon,
  selected = false,
  onClick,
}: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full rounded-[28px] border border-black/10 bg-white px-5 py-6 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#9E8359]">
            {eyebrow}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span className="text-xl font-semibold text-slate-900">
              {title}
            </span>
          </div>

          <p className="mt-3 max-w-2xl text-sm text-slate-600">
            {description}
          </p>

          <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[#9E8359]">
            Entrar <span aria-hidden>→</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden rounded-2xl bg-[var(--primary-color)]/8 p-3 text-[var(--primary-color)] md:flex">
            {icon}
          </div>

          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full border ${
              selected
                ? "border-[#D6B47A] bg-[#FBF7EF] text-[#C4933F]"
                : "border-slate-200 bg-white text-[#C4933F]"
            }`}
          >
            {selected ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function CierreModoSelector({ onSelectMode }: Props) {
  return (
    <div className="p-6">
      <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Cierre de tareas
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Elige el modo de análisis:
            </p>
          </div>

          <p className="max-w-2xl text-xs text-slate-500">
            Consejo: “Por tarea” sirve para ver el consolidado global. “Por agente”
            sirve para analizar la cartera. “Desactivadas” permite auditar tareas
            marcadas como no aplica.
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ModeCard
            eyebrow="Modo"
            title="Por tarea"
            description="Selecciona una tarea y revisa su estado consolidado en todas las empresas."
            icon={<ClipboardList className="h-5 w-5" />}
            onClick={() => onSelectMode("tarea")}
          />

          <ModeCard
            eyebrow="Modo"
            title="Por agente"
            description="Dashboards, empresas e impacto dentro de la cartera de un agente."
            icon={<Users className="h-5 w-5" />}
            onClick={() => onSelectMode("agente")}
          />

          <ModeCard
            eyebrow="Modo"
            title="Tareas desactivadas"
            description="Visualiza y audita tareas marcadas como 'No aplica' y su impacto en la gestión."
            icon={<ClipboardX className="h-5 w-5" />}
            onClick={() => onSelectMode("desactivadas")}
          />
        </div>
      </div>
    </div>
  );
}