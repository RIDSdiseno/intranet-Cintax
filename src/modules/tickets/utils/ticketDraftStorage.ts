export type TicketComposerMode = "reply" | "note" | "forward";
export type TicketComposerType = "PUBLIC_REPLY" | "INTERNAL_NOTE" | "FORWARD";

export type TicketComposerDraft = {
  mode: TicketComposerMode;
  type: TicketComposerType;
  toEmail: string;
  cc: string;
  bcc: string;
  subject: string;
  bodyHtml: string;
  savedAt: string;
};

function draftKey(ticketId: number | string) {
  return `ticket_draft_${ticketId}`;
}

export function loadTicketDraft(ticketId: number | string): TicketComposerDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(ticketId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TicketComposerDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveTicketDraft(
  ticketId: number | string,
  draft: Omit<TicketComposerDraft, "savedAt">
) {
  const payload: TicketComposerDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(draftKey(ticketId), JSON.stringify(payload));
}

export function clearTicketDraft(ticketId: number | string) {
  localStorage.removeItem(draftKey(ticketId));
}
