import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Lock,
} from "lucide-react";

export default function RecuperarContrasena() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [passwords, setPasswords] = useState({ new: "", confirm: "" });

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTimeout(() => {
      setLoading(false);
      if (email.includes("@")) {
        setStep(2);
      } else {
        setError("Por favor ingresa un correo válido.");
      }
    }, 1500);
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTimeout(() => {
      setLoading(false);
      if (code === "123456") {
        setStep(3);
      } else {
        setError("Código incorrecto. Prueba con 123456.");
      }
    }, 1500);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (passwords.new !== passwords.confirm) {
      setLoading(false);
      setError("Las contraseñas no coinciden.");
      return;
    }

    setTimeout(() => {
      setLoading(false);
      setStep(4);
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.7)_0%,rgba(0,0,0,0)_60%),url(/img/bg-recuperarclave.webp)] bg-cover bg-center bg-no-repeat bg-fixed">
      <style>{`
        :root{ --primary-color: #1d1e1c; --secondary-color: #af9150; }
      `}</style>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 border-b border-black/5 text-center bg-gray-50/50">
          <h1 className="text-xl font-bold text-[var(--primary-color)]">
            Recuperar Contraseña
          </h1>
          <p className="text-sm text-black/50 mt-1">
            {step === 1 && "Ingresa tu correo y te enviaremos un código."}
            {step === 2 && `Hemos enviado un código a ${email}`}
            {step === 3 && "Crea una nueva contraseña segura."}
            {step === 4 && "¡Todo listo!"}
          </p>
        </div>

        <div className="p-6 md:p-8">
          {step === 1 && (
            <form
              onSubmit={handleSendCode}
              className="space-y-5 animate-in fade-in slide-in-from-right-4"
            >
              {error && (
                <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-1.5">
                  Correo Corporativo
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
                  />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nombre@cintax.cl"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/10 rounded-xl text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-1 focus:ring-[var(--secondary-color)] transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 transition-all"
                style={{ background: "var(--secondary-color)" }}
              >
                {loading ? "Enviando..." : "Enviar código"}
              </button>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={handleVerifyCode}
              className="space-y-5 animate-in fade-in slide-in-from-right-4"
            >
              {error && (
                <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-1.5">
                  Código de verificación (6 dígitos)
                </label>
                <div className="relative">
                  <KeyRound
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
                  />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Ej: 123456"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/10 rounded-xl text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-1 focus:ring-[var(--secondary-color)] transition-all tracking-widest font-mono"
                  />
                </div>
                <p className="text-xs text-black/40 mt-2 text-center">
                  ¿No recibiste el código?{" "}
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[var(--secondary-color)] underline hover:text-black"
                  >
                    Reenviar
                  </button>
                </p>
              </div>
              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="w-full py-3 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 transition-all disabled:opacity-50"
                style={{ background: "var(--secondary-color)" }}
              >
                {loading ? "Verificando..." : "Verificar código"}
              </button>
            </form>
          )}

          {step === 3 && (
            <form
              onSubmit={handleResetPassword}
              className="space-y-5 animate-in fade-in slide-in-from-right-4"
            >
              {error && (
                <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-1.5">
                    Nueva Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
                    />
                    <input
                      type="password"
                      required
                      value={passwords.new}
                      onChange={(e) =>
                        setPasswords({ ...passwords, new: e.target.value })
                      }
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/10 rounded-xl text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-1 focus:ring-[var(--secondary-color)] transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-black/60 uppercase tracking-wider mb-1.5">
                    Confirmar Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30"
                    />
                    <input
                      type="password"
                      required
                      value={passwords.confirm}
                      onChange={(e) =>
                        setPasswords({ ...passwords, confirm: e.target.value })
                      }
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-black/10 rounded-xl text-sm outline-none focus:border-[var(--secondary-color)] focus:ring-1 focus:ring-[var(--secondary-color)] transition-all"
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !passwords.new}
                className="w-full py-3 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 transition-all disabled:opacity-50"
                style={{ background: "var(--secondary-color)" }}
              >
                {loading ? "Actualizando..." : "Cambiar contraseña"}
              </button>
            </form>
          )}

          {step === 4 && (
            <div className="text-center animate-in fade-in slide-in-from-bottom-2">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-2">
                ¡Contraseña actualizada!
              </h3>
              <p className="text-sm text-black/60 mb-6">
                Tu contraseña ha sido cambiada exitosamente. Ya puedes iniciar
                sesión con tus nuevas credenciales.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center w-full py-2.5 rounded-xl text-sm font-medium text-white shadow-md hover:opacity-90 transition-all"
                style={{ background: "var(--secondary-color)" }}
              >
                Ir al inicio de sesión
              </Link>
            </div>
          )}
        </div>

        {step !== 4 && (
          <div className="p-4 bg-gray-50 border-t border-black/5 text-center">
            {step === 1 ? (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-black/60 hover:text-[var(--primary-color)] transition-colors"
              >
                <ArrowLeft size={16} />
                Volver al login
              </Link>
            ) : (
              <button
                onClick={() => setStep((prev) => Math.max(1, prev - 1) as any)}
                className="inline-flex items-center gap-2 text-sm font-medium text-black/60 hover:text-[var(--primary-color)] transition-colors"
              >
                <ArrowLeft size={16} />
                Atrás
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}