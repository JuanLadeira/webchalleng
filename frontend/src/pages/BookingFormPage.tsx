import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { bookingsApi } from "../api/client";
import { Layout } from "../components/Layout";
import { BookingForm } from "../components/BookingForm";
import type { BookingFormData } from "../components/BookingForm";
import { Toast, useToast } from "../components/Toast";

export function BookingFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { toast, show, hide } = useToast();

  // Pré-preenche horários vindos do calendário (?start=...&end=...)
  const initialStart = searchParams.get("start") ?? "";
  const initialEnd = searchParams.get("end") ?? "";

  const handleSubmit = async (data: BookingFormData) => {
    setFormError(null);
    setIsLoading(true);
    try {
      await bookingsApi.create({
        title: data.title,
        start_at: new Date(data.start_at).toISOString(),
        end_at: new Date(data.end_at).toISOString(),
        participant_emails: data.participant_emails,
        recurrence: data.recurrence,
        recurrence_count: data.recurrence_count,
      });

      show("Reserva criada com sucesso!", "success");
      setTimeout(() => navigate("/calendar"), 1200);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        setFormError("Conflito de horário nesse período.");
      } else if (status === 422) {
        setFormError("Dados inválidos. Verifique as datas e tente novamente.");
      } else {
        setFormError("Erro ao criar reserva. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      {toast && <Toast message={toast.message} type={toast.type} onClose={hide} />}

      <div className="mx-auto max-w-lg">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800">Nova Reserva</h2>
          <p className="mt-1 text-sm text-gray-500">
            Preencha os detalhes. Uma sala será reservada automaticamente.
          </p>
        </div>

        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <BookingForm
            initialStart={initialStart}
            initialEnd={initialEnd}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={formError}
          />
        </div>
      </div>
    </Layout>
  );
}
