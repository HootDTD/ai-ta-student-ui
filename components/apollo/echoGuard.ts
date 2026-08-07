// Submit-time echo guard for the Apollo composer (2026-08-07 bimodal-fix
// P0.6, defect I8): real pilot students submitted Apollo's own previous turn
// as their teaching message — one verbatim, one missing its first two
// characters (an imprecise manual select-copy-paste; the UI has no
// programmatic prefill path). Those turns grade as the student's words.
//
// Detection is substring containment over whitespace-normalized, lowercased
// text: the observed defect is contiguous copies, so no fuzzy matching. The
// guard fires when the shared span covers >= 90% of Apollo's turn — a short
// legitimate quote of one phrase stays well under that; a whole-turn copy
// (with or without the student's own additions around it) crosses it.

const ECHO_OVERLAP_THRESHOLD = 0.9;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function isEchoOfApolloTurn(draft: string, lastApolloMessage: string): boolean {
  const d = normalize(draft);
  const a = normalize(lastApolloMessage);
  if (!d || !a) return false;
  let overlap = 0;
  if (a.includes(d)) {
    overlap = d.length;
  } else if (d.includes(a)) {
    overlap = a.length;
  }
  return overlap / a.length >= ECHO_OVERLAP_THRESHOLD;
}
