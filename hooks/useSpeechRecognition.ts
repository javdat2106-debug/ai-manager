"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Минимальные типы Web Speech API (в lib.dom их нет для webkit-префикса)
interface SRAlternative {
  transcript: string;
}
interface SRResult {
  isFinal: boolean;
  0: SRAlternative;
}
interface SREvent {
  resultIndex: number;
  results: { length: number; [i: number]: SRResult };
}
interface SRErrorEvent {
  error: string;
}
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type SRCtor = new () => SR;

function getCtor(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Доступ к микрофону запрещён",
  "service-not-allowed": "Доступ к распознаванию речи запрещён",
  "no-speech": "Речь не распознана — попробуйте ещё раз",
  "audio-capture": "Микрофон не найден",
  network: "Ошибка сети при распознавании речи",
};

export function useSpeechRecognition(onFinal: (text: string) => void, lang = "ru-RU") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SR | null>(null);
  const wantRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(getCtor() !== null);
    return () => {
      wantRef.current = false;
      recRef.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0].transcript;
        if (r.isFinal) onFinalRef.current(t.trim());
        else interimText += t;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      if (e.error !== "no-speech") wantRef.current = false;
      setError(ERRORS[e.error] ?? `Ошибка распознавания: ${e.error}`);
    };
    rec.onend = () => {
      setInterim("");
      // Chrome сам останавливает запись после паузы — перезапускаем, пока пользователь не нажал «стоп»
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          /* ignore */
        }
      }
      setListening(false);
    };

    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Не удалось запустить распознавание");
    }
  }, [lang]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { supported, listening, interim, error, start, stop, toggle };
}
