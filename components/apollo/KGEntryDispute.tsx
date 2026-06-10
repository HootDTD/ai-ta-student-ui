"use client";

// P3.7 — inline expandable card for the CHALLENGE move. Free-text reason
// (max 500 chars per backend contract); submit -> POST /challenge.

import { useState } from "react";

interface Props {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (reason: string) => void;
}

const MAX_REASON = 500;

export default function KGEntryDispute({ busy, onCancel, onSubmit }: Props) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const tooLong = trimmed.length > MAX_REASON;
  const canSubmit = trimmed.length > 0 && !tooLong && !busy;

  return (
    <div className="kg-pill__card kg-pill__card--dispute" role="dialog">
      <div className="kg-pill__card-eyebrow">Challenge this entry</div>
      <textarea
        className="kg-pill__textarea"
        placeholder="What's wrong here? (Apollo will flag this for your grader.)"
        rows={3}
        maxLength={MAX_REASON + 1}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        autoFocus
      />
      <div className="kg-pill__card-meta">
        <span className={tooLong ? "kg-pill__counter kg-pill__counter--err" : "kg-pill__counter"}>
          {trimmed.length}/{MAX_REASON}
        </span>
        <span className="kg-pill__card-actions">
          <button
            type="button"
            className="kg-pill__btn-secondary"
            onClick={onCancel}
            disabled={busy}
          >cancel</button>
          <button
            type="button"
            className="kg-pill__btn-primary"
            onClick={() => onSubmit(trimmed)}
            disabled={!canSubmit}
          >submit</button>
        </span>
      </div>
    </div>
  );
}
