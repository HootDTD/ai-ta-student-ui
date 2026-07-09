"use client";

// Concepts navigation for the Apollo browse page. Persistent in-flow
// column on desktop (see .apollo-sidebar's @media rule); a Hoot-style
// off-canvas drawer below that breakpoint, toggled from ApolloTopBar.

import { useEffect } from "react";
import type { ApolloConceptSummary } from "@/lib/apollo/api";

interface Props {
  concepts: ApolloConceptSummary[];
  conceptId: number | null;
  onSelect: (id: number) => void;
  open: boolean;
  onClose: () => void;
}

export default function ApolloSidebar({ concepts, conceptId, onSelect, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="apollo-sidebar-overlay" onClick={onClose} aria-hidden="true" />}
      <nav className={`apollo-sidebar ${open ? "apollo-sidebar--open" : ""}`} aria-label="Concepts">
        <div className="eyebrow">Concepts</div>
        <div className="apollo-sidebar__list">
          {concepts.map((c) => (
            <button
              key={c.concept_id}
              type="button"
              aria-current={c.concept_id === conceptId ? "true" : undefined}
              className={`apollo-sidebar__item ${
                c.concept_id === conceptId ? "apollo-sidebar__item--active" : ""
              }`}
              onClick={() => {
                onSelect(c.concept_id);
                onClose();
              }}
            >
              {c.display_name}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
