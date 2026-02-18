import React, { useEffect, useRef, useState } from "react";

export type AutomationToastTone = "success" | "error" | "warning" | "info";

export type AutomationToastState = {
  tone: AutomationToastTone;
  text: string;
} | null;

export function useAutomationToast(timeoutMs = 3200) {
  const [toast, setToast] = useState<AutomationToastState>(null);
  const timerRef = useRef<number | null>(null);

  const showToast = (tone: AutomationToastTone, text: string) => {
    setToast({ tone, text });
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), timeoutMs);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return { toast, showToast, clearToast: () => setToast(null) };
}

export default function AutomationToast({
  toast,
}: {
  toast: AutomationToastState;
}) {
  if (!toast) return null;

  const toneClass =
    toast.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : toast.tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : toast.tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className="fixed right-4 top-4 z-[100]">
      <div className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass}`}>
        {toast.text}
      </div>
    </div>
  );
}

