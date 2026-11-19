import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { STATUS_LABELS, type ApplicationStatus } from '@/domain/application';

import { errorMessage, useApp } from './app-context';

// --- Toast -----------------------------------------------------------------------------------

type Toast = {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
};

const ToastContext = createContext<(toast: Omit<Toast, 'id'>) => void>(
  () => {},
);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = ++nextId.current;
    setToasts((current) => [...current, { ...toast, id }]);
    setTimeout(
      () => setToasts((current) => current.filter((t) => t.id !== id)),
      toast.action ? 8000 : 4000,
    );
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <span>{toast.text}</span>
            {toast.action && (
              <button
                className="link"
                onClick={() => {
                  toast.action?.run();
                  setToasts((current) =>
                    current.filter((t) => t.id !== toast.id),
                  );
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/**
 * Führt eine Schreibaktion aus, meldet danach die Änderung (Listen laden neu) und zeigt Fehler
 * als Toast. Gibt zurück, ob es geklappt hat.
 */
export function useAction() {
  const { notifyChange } = useApp();
  const toast = useToast();
  return useCallback(
    async (action: () => Promise<unknown>, success?: string) => {
      try {
        await action();
        notifyChange();
        if (success) toast({ text: success });
        return true;
      } catch (error) {
        toast({ text: `Speichern fehlgeschlagen: ${errorMessage(error)}` });
        return false;
      }
    },
    [notifyChange, toast],
  );
}

// --- Bausteine -------------------------------------------------------------------------------

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>
  );
}

export function Field({
  label,
  error,
  children,
  wide,
}: {
  label: string;
  error?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field${wide ? ' wide' : ''}${error ? ' invalid' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      <header className="card-header">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}

export function LoadError({ error }: { error: unknown }) {
  return (
    <p className="error-box">Laden fehlgeschlagen: {errorMessage(error)}</p>
  );
}

/** Modaler Dialog über das native <dialog>-Element – Escape und Fokusfalle gibt es gratis */
export function Dialog({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose}>
      {open && (
        <>
          <h2>{title}</h2>
          {children}
        </>
      )}
    </dialog>
  );
}

/** Wert für <input type="datetime-local"> in lokaler Zeit */
export function toDateTimeLocal(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function formatDate(day: string) {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(
    new Date(`${day}T12:00:00`),
  );
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}
