import { useState, useRef, useEffect, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import type { EventClickArg, DateSelectArg, EventContentArg, EventDropArg } from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { bookingsApi, type Booking } from "../api/client";
import { Layout } from "../components/Layout";
import { useAuth } from "../contexts/AuthContext";
import { Toast, useToast } from "../components/Toast";
import { BookingModal } from "../components/BookingModal";

// Paleta de cores — atribuída de forma estável pelo hash do título
const PALETTE = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ── Modal de detalhes ───────────────────────────────────────────────────────

interface DetailModalProps {
  booking: Booking;
  isOwn: boolean;
  onClose: () => void;
  onCancelled: () => void;
  onEdit?: () => void;
}

function DetailModal({ booking, isOwn, onClose, onCancelled, onEdit }: DetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const duration = () => {
    const mins = (new Date(booking.end_at).getTime() - new Date(booking.start_at).getTime()) / 60000;
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}min` : `${h}h`;
  };

  const handleCancel = async () => {
    if (!confirm("Cancelar esta reserva?")) return;
    setLoading(true);
    try {
      await bookingsApi.cancel(booking.id);
      onCancelled();
    } catch {
      setError("Erro ao cancelar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Fecha com Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">
        {/* Header colorido */}
        <div
          className="px-6 py-5"
          style={{ backgroundColor: hashColor(booking.title) }}
        >
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-bold text-white leading-tight pr-2">
              {booking.title}
            </h3>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white shrink-0"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-sm text-white/80">{duration()}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-start gap-3 text-sm text-gray-700">
            <span className="mt-0.5 text-gray-400">🕐</span>
            <div>
              <p>{fmt(booking.start_at)}</p>
              <p className="text-gray-500">até {fmt(booking.end_at)}</p>
            </div>
          </div>

          {booking.participants.length > 0 && (
            <div className="flex items-start gap-3 text-sm text-gray-700">
              <span className="mt-0.5 text-gray-400">👥</span>
              <p>{booking.participants.map((p) => p.email).join(", ")}</p>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">•</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                booking.status === "active"
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {booking.status === "active" ? "Ativa" : "Cancelada"}
            </span>
          </div>
        </div>

        {error && (
          <p className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Fechar
          </button>
          {isOwn && booking.status === "active" && (
            <>
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="flex-1 rounded-lg border border-blue-600 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50"
                >
                  Editar
                </button>
              )}
              <button
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Cancelando..." : "Cancelar"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Conteúdo customizado dos eventos ────────────────────────────────────────

function EventContent({ eventInfo }: { eventInfo: EventContentArg }) {
  const { event, timeText } = eventInfo;
  return (
    <div className="px-1 py-0.5 overflow-hidden h-full">
      <p className="text-[11px] font-semibold leading-tight text-white truncate">
        {event.title}
      </p>
      {timeText && (
        <p className="text-[10px] text-white/80 leading-tight">{timeText}</p>
      )}
    </div>
  );
}

// ── Tipos do modal de booking ────────────────────────────────────────────────

type BookingModalState =
  | { mode: "create"; start: string; end: string }
  | { mode: "edit"; booking: Booking }
  | null;

// ── Página ──────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast, show, hide } = useToast();
  const calendarRef = useRef<FullCalendar>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const highlightId = searchParams.get("highlight");
  const targetDate = searchParams.get("date");

  const [selected, setSelected] = useState<Booking | null>(null);
  const [bookingModal, setBookingModal] = useState<BookingModalState>(null);

  // Carrega reservas do usuário
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingsApi.listMine().then((r) => r.data),
  });

  // Navega para a data e abre o modal quando vem de MyBookings
  useEffect(() => {
    if (!highlightId || bookings.length === 0) return;
    const booking = bookings.find((b) => b.id === highlightId);
    if (!booking) return;

    if (targetDate) {
      calendarRef.current?.getApi().gotoDate(targetDate);
    }
    setSelected(booking);

    // Limpa os params da URL sem recarregar
    setSearchParams({}, { replace: true });
  }, [highlightId, bookings, targetDate, setSearchParams]);

  // Monta eventos para o FullCalendar
  const events = bookings.map((b: Booking) => {
    const color = hashColor(b.title);
    const isHighlight = b.id === highlightId;
    return {
      id: b.id,
      title: b.title,
      start: b.start_at,
      end: b.end_at,
      backgroundColor: b.status === "active" ? color : "#9ca3af",
      borderColor: isHighlight ? "#1d4ed8" : (b.status === "active" ? color : "#9ca3af"),
      textColor: "#fff",
      extendedProps: { booking: b },
      classNames: b.status !== "active" ? ["fc-event-cancelled"] : [],
      editable: b.status === "active" && b.user_id === user?.id,
    };
  });

  const toLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleDateSelect = useCallback(
    (arg: DateSelectArg) => {
      setBookingModal({ mode: "create", start: toLocal(arg.start), end: toLocal(arg.end) });
      calendarRef.current?.getApi().unselect();
    },
    []
  );

  const handleEventClick = useCallback((arg: EventClickArg) => {
    const booking: Booking = arg.event.extendedProps.booking;
    setSelected(booking);
  }, []);

  const handleEventDrop = useCallback(async (info: EventDropArg) => {
    const booking = info.event.extendedProps.booking as Booking;
    try {
      await bookingsApi.update(booking.id, {
        start_at: info.event.start!.toISOString(),
        end_at: info.event.end!.toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      show("Reserva movida com sucesso!", "success");
    } catch {
      info.revert();
      show("Não foi possível mover a reserva.", "error");
    }
  }, [queryClient, show]);

  const handleEventResize = useCallback(async (info: EventResizeDoneArg) => {
    const booking = info.event.extendedProps.booking as Booking;
    try {
      await bookingsApi.update(booking.id, {
        start_at: info.event.start!.toISOString(),
        end_at: info.event.end!.toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      show("Reserva ajustada com sucesso!", "success");
    } catch {
      info.revert();
      show("Não foi possível ajustar a reserva.", "error");
    }
  }, [queryClient, show]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
  };

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}

      {selected && (
        <DetailModal
          booking={selected}
          isOwn={selected.user_id === user?.id}
          onClose={() => setSelected(null)}
          onEdit={
            selected.status === "active" && selected.user_id === user?.id
              ? () => {
                  const b = selected;
                  setSelected(null);
                  setBookingModal({ mode: "edit", booking: b });
                }
              : undefined
          }
          onCancelled={() => {
            setSelected(null);
            invalidate();
            show("Reserva cancelada.", "success");
          }}
        />
      )}

      {bookingModal && (
        <BookingModal
          mode={bookingModal.mode}
          initialStart={bookingModal.mode === "create" ? bookingModal.start : undefined}
          initialEnd={bookingModal.mode === "create" ? bookingModal.end : undefined}
          booking={bookingModal.mode === "edit" ? bookingModal.booking : undefined}
          onClose={() => setBookingModal(null)}
          onSuccess={() => {
            setBookingModal(null);
            invalidate();
          }}
          showToast={show}
        />
      )}

      {/* Cabeçalho */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Calendário</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Selecione um horário para criar uma reserva
          </p>
        </div>
        <button
          onClick={() => setBookingModal({ mode: "create", start: "", end: "" })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nova Reserva
        </button>
      </div>

      {/* Calendário full width */}
      <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ height: "calc(100vh - 160px)" }}>
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={ptBrLocale}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          height="100%"
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          selectable={true}
          selectMirror={true}
          editable={true}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
          eventAllow={(_dropInfo, draggedEvent) => {
            const b = draggedEvent?.extendedProps?.booking as Booking | undefined;
            return b?.status === "active" && b?.user_id === user?.id;
          }}
          events={events}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventContent={(info) => <EventContent eventInfo={info} />}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          nowIndicator={true}
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: "08:00",
            endTime: "18:00",
          }}
          dayMaxEvents={3}
          moreLinkText={(n) => `+${n} mais`}
        />
      </div>

      <style>{`
        .fc-event-cancelled { opacity: 0.45; }
        .fc .fc-button {
          background: #f3f4f6 !important;
          border-color: #e5e7eb !important;
          color: #374151 !important;
          font-size: 0.8rem !important;
          padding: 0.3rem 0.75rem !important;
          border-radius: 0.5rem !important;
        }
        .fc .fc-button:hover {
          background: #e5e7eb !important;
        }
        .fc .fc-button-active,
        .fc .fc-button-primary:not(:disabled):active {
          background: #3b82f6 !important;
          border-color: #3b82f6 !important;
          color: #fff !important;
        }
        .fc .fc-today-button {
          background: #fff !important;
          border-color: #3b82f6 !important;
          color: #3b82f6 !important;
        }
        .fc .fc-toolbar-title {
          font-size: 1.1rem !important;
          font-weight: 700 !important;
          color: #1f2937 !important;
        }
        .fc .fc-col-header-cell {
          background: #f9fafb;
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
        }
        .fc .fc-timegrid-slot {
          height: 2.5rem !important;
        }
        .fc .fc-highlight {
          background: #dbeafe !important;
          border-radius: 0.375rem;
        }
        .fc-event {
          border-radius: 0.375rem !important;
          cursor: pointer !important;
        }
        .fc-daygrid-event {
          border-radius: 0.25rem !important;
        }
      `}</style>
    </Layout>
  );
}
