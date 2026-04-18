import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { BookingForm } from "../components/BookingForm";

describe("BookingForm", () => {
  it("renders all required fields", () => {
    render(<BookingForm onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/título/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/início/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/fim/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/participantes/i)).toBeInTheDocument();
  });

  it("renders recurrence options", () => {
    render(<BookingForm onSubmit={vi.fn()} />);
    expect(screen.getByText(/sem repetição/i)).toBeInTheDocument();
    expect(screen.getByText(/diário/i)).toBeInTheDocument();
    expect(screen.getByText(/semanal/i)).toBeInTheDocument();
  });

  it("calls onSubmit with form data when submitted", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<BookingForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/título/i), {
      target: { value: "Sprint Review" },
    });
    fireEvent.change(screen.getByLabelText(/início/i), {
      target: { value: "2025-12-01T09:00" },
    });
    fireEvent.change(screen.getByLabelText(/fim/i), {
      target: { value: "2025-12-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText(/participantes/i), {
      target: { value: "alice@test.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: /reservar/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: "Sprint Review",
        start_at: "2025-12-01T09:00",
        end_at: "2025-12-01T10:00",
        participant_emails: "alice@test.com",
        recurrence: "none",
        recurrence_count: 1,
      });
    });
  });

  it("shows error message when error prop is provided", () => {
    render(
      <BookingForm
        onSubmit={vi.fn()}
        error="Conflito de horário detectado."
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /conflito de horário/i
    );
  });

  it("disables submit button while loading", () => {
    render(<BookingForm onSubmit={vi.fn()} isLoading={true} />);
    expect(screen.getByRole("button", { name: /criando/i })).toBeDisabled();
  });
});
