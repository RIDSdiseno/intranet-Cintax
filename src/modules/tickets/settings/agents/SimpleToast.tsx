import React from "react";

export type SimpleToastTone = "success" | "error" | "info";

export type SimpleToastState = {
  tone: SimpleToastTone;
  text: string;
} | null;

export function useSimpleToast(timeoutMs = 3200) {
  const [toast, setToast] = React.useState<SimpleToastState>(null);
  const timeoutRef = React.useRef<number | null>(null);

  const showToast = React.useCallback(
    (tone: SimpleToastTone, text: string) => {
      setToast({ tone, text });
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => setToast(null), timeoutMs);
    },
    [timeoutMs]
  );

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    toast,
    showToast,
    clearToast: () => setToast(null),
  };
}

export default function SimpleToast({ toast }: { toast: SimpleToastState }) {
  if (!toast) return null;

  const toneClass =
    toast.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : toast.tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-700"
      : "border-rose-200 bg-rose-50 text-rose-700";

  return (
    <div className="fixed right-4 top-4 z-[130]">
      <div className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass}`}>
        {toast.text}
      </div>
    </div>
  );
}
