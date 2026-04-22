"use client";

import {
  DIFFICULTIES,
  DIFFICULTY_DESCRIPTIONS,
  DIFFICULTY_LABELS,
  DIFFICULTY_MULTIPLIERS,
  type Difficulty,
} from "@/lib/apollo/api";

export interface DifficultyPickerProps {
  value: Difficulty | null;
  onChange: (d: Difficulty) => void;
  disabled?: boolean;
}

export default function DifficultyPicker({
  value,
  onChange,
  disabled,
}: DifficultyPickerProps) {
  return (
    <div className="apollo-difficulty-picker flex flex-col gap-2">
      {DIFFICULTIES.map((d) => {
        const selected = value === d;
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onChange(d)}
            aria-pressed={selected}
            className={[
              "text-left rounded-lg border px-4 py-3 transition",
              selected
                ? "border-amber-400 bg-amber-50"
                : "border-slate-200 bg-white hover:border-slate-300",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">
                {DIFFICULTY_LABELS[d]}
              </span>
              <span className="text-sm font-mono text-slate-600">
                ×{DIFFICULTY_MULTIPLIERS[d].toFixed(1)} XP
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {DIFFICULTY_DESCRIPTIONS[d]}
            </p>
          </button>
        );
      })}
    </div>
  );
}
