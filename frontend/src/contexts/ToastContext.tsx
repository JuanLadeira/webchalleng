import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { Toast, useToast } from "../components/Toast";
import type { ToastType } from "../components/Toast";

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toast, show, hide } = useToast();

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={hide} />
      )}
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastContext must be inside <ToastProvider>");
  return ctx;
}
