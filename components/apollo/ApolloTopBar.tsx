"use client";

// Chrome shared by every Apollo page — mirrors Hoot's site-header: sticky,
// blurred bar with a centered brand and a right-side menu instead of
// per-page nav rows of buttons.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, MoreVertical } from "lucide-react";

interface ApolloTopBarProgress {
  level: number;
  xp_total: number;
}

interface Props {
  classId?: number | null;
  progress?: ApolloTopBarProgress | null;
  onBack?: () => void;
  backLabel?: string;
  hideProgressLink?: boolean;
  menuExtra?: (close: () => void) => React.ReactNode;
}

export default function ApolloTopBar({
  classId,
  progress,
  onBack,
  backLabel = "Back",
  hideProgressLink,
  menuExtra,
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
    <header className="apollo-topbar">
      <div className="apollo-topbar__inner">
        <div className="apollo-topbar__left">
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

        <div className="apollo-topbar__brand">Apollo</div>

        <div className="apollo-topbar__right">
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
