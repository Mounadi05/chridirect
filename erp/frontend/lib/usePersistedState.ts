import { useState, useEffect } from "react";

// Drop-in useState replacement that mirrors its value to sessionStorage.
// Survives route changes (e.g. opening an order detail and coming back) and
// page refresh; clears when the browser tab is closed.
export function usePersistedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial; // SSR guard
    try {
      const raw = sessionStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue] as const;
}
