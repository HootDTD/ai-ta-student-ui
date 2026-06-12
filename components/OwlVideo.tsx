"use client";

import { useState } from "react";

// Decorative owl mascot. If the asset fails to load, hide it so the
// wordmark stands alone instead of leaving a broken-media box.
export default function OwlVideo({ className }: { className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <video
      src="/thinking.mp4"
      autoPlay
      loop
      muted
      playsInline
      aria-hidden
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
