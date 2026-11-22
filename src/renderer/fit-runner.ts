import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import {
  fitBlocker,
  fitStatus,
  postingHash,
  profileHash,
} from '@/domain/job-fit';
import { postingState, type JobPosting } from '@/domain/job-postings';
import type { Profile } from '@/domain/profile';

import { evaluateFit } from '@/data/job-fit';

import { useApp } from './app-context';

// Passung bewerten – auf Knopfdruck (Detailseite) oder automatisch im Hintergrund, wenn in den
// Einstellungen eingeschaltet. Welche Stellenangebote gerade bewertet werden, teilen sich alle
// Ansichten über einen kleinen gemeinsamen Zustand, damit nichts doppelt läuft.

const running = new Set<string>();
const listeners = new Set<() => void>();
let snapshot: ReadonlySet<string> = new Set();

function changed() {
  snapshot = new Set(running);
  for (const listener of listeners) listener();
}

/** Ids der Stellenangebote, die gerade bewertet werden */
export function useRunningFits(): ReadonlySet<string> {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
  );
}

/** Bewertet ein Stellenangebot und speichert das Ergebnis; Fehler gehen an den Aufrufer */
export function useRunFit() {
  const { supabase, repos, notifyChange } = useApp();
  return async (posting: JobPosting, profile: Profile) => {
    if (running.has(posting.id)) return;
    running.add(posting.id);
    changed();
    try {
      const { fit, model } = await evaluateFit(supabase, profile, posting);
      await repos.jobPostings.saveFit(
        posting.id,
        fit,
        { profile: profileHash(profile), posting: postingHash(posting) },
        model,
      );
      notifyChange();
    } finally {
      running.delete(posting.id);
      changed();
    }
  };
}

/**
 * Automatischer Modus (Einstellung `ai.fit.auto`): bewertet offene Stellenangebote, die noch keine
 * Passung haben, nacheinander im Hintergrund – nur mit Zustimmung und KI-Key. Veraltete Bewertungen
 * werden nicht automatisch erneuert (nur auf Knopfdruck), damit Profiländerungen nicht viele Aufrufe
 * auslösen. Nach einem Fehler pausiert der Modus bis zum nächsten Start der App.
 */
export function useAutoFit() {
  const { repos, dataVersion, session } = useApp();
  const runFit = useRunFit();
  const runFitRef = useRef(runFit);
  runFitRef.current = runFit;
  const busy = useRef(false);
  const stopped = useRef(false);
  const tried = useRef(new Set<string>());
  // Nach jeder Bewertung erneut nachsehen, ob noch eins offen ist
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!session || busy.current || stopped.current) return;
    busy.current = true;
    void (async () => {
      try {
        const settings = await repos.settings.all();
        if (
          settings.get('ai.fit.auto') !== 'yes' ||
          settings.get('ai.consent') !== 'yes'
        )
          return;
        if (!(await repos.aiKey.status()).configured) return;
        const [profile, postings, applications] = await Promise.all([
          repos.profile.get(),
          repos.jobPostings.list(),
          repos.applications.listActive(),
        ]);
        if (!profile) return;
        const activeIds = new Set(applications.map((a) => a.id));
        const next = postings.find(
          (posting) =>
            !tried.current.has(posting.id) &&
            postingState(posting, activeIds) === 'open' &&
            fitStatus(posting, profile) === 'none' &&
            !fitBlocker(profile, posting),
        );
        if (!next) return;
        tried.current.add(next.id);
        await runFitRef.current(next, profile);
        busy.current = false;
        setRound((n) => n + 1);
      } catch {
        stopped.current = true;
      } finally {
        busy.current = false;
      }
    })();
  }, [dataVersion, repos, session, round]);
}
