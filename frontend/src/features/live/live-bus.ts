import type { LiveContentKind } from "./kinds";
import type { PublicSettings } from "@/types/settings";

export type LiveChangePayload = {
  kind: LiveContentKind;
  settings?: PublicSettings;
};

type ChangeListener = (payload: LiveChangePayload) => void;

type Bus = {
  source?: EventSource;
  listeners: Set<ChangeListener>;
  retryTimer?: ReturnType<typeof setTimeout>;
  attempts: number;
};

const buses = new Map<string, Bus>();
const MAX_RETRY_MS = 30_000;

function attach(path: string, bus: Bus) {
  const source = new EventSource(path);
  bus.source = source;

  source.onopen = () => {
    bus.attempts = 0;
  };

  source.addEventListener("change", (event) => {
    try {
      const data = JSON.parse((event as MessageEvent<string>).data) as LiveChangePayload;
      for (const listener of [...bus.listeners]) listener(data);
    } catch {
      // Ignore malformed live events.
    }
  });

  source.onerror = () => {
    if (source.readyState !== EventSource.CLOSED) return;
    source.close();
    bus.source = undefined;
    clearTimeout(bus.retryTimer);
    bus.retryTimer = setTimeout(
      () => {
        if (!buses.has(path) || buses.get(path) !== bus) return;
        attach(path, bus);
      },
      Math.min(MAX_RETRY_MS, 2_000 * 2 ** bus.attempts++),
    );
  };
}

/**
 * One EventSource per SSE path for the whole tab.
 * Components subscribe/unsubscribe; the socket stays open while anyone is listening.
 */
export function subscribeLive(path: string, listener: ChangeListener) {
  let bus = buses.get(path);
  if (!bus) {
    bus = { listeners: new Set(), attempts: 0 };
    buses.set(path, bus);
    attach(path, bus);
  }
  bus.listeners.add(listener);

  return () => {
    const current = buses.get(path);
    if (!current) return;
    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;
    clearTimeout(current.retryTimer);
    current.source?.close();
    buses.delete(path);
  };
}
