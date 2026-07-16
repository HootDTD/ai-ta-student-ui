"use client";

export interface CoverageCelebration {
  eventId: number;
  displayName: string;
}

/**
 * Two coupled surfaces for a newly-covered reference topic, both pinned to the
 * right of the Apollo session:
 *  - `celebrating` — the transient sparkle pop shown right when a topic is
 *    newly covered; the parent clears each item after its entrance settles.
 *  - `covered` — the persistent checklist that stays for the whole attempt.
 *    One row per concept (deduped upstream), so rows never repeat.
 */
export default function ApolloCoverageCelebrations({
  celebrating,
  covered,
}: {
  celebrating: CoverageCelebration[];
  covered: CoverageCelebration[];
}) {
  if (!celebrating.length && !covered.length) return null;

  return (
    <div className="apollo-coverage-celebrations">
      {celebrating.length > 0 && (
        <div className="apollo-coverage-pops" aria-live="polite" aria-atomic="false">
          {celebrating.map((item) => (
            <div className="apollo-coverage-pop" key={item.eventId}>
              <span className="apollo-coverage-pop__burst" aria-hidden>
                <span />
                <span />
                <span />
                <span />
              </span>
              <svg className="apollo-coverage-pop__check" viewBox="0 0 48 48" aria-hidden>
                <circle cx="24" cy="24" r="20" />
                <path d="m14.5 24.5 6.2 6.2 13.4-14" />
              </svg>
              <span className="apollo-coverage-pop__copy">
                <span className="apollo-coverage-pop__eyebrow">Topic covered</span>
                <strong>{item.displayName}</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {covered.length > 0 && (
        <div className="apollo-coverage-list">
          <span className="apollo-coverage-list__title">Topics covered</span>
          <ul className="apollo-coverage-list__items">
            {covered.map((item) => (
              <li className="apollo-coverage-list__item" key={item.eventId}>
                <svg className="apollo-coverage-list__check" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="11" />
                  <path d="m6.8 12.4 3.1 3.1 7.3-7.7" />
                </svg>
                <span className="apollo-coverage-list__label">{item.displayName}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
