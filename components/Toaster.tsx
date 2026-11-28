"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { subscribeToasts, type ToastItem } from "@/lib/toast";

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(
    () =>
      subscribeToasts((t) => {
        setItems((xs) => [...xs, t]);
        setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 4500);
      }),
    [],
  );

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {items.map((t) => {
        const Icon = t.kind === "error" ? AlertCircle : t.kind === "success" ? CheckCircle2 : Info;
        const color =
          t.kind === "error" ? "text-q-do" : t.kind === "success" ? "text-success" : "text-accent";
        return (
          <div
            key={t.id}
            className="glass pointer-events-auto flex animate-fade-in items-start gap-2.5 rounded-panel px-3.5 py-3 text-[13px] font-medium"
          >
            <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} />
            <span className="flex-1 text-fg">{t.message}</span>
            <button
              onClick={() => setItems((xs) => xs.filter((x) => x.id !== t.id))}
              className="rounded-full text-muted hover:text-fg"
              aria-label="Закрыть"
            >
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
