import type { Booking } from "../api/client";

interface BookingListProps {
  bookings: Booking[];
  onCancel?: (id: string) => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("pt-BR", { day: "2-digit" }),
    month: d.toLocaleDateString("pt-BR", { month: "short" }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  };
}

export function BookingList({ bookings, onCancel }: BookingListProps) {
  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
        <p className="text-sm text-gray-400">Nenhuma reserva encontrada.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {bookings.map((b) => {
        const start = formatDate(b.start_at);
        const end = formatDate(b.end_at);
        const isActive = b.status === "active";

        return (
          <li
            key={b.id}
            className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-4 shadow-sm"
          >
            <div className="flex items-start gap-4">
              {/* Data */}
              <div className="flex min-w-[3rem] flex-col items-center rounded-lg bg-gray-50 px-3 py-2 text-center">
                <span className="text-xs text-gray-400">{start.month}</span>
                <span className="text-xl font-bold text-gray-800">{start.day}</span>
              </div>

              {/* Info */}
              <div>
                <p className="font-semibold text-gray-800">{b.title}</p>
                <p className="mt-0.5 text-sm text-gray-500">
                  {start.time} – {end.time}
                </p>
                {b.participants.length > 0 && (
                  <p className="mt-0.5 text-xs text-gray-400">
                    👥 {b.participants.map((p) => p.email).join(", ")}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {isActive ? "Ativa" : "Cancelada"}
              </span>
              {isActive && onCancel && (
                <button
                  onClick={() => onCancel(b.id)}
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  Cancelar
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
