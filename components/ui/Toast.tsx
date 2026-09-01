"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<Toast, "id">) => void;
  hideToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Toast notification provider
 * Wrap your app with this to enable toast notifications
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: Toast = { ...toast, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto-hide after duration (default 5s)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        hideToast(id);
      }, duration);
    }
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={hideToast} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to show toast notifications
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

/**
 * Toast container - renders all active toasts
 */
function ToastContainer({
  toasts,
  onClose,
}: {
  toasts: Toast[];
  onClose: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 lg:bottom-6 lg:right-6"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast, index) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => onClose(toast.id)}
          index={index}
        />
      ))}
    </div>
  );
}

/**
 * Individual toast item
 */
function ToastItem({
  toast,
  onClose,
  index,
}: {
  toast: Toast;
  onClose: () => void;
  index: number;
}) {
  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const styles = {
    success: {
      container: "border-online-line bg-online-bg",
      icon: "text-online",
      title: "text-online",
    },
    error: {
      container: "border-danger-line bg-danger-bg",
      icon: "text-danger",
      title: "text-danger",
    },
    warning: {
      container: "border-gold-line bg-gold-bg",
      icon: "text-gold",
      title: "text-gold",
    },
    info: {
      container: "border-brand-line bg-brand-bg",
      icon: "text-brand",
      title: "text-brand",
    },
  };

  const Icon = icons[toast.type];
  const style = styles[toast.type];

  return (
    <div
      className={cn(
        "slide-in-right glass-enhanced flex w-[320px] items-start gap-3 border p-4 shadow-elevated-hover",
        style.container,
      )}
      style={{ animationDelay: `${index * 0.1}s` }}
      role="alert"
    >
      <Icon size={20} className={cn("shrink-0", style.icon)} aria-hidden />

      <div className="min-w-0 flex-1">
        <h3 className={cn("text-[14px] font-semibold", style.title)}>
          {toast.title}
        </h3>
        {toast.message && (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            {toast.message}
          </p>
        )}
      </div>

      <button
        onClick={onClose}
        className="shrink-0 rounded-[3px] text-muted transition-colors duration-150 hover:text-ink"
        aria-label="Close notification"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/**
 * Convenience functions for showing toasts
 */
export const toast = {
  success: (title: string, message?: string, duration?: number) => ({
    type: "success" as const,
    title,
    message,
    duration,
  }),
  error: (title: string, message?: string, duration?: number) => ({
    type: "error" as const,
    title,
    message,
    duration,
  }),
  warning: (title: string, message?: string, duration?: number) => ({
    type: "warning" as const,
    title,
    message,
    duration,
  }),
  info: (title: string, message?: string, duration?: number) => ({
    type: "info" as const,
    title,
    message,
    duration,
  }),
};
