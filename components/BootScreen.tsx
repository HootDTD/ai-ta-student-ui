"use client";

import OwlVideo from "./OwlVideo";

export default function BootScreen({ label }: { label?: string }) {
  return (
    <div className="boot-screen">
      <OwlVideo className="boot-screen__owl" />
      <div className="boot-screen__wordmark">Hoot</div>
      <div className="boot-screen__bar" />
      {label && <div className="boot-screen__label">{label}</div>}
    </div>
  );
}
