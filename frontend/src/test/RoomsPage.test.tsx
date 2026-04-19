import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RoomsPage } from "../pages/RoomsPage";
import { AuthContext } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import type { User } from "../api/client";

vi.mock("../api/client", async () => {
  const actual = await vi.importActual("../api/client");
  return {
    ...actual,
    roomsApi: {
      list: vi.fn().mockResolvedValue({
        data: [
          {
            id: "1",
            name: "Sala Alpha",
            capacity: 10,
            location: "Bloco A",
            description: "Sala de reuniões principal",
            is_active: true,
          },
          {
            id: "2",
            name: "Sala Beta",
            capacity: 4,
            location: "Bloco B",
            description: null,
            is_active: false,
          },
        ],
      }),
    },
  };
});

const mockUser: User = {
  id: "u1",
  name: "Test User",
  email: "test@example.com",
  role: "member",
};

function renderRooms() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <AuthContext.Provider
            value={{
              user: mockUser,
              isLoading: false,
              login: vi.fn(),
              register: vi.fn(),
              logout: vi.fn(),
            }}
          >
            <RoomsPage />
          </AuthContext.Provider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

describe("RoomsPage", () => {
  it("renders active rooms returned by the API", async () => {
    renderRooms();
    const card = await screen.findByText("Sala Alpha");
    expect(card).toBeInTheDocument();
  });

  it("does not render inactive rooms", async () => {
    renderRooms();
    await screen.findByText("Sala Alpha");
    expect(screen.queryByText("Sala Beta")).not.toBeInTheDocument();
  });

  it("shows room location", async () => {
    renderRooms();
    expect(await screen.findByText("Bloco A")).toBeInTheDocument();
  });
});
