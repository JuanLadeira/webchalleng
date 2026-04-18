import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { roomsApi, type Room } from "../api/client";

interface CreateRoomModalProps {
  onClose: () => void;
  onCreated: (room: Room) => void;
}

export function CreateRoomModal({ onClose, onCreated }: CreateRoomModalProps) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fecha com Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await roomsApi.create({
        name,
        capacity: Number(capacity),
        location,
        description: description || null,
      });
      onCreated(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setError(
        status === 409
          ? "Já existe uma sala com esse nome."
          : "Erro ao criar sala. Tente novamente."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800">Nova Sala</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="modal-name" className="mb-1 block text-sm font-medium text-gray-700">
              Nome
            </label>
            <input
              id="modal-name"
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sala Alpha"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="modal-capacity"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Capacidade
              </label>
              <input
                id="modal-capacity"
                required
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="10"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label
                htmlFor="modal-location"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Localização
              </label>
              <input
                id="modal-location"
                required
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bloco A"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="modal-description"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Descrição <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              id="modal-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Sala com projetor"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Criando..." : "Criar e Selecionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
