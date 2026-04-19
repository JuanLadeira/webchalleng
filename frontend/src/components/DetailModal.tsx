import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { bookingsApi, type Booking } from "../api/client";
import { useFocusTrap } from "../hooks/useFocusTrap";

interface DetailModalProps {
  booking: Booking;
  isOwn: boolean;
  onClose: () => void;
  onCancelled: () => void;
  onEdit?: () => void;
  onNavigate?: () => void; // "Ver no calendário" — usado em MyBookingsPage
}

function hashColor(str: string): string {
  const PALETTE = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  ];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function duration(start: string, end: string) {
  const mins = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function DetailModal({
  booking,
  isOwn,
  onClose,
  onCancelled,
  onEdit,
  onNavigate,
}: DetailModalProps) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef);

  const cancelMutation = useMutation({
    mutationFn: () => bookingsApi.cancel(booking.id),
    onSuccess: onCancelled,
    onError: () => {
      setError("Erro ao cancelar. Tente novamente.");
      setConfirming(false);
    },
  });

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
      <div
        ref={containerRef}
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden dark:bg-gray-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-modal-title"
      >
        {/* Header colorido */}
        <div className="px-6 py-5" style={{ backgroundColor: hashColor(booking.title) }}>
          <div className="flex items-start justify-between">
            <h3 id="detail-modal-title" className="text-lg font-bold text-white leading-tight pr-2">
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
          <p className="mt-1 text-sm text-white/80">{duration(booking.start_at, booking.end_at)}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-3">
          <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
            <span className="mt-0.5 text-gray-400 dark:text-gray-500" aria-hidden="true">🕐</span>
            <div>
              <p>{fmt(booking.start_at)}</p>
              <p className="text-gray-600 dark:text-gray-400">até {fmt(booking.end_at)}</p>
            </div>
          </div>

          {booking.participants.length > 0 && (
            <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="mt-0.5 text-gray-400 dark:text-gray-500" aria-hidden="true">👥</span>
              <p>{booking.participants.map((p) => p.email).join(", ")}</p>
            </div>
          )}

          {booking.notes && (
            <div className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="mt-0.5 text-gray-400 dark:text-gray-500" aria-hidden="true">📝</span>
              <p className="whitespace-pre-wrap">{booking.notes}</p>
            </div>
          )}

          <div className="flex items-center gap-3 text-sm">
            <span aria-hidden="true">•</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                booking.status === "active"
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {booking.status === "active" ? "Ativa" : "Cancelada"}
            </span>
          </div>

          <button
            onClick={() => { onClose(); navigate(`/rooms/${booking.room_id}`); }}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            Ver sala →
          </button>

          {onNavigate && (
            <button
              onClick={onNavigate}
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              Ver no calendário →
            </button>
          )}
        </div>

        {error && (
          <p className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          {confirming ? (
            <>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Voltar
              </button>
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelMutation.isPending ? "Cancelando..." : "Confirmar cancelamento"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                Fechar
              </button>
              {isOwn && booking.status === "active" && (
                <>
                  {onEdit && (
                    <button
                      onClick={onEdit}
                      className="flex-1 rounded-lg border border-blue-600 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-900/30"
                    >
                      Editar
                    </button>
                  )}
                  <button
                    onClick={() => setConfirming(true)}
                    className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
