/** Suppress LiveRefresh / board reloads on this tab after a local mutation (avoids toggle blink). */
let silenceUntil = 0;
/** Hard pause while a portal is under maintenance (avoids 503 RSC refreshes). */
let paused = false;

export function silenceLive(ms = 2_500) {
  silenceUntil = Math.max(silenceUntil, Date.now() + ms);
}

/** Block live-driven refreshes until cleared (used by PortalMaintenanceGate). */
export function setLivePaused(next: boolean) {
  paused = next;
}

export function isLiveSilenced() {
  return paused || Date.now() < silenceUntil;
}
