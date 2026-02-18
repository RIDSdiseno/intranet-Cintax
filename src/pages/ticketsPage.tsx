// src/pages/TicketsPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getAuthPayload, getAuthToken } from "../lib/auth"; // ✅ usa tu helper real

/**
 * Vite:
 * - .env => VITE_API_URL=http://localhost:3000/api
 * - si no existe, fallback
 */
const API_BASE =
  import.meta.env.VITE_API_URL?.toString() || "http://localhost:3000/api";

const api = axios.create({
  baseURL: API_BASE,
  // Si tu auth usa cookies, pon true y backend debe responder Allow-Credentials=true
  withCredentials: false,
});

// ✅ token desde tu auth.ts (access_token / auth_token)
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type Area = "CONTA" | "ADMIN" | "RRHH" | "TRIBUTARIO" | null;

type Me = {
  id: number; // ✅ payload trae id, no id_trabajador
  email: string;
  nombre?: string;
  areaInterna?: Area; // si no viene en payload, queda null
};



type GmailThreadRow = {
  id: string; // threadId
  snippet?: string;
  historyId?: string;
};

type GmailParsedMessage = {
  gmailId: string | null;
  threadId: string | null;
  snippet: string | null;

  subject: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  replyTo: string | null;
  date: string | null;

  messageIdHeader: string | null;
  inReplyTo: string | null;
  references: string | null;

  bodyText: string;
  bodyHtml: string;
};

function formatArea(a?: Area) {
  if (!a) return "—";
  const map: Record<string, string> = {
    CONTA: "Contabilidad",
    ADMIN: "Administración",
    RRHH: "Recursos Humanos",
    TRIBUTARIO: "Tributario",
  };
  return map[a] ?? a;
}

function formatDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function deriveSubjectFromSnippet(snippet?: string) {
  if (!snippet) return "—";
  return snippet.length > 60 ? snippet.slice(0, 60) + "…" : snippet;
}

function isCintaxAddress(v?: string | null) {
  const s = (v ?? "").toLowerCase();
  return s.includes("@cintax.cl");
}

function deriveRequesterFromMessages(messages: GmailParsedMessage[]) {
  for (const m of messages) {
    const from = (m.from ?? "").toLowerCase();
    if (!from) continue;
    if (!from.includes("@cintax.cl")) return m.from ?? "";
  }
  return messages[0]?.from ?? "";
}

export default function TicketsPage() {
  const [me, setMe] = useState<Me | null>(null);

  // Gmail query real (se manda al backend)
  const [gmailQ, setGmailQ] = useState("");

  // filtro local (texto simple sobre snippet/id)
  const [localQ, setLocalQ] = useState("");

  const [threads, setThreads] = useState<GmailThreadRow[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const [messages, setMessages] = useState<GmailParsedMessage[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // responder
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const canSend = useMemo(
    () => replyText.trim().length > 0 && !!selectedThreadId && !sending,
    [replyText, selectedThreadId, sending]
  );

  async function fetchMe() {
    // ✅ 1) Preferimos payload local (no depende de /auth/me)
    const payload = getAuthPayload();
    if (payload?.id && payload.email) {
      setMe({
        id: payload.id,
        email: payload.email,
        nombre: payload.nombre ?? payload.nombreUsuario ?? undefined,
        // si el JWT no trae area, lo dejamos null (la UI mostrará —)
        areaInterna: null,
      });
      return;
    }

    // ✅ 2) fallback: intenta endpoint si existe
    try {
      const res = await api.get("/auth/me");
      const u = res.data?.user ?? res.data;
      if (u) {
        setMe({
          id: u.id ?? u.id_trabajador ?? 0,
          email: u.email,
          nombre: u.nombre,
          areaInterna: u.areaInterna ?? null,
        });
      }
    } catch {
      // nada
    }
  }

  async function fetchThreads() {
    setLoadingThreads(true);
    setThreadsError(null);
    try {
      const qBase = gmailQ.trim() ? gmailQ.trim() : "in:inbox";

      const res = await api.get("/mailbox/threads", {
        params: {
          q: qBase,
          max: 50,
          unreadOnly: false,
          includeSpamTrash: false,
        },
      });

      const list = res.data?.threads ?? [];
      setThreads(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setThreadsError(
        e?.response?.data?.error ?? e?.message ?? "Error cargando bandeja"
      );
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }

  async function fetchThreadDetail(threadId: string) {
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await api.get(`/mailbox/threads/${threadId}`, {
        params: { markRead: false, raw: false },
      });

      const msgs = res.data?.messages ?? [];
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e: any) {
      setDetailError(
        e?.response?.data?.error ?? e?.message ?? "Error cargando thread"
      );
      setMessages([]);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function sendReply() {
    if (!selectedThreadId || !canSend) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("bodyText", replyText);

      for (const f of replyFiles) {
        fd.append("attachments", f);
      }

      const res = await api.post(
        `/mailbox/threads/${selectedThreadId}/reply`,
        fd,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (!res.data?.ok) {
        throw new Error(res.data?.error ?? "No se pudo enviar");
      }

      setReplyText("");
      setReplyFiles([]);

      await fetchThreadDetail(selectedThreadId);
      await fetchThreads();
    } catch (e: any) {
      alert(e?.response?.data?.error ?? e?.message ?? "Error enviando respuesta");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    fetchMe();
    fetchThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedThreadId) fetchThreadDetail(selectedThreadId);
    else setMessages([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  const visibleThreads = useMemo(() => {
    const qq = localQ.trim().toLowerCase();
    if (!qq) return threads;

    return threads.filter((t) => {
      const snippet = (t.snippet ?? "").toLowerCase();
      return snippet.includes(qq) || t.id.toLowerCase().includes(qq);
    });
  }, [threads, localQ]);

  const headerSubject = useMemo(() => {
    if (messages.length > 0) return messages[0]?.subject ?? "—";
    if (selectedThreadId)
      return deriveSubjectFromSnippet(
        threads.find((t) => t.id === selectedThreadId)?.snippet
      );
    return "—";
  }, [messages, selectedThreadId, threads]);

  const requester = useMemo(() => {
    if (messages.length > 0) return deriveRequesterFromMessages(messages);
    return "—";
  }, [messages]);

  const lastDate = useMemo(() => {
    if (!messages.length) return null;
    return messages[messages.length - 1]?.date ?? null;
  }, [messages]);

  const tokenPresent = Boolean(getAuthToken());

  return (
    <div className="min-h-screen w-full p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">
              Tickets (provisorio - Gmail)
            </h1>
            <div className="mt-1 text-sm text-neutral-500">
              Bandeja real: soporte@cintax.cl. Grupo = tu área. Agente = tú.
            </div>
            <div className="mt-1 text-xs text-neutral-400">
              API: <span className="font-mono">{API_BASE}</span> • Token:{" "}
              <span className="font-mono">{tokenPresent ? "OK" : "NO"}</span>
            </div>
          </div>

          <button
            onClick={fetchThreads}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
          >
            Refrescar
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[380px_1fr]">
          {/* LISTA */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <div className="text-sm font-semibold text-neutral-900">Bandeja</div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <input
                value={gmailQ}
                onChange={(e) => setGmailQ(e.target.value)}
                placeholder='Gmail query (ej: in:inbox newer_than:7d is:unread)'
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2"
              />

              <div className="grid grid-cols-1 gap-2">
                <input
                  value={localQ}
                  onChange={(e) => setLocalQ(e.target.value)}
                  placeholder="Filtro local (texto sobre snippet/id)"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2"
                />
              </div>

              <button
                onClick={fetchThreads}
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white"
              >
                Buscar
              </button>

              <div className="text-xs text-neutral-500">
                Tips Gmail: <span className="font-mono">newer_than:7d</span>,{" "}
                <span className="font-mono">from:correo</span>,{" "}
                <span className="font-mono">subject:palabra</span>,{" "}
                <span className="font-mono">is:unread</span>
              </div>
            </div>

            <div className="mt-4">
              {loadingThreads && (
                <div className="text-sm text-neutral-500">Cargando…</div>
              )}
              {threadsError && (
                <div className="text-sm text-red-600">{threadsError}</div>
              )}

              {!loadingThreads && !threadsError && visibleThreads.length === 0 && (
                <div className="text-sm text-neutral-500">No hay tickets.</div>
              )}

              <div className="mt-2 space-y-2">
                {visibleThreads.map((t) => {
                  const active = t.id === selectedThreadId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedThreadId(t.id)}
                      className={cx(
                        "w-full rounded-lg border p-3 text-left",
                        active
                          ? "border-neutral-900 bg-neutral-50"
                          : "border-neutral-200 bg-white hover:bg-neutral-50"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-neutral-900">
                          Thread #{t.id}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {t.historyId ?? "—"}
                        </div>
                      </div>

                      <div className="mt-1 text-xs text-neutral-600">
                        {t.snippet ?? "(sin snippet)"}
                      </div>

                      <div className="mt-1 text-xs text-neutral-500">
                        Grupo: {formatArea(me?.areaInterna ?? null)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* DETALLE */}
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            {!selectedThreadId ? (
              <div className="text-sm text-neutral-500">
                Selecciona un ticket para ver detalles.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-neutral-900">
                      Thread #{selectedThreadId}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">
                      {headerSubject}
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">
                      Cliente: {requester}
                    </div>
                  </div>

                  <div className="text-xs text-neutral-500">
                    Último mensaje: {formatDate(lastDate)}
                  </div>
                </div>

                {/* Asignación */}
                <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-sm font-semibold text-neutral-900">
                    Asignación
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs text-neutral-500">Grupo</div>
                      <div className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                        {formatArea(me?.areaInterna ?? null)}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-neutral-500">Agente (tú)</div>
                      <div className="mt-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                        {me
                          ? me.nombre
                            ? `${me.nombre} (${me.email})`
                            : me.email
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-neutral-500">
                    Al responder: From = tu email, CC = soporte + tú, Reply-To = soporte.
                  </div>
                </div>

                {/* Mensajes */}
                <div className="mt-4">
                  <div className="text-sm font-semibold text-neutral-900">
                    Historial
                  </div>

                  {loadingDetail && (
                    <div className="mt-2 text-sm text-neutral-500">Cargando…</div>
                  )}
                  {detailError && (
                    <div className="mt-2 text-sm text-red-600">{detailError}</div>
                  )}

                  {!loadingDetail && !detailError && (
                    <div className="mt-3 space-y-3">
                      {messages.map((m, idx) => {
                        const fromIsInternal = isCintaxAddress(m.from);
                        return (
                          <div
                            key={m.gmailId ?? `${idx}`}
                            className={cx(
                              "rounded-xl border p-4",
                              fromIsInternal
                                ? "border-neutral-200 bg-neutral-50"
                                : "border-neutral-200 bg-white"
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-xs text-neutral-500">
                                {formatDate(m.date)}
                              </div>
                              <div className="text-xs text-neutral-500">
                                From: {m.from ?? "—"}
                              </div>
                            </div>

                            {m.subject && (
                              <div className="mt-2 text-sm font-semibold text-neutral-900">
                                {m.subject}
                              </div>
                            )}

                            <pre className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">
                              {m.bodyText ?? ""}
                            </pre>
                          </div>
                        );
                      })}

                      {messages.length === 0 && (
                        <div className="text-sm text-neutral-500">Sin mensajes aún.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Responder */}
                <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="text-sm font-semibold text-neutral-900">Responder</div>

                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Escribe tu respuesta…"
                    className="mt-3 h-28 w-full rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:ring-2"
                  />

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <input
                      type="file"
                      multiple
                      onChange={(e) =>
                        setReplyFiles(Array.from(e.target.files ?? []))
                      }
                      className="text-sm"
                    />

                    <button
                      onClick={sendReply}
                      disabled={!canSend}
                      className="rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {sending ? "Enviando..." : "Enviar respuesta"}
                    </button>
                  </div>

                  {replyFiles.length > 0 && (
                    <div className="mt-2 text-xs text-neutral-500">
                      Adjuntos: {replyFiles.map((f) => f.name).join(", ")}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-neutral-500">
                    Endpoint requerido:{" "}
                    <span className="font-mono">POST /mailbox/threads/:threadId/reply</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
