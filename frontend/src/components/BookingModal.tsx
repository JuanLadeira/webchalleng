import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { bookingsApi, type Booking } from "../api/client";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useAuth } from "../contexts/AuthContext";
import { BookingForm } from "./BookingForm";
import type { BookingFormData } from "./BookingForm";
import type { ToastType } from "./Toast";

function extractApiError(err: unknown): string {
  if (!axios.isAxiosError(err)) return "Erro inesperado. Tente novamente.";
  const status = err.response?.status;
  const detail = err.response?.data?.detail;
  if (status === 409) {
    return typeof detail === "string" ? detail : "Conflito de horário nesse período.";
  }
  if (status === 422) {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const msg: string = detail[0]?.msg ?? "";
      return msg.replace(/^Value error,\s*/i, "") || "Dados inválidos. Verifique as datas.";
    }
    return "Dados inválidos. Verifique as datas.";
  }
  return "Erro ao salvar reserva. Tente novamente.";
}

interface BookingModalProps {
  mode: "create" | "edit";
  initialStart?: string;
  initialEnd?: string;
  booking?: Booking;
  roomId?: string;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (msg: string, type: ToastType) => void;
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookingModal({
  mode,
  initialStart,
  initialEnd,
  booking,
  roomId,
  onClose,
  onSuccess,
  showToast,
}: BookingModalProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPastData, setPendingPastData] = useState<BookingFormData | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  const doSubmit = async (data: BookingFormData) => {
    setIsLoading(true);
    try {
      if (mode === "create") {
        await bookingsApi.create({
          title: data.title,
          room_id: roomId,
          start_at: new Date(data.start_at).toISOString(),
          end_at: new Date(data.end_at).toISOString(),
          participant_emails: data.participant_emails,
          notes: data.notes || undefined,
          recurrence: data.recurrence,
          recurrence_count: data.recurrence_count,
        });
        showToast("Reserva criada com sucesso!", "success");
      } else if (booking) {
        await bookingsApi.update(booking.id, {
          title: data.title,
          start_at: new Date(data.start_at).toISOString(),
          end_at: new Date(data.end_at).toISOString(),
          participant_emails: data.participant_emails,
          notes: data.notes || undefined,
        });
        showToast("Reserva atualizada!", "success");
      }
      onSuccess();
    } catch (err: unknown) {
      showToast(extractApiError(err), "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: BookingFormData) => {
    if (mode === "create" && new Date(data.start_at) < new Date()) {
      setPendingPastData(data);
      return;
    }
    await doSubmit(data);
  };

  const preStart = initialStart ?? (booking ? toLocalDatetime(booking.start_at) : "");
  const preEnd = initialEnd ?? (booking ? toLocalDatetime(booking.end_at) : "");

  // In create mode, pre-populate with the current user's email
  const preEmails = mode === "create" && user?.email
    ? [user.email]
    : booking?.participants.map((p) => p.email) ?? [];

  if (pendingPastData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <h3 className="text-base font-bold text-gray-800">Reserva no passado</h3>
          <p className="mt-2 text-sm text-gray-600">
            O horário selecionado já passou. Tem certeza que deseja criar essa reserva?
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={() => setPendingPastData(null)}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Voltar
            </button>
            <button
              onClick={() => { const d = pendingPastData; setPendingPastData(null); doSubmit(d); }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Criar mesmo assim
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={containerRef}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            {mode === "create" ? "Nova Reserva" : "Editar Reserva"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 overflow-y-auto max-h-[80vh]">
          <BookingForm
            mode={mode}
            initialStart={preStart}
            initialEnd={preEnd}
            initialTitle={booking?.title}
            initialEmails={preEmails}
            initialNotes={booking?.notes ?? ""}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            submitLabel={mode === "create" ? "Reservar" : "Salvar alterações"}
          />
        </div>
      </div>
    </div>
  );
}
