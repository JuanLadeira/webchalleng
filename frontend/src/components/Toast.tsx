import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
}

export function Toast({ message, type = "info", onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!visible) return null;

  const colors: Record<ToastType, string> = {
    success: "bg-green-600",
    error: "bg-red-600",
    info: "bg-blue-600",
  };

  return (
    <div
      role="alert"
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-white shadow-lg ${colors[type]}`}
    >
      <span className="text-sm">{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          onClose();
        }}
        className="text-white/80 hover:text-white"
        aria-label="Fechar"
      >
        ✕
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = useState<{
    message: string;
    type: ToastType;
  } | null>(null);

  const show = (message: string, type: ToastType = "info") =>
    setToast({ message, type });

  const hide = () => setToast(null);

  return { toast, show, hide };
}
