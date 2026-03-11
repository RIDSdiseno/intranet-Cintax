import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CierreModoSelector from "../components/cierre-tareas/CierreModoSelector";
import CierrePorAgente from "../components/cierre-tareas/CierrePorAgente";
import CierrePorTarea from "../components/cierre-tareas/CierrePorTarea";

export type CierreMode = "selector" | "tarea" | "agente";

function isValidMode(value: string | null): value is Exclude<CierreMode, "selector"> {
  return value === "tarea" || value === "agente";
}

export default function CierreTareasPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialMode = useMemo<CierreMode>(() => {
    const modo = searchParams.get("modo");
    return isValidMode(modo) ? modo : "selector";
  }, [searchParams]);

  const [mode, setMode] = useState<CierreMode>(initialMode);

  useEffect(() => {
    const modo = searchParams.get("modo");

    if (isValidMode(modo)) {
      setMode(modo);
      return;
    }

    setMode("selector");
  }, [searchParams]);

  const handleSelectMode = (nextMode: Extract<CierreMode, "tarea" | "agente">) => {
    setMode(nextMode);
    setSearchParams({ modo: nextMode });
  };

  const handleBack = () => {
    setMode("selector");
    setSearchParams({});
  };

  if (mode === "selector") {
    return <CierreModoSelector onSelectMode={handleSelectMode} />;
  }

  if (mode === "tarea") {
    return <CierrePorTarea onBack={handleBack} />;
  }

  return <CierrePorAgente onBack={handleBack} />;
}