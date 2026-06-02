import { useState, useEffect, useCallback } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean; // true for a brief moment after reconnection — use to trigger re-fetch
}

/**
 * Tracks browser online/offline state.
 * - `isOnline`  — current network state
 * - `wasOffline` — flips true→false briefly on reconnection so consumers can
 *                  fire a one-shot re-fetch without setting up their own listeners
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    // Signal "just reconnected" to consumers for one render cycle
    setWasOffline(true);
    setTimeout(() => setWasOffline(false), 100);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(false);
  }, []);

  useEffect(() => {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
