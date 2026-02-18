import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  Forward,
  Loader2,
  MessageSquareReply,
  Send,
  StickyNote,
  X,
  XCircle,
} from "lucide-react";
import DOMPurify from "dompurify";

import {
  createTicketMessage,
  getTicketAgents,
  getTicketById,
  getTicketEvents,
  getTicketMessages,
  updateTicket,
} from "../services/ticketsApi";
import type {
  TicketAgent,
  TicketDetail,
  TicketEvent,
  TicketMessageCreatePayload,
  TicketThreadAttachment,
  TicketThreadMessage,
} from "../types";
import { esAdminOSoporte, getAuthPayload } from "../../../lib/auth";
import { API_BASE_URL } from "../../../lib/api";
import TicketRichTextEditor, {
  TicketRichTextState,
} from "../components/TicketRichTextEditor";
import {
  clearTicketDraft,
  loadTicketDraft,
  saveTicketDraft,
} from "../utils/ticketDraftStorage";

const LEGACY_GROUP_REDIRECTS: Record<string, string | null> = {
  contabilidad: "contabilidad",
  comercial: "comercial-y-marketing",
  "comercial-y-marketing": "comercial-y-marketing",
  gerencia: "gerencia",
  rrhh: "recursos-humanos",
  "recursos-humanos": "recursos-humanos",
  otros: null,
};

const ESTADOS = ["--", "Abierto", "Pendiente", "Resuelto", "Cerrado"] as const;
const PRIORIDADES = ["--", "Baja", "Media", "Alta", "Urgente"] as const;
const AREAS = ["SIN_CLASIFICAR", "CONTABLE", "TRIBUTARIA", "LABORAL"] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_MESSAGE_CHARS = 5000;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_ATTACHMENT_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

const ALLOWED_ATTACHMENT_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
  ".zip",
]);

type ComposerMode = "reply" | "note" | "forward";
type NoticeTone = "success" | "error" | "warning";
type DraftStatus = "idle" | "saving" | "saved";
type SendAction = "send" | "send_close" | "send_internal";

type ComposerAttachment = {
  id: string;
  file: File;
};

type PropertiesState = {
  status: string;
  priority: string;
  areaDetected: "CONTABLE" | "TRIBUTARIA" | "LABORAL" | "SIN_CLASIFICAR";
  tags: string;
  agent: string;
};

type TicketUpdatePayload = {
  estado?: string;
  prioridad?: number | null;
  categoria?: string | null;
  areaDetected?: string | null;
  tags?: string[] | string | null;
  trabajadorId?: number | null;
};

type ConfirmState =
  | { kind: "save"; payload: TicketUpdatePayload; agentChanged: boolean }
  | { kind: "close" }
  | null;

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  warning?: string | null;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

function ConfirmDialog({
  open,
  title,
  description,
  warning,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/45" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-black">{title}</h3>
        <p className="mt-2 text-sm text-black/65">{description}</p>
        {warning && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            {warning}
          </p>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm hover:border-black/20 disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-70 ${
              tone === "danger" ? "bg-rose-600 hover:bg-rose-700" : "bg-[var(--secondary-color)]"
            }`}
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function normalizeEstadoLabel(raw: string | null | undefined) {
  const key = String(raw || "").trim().toLowerCase();
  if (key === "abierto" || key === "open" || key === "abierta") return "Abierto";
  if (key === "pendiente" || key.includes("pending")) return "Pendiente";
  if (key === "resuelto" || key === "resolved") return "Resuelto";
  if (key === "cerrado" || key === "closed") return "Cerrado";
  return "Abierto";
}

function estadoToApiValue(label: string) {
  const key = String(label || "").trim().toLowerCase();
  if (key === "abierto") return "ABIERTO";
  if (key === "pendiente") return "PENDIENTE";
  if (key === "resuelto") return "RESUELTO";
  if (key === "cerrado") return "CERRADO";
  return null;
}

function normalizePrioridadLabel(raw: string | number | null | undefined) {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key) return "--";
  if (key === "1" || key === "baja") return "Baja";
  if (key === "2" || key === "media") return "Media";
  if (key === "3" || key === "alta") return "Alta";
  if (key === "4" || key === "urgente") return "Urgente";
  return "--";
}

function prioridadToApiValue(label: string): number | null {
  const key = String(label || "").trim().toLowerCase();
  if (key === "baja") return 1;
  if (key === "media") return 2;
  if (key === "alta") return 3;
  if (key === "urgente") return 4;
  return null;
}

function escapeHtml(input: string) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textToHtml(input: string) {
  return escapeHtml(input).replace(/\r?\n/g, "<br />");
}

function stripHtmlToText(rawHtml?: string | null) {
  const html = String(rawHtml ?? "");
  if (!html) return "";

  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<\/\s*li\s*>/gi, "\n")
    .replace(/<\s*li\s*>/gi, "- ");

  const withoutScripts = withBreaks
    .replace(/<\s*script[^>]*>[\s\S]*?<\/\s*script\s*>/gi, "")
    .replace(/<\s*style[^>]*>[\s\S]*?<\/\s*style\s*>/gi, "");

  return withoutScripts
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeThreadHtml(rawHtml?: string | null) {
  return DOMPurify.sanitize(String(rawHtml ?? ""), {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "a",
      "blockquote",
      "pre",
      "code",
      "hr",
    ],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

function extensionFromName(filename: string) {
  const name = String(filename ?? "").trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot);
}

function isAllowedAttachmentFile(file: File) {
  const ext = extensionFromName(file.name);
  const mime = String(file.type || "").toLowerCase();
  if (ALLOWED_ATTACHMENT_MIME.has(mime)) return true;
  if (ALLOWED_ATTACHMENT_EXT.has(ext)) return true;
  return false;
}

function formatBytes(rawBytes: number) {
  const bytes = Math.max(Number(rawBytes || 0), 0);
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function resolveAttachmentUrl(rawUrl: string) {
  const url = String(rawUrl || "").trim();
  if (!url) return "#";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("email://")) return url;

  try {
    const api = new URL(API_BASE_URL);
    return new URL(url, api.origin).toString();
  } catch {
    return url;
  }
}

function normalizarListaCorreos(raw: string) {
  if (!raw) return [];

  const vistos = new Set<string>();
  const lista: string[] = [];

  raw
    .split(/[;,]/g)
    .map((item) => item.trim().toLowerCase())
    .forEach((email) => {
      if (!email || vistos.has(email)) return;
      vistos.add(email);
      lista.push(email);
    });

  return lista;
}

function obtenerCorreosInvalidos(correos: string[]) {
  return correos.filter((email) => !EMAIL_REGEX.test(email));
}

function getThreadTypeBadge(msg: Pick<TicketThreadMessage, "type" | "isInbound">) {
  if (msg.isInbound) {
    return {
      label: "Correo entrante",
      classes: "bg-violet-50 border-violet-200 text-violet-700",
      panel: "bg-violet-50/50 border-violet-200",
    };
  }

  if (msg.type === "INTERNAL_NOTE") {
    return {
      label: "Nota interna",
      classes: "bg-amber-50 border-amber-200 text-amber-700",
      panel: "bg-amber-50/60 border-amber-200",
    };
  }

  if (msg.type === "FORWARD") {
    return {
      label: "Reenviado",
      classes: "bg-blue-50 border-blue-200 text-blue-700",
      panel: "bg-blue-50/60 border-blue-200",
    };
  }

  return {
    label: "Respuesta publica",
    classes: "bg-emerald-50 border-emerald-200 text-emerald-700",
    panel: "bg-white border-black/10",
  };
}

function getSlaBadgeClasses(status: "PENDIENTE" | "OK") {
  if (status === "OK") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  return "bg-orange-50 text-orange-700 border-orange-100";
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = id === "nuevo";
  const modeParam = searchParams.get("modo") ?? searchParams.get("mode");
  const esAdmin = esAdminOSoporte();
  const authPayload = getAuthPayload();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [thread, setThread] = useState<TicketThreadMessage[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [agents, setAgents] = useState<TicketAgent[]>([]);

  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  const [properties, setProperties] = useState<PropertiesState>({
    status: "Abierto",
    priority: "Media",
    areaDetected: "SIN_CLASIFICAR",
    tags: "",
    agent: "--",
  });
  const [initialProperties, setInitialProperties] = useState<PropertiesState | null>(null);

  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [tipoComposer, setTipoComposer] = useState<
    "PUBLIC_REPLY" | "INTERNAL_NOTE" | "FORWARD"
  >("PUBLIC_REPLY");
  const [toEmail, setToEmail] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [editorHtml, setEditorHtml] = useState("");
  const [editorTextLength, setEditorTextLength] = useState(0);
  const [editorIsEmpty, setEditorIsEmpty] = useState(true);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [sendAction, setSendAction] = useState<SendAction>("send");
  const [showSendMenu, setShowSendMenu] = useState(false);

  const [toast, setToast] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const toastTimerRef = useRef<number | null>(null);
  const composerPanelRef = useRef<HTMLDivElement | null>(null);
  const destinatarioInputRef = useRef<HTMLInputElement | null>(null);
  const editorFocusRef = useRef<HTMLDivElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const draftSavedTimerRef = useRef<number | null>(null);
  const sendMenuRef = useRef<HTMLDivElement | null>(null);

  // Hace que Responder/Nota/Reenviar lleven al usuario directo al bloque de redaccion.
  const irAComposer = React.useCallback((mode: ComposerMode) => {
    window.requestAnimationFrame(() => {
      composerPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const campoObjetivo =
        mode === "forward" && destinatarioInputRef.current
          ? destinatarioInputRef.current
          : editorFocusRef.current || destinatarioInputRef.current;
      campoObjetivo?.focus();
    });
  }, []);

  const updateProperty = (field: keyof PropertiesState, value: string) => {
    setProperties((prev) => ({ ...prev, [field]: value }));
  };

  const showToast = (tone: NoticeTone, text: string) => {
    setToast({ tone, text });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
      if (draftSavedTimerRef.current) window.clearTimeout(draftSavedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!id || isNew) return;
    const legacy = LEGACY_GROUP_REDIRECTS[id];
    if (legacy === null) {
      navigate("/tickets", { replace: true });
      return;
    }
    if (legacy) navigate(`/tickets?area=${legacy}`, { replace: true });
  }, [id, isNew, navigate]);

  useEffect(() => {
    if (!isNew || esAdmin) return;
    navigate("/tickets", { replace: true });
  }, [isNew, esAdmin, navigate]);

  useEffect(() => {
    if (modeParam === "reply") {
      setComposerMode("reply");
      setTipoComposer("PUBLIC_REPLY");
    } else if (modeParam === "note") {
      setComposerMode("note");
      setTipoComposer("INTERNAL_NOTE");
    } else if (modeParam === "forward") {
      setComposerMode("forward");
      setTipoComposer("FORWARD");
    } else {
      setComposerMode(null);
    }
  }, [modeParam]);

  useEffect(() => {
    if (!ticket || !composerMode) return;

    const defaults = {
      type:
        composerMode === "note"
          ? ("INTERNAL_NOTE" as const)
          : composerMode === "forward"
          ? ("FORWARD" as const)
          : ("PUBLIC_REPLY" as const),
      toEmail: composerMode === "reply" ? ticket.requesterEmail || "" : "",
      cc: "",
      bcc: "",
      subject:
        composerMode === "forward"
          ? `Fwd: ${ticket.subject || "Sin asunto"}`
          : composerMode === "reply"
          ? ticket.subject || ""
          : "",
      bodyHtml: "",
    };

    const savedDraft = loadTicketDraft(ticket.id);
    const canRestoreDraft =
      savedDraft &&
      savedDraft.mode === composerMode &&
      (composerMode !== "note" || savedDraft.type === "INTERNAL_NOTE") &&
      (composerMode !== "forward" || savedDraft.type === "FORWARD");

    const restoredType =
      composerMode === "reply" && canRestoreDraft
        ? savedDraft.type
        : defaults.type;

    setTipoComposer(restoredType);
    setToEmail(canRestoreDraft ? savedDraft.toEmail : defaults.toEmail);
    setCc(canRestoreDraft ? savedDraft.cc : defaults.cc);
    setBcc(canRestoreDraft ? savedDraft.bcc : defaults.bcc);
    setSubject(canRestoreDraft ? savedDraft.subject : defaults.subject);
    setEditorHtml(canRestoreDraft ? savedDraft.bodyHtml : defaults.bodyHtml);
    setShowCcBcc(Boolean(canRestoreDraft && (savedDraft.cc || savedDraft.bcc)));
    setComposerAttachments([]);
    setDraftStatus("idle");
    setSendAction("send");
    setShowSendMenu(false);

    if (composerMode === "reply") {
      return;
    }

    if (composerMode === "forward") {
      setTipoComposer("FORWARD");
      return;
    }

    if (composerMode === "note") {
      setTipoComposer("INTERNAL_NOTE");
      return;
    }
  }, [composerMode, ticket]);

  useEffect(() => {
    if (!ticket || !composerMode) return;
    irAComposer(composerMode);
  }, [composerMode, irAComposer, ticket]);

  const loadAgents = async () => {
    try {
      setLoadingAgents(true);
      setAgentsError(null);
      const res = await getTicketAgents();
      setAgents(res.data);
    } catch (err) {
      console.error("Error cargando agentes:", err);
      setAgentsError("No se pudo cargar la lista de agentes.");
    } finally {
      setLoadingAgents(false);
    }
  };

  const loadTicket = async (ticketId: number) => {
    try {
      setLoading(true);
      setError(null);

      const [detailRes, messagesRes, eventsRes] = await Promise.all([
        getTicketById(ticketId),
        getTicketMessages(ticketId),
        getTicketEvents(ticketId),
      ]);

      setTicket(detailRes.data.ticket);
      setThread(messagesRes.data);
      setEvents(eventsRes.data);

      const nextProperties: PropertiesState = {
        status: normalizeEstadoLabel(detailRes.data.ticket.estado ?? detailRes.data.ticket.status),
        priority: normalizePrioridadLabel(
          detailRes.data.ticket.prioridad ?? detailRes.data.ticket.priority
        ),
        areaDetected: detailRes.data.ticket.areaDetected,
        tags: (detailRes.data.ticket.tags ?? []).join(", "),
        agent: detailRes.data.ticket.trabajadorId
          ? String(detailRes.data.ticket.trabajadorId)
          : "--",
      };

      setProperties(nextProperties);
      setInitialProperties(nextProperties);
    } catch (err) {
      console.error("Error cargando ticket:", err);
      setError("No se pudo cargar el ticket.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!id || isNew) return;
    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      setError("ID invalido");
      return;
    }

    loadTicket(numericId);
    if (esAdmin) {
      loadAgents();
    } else {
      setAgents([]);
      setAgentsError(null);
    }
  }, [id, isNew, esAdmin]);

  const isClosed = useMemo(() => {
    const key = properties.status.toLowerCase();
    return key === "cerrado" || key === "closed";
  }, [properties.status]);
  const esAgenteAsignado = Boolean(
    ticket?.trabajadorId &&
      authPayload?.id &&
      Number(ticket.trabajadorId) === Number(authPayload.id)
  );
  const puedeGestionarPropiedades = esAdmin || esAgenteAsignado;
  const puedeReasignar = esAdmin;
  const puedeEditarClasificacion = esAdmin;
  const puedeAnotarTicketCerrado = esAdmin || esAgenteAsignado;
  const puedeUsarNotaInterna = esAdmin || esAgenteAsignado;
  const composerBloqueadoPorCierre =
    isClosed && (tipoComposer !== "INTERNAL_NOTE" || !puedeAnotarTicketCerrado);
  const mensajeConContenido = !editorIsEmpty || composerAttachments.length > 0;
  const mensajeExcedeLimite = editorTextLength > MAX_MESSAGE_CHARS;
  const envioYcierreDisponible = !isClosed && puedeGestionarPropiedades;

  const hasPendingChanges = useMemo(() => {
    if (!initialProperties) return false;
    return (
      initialProperties.status !== properties.status ||
      initialProperties.priority !== properties.priority ||
      initialProperties.areaDetected !== properties.areaDetected ||
      initialProperties.tags !== properties.tags ||
      initialProperties.agent !== properties.agent
    );
  }, [initialProperties, properties]);

  const threadAsc = useMemo(
    () =>
      [...thread].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [thread]
  );

  useEffect(() => {
    if (!ticket || !composerMode) return;

    if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    setDraftStatus("saving");

    draftTimerRef.current = window.setTimeout(() => {
      saveTicketDraft(ticket.id, {
        mode: composerMode,
        type: tipoComposer,
        toEmail,
        cc,
        bcc,
        subject,
        bodyHtml: editorHtml,
      });

      setDraftStatus("saved");
      if (draftSavedTimerRef.current) {
        window.clearTimeout(draftSavedTimerRef.current);
      }
      draftSavedTimerRef.current = window.setTimeout(() => {
        setDraftStatus("idle");
      }, 1200);
    }, 900);

    return () => {
      if (draftTimerRef.current) window.clearTimeout(draftTimerRef.current);
    };
  }, [ticket?.id, composerMode, tipoComposer, toEmail, cc, bcc, subject, editorHtml]);

  useEffect(() => {
    if (!showSendMenu) return;

    const onWindowPointer = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (sendMenuRef.current?.contains(target)) return;
      setShowSendMenu(false);
    };

    window.addEventListener("mousedown", onWindowPointer);
    return () => window.removeEventListener("mousedown", onWindowPointer);
  }, [showSendMenu]);

  useEffect(() => {
    if (sendAction === "send_internal") {
      const disabled = !puedeUsarNotaInterna || composerMode === "forward";
      if (disabled) setSendAction("send");
      return;
    }

    if (sendAction === "send_close") {
      const disabled =
        !envioYcierreDisponible || tipoComposer === "INTERNAL_NOTE";
      if (disabled) setSendAction("send");
    }
  }, [
    sendAction,
    puedeUsarNotaInterna,
    composerMode,
    envioYcierreDisponible,
    tipoComposer,
  ]);

  const buildUpdatePayload = useMemo(() => {
    if (!initialProperties) {
      return { payload: {} as TicketUpdatePayload, changedFields: [] as string[] };
    }

    const payload: TicketUpdatePayload = {};
    const changedFields: string[] = [];

    if (properties.status !== initialProperties.status && puedeGestionarPropiedades) {
      changedFields.push("estado");
      const estado = estadoToApiValue(properties.status);
      if (estado) payload.estado = estado;
    }

    if (properties.priority !== initialProperties.priority && puedeGestionarPropiedades) {
      changedFields.push("prioridad");
      payload.prioridad = prioridadToApiValue(properties.priority);
    }

    if (
      properties.areaDetected !== initialProperties.areaDetected &&
      puedeEditarClasificacion
    ) {
      changedFields.push("areaDetected");
      payload.areaDetected = properties.areaDetected;
    }

    if (properties.tags !== initialProperties.tags && puedeEditarClasificacion) {
      changedFields.push("tags");
      payload.tags = properties.tags
        .split(/[;,]/g)
        .map((item) => item.trim())
        .filter(Boolean);
    }

    if (properties.agent !== initialProperties.agent && puedeReasignar) {
      changedFields.push("trabajadorId");
      if (properties.agent === "--") {
        payload.trabajadorId = null;
      } else {
        const parsedAgent = Number(properties.agent);
        if (!Number.isNaN(parsedAgent)) payload.trabajadorId = parsedAgent;
      }
    }

    return { payload, changedFields };
  }, [
    initialProperties,
    properties,
    puedeGestionarPropiedades,
    puedeEditarClasificacion,
    puedeReasignar,
  ]);

  const openComposer = (mode: ComposerMode) => {
    if (isClosed && mode !== "note") {
      showToast("error", "Ticket cerrado: solo se permite nota interna.");
      return;
    }
    if (isClosed && mode === "note" && !puedeAnotarTicketCerrado) {
      showToast("error", "Ticket cerrado: no tienes permisos para agregar notas.");
      return;
    }
    if (composerMode === mode) {
      irAComposer(mode);
      return;
    }
    setSearchParams({ modo: mode });
  };

  const closeComposer = () => {
    setShowSendMenu(false);
    setComposerAttachments([]);
    setSearchParams({});
  };

  const confirmSaveProperties = () => {
    if (!ticket) return;
    if (
      !puedeGestionarPropiedades &&
      !puedeEditarClasificacion &&
      !puedeReasignar
    ) {
      showToast("error", "No tienes permisos para actualizar propiedades.");
      return;
    }

    if (Object.keys(buildUpdatePayload.payload).length === 0) {
      showToast("warning", "No hay cambios para guardar.");
      return;
    }

    setConfirmState({
      kind: "save",
      payload: buildUpdatePayload.payload,
      agentChanged: buildUpdatePayload.changedFields.includes("trabajadorId"),
    });
  };

  const runSaveProperties = async (payload: TicketUpdatePayload) => {
    if (!ticket) return;

    try {
      setSaving(true);
      await updateTicket(ticket.id, payload);
      await loadTicket(ticket.id);
      showToast("success", "Propiedades actualizadas.");
    } catch (err) {
      console.error("Error actualizando ticket:", err);
      showToast("error", "No se pudo actualizar el ticket.");
    } finally {
      setSaving(false);
    }
  };

  const confirmCloseTicket = () => {
    if (!ticket || isClosed) return;
    if (!puedeGestionarPropiedades) {
      showToast("error", "No tienes permisos para cerrar este ticket.");
      return;
    }
    setConfirmState({ kind: "close" });
  };

  const runCloseTicket = async () => {
    if (!ticket || isClosed) return;

    try {
      setSaving(true);
      await updateTicket(ticket.id, { estado: "CERRADO" });
      await loadTicket(ticket.id);
      showToast("success", "Ticket cerrado.");
      if (composerMode && composerMode !== "note") {
        if (puedeAnotarTicketCerrado) setSearchParams({ modo: "note" });
        else setSearchParams({});
      }
    } catch (err) {
      console.error("Error cerrando ticket:", err);
      showToast("error", "No se pudo cerrar el ticket.");
    } finally {
      setSaving(false);
    }
  };

  const onConfirmDialog = async () => {
    if (!confirmState) return;
    if (confirmState.kind === "save") {
      await runSaveProperties(confirmState.payload);
      setConfirmState(null);
      return;
    }

    await runCloseTicket();
    setConfirmState(null);
  };

  const handleEditorChange = React.useCallback((state: TicketRichTextState) => {
    setEditorHtml(state.html);
    setEditorTextLength(state.textLength);
    setEditorIsEmpty(state.isEmpty);
  }, []);

  const removeComposerAttachment = (idToRemove: string) => {
    setComposerAttachments((prev) => prev.filter((item) => item.id !== idToRemove));
  };

  const onPickAttachments = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;

    setComposerAttachments((previous) => {
      const next = [...previous];
      const spaceLeft = MAX_ATTACHMENTS - next.length;
      if (spaceLeft <= 0) {
        showToast("warning", `Maximo ${MAX_ATTACHMENTS} archivos por mensaje.`);
        return previous;
      }

      files.slice(0, spaceLeft).forEach((file) => {
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          showToast(
            "warning",
            `${file.name} supera 10 MB. Reduce el tamaño para adjuntarlo.`
          );
          return;
        }

        if (!isAllowedAttachmentFile(file)) {
          showToast(
            "warning",
            `${file.name} no es un tipo permitido. Usa PDF, Office, imagen, TXT o ZIP.`
          );
          return;
        }

        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
        });
      });

      if (files.length > spaceLeft) {
        showToast("warning", `Solo puedes adjuntar ${MAX_ATTACHMENTS} archivos.`);
      }

      return next;
    });
  };

  const handleSendMessage = async () => {
    if (!ticket || !composerMode) return;
    if (composerBloqueadoPorCierre) {
      showToast("error", "No se puede enviar mensajes en este estado del ticket.");
      return;
    }

    const effectiveType: TicketMessageCreatePayload["type"] =
      sendAction === "send_internal" ? "INTERNAL_NOTE" : tipoComposer;

    if (sendAction === "send_internal" && !puedeUsarNotaInterna) {
      showToast("error", "No tienes permisos para enviar notas internas.");
      return;
    }

    if (mensajeExcedeLimite) {
      showToast(
        "warning",
        `El mensaje supera el limite de ${MAX_MESSAGE_CHARS} caracteres.`
      );
      return;
    }

    if (!mensajeConContenido) {
      showToast("warning", "Escribe un mensaje o adjunta un archivo antes de enviar.");
      return;
    }

    const correosPara =
      effectiveType === "INTERNAL_NOTE" ? [] : normalizarListaCorreos(toEmail);
    const correosCc = normalizarListaCorreos(cc);
    const correosBcc = normalizarListaCorreos(bcc);

    if (effectiveType !== "INTERNAL_NOTE" && correosPara.length === 0) {
      showToast("warning", "Debes indicar al menos un destinatario en Para.");
      return;
    }

    const invalidos = [
      ...obtenerCorreosInvalidos(correosPara),
      ...obtenerCorreosInvalidos(correosCc),
      ...obtenerCorreosInvalidos(correosBcc),
    ];
    if (invalidos.length > 0) {
      showToast("warning", "Hay correos invalidos en Para/CC/BCC.");
      return;
    }

    if (effectiveType === "FORWARD" && !subject.trim()) {
      showToast("warning", "Debes indicar asunto para reenviar.");
      return;
    }

    try {
      setSending(true);
      setShowSendMenu(false);

      const payload = new FormData();
      payload.append("type", effectiveType);
      payload.append("bodyHtml", editorHtml || "");
      if (effectiveType !== "INTERNAL_NOTE" && correosPara.length > 0) {
        payload.append("toEmail", correosPara.join(", "));
      }
      if (effectiveType === "FORWARD" && subject.trim()) {
        payload.append("subject", subject.trim());
      }
      if (correosCc.length > 0) payload.append("cc", correosCc.join(", "));
      if (correosBcc.length > 0) payload.append("bcc", correosBcc.join(", "));
      composerAttachments.forEach((attachment) => {
        payload.append("attachments", attachment.file, attachment.file.name);
      });

      const res = await createTicketMessage(ticket.id, payload);

      if (res.data) {
        setThread((prev) => [...prev, res.data as TicketThreadMessage]);
      } else {
        const messagesRes = await getTicketMessages(ticket.id);
        setThread(messagesRes.data);
      }

      setEditorHtml("");
      setEditorTextLength(0);
      setEditorIsEmpty(true);
      setCc("");
      setBcc("");
      setComposerAttachments([]);
      clearTicketDraft(ticket.id);
      setDraftStatus("idle");
      setSendAction("send");
      let cierreFallido = false;

      if (sendAction === "send_close" && envioYcierreDisponible) {
        try {
          await updateTicket(ticket.id, { estado: "CERRADO" });
          await loadTicket(ticket.id);
        } catch (closeErr) {
          console.error("Error cerrando ticket tras envio:", closeErr);
          cierreFallido = true;
        }
      }

      // El backend devuelve emailStatus para distinguir:
      // - SENT: envio real ok
      // - SKIPPED: mensaje guardado sin salida externa (ej. nota interna)
      // - FAILED: mensaje guardado pero fallo el envio
      if (res.emailStatus === "FAILED") {
        showToast(
          "warning",
          res.emailError
            ? `${res.message || "Mensaje guardado sin envio."} ${res.emailError}`
            : res.message || "Mensaje guardado, pero el correo no pudo enviarse."
        );
      } else {
        showToast("success", res.message || "Accion guardada en el hilo.");
      }

      if (cierreFallido) {
        showToast(
          "warning",
          "Mensaje enviado, pero no se pudo cerrar el ticket automaticamente."
        );
      }

      if (sendAction === "send_close") {
        if (puedeAnotarTicketCerrado) {
          setSearchParams({ modo: "note" });
        } else {
          setSearchParams({});
        }
      }
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      showToast("error", "No se pudo guardar la accion.");
    } finally {
      setSending(false);
    }
  };

  if (isNew) {
    if (!esAdmin) return null;

    return (
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-[var(--primary-color)]">Crear ticket</h2>
        <p className="text-sm text-black/60 mt-1">Formulario de creacion pendiente de implementacion.</p>
        <button
          onClick={() => navigate("/tickets")}
          className="mt-4 rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20"
        >
          Volver a tickets
        </button>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="mt-4 bg-white rounded-2xl border border-black/5 shadow-sm p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 rounded bg-black/10" />
          <div className="h-6 w-3/4 rounded bg-black/10" />
          <div className="h-4 w-2/3 rounded bg-black/10" />
          <div className="h-28 rounded-xl bg-black/10 mt-4" />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-[var(--primary-color)]">Detalle de ticket</h2>
        <p className="text-sm text-rose-600 mt-2">{error}</p>
        <button
          onClick={() => navigate("/tickets")}
          className="mt-4 rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20"
        >
          Volver a tickets
        </button>
      </section>
    );
  }

  if (!ticket) return null;

  const sendPrimaryLabel =
    sendAction === "send_close"
      ? "Enviar y cerrar"
      : sendAction === "send_internal"
      ? "Enviar como nota"
      : tipoComposer === "INTERNAL_NOTE"
      ? "Guardar nota"
      : "Enviar";

  return (
    <section className="mt-4 space-y-5">
      {toast && (
        <div className="fixed right-4 top-4 z-[70]">
          <div
            className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${
              toast.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : toast.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs text-black/40">Ticket #{ticket.number}</p>
                <h2 className="text-2xl font-semibold text-[var(--primary-color)]">{ticket.subject}</h2>
                <p className="text-sm text-black/60 mt-1">
                  {ticket.requesterEmail} - {ticket.group}
                </p>
                <p className="text-xs text-black/40 mt-1">Creado: {formatDate(ticket.createdAt)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[11px] font-medium text-black/70">
                    Área: {ticket.areaDetected}
                  </span>
                  {(ticket.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={() => navigate("/tickets")}
                className="rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20"
              >
                Volver a tickets
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-black/10 bg-white px-3 py-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => openComposer("reply")}
                  disabled={isClosed}
                  aria-pressed={composerMode === "reply"}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white transition active:scale-[0.98] disabled:opacity-60 ${
                    composerMode === "reply" ? "ring-2 ring-black/10 shadow-md" : ""
                  }`}
                  style={{ background: "var(--secondary-color)" }}
                >
                  <MessageSquareReply size={15} />
                  Responder
                </button>

                <button
                  onClick={() => openComposer("note")}
                  disabled={isClosed && !puedeAnotarTicketCerrado}
                  aria-pressed={composerMode === "note"}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition active:scale-[0.98] disabled:opacity-60 ${
                    composerMode === "note"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-black/10 bg-white hover:border-black/20"
                  }`}
                >
                  <StickyNote size={15} />
                  Nota
                </button>

                <button
                  onClick={() => openComposer("forward")}
                  disabled={isClosed}
                  aria-pressed={composerMode === "forward"}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition active:scale-[0.98] disabled:opacity-60 ${
                    composerMode === "forward"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-black/10 bg-white hover:border-black/20"
                  }`}
                >
                  <Forward size={15} />
                  Reenviar
                </button>

                <button
                  onClick={confirmCloseTicket}
                  disabled={saving || isClosed || !puedeGestionarPropiedades}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  title={isClosed ? "El ticket ya esta cerrado" : "Cerrar ticket"}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                  {isClosed ? "Cerrado" : "Cerrar"}
                </button>
              </div>

              {isClosed && (
                <p className="mt-2 text-xs text-black/55">
                  Ticket cerrado: solo se permiten notas internas
                  {!puedeAnotarTicketCerrado ? " para admin/soporte." : "."}
                </p>
              )}
            </div>

            <div className="mt-4 text-xs text-black/40">Ultima actualizacion: {formatDate(ticket.updatedAt)}</div>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-[var(--primary-color)]">Conversacion</h3>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-black/10 p-4 bg-white shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-black/50">
                  <span className="font-medium text-black/70">Solicitud original</span>
                  <span className="text-black/30">-</span>
                  <span>{ticket.requesterEmail}</span>
                  <span className="text-black/30">-</span>
                  <span>{formatDate(ticket.createdAt)}</span>
                </div>
                <p className="text-sm text-black/80 mt-2 whitespace-pre-wrap">
                  {ticket.description || "Sin descripcion."}
                </p>
              </div>

              {threadAsc.map((msg) => {
                const typeUi = getThreadTypeBadge(msg);
                const authorName =
                  msg.author?.nombre ||
                  msg.author?.email ||
                  msg.fromEmail ||
                  "Sistema";
                const fallbackHtml = textToHtml(
                  (msg.bodyText && msg.bodyText.trim()) || stripHtmlToText(msg.bodyHtml)
                );
                const safeHtml = sanitizeThreadHtml(msg.bodyHtml || fallbackHtml);
                const attachments = msg.attachments ?? [];

                return (
                  <div key={msg.id} className={`rounded-xl border p-4 shadow-sm ${typeUi.panel}`}>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-black/55">
                      <span className="font-medium text-black/75">{authorName}</span>
                      <span className="text-black/30">-</span>
                      <span>{formatDate(msg.createdAt)}</span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeUi.classes}`}
                      >
                        {typeUi.label}
                      </span>
                    </div>

                    {(msg.toEmail || msg.subject) && (
                      <div className="mt-2 text-xs text-black/55 space-y-1">
                        {msg.toEmail && <div>Para: {msg.toEmail}</div>}
                        {msg.subject && <div>Asunto: {msg.subject}</div>}
                      </div>
                    )}

                    <div
                      className="ticket-thread-body mt-2 text-sm text-black/80 leading-relaxed"
                      dangerouslySetInnerHTML={{
                        __html: safeHtml || "<p>Sin contenido</p>",
                      }}
                    />

                    {attachments.length > 0 && (
                      <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3">
                        <p className="text-xs font-semibold text-black/60">Adjuntos</p>
                        <div className="mt-2 space-y-1.5">
                          {attachments.map((attachment: TicketThreadAttachment) => {
                            const isEmailAttachment = attachment.url.startsWith("email://");
                            const href = resolveAttachmentUrl(attachment.url);

                            if (isEmailAttachment) {
                              return (
                                <div
                                  key={attachment.id}
                                  className="text-xs text-black/60"
                                  title="Adjunto proveniente de correo entrante"
                                >
                                  {attachment.filename} ({formatBytes(attachment.size)})
                                </div>
                              );
                            }

                            return (
                              <a
                                key={attachment.id}
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-xs text-sky-700 hover:underline"
                              >
                                {attachment.filename} ({formatBytes(attachment.size)})
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {composerMode ? (
            <div
              ref={composerPanelRef}
              className="bg-white rounded-2xl border border-black/5 shadow-sm p-6"
            >
              <input
                ref={attachmentInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={onPickAttachments}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt,.zip"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--primary-color)]">
                  {tipoComposer === "PUBLIC_REPLY"
                    ? "Responder"
                    : tipoComposer === "INTERNAL_NOTE"
                    ? "Nota interna"
                    : "Reenviar"}
                </h3>

                <span className="text-xs text-black/45">
                  {draftStatus === "saving"
                    ? "Guardando..."
                    : draftStatus === "saved"
                    ? "Guardado"
                    : " "}
                </span>
              </div>

              {composerMode === "reply" && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTipoComposer("PUBLIC_REPLY")}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      tipoComposer === "PUBLIC_REPLY"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-black/10 bg-white text-black/70"
                    }`}
                  >
                    Publico
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoComposer("INTERNAL_NOTE")}
                    disabled={!puedeUsarNotaInterna}
                    className={`rounded-lg border px-3 py-1.5 text-xs disabled:opacity-60 ${
                      tipoComposer === "INTERNAL_NOTE"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-black/10 bg-white text-black/70"
                    }`}
                  >
                    Privado (nota)
                  </button>
                </div>
              )}

              {tipoComposer !== "INTERNAL_NOTE" && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-xs text-black/50">Para</label>
                    <input
                      ref={destinatarioInputRef}
                      value={toEmail}
                      disabled={sending || composerBloqueadoPorCierre}
                      onChange={(e) => setToEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                      placeholder="correo@cliente.cl"
                    />
                  </div>

                  {tipoComposer === "FORWARD" && (
                    <div>
                      <label className="text-xs text-black/50">Asunto</label>
                      <input
                        value={subject}
                        disabled={sending || composerBloqueadoPorCierre}
                        onChange={(e) => setSubject(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowCcBcc((current) => !current)}
                    className="text-xs text-sky-700 hover:underline"
                  >
                    {showCcBcc ? "Ocultar CC/BCC" : "Mostrar CC/BCC"}
                  </button>

                  {showCcBcc && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        value={cc}
                        disabled={sending || composerBloqueadoPorCierre}
                        onChange={(event) => setCc(event.target.value)}
                        className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                        placeholder="CC"
                      />
                      <input
                        value={bcc}
                        disabled={sending || composerBloqueadoPorCierre}
                        onChange={(event) => setBcc(event.target.value)}
                        className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                        placeholder="BCC"
                      />
                    </div>
                  )}
                </div>
              )}

              <div ref={editorFocusRef} tabIndex={-1} className="mt-3">
                <TicketRichTextEditor
                  value={editorHtml}
                  disabled={sending || composerBloqueadoPorCierre}
                  maxCharacters={MAX_MESSAGE_CHARS}
                  onChange={handleEditorChange}
                  onAttachClick={() => attachmentInputRef.current?.click()}
                />
              </div>

              {composerAttachments.length > 0 && (
                <div className="mt-3 rounded-xl border border-black/10 bg-black/[0.02] p-3">
                  <p className="text-xs font-semibold text-black/60">Adjuntos listos para enviar</p>
                  <div className="mt-2 space-y-2">
                    {composerAttachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between rounded-lg border border-black/10 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs text-black/75">{attachment.file.name}</p>
                          <p className="text-[11px] text-black/45">
                            {formatBytes(attachment.file.size)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeComposerAttachment(attachment.id)}
                          className="rounded-md border border-black/10 p-1 text-black/55 hover:border-black/20"
                          title="Quitar archivo"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {mensajeExcedeLimite && (
                <p className="mt-2 text-xs text-rose-600">
                  El mensaje supera el limite de {MAX_MESSAGE_CHARS} caracteres.
                </p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={closeComposer}
                  className="rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20"
                >
                  Cerrar
                </button>

                <div ref={sendMenuRef} className="relative inline-flex items-stretch rounded-xl">
                  <button
                    onClick={handleSendMessage}
                    disabled={
                      sending ||
                      composerBloqueadoPorCierre ||
                      !mensajeConContenido ||
                      mensajeExcedeLimite
                    }
                    className="inline-flex items-center gap-2 rounded-l-xl px-4 py-2 text-sm text-white shadow-md shadow-black/20 disabled:opacity-70"
                    style={{ background: "var(--secondary-color)" }}
                  >
                    {sending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    {sending ? "Enviando..." : sendPrimaryLabel}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSendMenu((prev) => !prev)}
                    disabled={sending}
                    className="rounded-r-xl border-l border-white/20 px-2 text-white disabled:opacity-70"
                    style={{ background: "var(--secondary-color)" }}
                    title="Opciones de envio"
                  >
                    <ChevronDown size={14} />
                  </button>

                  {showSendMenu && (
                    <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[210px] rounded-xl border border-black/10 bg-white p-1.5 shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setSendAction("send");
                          setShowSendMenu(false);
                        }}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                          sendAction === "send"
                            ? "bg-black/[0.05] text-black"
                            : "text-black/75 hover:bg-black/[0.04]"
                        }`}
                      >
                        Enviar
                      </button>

                      {envioYcierreDisponible && tipoComposer !== "INTERNAL_NOTE" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSendAction("send_close");
                            setShowSendMenu(false);
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                            sendAction === "send_close"
                              ? "bg-black/[0.05] text-black"
                              : "text-black/75 hover:bg-black/[0.04]"
                          }`}
                        >
                          Enviar y cerrar ticket
                        </button>
                      )}

                      {puedeUsarNotaInterna && composerMode !== "forward" && (
                        <button
                          type="button"
                          onClick={() => {
                            setSendAction("send_internal");
                            setShowSendMenu(false);
                          }}
                          className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                            sendAction === "send_internal"
                              ? "bg-black/[0.05] text-black"
                              : "text-black/75 hover:bg-black/[0.04]"
                          }`}
                        >
                          Enviar como nota interna
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6 text-sm text-black/50">
              Selecciona una accion para responder, agregar nota o reenviar.
            </div>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 self-start">
          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <h3 className="text-xs font-semibold tracking-wide text-black/55">
              VENCIMIENTO DE LA PRIMERA RESPUESTA
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getSlaBadgeClasses(
                  ticket.firstResponseStatus
                )}`}
              >
                {ticket.firstResponseStatus}
              </span>
              <span className="text-xs text-black/45">{formatDate(ticket.firstResponseDueAt)}</span>
            </div>

            <h3 className="mt-4 text-xs font-semibold tracking-wide text-black/55">RESOLUCION PENDIENTE</h3>
            <div className="mt-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getSlaBadgeClasses(
                  ticket.resolutionStatus
                )}`}
              >
                {ticket.resolutionStatus}
              </span>
              <span className="text-xs text-black/45">{formatDate(ticket.resolutionDueAt)}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--primary-color)]">PROPIEDADES</h3>
            <p className="mt-1 text-xs text-black/45">
              {hasPendingChanges ? "Cambios pendientes" : "Sin cambios pendientes"}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-black/50">Estado</label>
                <select
                  value={properties.status}
                  disabled={!puedeGestionarPropiedades}
                  onChange={(e) => updateProperty("status", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                >
                  {ESTADOS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-black/50">Prioridad</label>
                <select
                  value={properties.priority}
                  disabled={!puedeGestionarPropiedades}
                  onChange={(e) => updateProperty("priority", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                >
                  {PRIORIDADES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-black/50">Área detectada</label>
                <select
                  value={properties.areaDetected}
                  disabled={!puedeEditarClasificacion}
                  onChange={(e) =>
                    updateProperty(
                      "areaDetected",
                      e.target.value as PropertiesState["areaDetected"]
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                >
                  {AREAS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                {!puedeEditarClasificacion && (
                  <p className="mt-1 text-[11px] text-black/45">
                    Solo admin/soporte puede editar clasificación y tags.
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-black/50">Tags (coma o ;)</label>
                <input
                  value={properties.tags}
                  disabled={!puedeEditarClasificacion}
                  onChange={(e) => updateProperty("tags", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                  placeholder="f29, iva, remuneraciones"
                />
              </div>

              <div>
                <label className="text-xs text-black/50">Agente</label>
                <select
                  value={properties.agent}
                  disabled={!puedeReasignar}
                  onChange={(e) => updateProperty("agent", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                >
                  <option value="--">--</option>
                  {agents.map((agent) => (
                    <option key={agent.id_trabajador} value={String(agent.id_trabajador)}>
                      {agent.nombre} ({agent.email})
                    </option>
                  ))}
                </select>
                {!puedeReasignar && (
                  <p className="mt-1 text-[11px] text-black/45">
                    Solo admin/soporte puede reasignar.
                  </p>
                )}
                {loadingAgents && puedeReasignar && (
                  <p className="mt-1 text-[11px] text-black/45">Cargando agentes...</p>
                )}
                {agentsError && puedeReasignar && (
                  <p className="mt-1 text-[11px] text-rose-600">{agentsError}</p>
                )}
              </div>

              <button
                onClick={confirmSaveProperties}
                disabled={
                  saving ||
                  !hasPendingChanges ||
                  (!puedeGestionarPropiedades &&
                    !puedeEditarClasificacion &&
                    !puedeReasignar)
                }
                className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm text-white shadow-md shadow-black/30 active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-80"
                style={{ background: "var(--secondary-color)" }}
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--primary-color)]">EVENTOS</h3>
            <div className="mt-3 space-y-2">
              {events.length === 0 && (
                <p className="text-xs text-black/50">Sin eventos registrados.</p>
              )}
              {events.map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2"
                >
                  <p className="text-xs font-medium text-black/70">{event.type}</p>
                  <p className="text-[11px] text-black/50">
                    {event.actor?.nombre || event.actor?.email || "Sistema"} ·{" "}
                    {formatDate(event.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.kind === "close" ? "Cerrar ticket" : "Actualizar propiedades"}
        description={
          confirmState?.kind === "close"
            ? "Estas seguro? Esta accion marcara el ticket como CERRADO."
            : "Confirmas guardar los cambios del ticket?"
        }
        warning={
          confirmState?.kind === "save" && confirmState.agentChanged
            ? "Esto cambiara el agente asignado."
            : confirmState?.kind === "close"
            ? "Esta accion no se puede deshacer."
            : null
        }
        confirmLabel={confirmState?.kind === "close" ? "Cerrar ticket" : "Guardar cambios"}
        tone={confirmState?.kind === "close" ? "danger" : "default"}
        busy={saving}
        onCancel={() => setConfirmState(null)}
        onConfirm={onConfirmDialog}
      />
    </section>
  );
}
