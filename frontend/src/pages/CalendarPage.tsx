import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { useToastContext } from "../contexts/ToastContext";
import { DetailModal } from "../components/DetailModal";
import { BookingModal } from "../components/BookingModal";
import "../styles/calendar.css";

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
  const { show } = useToastContext();
  const queryClient = useQueryClient();
  const calendarRef = useRef<FullCalendar>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const highlightId = searchParams.get("highlight");
  const targetDate = searchParams.get("date");

  const [selected, setSelected] = useState<Booking | null>(null);
  const [bookingModal, setBookingModal] = useState<BookingModalState>(null);

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => bookingsApi.listMine().then((r) => r.data),
  });

  // Navega para a data e abre o modal quando vem de MyBookings
  useEffect(() => {
    if (!highlightId || bookings.length === 0) return;
    const booking = bookings.find((b) => b.id === highlightId);
    if (!booking) return;
    if (targetDate) calendarRef.current?.getApi().gotoDate(targetDate);
    setSelected(booking);
    setSearchParams({}, { replace: true });
  }, [highlightId, bookings, targetDate, setSearchParams]);

  const events = useMemo(() => bookings.map((b: Booking) => {
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
  }), [bookings, highlightId, user?.id]);

  const toLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleDateSelect = useCallback((arg: DateSelectArg) => {
    setBookingModal({ mode: "create", start: toLocal(arg.start), end: toLocal(arg.end) });
    calendarRef.current?.getApi().unselect();
  }, []);

  const handleEventClick = useCallback((arg: EventClickArg) => {
    setSelected(arg.event.extendedProps.booking as Booking);
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

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["bookings"] });
  }, [queryClient]);

  return (
    <Layout>
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
          onSuccess={() => { setBookingModal(null); invalidate(); }}
          showToast={show}
        />
      )}

      {/* Cabeçalho */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Calendário</h2>
          <p className="mt-0.5 text-sm text-gray-600">
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
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          nowIndicator={true}
          businessHours={{ daysOfWeek: [1, 2, 3, 4, 5], startTime: "08:00", endTime: "18:00" }}
          dayMaxEvents={3}
          moreLinkText={(n) => `+${n} mais`}
        />
      </div>
    </Layout>
  );
}
