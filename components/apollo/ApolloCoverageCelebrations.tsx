"use client";

export interface CoverageCelebration {
  eventId: number;
  displayName: string;
}

export default function ApolloCoverageCelebrations({
  items,
}: {
  items: CoverageCelebration[];
}) {
  return (
    <div className="apollo-coverage-celebrations" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
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
  );
}
