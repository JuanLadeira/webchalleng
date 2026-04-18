import { useState } from "react";
import type { FormEvent } from "react";

export interface BookingFormData {
  title: string;
  start_at: string;
  end_at: string;
  participant_emails: string;
  recurrence: "none" | "daily" | "weekly";
  recurrence_count: number;
}

interface BookingFormProps {
  initialStart?: string;
  initialEnd?: string;
  onSubmit: (data: BookingFormData) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  submitLabel?: string;
}

export function BookingForm({
  initialStart = "",
  initialEnd = "",
  onSubmit,
  isLoading,
  error,
  submitLabel = "Reservar",
}: BookingFormProps) {
  const [form, setForm] = useState<BookingFormData>({
    title: "",
    start_at: initialStart,
    end_at: initialEnd,
    participant_emails: "",
    recurrence: "none",
    recurrence_count: 1,
  });

  const set = <K extends keyof BookingFormData>(k: K, v: BookingFormData[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit(form);
  };

  const recurrenceLabel = form.recurrence === "daily" ? "dias" : "semanas";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Título */}
      <div>
        <label htmlFor="title" className="mb-1 block text-sm font-medium text-gray-700">
          Título
        </label>
        <input
          id="title"
          required
          type="text"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Ex: Reunião de planejamento"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Datas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start_at" className="mb-1 block text-sm font-medium text-gray-700">
            Início
          </label>
          <input
            id="start_at"
            required
            type="datetime-local"
            value={form.start_at}
            onChange={(e) => set("start_at", e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="end_at" className="mb-1 block text-sm font-medium text-gray-700">
            Fim
          </label>
          <input
            id="end_at"
            required
            type="datetime-local"
            value={form.end_at}
            onChange={(e) => set("end_at", e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Recorrência */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Repetição
        </label>
        <div className="flex gap-2">
          {(["none", "daily", "weekly"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => set("recurrence", type)}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                form.recurrence === type
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {type === "none" ? "Sem repetição" : type === "daily" ? "Diário" : "Semanal"}
            </button>
          ))}
        </div>

        {form.recurrence !== "none" && (
          <div className="mt-3 flex items-center gap-2">
            <label className="text-sm text-gray-600">Repetir por</label>
            <input
              type="number"
              min={2}
              max={52}
              value={form.recurrence_count}
              onChange={(e) => set("recurrence_count", Math.max(2, Number(e.target.value)))}
              className="w-20 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">{recurrenceLabel}</span>
          </div>
        )}
      </div>

      {/* Participantes */}
      <div>
        <label htmlFor="participant_emails" className="mb-1 block text-sm font-medium text-gray-700">
          Participantes{" "}
          <span className="font-normal text-gray-400">(e-mails separados por vírgula)</span>
        </label>
        <input
          id="participant_emails"
          type="text"
          value={form.participant_emails}
          onChange={(e) => set("participant_emails", e.target.value)}
          placeholder="alice@ex.com, bob@ex.com"
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading
          ? "Criando..."
          : form.recurrence !== "none"
            ? `Criar ${form.recurrence_count} ${recurrenceLabel === "dias" ? "reservas diárias" : "reservas semanais"}`
            : submitLabel}
      </button>
    </form>
  );
}
