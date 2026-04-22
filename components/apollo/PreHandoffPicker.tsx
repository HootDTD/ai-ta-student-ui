"use client";

import { useState } from "react";
import DifficultyPicker from "./DifficultyPicker";
import type { Difficulty } from "@/lib/apollo/api";

export interface PreHandoffPickerProps {
  onStart: (difficulty: Difficulty) => Promise<void>;
  disabled?: boolean;
  errorMessage?: string | null;
}

export default function PreHandoffPicker({
  onStart,
  disabled,
  errorMessage,
}: PreHandoffPickerProps) {
  const [choice, setChoice] = useState<Difficulty | null>(null);
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!choice) return;
    setBusy(true);
    try {
      await onStart(choice);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="apollo-pre-handoff max-w-xl mx-auto py-12 px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Ready to start teaching?</h1>
      <p className="mt-2 text-slate-600">
        Pick a difficulty to start. You can change it any time.
      </p>

      <div className="mt-6">
        <DifficultyPicker
          value={choice}
          onChange={setChoice}
          disabled={disabled || busy}
        />
      </div>

      {errorMessage ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="button"
        onClick={go}
        disabled={!choice || disabled || busy}
        className="mt-6 inline-flex items-center rounded-md bg-amber-500 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {busy ? "Starting…" : "Start teaching"}
      </button>
    </div>
  );
}
