import { API_BASE_URL, fetchJSON } from "../../../lib/api";
import type {
  TicketAgentsResponse,
  TicketGroupsResponse,
  TicketDetailResponse,
  InboxDiagnosticResponse,
  TicketMessagesResponse,
  TicketMessageCreatePayload,
  TicketThreadMessage,
  TicketsQuery,
  TicketsResponse,
} from "../types";

const TICKETS_BASE_URL = `${API_BASE_URL}/tickets`;

export async function getGroups() {
  return fetchJSON<TicketGroupsResponse>(`${TICKETS_BASE_URL}/groups`);
}

export async function getTickets(params: TicketsQuery) {
  const search = new URLSearchParams();
  if (params.area) search.set("area", params.area);
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.priority) search.set("priority", params.priority);

  const url = search.toString()
    ? `${TICKETS_BASE_URL}?${search.toString()}`
    : TICKETS_BASE_URL;

  return fetchJSON<TicketsResponse>(url);
}

export async function syncTickets() {
  return fetchJSON<{ ok: boolean; message?: string; processed?: number }>(
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
  payload: TicketMessageCreatePayload
) {
  return fetchJSON<{ ok: boolean; data?: TicketThreadMessage; message?: string }>(
    `${TICKETS_BASE_URL}/${id}/messages`,
    {
      method: "POST",
      body: JSON.stringify(payload),
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
