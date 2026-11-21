"use client";

import { Check } from "lucide-react";

export function Checkbox({
  checked,
  onChange,
  label,
  size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "size-3.5 rounded-[4px]" : "size-4 rounded-[5px]";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`${box} grid shrink-0 place-items-center border transition-colors ${
        checked
          ? "border-accent bg-accent text-bg"
          : "border-line-strong bg-transparent hover:border-muted"
      }`}
    >
      {checked && <Check className={size === "sm" ? "size-2.5" : "size-3"} strokeWidth={3.5} />}
    </button>
  );
}
