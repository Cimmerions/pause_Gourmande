
import { useCallback, useEffect, useState } from "react";

export function useRateLimitLockout(storageKey: string) {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const saved = Number(localStorage.getItem(storageKey));

    if (Number.isFinite(saved) && saved > Date.now()) {
      setExpiresAt(saved);
    } else {
      localStorage.removeItem(storageKey);
    }

    setNow(Date.now());
  }, [storageKey]);

  useEffect(() => {
    if (expiresAt === null) return;

    const interval = window.setInterval(() => {
      const current = Date.now();
      setNow(current);

      if (current >= expiresAt) {
        setExpiresAt(null);
        localStorage.removeItem(storageKey);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [expiresAt, storageKey]);

  const startLockout = useCallback(
    (seconds: number) => {
      if (!Number.isFinite(seconds) || seconds <= 0) return;

      const expiration = Date.now() + Math.ceil(seconds) * 1000;

      localStorage.setItem(storageKey, String(expiration));
      setExpiresAt(expiration);
      setNow(Date.now());
    },
    [storageKey],
  );

  const remainingSeconds =
    expiresAt === null
      ? 0
      : Math.max(0, Math.ceil((expiresAt - now) / 1000));

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const countdown = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    isLocked: remainingSeconds > 0,
    remainingSeconds,
    countdown,
    startLockout,
  };
}
