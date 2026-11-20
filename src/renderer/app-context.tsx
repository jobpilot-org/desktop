import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { createRepositories, type Repositories } from '@/data';
import { createSupabase, type Supabase } from '@/data/supabase';

type AppContextValue = {
  supabase: Supabase;
  repos: Repositories;
  /** undefined, solange die gespeicherte Session noch gelesen wird */
  session: Session | null | undefined;
  /** Zählt bei jeder Änderung hoch; Abfragen laden dann neu (vgl. ADR 2 der mobile-app) */
  dataVersion: number;
  /** Nach jedem Schreiben aufrufen */
  notifyChange: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const supabase = createSupabase();
const repos = createRepositories(supabase);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>();
  const [dataVersion, setDataVersion] = useState(0);
  const notifyChange = useCallback(() => setDataVersion((v) => v + 1), []);

  useEffect(() => {
    supabase.auth.getSession().then(
      ({ data }) => setSession(data.session),
      () => setSession(null),
    );
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  // Andere Geräte schreiben in dieselbe Datenbank: beim Zurückkehren ins Fenster neu laden.
  useEffect(() => {
    window.addEventListener('focus', notifyChange);
    return () => window.removeEventListener('focus', notifyChange);
  }, [notifyChange]);

  const value = useMemo(
    () => ({ supabase, repos, session, dataVersion, notifyChange }),
    [session, dataVersion, notifyChange],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp braucht einen AppProvider');
  return value;
}

export type DataState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown; data?: T };

/**
 * Lädt Daten über die Repositories und lädt bei jeder gemeldeten Änderung neu. Während des
 * Neuladens bleiben die alten Daten sichtbar, damit nichts flackert.
 */
export function useData<T>(
  load: (repos: Repositories) => Promise<T>,
  deps: readonly unknown[] = [],
): DataState<T> {
  const { dataVersion } = useApp();
  const [state, setState] = useState<DataState<T>>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState((previous) => ({ status: 'loading', data: previous.data }));
    load(repos).then(
      (data) => !cancelled && setState({ status: 'ready', data }),
      (error: unknown) =>
        !cancelled &&
        setState((previous) => ({
          status: 'error',
          error,
          data: previous.data,
        })),
    );
    return () => {
      cancelled = true;
    };
    // load ist meist eine Inline-Funktion; neu geladen wird über deps und dataVersion
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataVersion, ...deps]);

  return state;
}

/** Fehler aus Supabase oder dem Netz in einen Satz für die Oberfläche */
export function errorMessage(error: unknown) {
  if (error instanceof TypeError) {
    return 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.';
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unbekannter Fehler';
}
