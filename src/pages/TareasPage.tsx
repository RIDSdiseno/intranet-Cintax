// src/pages/TareasPage.tsx
import React, { useState } from "react";
import VistaPorRut from "../components/tareas/VistaPorRut";
import VistaPorTarea from "../components/tareas/VistaPorTarea";

type VistaTareas = "porRut" | "porTarea";

const TareasPage: React.FC = () => {
  const [vista, setVista] = useState<VistaTareas>("porRut");

  return (
    <div className="mt-6 flex flex-col gap-4">
      {/* selector de vista */}
      <div className="inline-flex bg-white rounded-full border border-black/5 p-1 self-start shadow-sm">
        <button
          type="button"
          onClick={() => setVista("porRut")}
          className={`px-4 py-1.5 text-xs rounded-full transition ${
            vista === "porRut"
              ? "bg-[var(--primary-color)] text-white shadow-sm"
              : "text-black/60 hover:bg-black/5"
          }`}
        >
          Ver por RUT
        </button>
        <button
          type="button"
          onClick={() => setVista("porTarea")}
          className={`px-4 py-1.5 text-xs rounded-full transition ${
            vista === "porTarea"
              ? "bg-[var(--primary-color)] text-white shadow-sm"
              : "text-black/60 hover:bg-black/5"
          }`}
        >
          Ver por tarea
        </button>
      </div>

      {vista === "porRut" && <VistaPorRut />}
      {vista === "porTarea" && <VistaPorTarea />}
    </div>
  );
};

export default TareasPage;
