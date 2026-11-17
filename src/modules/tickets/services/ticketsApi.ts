import { API_BASE_URL, fetchJSON } from "../../../lib/api";
import type {
  CreateTicketPayload,
  CreateTicketResponse,
  TicketAgentsResponse,
  TicketGroupsResponse,
  TicketsSummaryResponse,
  TicketDetailResponse,
  InboxDiagnosticResponse,
  TicketEventsResponse,
  TicketMessagesResponse,
  TicketMessageCreatePayload,
  TicketMessageCreateResponse,
  TicketsQuery,
  TicketsResponse,
} from "../types";

const TICKETS_BASE_URL = `${API_BASE_URL}/tickets`;

export async function getGroups(params: { view?: string } = {}) {
  // `view` hace que los contadores de las pestanas cuenten lo mismo que
  // muestra la tabla; sin el, "Mis tickets" mostraba el total del area.
  const qs = params.view ? `?view=${encodeURIComponent(params.view)}` : "";
  return fetchJSON<TicketGroupsResponse>(`${TICKETS_BASE_URL}/groups${qs}`);
}

export async function getTicketsSummary(params: { area?: string; view?: string } = {}) {
  const search = new URLSearchParams();
  if (params.area) search.set("area", params.area);
  if (params.view) search.set("view", params.view);
  const qs = search.toString();
  return fetchJSON<TicketsSummaryResponse>(
    `${TICKETS_BASE_URL}/summary${qs ? `?${qs}` : ""}`
  );
}

export async function getTickets(params: TicketsQuery) {
  const search = new URLSearchParams();
  if (params.area) search.set("area", params.area);
  if (params.view) search.set("view", params.view);
  if (params.q) search.set("q", params.q);
  if (params.keywords) search.set("keywords", params.keywords);
  if (params.status) search.set("status", params.status);
  if (params.priority) search.set("priority", params.priority);
  if (params.asignado) search.set("asignado", params.asignado);
  if (params.solicitante) search.set("solicitante", params.solicitante);
  if (params.page) search.set("page", String(params.page));
  if (params.pageSize) search.set("pageSize", String(params.pageSize));

  const url = search.toString()
    ? `${TICKETS_BASE_URL}?${search.toString()}`
    : TICKETS_BASE_URL;

  return fetchJSON<TicketsResponse>(url);
}

/**
 * Ingesta manual de correo.
 *
 * No modifica la casilla de soporte: los hilos quedan tal como estaban,
 * leidos o no leidos. La deduplicacion es por `gmailThreadId` y
 * `gmailMessageId` en la base, asi que repetir la sincronizacion no duplica
 * nada. El boton igual pide confirmacion, porque crea tickets de verdad.
 *
 * El endpoint acepta `?markRead=true` para marcarlos, pero eso es sobre el
 * correo real de la empresa y no se revierte.
 */
export async function syncTickets() {
  return fetchJSON<{
    ok: boolean;
    message?: string;
    processed?: number;
    data?: {
      processed: number;
      ingested: number;
      createdTickets: number;
      updatedThreads: number;
      duplicates: number;
      errors: number;
    };
  }>(
    `${TICKETS_BASE_URL}/sync`,
    { method: "POST" }
  );
}

export async function getInboxDiagnostic() {
  return fetchJSON<InboxDiagnosticResponse>(
    `${TICKETS_BASE_URL}/inbox/diagnostic`
  );
}

export async function getTicketById(id: number | string) {
  return fetchJSON<TicketDetailResponse>(`${TICKETS_BASE_URL}/${id}`);
}

export async function getTicketEvents(id: number | string) {
  return fetchJSON<TicketEventsResponse>(`${TICKETS_BASE_URL}/${id}/events`);
}

export async function getTicketMessages(id: number | string) {
  return fetchJSON<TicketMessagesResponse>(
    `${TICKETS_BASE_URL}/${id}/messages`
  );
}

export async function getTicketAgents() {
  return fetchJSON<TicketAgentsResponse>(`${TICKETS_BASE_URL}/agents`);
}

export async function createTicketMessage(
  id: number | string,
  payload: TicketMessageCreatePayload | FormData
) {
  const body = payload instanceof FormData ? payload : JSON.stringify(payload);

  // Incluye estado de entrega de correo (emailStatus/emailError) para feedback en UI.
  return fetchJSON<TicketMessageCreateResponse>(
    `${TICKETS_BASE_URL}/${id}/messages`,
    {
      method: "POST",
      body,
    }
  );
}

export async function sendTicketReply(id: number | string, body: string) {
  return fetchJSON<{ ok: boolean; message?: string }>(
    `${TICKETS_BASE_URL}/${id}/reply`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  );
}

export async function updateTicket(
  id: number | string,
  payload: {
    estado?: string;
    prioridad?: string | number | null;
    categoria?: string | null;
    areaDetected?: string | null;
    tags?: string[] | string | null;
    trabajadorId?: number | null;
  }
) {
  return fetchJSON<{ ok: boolean; data?: unknown }>(
    `${TICKETS_BASE_URL}/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function createTicket(payload: CreateTicketPayload) {
  return fetchJSON<CreateTicketResponse>(`${TICKETS_BASE_URL}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
