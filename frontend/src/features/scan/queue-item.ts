/** One photo waiting in the OMR review queue after a photo batch upload. */
export type ScanQueueItem = { kind: "file"; file: File; testId?: string };
