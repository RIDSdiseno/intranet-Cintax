import React from "react";
import { useNavigate } from "react-router-dom";

export default function TemplatesPage() {
  const navigate = useNavigate();

  return (
    <section className="mt-5 rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-[var(--primary-color)]">Plantillas</h2>
      <p className="mt-2 max-w-2xl text-sm text-black/60">
        Seccion en preparacion. Aqui podras guardar y reutilizar plantillas de
        automatizaciones.
      </p>

      <div className="mt-5 rounded-xl border border-dashed border-black/20 bg-[var(--tertiary-color)]/40 p-5">
        <p className="text-sm text-black/60">
          Proximamente: biblioteca de reglas preconfiguradas para creacion,
          actualizaciones y activadores por horas.
        </p>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => navigate("/tickets/automatizaciones")}
          className="rounded-xl bg-[var(--primary-color)] px-4 py-2 text-sm text-white shadow-sm hover:opacity-95"
        >
          Volver a automatizaciones
        </button>
      </div>
    </section>
  );
}

