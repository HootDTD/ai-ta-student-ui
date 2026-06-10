"use client";

// P3.7 — inline editor for the SUPPLY-PARAPHRASE move. Preserves the
// entry's structural fields (the backend never mutates them); only the
// surface form is user-editable. Max 1000 chars per backend contract.

import { useState } from "react";

interface Props {
  busy: boolean;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (surfaceForm: string) => void;
}

const MAX_FORM = 1000;

export default function KGEntryParaphrase({
  busy, initialValue, onCancel, onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const tooLong = trimmed.length > MAX_FORM;
  const canSubmit = trimmed.length > 0 && !tooLong && !busy;

  return (
    <div className="kg-pill__card kg-pill__card--paraphrase" role="dialog">
      <div className="kg-pill__card-eyebrow">Your preferred wording</div>
      <textarea
        className="kg-pill__textarea"
        placeholder="Rephrase how Apollo should remember this. (Structural fields stay; only the wording changes.)"
        rows={3}
        maxLength={MAX_FORM + 1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
      />
      <div className="kg-pill__card-meta">
        <span className={tooLong ? "kg-pill__counter kg-pill__counter--err" : "kg-pill__counter"}>
          {trimmed.length}/{MAX_FORM}
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
          >save</button>
        </span>
      </div>
    </div>
  );
}
