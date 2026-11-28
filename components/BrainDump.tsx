"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Sparkles } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { toast } from "@/lib/toast";

const MAX = 5000;

export function BrainDump({ onParse }: { onParse: (text: string) => Promise<number> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeechRecognition((chunk) => {
    if (!chunk) return;
    setText((prev) => (prev && !/\s$/.test(prev) ? `${prev} ${chunk}` : prev + chunk));
  });

  useEffect(() => {
    if (speech.error) toast(speech.error, "error");
  }, [speech.error]);

  // авто-рост textarea
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [text, speech.interim]);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    if (speech.listening) speech.stop();
    setBusy(true);
    try {
      const count = await onParse(value);
      if (count === 0) toast("ИИ не нашёл задач в тексте", "info");
      else {
        toast(`Добавлено задач: ${count}`, "success");
        setText("");
      }
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="material rounded-panel transition-shadow focus-within:ring-[3px] focus-within:ring-accent/30">
      <div className="relative">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="Выгрузите всё из головы: «Завтра до 12 сдать отчёт, купить продукты, записаться к стоматологу на следующей неделе…»"
          className="block min-h-[96px] w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-relaxed text-fg outline-none placeholder:text-faint"
          disabled={busy}
        />
        {speech.interim && (
          <p className="px-4 pb-2 text-[15px] leading-relaxed text-faint italic">{speech.interim}</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <button
          type="button"
          onClick={speech.toggle}
          disabled={!speech.supported || busy}
          title={
            speech.supported
              ? speech.listening
                ? "Остановить запись"
                : "Голосовой ввод (русский)"
              : "Браузер не поддерживает голосовой ввод"
          }
          aria-pressed={speech.listening}
          className={`grid size-8 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            speech.listening
              ? "animate-pulse-ring border border-q-do bg-q-do text-on-accent"
              : "glass text-fg hover:brightness-105"
          }`}
        >
          {speech.supported ? <Mic className="size-4" /> : <MicOff className="size-4" />}
        </button>
        {speech.listening && <span className="text-xs font-medium text-q-do">Слушаю…</span>}

        <span className="ml-auto hidden text-xs text-muted sm:inline">
          {text.length > 0 && `${text.length}/${MAX} · `}⌘ / Ctrl + Enter
        </span>

        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || busy}
          className="glass-prominent inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-[filter,opacity] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {busy ? "Разбираю…" : "Разобрать с помощью ИИ"}
        </button>
      </div>
    </section>
  );
}
