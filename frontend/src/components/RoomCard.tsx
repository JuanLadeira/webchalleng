import { Link } from "react-router-dom";
import type { Room } from "../api/client";

export function RoomCard({ room }: { room: Room }) {
  return (
    <Link
      to={`/rooms/${room.id}`}
      className="group block rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <h3 className="font-semibold text-gray-800 group-hover:text-blue-700">
          {room.name}
        </h3>
        <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          👥 {room.capacity}
        </span>
      </div>

      <p className="flex items-center gap-1.5 text-sm text-gray-500">
        <span>📍</span>
        {room.location}
      </p>

      {room.description && (
        <p className="mt-2 line-clamp-2 text-sm text-gray-400">
          {room.description}
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
          Ver detalhes →
        </span>
      </div>
    </Link>
  );
}
