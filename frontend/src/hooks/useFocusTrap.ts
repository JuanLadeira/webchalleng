import { useEffect } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const focusable = Array.from(
      container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Move foco para o primeiro elemento ao abrir
    first?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (focusable.length === 0) { e.preventDefault(); return; }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener("keydown", trap);
    return () => container.removeEventListener("keydown", trap);
  }, [containerRef]);
}
