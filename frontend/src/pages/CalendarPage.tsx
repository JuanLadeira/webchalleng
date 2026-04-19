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
  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [calSettings, setCalSettings] = useState<{
    slotMinTime: string;
    slotMaxTime: string;
    slotDuration: string;
    showWeekends: boolean;
    businessStart: string;
    businessEnd: string;
    dayMaxEvents: number;
  }>(() => {
    try {
      const saved = sessionStorage.getItem("calendarSettings");
      return saved ? JSON.parse(saved) : {
        slotMinTime: "06:00:00",
        slotMaxTime: "22:00:00",
        slotDuration: "00:30:00",
        showWeekends: true,
        businessStart: "08:00",
        businessEnd: "18:00",
        dayMaxEvents: 3,
      };
    } catch {
      return {
        slotMinTime: "06:00:00",
        slotMaxTime: "22:00:00",
        slotDuration: "00:30:00",
        showWeekends: true,
        businessStart: "08:00",
        businessEnd: "18:00",
        dayMaxEvents: 3,
      };
    }
  });

  useEffect(() => {
    sessionStorage.setItem("calendarSettings", JSON.stringify(calSettings));
  }, [calSettings]);

  useEffect(() => {
    if (!showSettings) return;
    const handle = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [showSettings]);

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
    const color = b.color ?? hashColor(b.title);
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
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Calendário</h2>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
            Selecione um horário para criar uma reserva
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Botão de configurações */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              aria-label="Configurações do calendário"
              title="Configurações"
            >
              ⚙️
            </button>

            {showSettings && (
              <div className="absolute right-0 top-10 z-50 w-72 rounded-xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900 p-4 space-y-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Configurações do Calendário</p>

                {/* Horário visível */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Início visível</label>
                    <select
                      value={calSettings.slotMinTime}
                      onChange={(e) => setCalSettings((s) => ({ ...s, slotMinTime: e.target.value }))}
                      className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {Array.from({ length: 19 }, (_, i) => {
                        const h = String(i).padStart(2, "0");
                        return <option key={h} value={`${h}:00:00`}>{h}:00</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Fim visível</label>
                    <select
                      value={calSettings.slotMaxTime}
                      onChange={(e) => setCalSettings((s) => ({ ...s, slotMaxTime: e.target.value }))}
                      className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {Array.from({ length: 19 }, (_, i) => {
                        const h = String(i + 6).padStart(2, "0");
                        return <option key={h} value={`${h}:00:00`}>{h}:00</option>;
                      })}
                    </select>
                  </div>
                </div>

                {/* Intervalo dos slots */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Tamanho do slot de tempo</label>
                  <select
                    value={calSettings.slotDuration}
                    onChange={(e) => setCalSettings((s) => ({ ...s, slotDuration: e.target.value }))}
                    className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="00:15:00">15 minutos</option>
                    <option value="00:30:00">30 minutos</option>
                    <option value="01:00:00">1 hora</option>
                  </select>
                </div>

                {/* Horário comercial */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Início comercial</label>
                    <select
                      value={calSettings.businessStart}
                      onChange={(e) => setCalSettings((s) => ({ ...s, businessStart: e.target.value }))}
                      className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {Array.from({ length: 13 }, (_, i) => {
                        const h = String(i + 6).padStart(2, "0");
                        return <option key={h} value={`${h}:00`}>{h}:00</option>;
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Fim comercial</label>
                    <select
                      value={calSettings.businessEnd}
                      onChange={(e) => setCalSettings((s) => ({ ...s, businessEnd: e.target.value }))}
                      className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {Array.from({ length: 13 }, (_, i) => {
                        const h = String(i + 12).padStart(2, "0");
                        return <option key={h} value={`${h}:00`}>{h}:00</option>;
                      })}
                    </select>
                  </div>
                </div>

                {/* Eventos por dia (visão mês) */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Máx. eventos visíveis por dia (visão mês)</label>
                  <select
                    value={calSettings.dayMaxEvents}
                    onChange={(e) => setCalSettings((s) => ({ ...s, dayMaxEvents: Number(e.target.value) }))}
                    className="w-full rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n} evento{n > 1 ? "s" : ""}</option>
                    ))}
                  </select>
                </div>

                {/* Mostrar finais de semana */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={calSettings.showWeekends}
                    onChange={(e) => setCalSettings((s) => ({ ...s, showWeekends: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Mostrar finais de semana</span>
                </label>
              </div>
            )}
          </div>

          <button
            onClick={() => setBookingModal({ mode: "create", start: "", end: "" })}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nova Reserva
          </button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900" style={{ height: "calc(100vh - 160px)" }}>
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
          slotMinTime={calSettings.slotMinTime}
          slotMaxTime={calSettings.slotMaxTime}
          slotDuration={calSettings.slotDuration}
          slotLabelInterval="01:00:00"
          weekends={calSettings.showWeekends}
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
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5],
            startTime: calSettings.businessStart,
            endTime: calSettings.businessEnd,
          }}
          dayMaxEvents={calSettings.dayMaxEvents}
          moreLinkText={(n) => `+${n} mais`}
        />
      </div>
    </Layout>
  );
}
