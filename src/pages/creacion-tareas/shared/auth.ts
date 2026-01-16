// src/pages/creacion-tareas/shared/auth.ts
export type Role = "ADMIN" | "SUPERVISOR" | "AGENTE";

export const getAuthToken = () => {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("auth_token") ||
    sessionStorage.getItem("auth_token")
  );
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
};

const parseJwtPayload = (token: string): any | null => {
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const normalizeRole = (v: any): Role | null => {
  const s = String(v || "").trim().toUpperCase();
  if (s === "ADMIN") return "ADMIN";
  if (s === "SUPERVISOR") return "SUPERVISOR";
  if (s === "AGENTE") return "AGENTE";
  return null;
};

const extractRoleFromAny = (obj: any): Role | null => {
  if (!obj || typeof obj !== "object") return null;

  const direct =
    normalizeRole(obj.role) ||
    normalizeRole(obj.rol) ||
    normalizeRole(obj.areaInterna) ||
    normalizeRole(obj.areainterna) ||
    normalizeRole(obj.area) ||
    normalizeRole(obj.perfil);

  if (direct) return direct;

  return (
    extractRoleFromAny(obj.user) ||
    extractRoleFromAny(obj.usuario) ||
    extractRoleFromAny(obj.trabajador) ||
    extractRoleFromAny(obj.profile) ||
    extractRoleFromAny(obj.data) ||
    null
  );
};

export const getRoleFromToken = (): Role | null => {
  const token = getAuthToken();
  if (!token) return null;

  const payload = parseJwtPayload(token);
  if (!payload) return null;

  // console.log("[AUTH] jwt payload:", payload);
  return extractRoleFromAny(payload);
};

export const fetchRoleFromBackend = async (API_BASE_URL: string): Promise<Role | null> => {
  const endpoints = [
    `${API_BASE_URL}/auth/me`,
    `${API_BASE_URL}/me`,
    `${API_BASE_URL}/usuarios/me`,
    `${API_BASE_URL}/trabajadores/me`,
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) continue;

      const data = await res.json();
      // console.log("[AUTH] me:", url, data);

      const r = extractRoleFromAny(data);
      if (r) return r;
    } catch {
      // probar siguiente
    }
  }

  return null;
};
