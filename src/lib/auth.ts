export type JwtFrontendPayload = {
  id: number;
  email: string;
  role?: "ADMIN" | "SUPERVISOR" | "AGENTE" | "SOPORTE";
  nombre?: string;
  nombreUsuario?: string;
  isSupervisorOrAdmin?: boolean;
  isAdmin?: boolean;
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
