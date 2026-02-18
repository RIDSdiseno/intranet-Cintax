export type TicketGroup = {
  slug: string;
  name: string;
  count: number;
};

export type TicketsGroupsData = {
  totalAll: number;
  groups: TicketGroup[];
};

export type TicketRow = {
  id: number;
  number: number;
  subject: string;
  requester: string;
  requesterEmail: string;
  preview: string | null;
  group: string;
  areaDetected: "CONTABLE" | "TRIBUTARIA" | "LABORAL" | "SIN_CLASIFICAR";
  areaSlug: string | null;
  areaLabel: string | null;
  categoria: string | null;
  tags: string[];
  trabajadorId: number | null;
  status: string;
  priority: string;
  createdAt: string;
};

export type TicketMessage = {
  id: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  kind: "requester" | "reply";
};

export type TicketThreadMessageAuthor = {
  id_trabajador: number;
  nombre: string;
  email: string;
};

export type TicketThreadAttachment = {
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  createdAt: string;
};

export type TicketThreadMessage = {
  id: number;
  type: "PUBLIC_REPLY" | "INTERNAL_NOTE" | "FORWARD";
  isInbound?: boolean;
  fromEmail?: string | null;
  toEmail?: string | null;
  cc?: string | null;
  bcc?: string | null;
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  attachments?: TicketThreadAttachment[];
  createdAt: string;
  author?: TicketThreadMessageAuthor | null;
};

export type TicketMessagesResponse = {
  ok: true;
  data: TicketThreadMessage[];
};

export type TicketMessageCreatePayload = {
  type: "PUBLIC_REPLY" | "INTERNAL_NOTE" | "FORWARD";
  toEmail?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  bodyHtml: string;
};

// Estado de entrega reportado por backend al crear mensaje.
export type TicketMessageEmailStatus = "SENT" | "SKIPPED" | "FAILED";

export type TicketMessageCreateResponse = {
  ok: boolean;
  data?: TicketThreadMessage;
  message?: string;
  emailStatus?: TicketMessageEmailStatus;
  emailError?: string | null;
};

export type TicketDetail = {
  id: number;
  number: number;
  subject: string;
  description: string;
  requesterEmail: string;
  group: string;
  categoria: string | null;
  areaDetected: "CONTABLE" | "TRIBUTARIA" | "LABORAL" | "SIN_CLASIFICAR";
  tags: string[];
  status: string;
  estado: string | null;
  priority: string;
  prioridad: number | null;
  createdAt: string;
  updatedAt: string;
  trabajadorId: number | null;
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstResponseStatus: "PENDIENTE" | "OK";
  resolutionStatus: "PENDIENTE" | "OK";
};

export type TicketDetailResponse = {
  ok: true;
  data: {
    ticket: TicketDetail;
    messages: TicketMessage[];
  };
};

export type TicketEvent = {
  id: number;
  type: string;
  createdAt: string;
  actor: {
    id_trabajador: number;
    nombre: string;
    email: string;
  } | null;
  payload: Record<string, unknown> | null;
};

export type TicketEventsResponse = {
  ok: true;
  data: TicketEvent[];
};

export type TicketGroupsResponse = {
  ok: true;
  data: TicketsGroupsData;
};

export type TicketsResponse = {
  ok: true;
  data: {
    items: TicketRow[];
    total: number;
    page: number;
    pageSize: number;
  };
};

export type InboxDiagnosticTicket = {
  id_ticket: number;
  subject: string;
  requesterEmail: string;
  createdAt: string;
  categoria: string | null;
  estado: string | null;
  prioridad: number | null;
};

export type InboxDiagnosticData = {
  totalTickets: number;
  latest: InboxDiagnosticTicket[];
};

export type InboxDiagnosticResponse = {
  ok: true;
  data: InboxDiagnosticData;
};

export type TicketAgent = {
  id_trabajador: number;
  nombre: string;
  email: string;
  areaInterna: "CONTA" | "ADMIN" | "RRHH" | "TRIBUTARIO" | null;
};

export type TicketAgentsResponse = {
  ok: true;
  data: TicketAgent[];
};

export type TicketsQuery = {
  area?: string;
  view?: "mine" | "all";
  q?: string;
  keywords?: string;
  status?: string;
  priority?: string;
  asignado?: string;
  solicitante?: string;
  page?: number;
  pageSize?: number;
};

export type CreateTicketPayload = {
  subject: string;
  description: string;
  categoria?: string | null;
  prioridad?: number | null;
  requesterEmail?: string | null;
  trabajadorId?: number | null;
  areaDetected?: "CONTABLE" | "TRIBUTARIA" | "LABORAL" | "SIN_CLASIFICAR" | null;
  tags?: string[] | string | null;
};

export type CreateTicketResponse = {
  ok: boolean;
  data?: TicketRow;
  error?: string;
};
