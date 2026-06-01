"use client";

// P3.8 — Done-gate modal.
//
// Triggered when the student clicks Done and the backend returns 422
// `review_required` (P3.6). Lists every flagged entry with a reason
// + summary; each row has a "Jump to entry" link that scrolls the
// sidebar to it and signals the panel to open the dispute card.
// Re-Done is only enabled once every flagged entry has been touched
// with a negotiation move (FE state from move-success dispatch).

import type { ReviewRequiredEntry } from "@/lib/apollo/api";

interface Props {
  entries: ReviewRequiredEntry[];
  // Set of entry_ids the student has touched since the modal opened.
  touched: Set<string>;
  onJumpTo: (entryId: string) => void;
  onClose: () => void;
  onRetry: () => void;
}

function _reasonLabel(reason: ReviewRequiredEntry["reason"]): string {
  return reason === "disputed"
    ? "you flagged this — review and choose a move"
    : "Apollo wasn't sure it heard you correctly";
}

export default function DoneGateModal({
  entries, touched, onJumpTo, onClose, onRetry,
}: Props) {
  const remaining = entries.filter((e) => !touched.has(e.entry_id));
  const allTouched = remaining.length === 0;

  return (
    <div className="done-gate-modal__backdrop" role="dialog" aria-modal="true">
      <div className="done-gate-modal__card">
        <div className="done-gate-modal__header">
          <div className="done-gate-modal__eyebrow">Review needed</div>
          <h2 className="done-gate-modal__title">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"} need
            {entries.length === 1 ? "s" : ""} your eyes before grading
          </h2>
          <p className="done-gate-modal__subtitle">
            Touch each one with a quick move (challenge / paraphrase / skip)
            and then re-submit Done. This makes sure Apollo isn&apos;t graded
            against words you didn&apos;t mean.
          </p>
        </div>

        <ul className="done-gate-modal__list">
          {entries.map((e) => {
            const done = touched.has(e.entry_id);
            return (
              <li
                key={e.entry_id}
                className={`done-gate-modal__row ${done ? "done-gate-modal__row--done" : ""}`}
              >
                <div className="done-gate-modal__row-main">
                  <span className="done-gate-modal__row-type">{e.type}</span>
                  <span className="done-gate-modal__row-summary">{e.summary}</span>
                </div>
                <div className="done-gate-modal__row-meta">
                  <span className="done-gate-modal__row-reason">
                    {_reasonLabel(e.reason)}
                  </span>
                  {done ? (
                    <span className="done-gate-modal__row-status done-gate-modal__row-status--done">
                      ✓ touched
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="kg-pill__btn-primary"
                      onClick={() => onJumpTo(e.entry_id)}
                    >Jump to entry</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="done-gate-modal__footer">
          <button
            type="button"
            className="kg-pill__btn-secondary"
            onClick={onClose}
          >Cancel</button>
          <button
            type="button"
            className="kg-pill__btn-primary"
            disabled={!allTouched}
            onClick={onRetry}
            title={allTouched ? "Submit Done again" : `Touch ${remaining.length} more entr${remaining.length === 1 ? "y" : "ies"} first`}
          >Re-submit Done</button>
        </div>
      </div>
    </div>
  );
}
