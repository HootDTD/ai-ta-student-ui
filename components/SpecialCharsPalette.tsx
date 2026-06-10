"use client";

import { useState } from "react";

interface Props {
  onInsert: (ch: string) => void;
}

const GROUPS: Array<{ label: string; chars: string[] }> = [
  { label: "Greek", chars: ["ρ", "π", "θ", "φ", "ω", "Δ", "Σ", "∫", "∂"] },
  { label: "Powers", chars: ["²", "³", "₁", "₂", "₃"] },
  { label: "Operators", chars: ["×", "÷", "±", "√"] },
  { label: "Relations", chars: ["=", "≠", "≈", "≤", "≥"] },
  { label: "Brackets", chars: ["(", ")", "[", "]"] },
];

export default function SpecialCharsPalette({ onInsert }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="char-palette">
      <button
        type="button"
        className="char-palette__toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Hide special characters" : "Show special characters"}
        title="Insert special characters"
      >
        <span className="char-palette__toggle-glyph">Σ</span>
        <span className="char-palette__toggle-label">
          {open ? "Hide" : "Special chars"}
        </span>
      </button>

      {open && (
        <div className="char-palette__grid" role="group">
          {GROUPS.map((group) => (
            <div key={group.label} className="char-palette__row">
              {group.chars.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className="char-palette__key"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onInsert(ch)}
                  aria-label={`Insert ${ch}`}
                >
                  {ch}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
