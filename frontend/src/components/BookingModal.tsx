import { useState, useEffect } from "react";
import axios from "axios";
import { bookingsApi, type Booking } from "../api/client";
import { BookingForm } from "./BookingForm";
import type { BookingFormData } from "./BookingForm";
import type { ToastType } from "./Toast";

interface BookingModalProps {
  mode: "create" | "edit";
  initialStart?: string;
  initialEnd?: string;
  booking?: Booking;
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
  onClose,
  onSuccess,
  showToast,
}: BookingModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);

  const handleSubmit = async (data: BookingFormData) => {
    setIsLoading(true);
    try {
      if (mode === "create") {
        await bookingsApi.create({
          title: data.title,
          start_at: new Date(data.start_at).toISOString(),
          end_at: new Date(data.end_at).toISOString(),
          participant_emails: data.participant_emails,
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
        });
        showToast("Reserva atualizada!", "success");
      }
      onSuccess();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const detail = err.response?.data?.detail;
        if (status === 409) {
          showToast("Conflito de horário nesse período.", "error");
        } else if (status === 422) {
          showToast(
            typeof detail === "string" ? detail : "Dados inválidos. Verifique as datas.",
            "error",
          );
        } else {
          showToast("Erro ao salvar reserva. Tente novamente.", "error");
        }
      } else {
        showToast("Erro inesperado. Tente novamente.", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const preStart = initialStart ?? (booking ? toLocalDatetime(booking.start_at) : "");
  const preEnd = initialEnd ?? (booking ? toLocalDatetime(booking.end_at) : "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
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
        <div className="px-6 py-5">
          <BookingForm
            mode={mode}
            initialStart={preStart}
            initialEnd={preEnd}
            initialTitle={booking?.title}
            initialEmails={booking?.participants.map((p) => p.email)}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            submitLabel={mode === "create" ? "Reservar" : "Salvar alterações"}
          />
        </div>
      </div>
    </div>
  );
}
