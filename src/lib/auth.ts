export type JwtFrontendPayload = {
  id: number;
  email: string;
  nombre?: string;
  nombreUsuario?: string;
  isSupervisorOrAdmin?: boolean;
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
