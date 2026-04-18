import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { roomsApi } from "../api/client";
import { Layout } from "../components/Layout";

export function RoomFormPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await roomsApi.create({
        name,
        capacity: Number(capacity),
        location,
        description: description || null,
      });
      navigate("/rooms");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        setError("Já existe uma sala com esse nome.");
      } else {
        setError("Erro ao criar sala. Verifique os dados e tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="mx-auto max-w-lg">
        <h2 className="mb-6 text-xl font-bold text-gray-800">Nova Sala</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Nome
            </label>
            <input
              id="name"
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Sala de Reuniões Alpha"
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="capacity" className="mb-1 block text-sm font-medium text-gray-700">
                Capacidade
              </label>
              <input
                id="capacity"
                required
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="10"
                className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="location" className="mb-1 block text-sm font-medium text-gray-700">
                Localização
              </label>
              <input
                id="location"
                required
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Bloco A, 2º andar"
                className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-medium text-gray-700">
              Descrição <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Sala com projetor e ar condicionado"
              className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate("/rooms")}
              className="flex-1 rounded border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Criando..." : "Criar Sala"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
