"use client";

import { useState } from "react";

export interface RestartProblemButtonProps {
  onRestart: () => Promise<void>;
  disabled?: boolean;
}

export default function RestartProblemButton({
  onRestart,
  disabled,
}: RestartProblemButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onRestart();
      setOpen(false);
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
        Restart this problem
      </button>

      {open ? (
        <div className="apollo-modal-overlay fixed inset-0 bg-black/40 flex items-center justify-center z-40">
          <div className="apollo-modal bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900">
              Restart this problem?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Wipe your teaching for this problem and start over? Same
              problem, same difficulty.
            </p>

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
                disabled={busy}
                className="ui-button ui-button--primary ui-button--small"
              >
                {busy ? "Restarting…" : "Restart"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
