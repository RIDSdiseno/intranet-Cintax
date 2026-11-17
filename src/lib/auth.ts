export type JwtFrontendPayload = {
  id: number;
  email: string;
  role?: "ADMIN" | "SUPERVISOR" | "AGENTE" | "SOPORTE";
  nombre?: string;
  nombreUsuario?: string;
  isSupervisorOrAdmin?: boolean;
  isAdmin?: boolean;
  /** Lo calcula el backend al firmar el token. Ver `puedeVerInformes`. */
  puedeVerInformes?: boolean;
  picture?: string;
  avatarUrl?: string;
};

export function getAuthToken(): string | null {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token")
  );
}

export function isAuthed() {
  return !!getAuthToken();
}

export function getAuthPayload(): JwtFrontendPayload | null {
  const token = getAuthToken();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => `%${("00" + c.charCodeAt(0).toString(16)).slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload) as JwtFrontendPayload;
  } catch {
    return null;
  }
}

export function isSupervisorOrAdmin(): boolean {
  return Boolean(getAuthPayload()?.isSupervisorOrAdmin);
}

export function esAdminOSoporte(): boolean {
  const payload = getAuthPayload();
  if (!payload) return false;

  const role = String(payload.role || "").toUpperCase();
  if (["ADMIN", "SUPERVISOR", "SOPORTE"].includes(role)) return true;
  if (payload.isAdmin) return true;
  if (payload.isSupervisorOrAdmin) return true;
  return false;
}

/**
 * ADMIN estricto, igual que `isAdmin()` del backend
 * (`back/src/modules/tickets/access/ticketAccess.ts`).
 *
 * `esAdminOSoporte` es mas amplio (acepta SUPERVISOR y SOPORTE) y sirve para
 * la UI del dia a dia, pero hay endpoints que exigen ADMIN y responden 403 a
 * todo lo demas. Usa esta para no mostrar botones que el backend va a
 * rechazar: hoy POST /tickets/sync y GET /tickets/inbox/diagnostic.
 */
export function esAdminEstricto(): boolean {
  const payload = getAuthPayload();
  if (!payload) return false;

  if (String(payload.role || "").toUpperCase() === "ADMIN") return true;
  return Boolean(payload.isAdmin);
}

/**
 * Acceso a los informes semanales.
 *
 * El flag lo pone el backend al firmar el token, a partir de la lista
 * INFORMES_EMAILS del .env. Aca solo se lee para decidir si se dibuja el menu
 * y la ruta: el backend vuelve a comprobarlo en cada request, asi que esconder
 * la pantalla es comodidad, no seguridad.
 *
 * No hay fallback por rol a proposito. Si alguien no esta en la lista, no ve
 * informes aunque sea ADMIN: la lista es la unica fuente.
 */
export function puedeVerInformes(): boolean {
  return Boolean(getAuthPayload()?.puedeVerInformes);
}
