"use client";

// Chrome shared by every Apollo page. Reuses Hoot's own .site-header and
// .site-brand classes directly (rather than parallel Apollo-specific
// copies) plus the exact Tailwind layout Hoot's header renders with
// (mx-auto max-w-3xl flex ... px-4 py-1.5, brand absolutely centered) —
// see app/page.tsx's <header>. This guarantees the two headers can't
// drift the way a hand-copied second set of values eventually will.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { APOLLO_ONLY } from "@/lib/flags";
import { ChevronDown, ChevronLeft, MoreVertical, PanelLeft } from "lucide-react";

import { listMyClasses, type ApolloClassOption } from "@/lib/apollo/api";

interface Props {
  classId?: number | null;
  onBack?: () => void;
  backLabel?: string;
  // Present only on the browse page — reveals the mobile concepts drawer.
  // Hidden by CSS at desktop widths, where the sidebar is always visible.
  onToggleSidebar?: () => void;
  hideProgressLink?: boolean;
  // Visible action(s) in the right cluster (e.g. session's "Start over"),
  // shown as real buttons rather than buried in the overflow menu.
  actions?: React.ReactNode;
  // The session view's two-column (problem + KG) grid needs more room
  // than Hoot's single reading column; browse/progress match it exactly.
  maxWidthClassName?: string;
}

export default function ApolloTopBar({
  classId,
  onBack,
  backLabel = "Back",
  onToggleSidebar,
  hideProgressLink,
  actions,
  maxWidthClassName = "max-w-3xl",
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = () => setMenuOpen(false);

  // Class switcher — mirrors Hoot's own header dropdown (app/page.tsx) so
  // students can hop between courses from anywhere in Apollo, not just from
  // Hoot. Fetched independently of the `classId` prop (which is only ever
  // the *current* course) so it still renders on the "no class in URL"
  // error screens and lets the student fix that themselves.
  const [classes, setClasses] = useState<ApolloClassOption[]>([]);
  const [classDropdownOpen, setClassDropdownOpen] = useState(false);
  const classDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
      if (
        classDropdownRef.current &&
        !classDropdownRef.current.contains(e.target as Node)
      ) {
        setClassDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="site-header">
      <div className={`mx-auto flex w-full ${maxWidthClassName} items-center justify-between px-4 py-1.5 relative`}>
        <div className="flex items-center gap-2 relative z-[1]">
          {onToggleSidebar && (
            <button
              type="button"
              className="apollo-topbar__back apollo-topbar__sidebar-toggle"
              onClick={onToggleSidebar}
              aria-label="Toggle concepts"
              title="Concepts"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          {onBack && (
            <button
              type="button"
              className="apollo-topbar__back"
              onClick={onBack}
              aria-label={backLabel}
              title={backLabel}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {classes.length > 0 && (
            <div ref={classDropdownRef} className="dropdown">
              <button
                type="button"
                onClick={() => setClassDropdownOpen((v) => !v)}
                className="dropdown-trigger !h-8 !min-h-8 !w-auto !px-3 !py-1.5 text-sm"
              >
                <span className="max-w-[160px] truncate">
                  {classes.find((c) => c.id === classId)?.name || "Select class"}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${
                    classDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {classDropdownOpen && (
                <div className="dropdown-menu">
                  {classes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setClassDropdownOpen(false);
                        if (c.id !== classId) router.push(`/apollo?class=${c.id}`);
                      }}
                      className="dropdown-item"
                      data-active={c.id === classId}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="site-brand">Apollo</div>
        </div>

        <div className="flex items-center gap-2 relative z-[1]">
          {actions}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              className="header-menu-trigger"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Apollo menu"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="header-menu">
                {!hideProgressLink && classId ? (
                  <Link
                    href={`/apollo/progress?class=${classId}`}
                    className="dropdown-item"
                    onClick={closeMenu}
                  >
                    My progress
                  </Link>
                ) : null}
                {!APOLLO_ONLY && (
                  <button
                    type="button"
                    className="dropdown-item"
                    onClick={() => {
                      closeMenu();
                      router.push("/");
                    }}
                  >
                    Return to Hoot
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
