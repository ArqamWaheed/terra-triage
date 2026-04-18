import type {
  MemoryEntryInput,
  MemoryKey,
  MemoryValue,
  SignalsByRehabber,
} from "./types";

export interface MemoryBackend {
  readonly kind: "backboard" | "local";
  query(ids: string[]): Promise<SignalsByRehabber>;
  upsert(id: string, entries: MemoryEntryInput[]): Promise<void>;
}

export class MemoryBackendError extends Error {
  readonly backend: "backboard" | "local";
  constructor(backend: "backboard" | "local", message: string, cause?: unknown) {
    super(message);
    this.name = "MemoryBackendError";
    this.backend = backend;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export type { MemoryKey, MemoryValue, SignalsByRehabber };
