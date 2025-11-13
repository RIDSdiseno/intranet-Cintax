import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* =========================
     LOGIN GOOGLE
  ========================== */
  useEffect(() => {
    // cargar script de Google Identity
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // @ts-ignore
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          const idToken = response.credential; // <- JWT de Google

          try {
            setLoading(true);
            setError(null);

            const res = await axios.post(
              "http://localhost:3000/api/auth/google",
              { idToken, remember },
              { withCredentials: true } // para la cookie rt
            );

            const accessToken = res.data.accessToken as string;

            if (remember) {
              localStorage.setItem("access_token", accessToken);
            } else {
              sessionStorage.setItem("access_token", accessToken);
            }

            navigate("/home", { replace: true });
          } catch (err: any) {
            console.error(err);
            const msg =
              err?.response?.data?.error ??
              "Error al iniciar sesión con Google.";
            setError(msg);
          } finally {
            setLoading(false);
          }
        },
      });

      // @ts-ignore
      google.accounts.id.renderButton(
        document.getElementById("google-btn"),
        {
          theme: "outline",
          size: "large",
          shape: "pill",
          width: 320,
        }
      );
    };

    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, [remember, navigate]);

  /* =========================
     LOGIN EMAIL + PASSWORD
  ========================== */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await axios.post(
        "http://localhost:3000/api/auth/login",
        { email, password, remember },
        { withCredentials: true }
      );

      const accessToken = res.data.accessToken as string;

      if (remember) {
        localStorage.setItem("access_token", accessToken);
      } else {
        sessionStorage.setItem("access_token", accessToken);
      }

      navigate("/home", { replace: true });
    } catch (err: any) {
      console.error(err);
      const msg =
        err?.response?.data?.error ??
        "Credenciales inválidas. Intenta nuevamente.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--tertiary-color)" }}
    >
      {/* Brand tokens */}
      <style>{`
        :root{ 
          --primary-font: "Loew", sans-serif; 
          --base-size-font: 15px; 
          --primary-color: #1d1e1c; 
          --secondary-color: #af9150; 
          --tertiary-color: #f5f4f0; 
          --transition: all 0.4s ease; 
          --custom-transition: all 0.6s cubic-bezier(0.645,0.045,0.355,1);
          --box-shadow: 0px 2.5896813869px 10.3587255478px 0px #0000001f; 
          --border-radius: 10px; 
          --title-m: 1.7rem; 
          --title-m-mini: 1.5rem; 
          --title-xl: 2rem; 
          --title-m-responsive: 2rem; 
          --text-mini: 0.8rem; 
          --text-content-size: 1rem; 
        }
        html { font-size: var(--base-size-font); }
        body { font-family: var(--primary-font); color: var(--primary-color); }
      `}</style>

      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img
            src="https://cintax.cl/wp-content/themes/cintax/assets/images/logo-cintax.svg"
            alt="Cintax"
            className="h-10 w-auto"
          />
          <h1
            className="text-2xl font-semibold"
            style={{ color: "var(--primary-color)" }}
          >
            Iniciar sesión
          </h1>
          <p className="text-sm text-black/60 text-center max-w-sm">
            Bienvenido(a) a la intranet de Cintax. Ingresa tus credenciales o
            utiliza tu cuenta de Google corporativa.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl bg-white p-5 md:p-6 shadow-sm border border-black/5"
        >
          {error && (
            <div className="mb-4 rounded-lg bg-rose-50 text-rose-700 text-sm px-3 py-2 border border-rose-200">
              {error}
            </div>
          )}

          <label className="block text-sm font-medium text-black/70">
            Correo
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nombre@cintax.cl"
            className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/20 text-[var(--primary-color)]"
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-black/70">
              Contraseña
            </label>
            <div className="mt-1 flex items-stretch gap-2">
              <input
                type={showPwd ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 outline-none focus:border-black/20 text-[var(--primary-color)]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="rounded-xl border border-black/10 px-3 text-sm text-black/70 hover:bg-black/5"
                aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPwd ? "Ocultar" : "Ver"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-black/70">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-black/20"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Recordarme
            </label>
            <a
              href="#"
              className="text-sm"
              style={{ color: "var(--secondary-color)" }}
            >
              ¿Olvidaste tu contraseña?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-xl px-4 py-2 font-medium text-white shadow-sm transition disabled:opacity-60"
            style={{ background: "var(--secondary-color)" }}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>

          {/* separador */}
          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10" />
            <span className="text-xs text-black/50">o</span>
            <div className="h-px flex-1 bg-black/10" />
          </div>

          {/* botón de Google (se renderiza dentro) */}
          <div id="google-btn" className="flex justify-center" />

          <p className="mt-4 text-center text-xs text-black/50">
            © {new Date().getFullYear()} Cintax. Todos los derechos reservados.
          </p>
        </form>
      </div>
    </div>
  );
}
