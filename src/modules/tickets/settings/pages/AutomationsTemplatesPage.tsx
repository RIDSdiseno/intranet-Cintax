import React, { useMemo, useState } from "react";
import { Lock, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Modal from "../../../../components/tickets/settings/Modal";
import SettingsLayout from "../../../../components/tickets/settings/SettingsLayout";
import {
  mockTemplates,
  type RuleTypeLabel,
  type TemplateCategory,
  type TicketTemplate,
} from "../../../../features/tickets/settings/mocks";

const CATEGORIES: TemplateCategory[] = [
  "Todas",
  "Comunicacion con el cliente",
  "Satisfaccion",
  "Eficiencia soporte tecnico",
  "Colaboracion interna",
];

type RuleTypeFilter = "Todo" | RuleTypeLabel;

export default function AutomationsTemplatesPage() {
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("Todas");
  const [ruleType, setRuleType] = useState<RuleTypeFilter>("Todo");
  const [query, setQuery] = useState("");
  const [previewTemplate, setPreviewTemplate] = useState<TicketTemplate | null>(null);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return mockTemplates.filter((template) => {
      const categoryMatch =
        selectedCategory === "Todas" || template.category === selectedCategory;
      const typeMatch = ruleType === "Todo" || template.ruleType === ruleType;
      const queryMatch =
        normalizedQuery.length === 0 ||
        template.title.toLowerCase().includes(normalizedQuery) ||
        template.description.toLowerCase().includes(normalizedQuery);

      return categoryMatch && typeMatch && queryMatch;
    });
  }, [query, ruleType, selectedCategory]);

  return (
    <SettingsLayout
      breadcrumb="Automatizaciones"
      title="Explorar plantillas"
      description="Use plantillas para acelerar la creacion de reglas en su mesa de ayuda."
      rightActions={
        <button
          type="button"
          onClick={() => navigate("/tickets/settings/automations")}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 shadow-sm hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
        >
          Atras
        </button>
      }
    >
      <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--primary-color)]">Categorias</h2>

          <div className="mt-3">
            <label className="mb-1 block text-xs uppercase tracking-wide text-black/45">
              Tipo de regla
            </label>
            <select
              value={ruleType}
              onChange={(event) => setRuleType(event.target.value as RuleTypeFilter)}
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-black/20 focus:ring-2 focus:ring-[var(--secondary-color)]/30"
            >
              <option value="Todo">Todo</option>
              <option value="Creacion de Tickets">Creacion de Tickets</option>
              <option value="Actualizaciones Del Ticket">Actualizaciones Del Ticket</option>
              <option value="Activadores Por Horas">Activadores Por Horas</option>
            </select>
          </div>

          <ul className="mt-4 space-y-1">
            {CATEGORIES.map((category) => {
              const isActive = category === selectedCategory;

              return (
                <li key={category}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30 ${
                      isActive
                        ? "bg-black/5 font-medium text-[var(--primary-color)]"
                        : "text-black/65 hover:bg-black/[0.03]"
                    }`}
                  >
                    {category}
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        <div className="space-y-4">
          <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 shadow-sm">
            <Search size={16} className="text-black/45" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar una plantilla"
              className="w-full bg-transparent text-sm outline-none placeholder:text-black/40"
              aria-label="Buscar una plantilla"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <article
                key={template.id}
                className="flex h-full flex-col rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-semibold text-[var(--primary-color)]">
                    {template.title}
                  </h3>
                  {template.locked && (
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/5 text-black/55"
                      title="Plantilla bloqueada"
                    >
                      <Lock size={14} />
                    </span>
                  )}
                </div>

                <p className="mt-2 line-clamp-3 text-sm text-black/60">{template.description}</p>

                <div className="mt-3 space-y-1 text-xs text-black/50">
                  <p>Categoria: {template.category}</p>
                  <p>Tipo: {template.ruleType}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewTemplate(template)}
                  className="mt-4 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/75 transition hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[var(--secondary-color)]/30"
                >
                  Vista previa
                </button>
              </article>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="rounded-2xl border border-dashed border-black/15 bg-white p-8 text-center text-sm text-black/55 shadow-sm">
              No hay plantillas para los filtros seleccionados.
            </div>
          )}
        </div>
      </section>

      <Modal
        open={Boolean(previewTemplate)}
        onClose={() => setPreviewTemplate(null)}
        title={previewTemplate?.title ?? "Vista previa"}
        description="Resumen de plantilla"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPreviewTemplate(null)}
              className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm text-black/75 hover:border-black/20"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => setPreviewTemplate(null)}
              className="rounded-xl px-4 py-2 text-sm text-white shadow-sm"
              style={{ background: "var(--secondary-color)" }}
            >
              Usar plantilla
            </button>
          </>
        }
      >
        {previewTemplate && (
          <div className="space-y-3 text-sm text-black/70">
            <p>{previewTemplate.description}</p>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-black/45">Categoria</p>
                <p className="mt-1">{previewTemplate.category}</p>
              </div>

              <div className="rounded-xl border border-black/10 bg-black/[0.015] px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-black/45">Tipo de regla</p>
                <p className="mt-1">{previewTemplate.ruleType}</p>
              </div>
            </div>

            {previewTemplate.locked && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Esta plantilla esta bloqueada en esta version de demo.
              </p>
            )}
          </div>
        )}
      </Modal>
    </SettingsLayout>
  );
}
