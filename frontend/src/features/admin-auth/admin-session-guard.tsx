"use client";

import { useEffect } from "react";
import { ADMIN_LOGOUT_PATH } from "@/constants/auth";

const CHANNEL = "vitaran-admin-session";

/**
 * Goes through the logout route, never straight to login: the signing-out tab hears its own
 * broadcast too, and jumping to login there would cancel the request that clears the cookie.
 */
function goToAdminLogin() {
  if (window.location.pathname === ADMIN_LOGOUT_PATH) return;
  window.location.replace(ADMIN_LOGOUT_PATH);
}

/** Other admin tabs only — `storage` does not fire in the tab that signs out. */
export function broadcastAdminLogout() {
  try {
    localStorage.setItem(CHANNEL, String(Date.now()));
  } catch {
    // private mode
  }
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage("logout");
    channel.close();
  } catch {
    // BroadcastChannel unavailable
  }
}

/** Other admin tabs and back-forward cache must not keep showing the console after sign-out. */
export function AdminSessionGuard() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CHANNEL) goToAdminLogin();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };

    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(CHANNEL);
      channel.onmessage = () => goToAdminLogin();
    } catch {
      // ignore
    }

    window.addEventListener("storage", onStorage);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pageshow", onPageShow);
      channel?.close();
    };
  }, []);

  return null;
}
