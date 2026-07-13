"use client";

export function PrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className ?? "btn-primary"}>
      🖨 {label}
    </button>
  );
}
