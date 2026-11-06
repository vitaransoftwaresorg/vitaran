/** One item waiting in the OMR review queue after a photo batch or PDF upload. */
export type ScanQueueItem =
  | { kind: "file"; file: File; testId?: string }
  | {
      kind: "pdf-page";
      batchId: string;
      page: number;
      token: string;
      batchPreviewUrl: string;
      testId?: string;
    };
