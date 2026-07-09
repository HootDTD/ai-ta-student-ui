"use client";

import OwlVideo from "./OwlVideo";

export default function AuthBrand({ subtitle = "AI Teaching Assistant" }: { subtitle?: string }) {
  return (
    <div className="auth-brand">
      <OwlVideo className="auth-brand__owl" />
      <div className="auth-brand__wordmark">Hoot</div>
      <div className="auth-brand__subtitle">{subtitle}</div>
    </div>
  );
}
