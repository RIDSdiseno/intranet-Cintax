import React from "react";
import {
  CheckCircle2,
  Eye,
  Forward,
  Inbox,
  Loader2,
  MessageSquareReply,
  StickyNote,
} from "lucide-react";
import type { TicketRow } from "../types";

function getStatusClasses(status: string): string {
  switch (status) {
    case "Abierto":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "Pendiente":
      return "bg-sky-50 text-sky-700 border-sky-100";
    case "Resuelto":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "Cerrado":
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

function getPriorityClasses(priority: string): string {
  switch (priority) {
    case "Urgente":
      return "bg-rose-50 text-rose-700 border-rose-100";
    case "Alta":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "Media":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "Baja":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    default:
      return "bg-zinc-100 text-zinc-700 border-zinc-200";
  }
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function isClosedStatus(status: string) {
  const key = String(status || "").trim().toLowerCase();
  return key === "cerrado" || key === "closed";
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-black/5">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="p-4 sm:p-5">
          <div className="animate-pulse flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-40 rounded-full bg-black/10" />
              <div className="h-3 w-20 rounded-full bg-black/10" />
            </div>
            <div className="h-4 w-3/4 rounded-full bg-black/10" />
            <div className="h-3 w-full rounded-full bg-black/10" />
            <div className="h-3 w-2/3 rounded-full bg-black/10" />
            <div className="flex items-center gap-2">
              <div className="h-6 w-20 rounded-full bg-black/10" />
              <div className="h-6 w-16 rounded-full bg-black/10" />
              <div className="h-6 w-24 rounded-full bg-black/10 ml-auto" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TicketsTable({
  tickets,
  loading,
  actionLoadingId,
  onView,
  onReply,
  onNote,
  onForward,
  onClose,
}: {
  tickets: TicketRow[];
  loading: boolean;
  actionLoadingId?: number | null;
  onView: (id: number) => void;
  onReply?: (id: number) => void;
  onNote?: (id: number) => void;
  onForward?: (id: number) => void;
  onClose?: (id: number) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-black/5 shadow-lg overflow-hidden">
      {loading && <SkeletonRows />}

      {!loading && tickets.length === 0 && (
        <div className="py-14 px-6 text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full border border-black/10 bg-black/[0.03] flex items-center justify-center text-black/50">
            <Inbox size={20} />
          </div>
          <p className="text-sm font-medium text-black/70">No se encontraron tickets.</p>
          <p className="text-xs text-black/45 mt-1">
            Ajusta filtros o busca por numero, asunto o solicitante.
          </p>
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="divide-y divide-black/5">
          {tickets.map((ticket) => {
            const closed = isClosedStatus(ticket.status);
            const rowBusy = actionLoadingId === ticket.id;

            return (
              <article
                key={ticket.id}
                className="group relative p-4 sm:p-5 transition-colors hover:bg-[var(--tertiary-color)]/35 cursor-pointer"
                onClick={() => onView(ticket.id)}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-black/50">
                      <span className="font-mono text-black/65">#{ticket.number}</span>
                      <span className="text-black/30">|</span>
                      <span className="truncate max-w-[280px] sm:max-w-none text-black/70">
                        {ticket.requesterEmail || ticket.requester}
                      </span>
                      <span className="ml-auto lg:ml-0 text-black/40">{formatDate(ticket.createdAt)}</span>
                    </div>

                    <h3 className="mt-1 text-sm sm:text-[15px] font-semibold text-[var(--primary-color)] group-hover:underline underline-offset-2 line-clamp-1">
                      {ticket.subject}
                    </h3>

                    <p className="mt-1 text-xs sm:text-sm text-black/55 line-clamp-2">
                      {ticket.preview || "Sin descripcion"}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 lg:items-end lg:min-w-[260px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium bg-black/[0.03] border-black/10 text-black/65">
                        {ticket.areaLabel || ticket.group}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${getStatusClasses(
                          ticket.status
                        )}`}
                      >
                        {ticket.status}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${getPriorityClasses(
                          ticket.priority
                        )}`}
                      >
                        {ticket.priority}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onView(ticket.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-black/10 bg-white hover:border-black/20"
                        aria-label={`Ver ticket ${ticket.number}`}
                      >
                        <Eye size={13} />
                        Ver
                      </button>

                      {onReply && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onReply(ticket.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-black/10 bg-white hover:border-black/20"
                        >
                          <MessageSquareReply size={13} />
                          Responder
                        </button>
                      )}

                      {onNote && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onNote(ticket.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-black/10 bg-white hover:border-black/20"
                        >
                          <StickyNote size={13} />
                          Nota
                        </button>
                      )}

                      {onForward && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onForward(ticket.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-black/10 bg-white hover:border-black/20"
                        >
                          <Forward size={13} />
                          Reenviar
                        </button>
                      )}

                      {onClose && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            if (!closed) onClose(ticket.id);
                          }}
                          disabled={closed || rowBusy}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition ${
                            closed || rowBusy
                              ? "border-black/10 bg-black/[0.03] text-black/40 cursor-not-allowed"
                              : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                          }`}
                        >
                          {rowBusy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                          {closed ? "Cerrado" : "Cerrar"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

