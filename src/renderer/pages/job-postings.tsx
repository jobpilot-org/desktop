import { useState } from 'react';
import { useNavigate } from 'react-router';

import { WORK_MODE_LABELS } from '@/domain/application';
import {
  countByPostingFilter,
  matchesPostingFilter,
  POSTING_FILTER_LABELS,
  POSTING_FILTERS,
  POSTING_STATE_LABELS,
  postingState,
  type PostingFilter,
} from '@/domain/job-postings';

import { useData } from '../app-context';
import { FitBadge } from '../components/job-fit';
import { useDeletePosting } from '../delete-actions';
import { useProfile } from './profile';
import { DeleteButton, Empty, formatDate, LoadError } from '../ui';

/** Gemerkte Stellenangebote (z. B. aus der Browser-Extension) – noch keine Bewerbungen */
export function JobPostingsPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<PostingFilter>('open');
  const remove = useDeletePosting();
  const { profile } = useProfile();
  const state = useData(async (r) => {
    const [postings, applications] = await Promise.all([
      r.jobPostings.list(),
      r.applications.listActive(),
    ]);
    return { postings, activeIds: new Set(applications.map((a) => a.id)) };
  });

  if (state.status === 'error' && !state.data)
    return <LoadError error={state.error} />;
  if (!state.data) return null;
  const { postings, activeIds } = state.data;
  const withState = postings.map((posting) => ({
    posting,
    state: postingState(posting, activeIds),
  }));
  const counts = countByPostingFilter(withState.map((p) => p.state));
  const visible = withState.filter((p) =>
    matchesPostingFilter(p.state, filter),
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <p className="jp-eyebrow">Gemerkt</p>
          <h1>Stellenangebote</h1>
        </div>
      </div>
      <p className="muted">
        Anzeigen, die du dir gemerkt hast – zum Beispiel mit der
        jobpilot-Extension im Browser. Wenn du dich bewirbst, machst du daraus
        eine Bewerbung.
      </p>

      <div className="chips" role="group" aria-label="Filter">
        {POSTING_FILTERS.map((option) => (
          <button
            key={option}
            className="chip"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
          >
            {POSTING_FILTER_LABELS[option]}{' '}
            <span className="count">{counts[option]}</span>
          </button>
        ))}
      </div>

      {postings.length === 0 ? (
        <Empty>
          Noch keine Stellenangebote. Mit der jobpilot-Extension merkst du dir
          Anzeigen direkt im Browser.
        </Empty>
      ) : visible.length === 0 ? (
        <Empty>Keine Stellenangebote in diesem Filter.</Empty>
      ) : (
        <ul className="rows card posting-list">
          {visible.map(({ posting, state: postingStateValue }) => (
            <li key={posting.id} className="row">
              <button
                type="button"
                className="row-main plain"
                onClick={() => navigate(`/stellen/${posting.id}`)}
              >
                <strong>
                  {posting.company} · {posting.role}
                </strong>
                <span className="muted small">
                  {[
                    posting.location,
                    posting.workMode && WORK_MODE_LABELS[posting.workMode],
                    posting.source,
                    `gemerkt am ${formatDate(posting.createdAt.slice(0, 10))}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
              <span className="row-actions">
                <FitBadge posting={posting} profile={profile} />
                <span className="posting-state" data-state={postingStateValue}>
                  {POSTING_STATE_LABELS[postingStateValue]}
                </span>
                <DeleteButton
                  label={`Stellenangebot ${posting.company} · ${posting.role} löschen`}
                  onDelete={() => void remove(posting)}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
