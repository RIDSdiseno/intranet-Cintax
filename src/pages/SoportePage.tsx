import React, { useState } from "react";
import { Mail, Phone, Globe, Copy, Check } from "lucide-react";

// Datos de contacto de RIDS
const RIDS_CONTACT = {
  email: "soporte@rids.cl",
  phone: "+56 9 7371 3869",
  website: "https://www.rids.cl",
};

export default function SoportePage() {
  const [copied, setCopied] = useState(false);

  // Función para copiar al portapapeles
  const copyToClipboard = (text: string) => {
    // Usamos document.execCommand('copy') por restricciones del entorno
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand("copy");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Resetear después de 2s
    } catch (err) {
      console.error("No se pudo copiar el texto: ", err);
      alert("Error al copiar el texto. Inténtalo manualmente.");
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const handleCopyPhone = () => {
    copyToClipboard(RIDS_CONTACT.phone);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header Llamativo */}
      <div className="bg-gradient-to-t from-[#af9150]/30 via-white to-transparent rounded-2xl p-6 md:p-10 shadow-xl border border-black/5 text-center mb-8">
        <img
          className="mx-auto mb-4 h-8 md:h-14 w-auto"
          src="/img/logo-rids.webp"
          alt="Logo RIDS"
        />
        <h1
          className="text-2xl md:text-3xl font-bold mb-2"
          style={{ color: "var(--primary-color)" }}
        >
          ¿Necesitas ayuda? Contacta el soporte de RIDS
        </h1>
        <p className="text-black/60 md:text-lg">
          Estamos listos para asistirte con cualquier consulta o incidencia.
          Elige tu medio de contacto preferido.
        </p>
      </div>

      {/* Grid de Contacto */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tarjeta 1: Correo Electrónico */}
        <a
          href={`mailto:${RIDS_CONTACT.email}`}
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-bl from-[#af9150]/30 via-white to-transparent backdrop-blur-lg rounded-2xl border border-black/10 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 group"
        >
          <Mail
            size={32}
            className="mb-3 group-hover:scale-110 transition-transform"
            style={{ color: "var(--secondary-color)" }}
          />
          <p className="text-xs text-black/60">Envíanos un</p>
          <h2 className="text-lg font-semibold mb-3 text-[var(--primary-color)]">
            Correo de Soporte
          </h2>
          <span className="text-sm text-black/70 font-medium hover:underline">
            {RIDS_CONTACT.email}
          </span>
        </a>

        {/* Tarjeta 2: Teléfono (con funcionalidad de copiar) */}
        <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#af9150]/30 via-white to-transparent backdrop-blur-lg rounded-2xl border border-black/10 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5">
          <Phone
            size={32}
            className="mb-3 transition-transform"
            style={{ color: "var(--secondary-color)" }}
          />
          <p className="text-xs text-black/60">Llámanos al</p>
          <h2 className="text-lg font-semibold mb-3 text-[var(--primary-color)]">
            Teléfono de Asistencia
          </h2>

          {/* Input para copiar */}
          <div className="w-full flex mt-2">
            <input
              type="text"
              readOnly
              value={RIDS_CONTACT.phone}
              className="
      flex-1 min-w-0
      px-3 py-2 text-sm
      border border-black/10
      rounded-l-lg
      bg-black/[0.03]
      text-[var(--primary-color)]
      font-medium
      outline-none
      cursor-default
      truncate
    "
            />
            <button
              onClick={handleCopyPhone}
              className="p-3 text-sm text-white rounded-r-lg transition-colors flex items-center justify-center shadow-sm"
              style={{
                background: copied
                  ? "rgb(34 197 94)"
                  : "var(--secondary-color)",
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>

          <p className="mt-2 text-xs text-black/50">
            {copied
              ? "¡Copiado al portapapeles!"
              : "Click para copiar el número completo."}
          </p>
        </div>

        {/* Tarjeta 3: Sitio Web */}
        <a
          href={RIDS_CONTACT.website}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#af9150]/30 via-white to-transparent backdrop-blur-lg rounded-2xl border border-black/10 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 group"
        >
          <Globe
            size={32}
            className="mb-3 group-hover:scale-110 transition-transform"
            style={{ color: "var(--secondary-color)" }}
          />
          <p className="text-xs text-black/60">Visita nuestra</p>
          <h2 className="text-lg font-semibold mb-3 text-[var(--primary-color)]">
            Web Oficial
          </h2>
          <span className="text-sm text-black/70 font-medium hover:underline">
            Ir a RIDS.cl
          </span>
        </a>
      </div>

      {/* Sección de Horarios/Información Adicional */}
      <div className="mt-10 p-6 bg-[var(--tertiary-color)] rounded-2xl border border-black/5 text-center">
        <p className="text-black/70 font-medium">Horario de Soporte</p>
        <p className="text-sm text-black/60 mt-1">
          Lunes a Viernes, de 9:00 AM a 6:00 PM (Hora de Chile)
        </p>
      </div>
    </div>
  );
}
