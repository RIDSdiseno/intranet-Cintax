// src/components/GoogleLoginButton.tsx
import { useEffect } from "react";
import axios from "axios";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function GoogleLoginButton() {
  useEffect(() => {
    // Cargar script de Google Identity
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      // @ts-ignore
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response: any) => {
          const idToken = response.credential; // 👈 este es el JWT de Google

          // Mandar al backend
          const res = await axios.post(
            "http://localhost:3000/api/auth/google",
            { idToken, remember: true },
            { withCredentials: true } // para que guarde la cookie rt
          );

          console.log("Respuesta backend:", res.data);
        },
      });

      // @ts-ignore
      google.accounts.id.renderButton(
        document.getElementById("google-btn"),
        { theme: "outline", size: "large" }
      );
    };
  }, []);

  return <div id="google-btn" />;
}
