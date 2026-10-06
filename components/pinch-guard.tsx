"use client";

import { useEffect } from "react";

const zoomLocked = () =>
  document.querySelector('meta[name="viewport"]')?.getAttribute("content")?.includes("user-scalable=no") ?? false;

/**
 * iPhone and iPad Safari ignore user-scalable=no (since iOS 10), so on screens whose viewport locks
 * zoom, also cancel Safari's pinch gesture. Other browsers never fire these events. The public site
 * allows zoom, so the check reads the current viewport rather than the route.
 */
export function PinchGuard() {
  useEffect(() => {
    const block = (e: Event) => {
      if (zoomLocked()) e.preventDefault();
    };
    document.addEventListener("gesturestart", block);
    document.addEventListener("gesturechange", block);
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
    };
  }, []);
  return null;
}
