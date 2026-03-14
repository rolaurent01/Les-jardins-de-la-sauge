"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Retourne l'état réseau en temps réel via navigator.onLine + événements */
function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

function getServerSnapshot(): boolean {
  return true;
}

export function useOnlineStatus(): { isOnline: boolean; wasOffline: boolean } {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    }
  }, [isOnline]);

  return { isOnline, wasOffline };
}
