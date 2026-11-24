import { router } from '@inertiajs/react';
import { CheckCircle2, Info, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FlashToast } from '../types';

interface ToastItem extends FlashToast {
  id: number;
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef<Set<number>>(new Set());

  useEffect(() => {
    const activeTimers = timers.current;
    const unsubscribe = router.on('flash', (event) => {
      const incoming = event.detail.flash?.toast;
      if (!incoming?.message) return;

      const id = nextId.current++;
      setToasts((prev) => [...prev.slice(-2), { ...incoming, id }]);

      const timer = window.setTimeout(() => {
        activeTimers.delete(timer);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
      activeTimers.add(timer);
    });

    return () => {
      unsubscribe();
      for (const timer of activeTimers) {
        window.clearTimeout(timer);
      }
      activeTimers.clear();
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => {
        const isSuccess = toast.kind === 'success';
        return (
          <div
            key={toast.id}
            className="animate-toast-in pointer-events-auto flex items-center gap-2.5 rounded-xl bg-slate-900 px-3.5 py-2.5 text-xs font-medium text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-800"
          >
            {isSuccess ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : (
              <Info className="h-4 w-4 shrink-0 text-sky-400" />
            )}
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              aria-label="Dismiss notification"
              className="ml-1 rounded-md p-0.5 text-slate-400 transition hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
