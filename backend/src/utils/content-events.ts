import { EventEmitter } from "node:events";

export type ContentKind =
  | "answer-keys"
  | "results"
  | "students"
  | "teachers"
  | "schools"
  | "sections"
  | "objections"
  | "programs";

export type ContentChange = {
  kind: ContentKind;
  /** Schools affected; `null` means every school (e.g. regular answer keys / catalog). */
  schoolId: string | null;
};

/**
 * In-process pub/sub for "content changed" signals across admin / school / teacher.
 * Running more than one API instance needs a shared channel (e.g. Postgres LISTEN/NOTIFY or Redis) instead.
 */
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function notifyContentChanged(change: ContentChange) {
  emitter.emit("change", change);
}

export function onContentChanged(listener: (change: ContentChange) => void) {
  emitter.on("change", listener);
  return () => {
    emitter.off("change", listener);
  };
}
