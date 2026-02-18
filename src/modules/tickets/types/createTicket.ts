import type { TicketRow } from "../types";

export type CreateTicketArea =
  | "Contabilidad"
  | "Tributaria"
  | "Laboral";

export type CreateTicketType =
  | "Solicitud"
  | "Problema"
  | "Whatsapp"
  | "Llamada telefonica";

export type CreateTicketPriority = "Baja" | "Media" | "Alta";

export type CreateTicketFormValues = {
  subject: string;
  requesterEmail: string;
  area: CreateTicketArea | "";
  type: CreateTicketType | "";
  priority: CreateTicketPriority | "";
  description: string;
  attachments: File[];
};

export type CreateTicketErrors = Partial<
  Record<keyof Omit<CreateTicketFormValues, "attachments">, string>
>;

export type CreateTicketMock = TicketRow;
