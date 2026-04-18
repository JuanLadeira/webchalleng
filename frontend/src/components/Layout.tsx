import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed overlay no mobile, posição normal no desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-200 lg:relative lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onClose={() => setOpen(false)} />
      </div>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto">
        {/* Topbar hamburguer — visível só em mobile */}
        <div className="sticky top-0 z-30 flex h-12 items-center border-b bg-white px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="Abrir menu"
          >
            ☰
          </button>
        </div>

        <div className="px-6 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
