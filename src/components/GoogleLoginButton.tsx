// src/components/GoogleLoginButton.tsx
import { useEffect } from "react";
import axios from "axios";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export default function GoogleLoginButton() {
  useEffect(() => {
    const initGoogleIdentity = () => {
      // @ts-ignore
      if (typeof google === "undefined" || !google.accounts?.id) return;
      const target = document.getElementById("google-btn");
      if (!target) return;
      target.innerHTML = "";

      // @ts-ignore
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          const idToken = response.credential;

          const res = await axios.post(
            `${API_BASE_URL}/auth/google`,
            { idToken, remember: true },
            { withCredentials: true }
          );

          console.log("Respuesta backend:", res.data);
        },
      });

      // @ts-ignore
      google.accounts.id.renderButton(target, {
        theme: "outline",
        size: "large",
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existingScript) {
      // @ts-ignore
      if (typeof google !== "undefined" && google.accounts?.id) {
        initGoogleIdentity();
        return;
      }

      existingScript.addEventListener("load", initGoogleIdentity);
      return () => {
        existingScript.removeEventListener("load", initGoogleIdentity);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", initGoogleIdentity);
    document.body.appendChild(script);

    return () => {
      script.removeEventListener("load", initGoogleIdentity);
    };
  }, []);

  return <div id="google-btn" />;
}

