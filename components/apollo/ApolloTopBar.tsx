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
import { ChevronLeft, MoreVertical, PanelLeft } from "lucide-react";

interface ApolloTopBarProgress {
  level: number;
  xp_total: number;
}

interface Props {
  classId?: number | null;
  progress?: ApolloTopBarProgress | null;
  onBack?: () => void;
  backLabel?: string;
  // Present only on the browse page — reveals the mobile concepts drawer.
  // Hidden by CSS at desktop widths, where the sidebar is always visible.
  onToggleSidebar?: () => void;
  hideProgressLink?: boolean;
  menuExtra?: (close: () => void) => React.ReactNode;
  // The session view's two-column (problem + KG) grid needs more room
  // than Hoot's single reading column; browse/progress match it exactly.
  maxWidthClassName?: string;
}

export default function ApolloTopBar({
  classId,
  progress,
  onBack,
  backLabel = "Back",
  onToggleSidebar,
  hideProgressLink,
  menuExtra,
  maxWidthClassName = "max-w-3xl",
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
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
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="site-brand">Apollo</div>
        </div>

        <div className="flex items-center gap-2 relative z-[1]">
          {progress && (
            <span className="apollo-topbar__stat">
              Lv {progress.level} · {progress.xp_total.toLocaleString()} XP
            </span>
          )}
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
                    className="dropdown-item text-sm"
                    onClick={closeMenu}
                  >
                    My progress
                  </Link>
                ) : null}
                {menuExtra?.(closeMenu)}
                <button
                  type="button"
                  className="dropdown-item text-sm"
                  onClick={() => {
                    closeMenu();
                    router.push("/");
                  }}
                >
                  Return to Hoot
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
