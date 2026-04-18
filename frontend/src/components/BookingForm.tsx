import { useState, useRef } from "react";
import type { FormEvent, KeyboardEvent, ClipboardEvent } from "react";

export interface BookingFormData {
  title: string;
  start_at: string;
  end_at: string;
  participant_emails: string[];
  recurrence: "none" | "daily" | "weekly";
  recurrence_count: number;
}

interface BookingFormProps {
  mode?: "create" | "edit";
  initialStart?: string;
  initialEnd?: string;
  initialTitle?: string;
  initialEmails?: string[];
  onSubmit: (data: BookingFormData) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  submitLabel?: string;
}

// ── Email Tag Input ─────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailTagInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
}

function EmailTagInput({ emails, onChange }: EmailTagInputProps) {
  const [inputVal, setInputVal] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = (raw: string) => {
    const list = raw.split(",").map((e) => e.trim()).filter(Boolean);
    const valid = list.filter((e) => EMAIL_RE.test(e));
    const invalid = list.filter((e) => !EMAIL_RE.test(e));
    if (valid.length) onChange([...new Set([...emails, ...valid])]);
    setTagError(invalid.length ? `Inválido: ${invalid.join(", ")}` : null);
    setInputVal("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      e.preventDefault();
      if (inputVal.trim()) commit(inputVal);
    } else if (e.key === "Backspace" && inputVal === "" && emails.length > 0) {
      onChange(emails.slice(0, -1));
      setTagError(null);
    }
  };

  const handleBlur = () => {
    if (inputVal.trim()) commit(inputVal);
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text.includes(",")) {
      e.preventDefault();
      commit(inputVal + text);
    }
  };

  const remove = (email: string) => onChange(emails.filter((e) => e !== email));

  return (
    <div>
      <div
        className="min-h-[42px] w-full rounded-lg border px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-blue-500 flex flex-wrap gap-1.5 items-center cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {emails.map((email) => (
          <span
            key={email}
            className="flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs text-blue-700"
          >
            {email}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(email); }}
              className="text-blue-400 hover:text-blue-700 leading-none"
              aria-label={`Remover ${email}`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id="participant_emails"
          type="text"
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); setTagError(null); }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder={emails.length === 0 ? "alice@ex.com, bob@ex.com" : "Adicionar..."}
          className="flex-1 min-w-[160px] outline-none bg-transparent text-sm"
        />
      </div>
      {tagError && <p className="mt-1 text-xs text-red-500">{tagError}</p>}
    </div>
  );
}

// ── BookingForm ─────────────────────────────────────────────────────────────

export function BookingForm({
  mode = "create",
  initialStart = "",
  initialEnd = "",
  initialTitle = "",
  initialEmails = [],
  onSubmit,
  isLoading,
  error,
  submitLabel = "Reservar",
}: BookingFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [startAt, setStartAt] = useState(initialStart);
  const [endAt, setEndAt] = useState(initialEnd);
  const [emails, setEmails] = useState<string[]>(initialEmails);
  const [recurrence, setRecurrence] = useState<"none" | "daily" | "weekly">("none");
  const [recurrenceCount, setRecurrenceCount] = useState(1);

  const recurrenceLabel = recurrence === "daily" ? "dias" : "semanas";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onSubmit({
      title,
      start_at: startAt,
      end_at: endAt,
      participant_emails: emails,
      recurrence,
      recurrence_count: recurrenceCount,
    });
  };

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
          value={title}
          onChange={(e) => setTitle(e.target.value)}
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
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
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
            value={endAt}
            onChange={(e) => setEndAt(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Recorrência — apenas no modo criação */}
      {mode === "create" && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Repetição
          </label>
          <div className="flex gap-2">
            {(["none", "daily", "weekly"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setRecurrence(type)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  recurrence === type
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {type === "none" ? "Sem repetição" : type === "daily" ? "Diário" : "Semanal"}
              </button>
            ))}
          </div>

          {recurrence !== "none" && (
            <div className="mt-3 flex items-center gap-2">
              <label className="text-sm text-gray-600">Repetir por</label>
              <input
                type="number"
                min={2}
                max={52}
                value={recurrenceCount}
                onChange={(e) => setRecurrenceCount(Math.max(2, Number(e.target.value)))}
                className="w-20 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">{recurrenceLabel}</span>
            </div>
          )}
        </div>
      )}

      {/* Participantes — tag input */}
      <div>
        <label htmlFor="participant_emails" className="mb-1 block text-sm font-medium text-gray-700">
          Participantes{" "}
          <span className="font-normal text-gray-400">
            (pressione Enter ou vírgula para adicionar)
          </span>
        </label>
        <EmailTagInput emails={emails} onChange={setEmails} />
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
          : mode === "create" && recurrence !== "none"
            ? `Criar ${recurrenceCount} ${recurrenceLabel === "dias" ? "reservas diárias" : "reservas semanais"}`
            : submitLabel}
      </button>
    </form>
  );
}
