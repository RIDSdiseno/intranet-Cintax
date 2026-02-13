import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Forward,
  Loader2,
  MessageSquareReply,
  Send,
  StickyNote,
  XCircle,
} from "lucide-react";

import {
  createTicketMessage,
  getTicketAgents,
  getTicketById,
  getTicketMessages,
  updateTicket,
} from "../services/ticketsApi";
import type { TicketAgent, TicketDetail, TicketThreadMessage } from "../types";

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
const GROUPS = ["Administrativo", "Soporte Rids", "Ventas"] as const;
const TYPES = ["Solicitud", "Problema", "Whatsapp", "Llamada telefonica"] as const;

type ComposerMode = "reply" | "note" | "forward";
type NoticeTone = "success" | "error" | "warning";

type PropertiesState = {
  status: string;
  priority: string;
  group: string;
  type: string;
  agent: string;
};

type TicketUpdatePayload = {
  estado?: string;
  prioridad?: number | null;
  categoria?: string | null;
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

function normalizeGroupValue(raw: string | null | undefined) {
  const key = String(raw || "").trim().toLowerCase();
  if (!key) return "--";
  if (key.includes("administrativo") || key === "admin") return "Administrativo";
  if (key.includes("soporte")) return "Soporte Rids";
  if (key.includes("venta")) return "Ventas";
  return "--";
}

function escapeHtml(input: string) {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plainTextToHtml(input: string) {
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

function getThreadTypeBadge(type: TicketThreadMessage["type"]) {
  if (type === "INTERNAL_NOTE") {
    return {
      label: "Nota interna",
      classes: "bg-amber-50 border-amber-200 text-amber-700",
      panel: "bg-amber-50/60 border-amber-200",
    };
  }

  if (type === "FORWARD") {
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
  const modeParam = searchParams.get("mode");

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [thread, setThread] = useState<TicketThreadMessage[]>([]);
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
    group: "--",
    type: "--",
    agent: "--",
  });
  const [initialProperties, setInitialProperties] = useState<PropertiesState | null>(null);

  const [composerMode, setComposerMode] = useState<ComposerMode | null>(null);
  const [toEmail, setToEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [editor, setEditor] = useState("");

  const [toast, setToast] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const toastTimerRef = useRef<number | null>(null);

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
    if (modeParam === "reply") setComposerMode("reply");
    else if (modeParam === "note") setComposerMode("note");
    else if (modeParam === "forward") setComposerMode("forward");
    else setComposerMode(null);
  }, [modeParam]);

  useEffect(() => {
    if (!ticket || !composerMode) return;

    if (composerMode === "reply") {
      setToEmail(ticket.requesterEmail || "");
      setSubject(ticket.subject || "");
    }

    if (composerMode === "forward") {
      setToEmail("");
      setSubject(`Fwd: ${ticket.subject || "Sin asunto"}`);
    }

    if (composerMode === "note") {
      setToEmail("");
      setSubject("");
    }

    setEditor("");
  }, [composerMode, ticket]);

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

      const [detailRes, messagesRes] = await Promise.all([
        getTicketById(ticketId),
        getTicketMessages(ticketId),
      ]);

      setTicket(detailRes.data.ticket);
      setThread(messagesRes.data);

      const nextProperties: PropertiesState = {
        status: normalizeEstadoLabel(detailRes.data.ticket.estado ?? detailRes.data.ticket.status),
        priority: normalizePrioridadLabel(
          detailRes.data.ticket.prioridad ?? detailRes.data.ticket.priority
        ),
        group: normalizeGroupValue(detailRes.data.ticket.categoria),
        type: "--",
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
    loadAgents();
  }, [id, isNew]);

  const isClosed = useMemo(() => {
    const key = properties.status.toLowerCase();
    return key === "cerrado" || key === "closed";
  }, [properties.status]);

  const hasPendingChanges = useMemo(() => {
    if (!initialProperties) return false;
    return (
      initialProperties.status !== properties.status ||
      initialProperties.priority !== properties.priority ||
      initialProperties.group !== properties.group ||
      initialProperties.type !== properties.type ||
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

  const buildUpdatePayload = useMemo(() => {
    if (!initialProperties) {
      return { payload: {} as TicketUpdatePayload, changedFields: [] as string[] };
    }

    const payload: TicketUpdatePayload = {};
    const changedFields: string[] = [];

    if (properties.status !== initialProperties.status) {
      changedFields.push("estado");
      const estado = estadoToApiValue(properties.status);
      if (estado) payload.estado = estado;
    }

    if (properties.priority !== initialProperties.priority) {
      changedFields.push("prioridad");
      payload.prioridad = prioridadToApiValue(properties.priority);
    }

    if (properties.group !== initialProperties.group) {
      changedFields.push("categoria");
      payload.categoria = properties.group === "--" ? null : properties.group;
    }

    if (properties.agent !== initialProperties.agent) {
      changedFields.push("trabajadorId");
      if (properties.agent === "--") {
        payload.trabajadorId = null;
      } else {
        const parsedAgent = Number(properties.agent);
        if (!Number.isNaN(parsedAgent)) payload.trabajadorId = parsedAgent;
      }
    }

    return { payload, changedFields };
  }, [initialProperties, properties]);

  const openComposer = (mode: ComposerMode) => {
    if (isClosed && mode !== "note") {
      showToast("error", "Ticket cerrado: solo se permite nota interna.");
      return;
    }
    setSearchParams({ mode });
  };

  const closeComposer = () => {
    setSearchParams({});
    setEditor("");
  };

  const confirmSaveProperties = () => {
    if (!ticket) return;

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
    setConfirmState({ kind: "close" });
  };

  const runCloseTicket = async () => {
    if (!ticket || isClosed) return;

    try {
      setSaving(true);
      await updateTicket(ticket.id, { estado: "CERRADO" });
      await loadTicket(ticket.id);
      showToast("success", "Ticket cerrado.");
      if (composerMode && composerMode !== "note") setSearchParams({ mode: "note" });
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

  const handleSendMessage = async () => {
    if (!ticket || !composerMode) return;

    const cleanEditor = editor.replace(/\s+/g, " ").trim();
    if (!cleanEditor) {
      showToast("warning", "Escribe un mensaje antes de enviar.");
      return;
    }
    if (composerMode !== "note" && !toEmail.trim()) {
      showToast("warning", "Debes indicar un destinatario.");
      return;
    }

    try {
      setSending(true);

      const payloadType =
        composerMode === "reply"
          ? "PUBLIC_REPLY"
          : composerMode === "note"
          ? "INTERNAL_NOTE"
          : "FORWARD";

      const res = await createTicketMessage(ticket.id, {
        type: payloadType,
        bodyHtml: plainTextToHtml(editor),
        toEmail: composerMode === "note" ? undefined : toEmail.trim(),
        subject: composerMode === "forward" ? subject.trim() : undefined,
      });

      if (res.data) {
        setThread((prev) => [...prev, res.data as TicketThreadMessage]);
      } else {
        const messagesRes = await getTicketMessages(ticket.id);
        setThread(messagesRes.data);
      }

      setEditor("");
      showToast("success", res.message || "Accion guardada en el hilo.");
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      showToast("error", "No se pudo guardar la accion.");
    } finally {
      setSending(false);
    }
  };

  if (isNew) {
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
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white disabled:opacity-60"
                  style={{ background: "var(--secondary-color)" }}
                >
                  <MessageSquareReply size={15} />
                  Responder
                </button>

                <button
                  onClick={() => openComposer("note")}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:border-black/20"
                >
                  <StickyNote size={15} />
                  Nota
                </button>

                <button
                  onClick={() => openComposer("forward")}
                  disabled={isClosed}
                  className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:border-black/20 disabled:opacity-60"
                >
                  <Forward size={15} />
                  Reenviar
                </button>

                <button
                  onClick={confirmCloseTicket}
                  disabled={saving || isClosed}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                  title={isClosed ? "El ticket ya esta cerrado" : "Cerrar ticket"}
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                  {isClosed ? "Cerrado" : "Cerrar"}
                </button>
              </div>

              {isClosed && (
                <p className="mt-2 text-xs text-black/55">
                  Ticket cerrado: solo se permiten notas internas.
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
                const typeUi = getThreadTypeBadge(msg.type);
                const authorName = msg.author?.nombre || msg.author?.email || "Sistema";
                const safeText = (msg.bodyText && msg.bodyText.trim()) || stripHtmlToText(msg.bodyHtml);

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

                    <p className="mt-2 text-sm text-black/80 whitespace-pre-wrap leading-relaxed">
                      {safeText || "Sin contenido"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {composerMode ? (
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-[var(--primary-color)]">
                {composerMode === "reply"
                  ? "Responder"
                  : composerMode === "note"
                  ? "Nota interna"
                  : "Reenviar"}
              </h3>

              {composerMode !== "note" && (
                <div className="mt-3 space-y-2">
                  <div>
                    <label className="text-xs text-black/50">Para</label>
                    <input
                      value={toEmail}
                      disabled={sending || isClosed}
                      onChange={(e) => setToEmail(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                      placeholder="correo@cliente.cl"
                    />
                  </div>

                  {composerMode === "forward" && (
                    <div>
                      <label className="text-xs text-black/50">Asunto</label>
                      <input
                        value={subject}
                        disabled={sending || isClosed}
                        onChange={(e) => setSubject(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:bg-black/[0.03]"
                      />
                    </div>
                  )}
                </div>
              )}

              <textarea
                value={editor}
                disabled={sending || (isClosed && composerMode !== "note")}
                onChange={(e) => setEditor(e.target.value)}
                className="mt-3 w-full rounded-xl border border-black/10 px-3 py-3 text-sm min-h-[160px] outline-none disabled:bg-black/[0.03]"
                placeholder="Escribe tu mensaje..."
              />

              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={closeComposer}
                  className="rounded-xl px-3 py-2 text-sm border border-black/10 bg-white hover:border-black/20"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleSendMessage}
                  disabled={sending || (isClosed && composerMode !== "note")}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-white shadow-md shadow-black/20 disabled:opacity-70"
                  style={{ background: "var(--secondary-color)" }}
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {sending ? "Guardando..." : "Enviar"}
                </button>
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
                  onChange={(e) => updateProperty("status", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
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
                  onChange={(e) => updateProperty("priority", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  {PRIORIDADES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-black/50">Grupo</label>
                <select
                  value={properties.group}
                  onChange={(e) => updateProperty("group", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="--">--</option>
                  {GROUPS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-black/50">Tipo</label>
                <select
                  value={properties.type}
                  onChange={(e) => updateProperty("type", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="--">--</option>
                  {TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-black/45">Tipo se mantiene solo en UI en esta fase.</p>
              </div>

              <div>
                <label className="text-xs text-black/50">Agente</label>
                <select
                  value={properties.agent}
                  onChange={(e) => updateProperty("agent", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm"
                >
                  <option value="--">--</option>
                  {agents.map((agent) => (
                    <option key={agent.id_trabajador} value={String(agent.id_trabajador)}>
                      {agent.nombre} ({agent.email})
                    </option>
                  ))}
                </select>
                {loadingAgents && <p className="mt-1 text-[11px] text-black/45">Cargando agentes...</p>}
                {agentsError && <p className="mt-1 text-[11px] text-rose-600">{agentsError}</p>}
              </div>

              <button
                onClick={confirmSaveProperties}
                disabled={saving}
                className="mt-2 w-full rounded-xl px-3 py-2.5 text-sm text-white shadow-md shadow-black/30 active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-80"
                style={{ background: "var(--secondary-color)" }}
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? "Actualizando..." : "Actualizar"}
              </button>
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
