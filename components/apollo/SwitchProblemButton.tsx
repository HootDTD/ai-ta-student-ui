"use client";

import { useState } from "react";
import DifficultyPicker from "./DifficultyPicker";
import type { Difficulty } from "@/lib/apollo/api";

export interface SwitchProblemButtonProps {
  onSwitch: (difficulty: Difficulty) => Promise<void>;
  disabled?: boolean;
}

export default function SwitchProblemButton({
  onSwitch,
  disabled,
}: SwitchProblemButtonProps) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Difficulty | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!choice) return;
    setBusy(true);
    setError(null);
    try {
      await onSwitch(choice);
      setOpen(false);
      setChoice(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="ui-button ui-button--small"
      >
        Switch problem
      </button>

      {open ? (
        <div className="apollo-modal-overlay fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="apollo-modal bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Switch to a different problem?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              This problem won&rsquo;t be graded. Pick a new difficulty to
              start over with a different problem.
            </p>

            <div className="mt-4">
              <DifficultyPicker
                value={choice}
                onChange={setChoice}
                disabled={busy}
              />
            </div>

            {error ? (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setChoice(null);
                  setError(null);
                }}
                disabled={busy}
                className="ui-button ui-button--small"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!choice || busy}
                className="ui-button ui-button--primary ui-button--small"
              >
                {busy ? "Switching…" : "Switch problem"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
