import type { Storage } from "./types";

export interface Remembered {
  loop: string;
  metric: string;
  requestId: string;
  /** epoch ms on this device's clock. */
  expiresAt: number;
}

const MAX_REMEMBERED = 50;

// localStorage can be absent, or throw on access (sandboxed iframes, blocked cookies,
// a full quota), and none of that may ever surface to the page.
function localStore(): globalThis.Storage | undefined {
  try {
    return globalThis.localStorage ?? undefined;
  } catch {
    return undefined;
  }
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function isRemembered(value: unknown): value is Remembered {
  const entry = value as Remembered;
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.loop === "string" &&
    typeof entry.metric === "string" &&
    typeof entry.requestId === "string" &&
    typeof entry.expiresAt === "number"
  );
}

/** the decisions this device was served: the latest per loop, until its window closes. */
export class DecisionMemory {
  private storage: Storage;
  private held: Remembered[] = [];
  private readonly key: string;

  /** `namespace` keeps two workspaces on one origin apart. */
  constructor(storage: Storage, namespace: string) {
    this.key = `qbrix:decisions:${fnv1a(namespace)}`;
    this.storage = storage === "local" && !localStore() ? "memory" : storage;
  }

  remember(entry: Remembered): void {
    if (this.storage === "none") return;
    const kept = this.current().filter((held) => held.loop !== entry.loop);
    kept.push(entry);
    this.write(kept.slice(-MAX_REMEMBERED));
  }

  /** unexpired decisions, oldest first; only those made for `metric` when given. */
  current(metric?: string): Remembered[] {
    const now = Date.now();
    const stored = this.read();
    const live = stored.filter((entry) => entry.expiresAt > now);
    if (live.length !== stored.length) this.write(live);
    return metric === undefined ? live : live.filter((entry) => entry.metric === metric);
  }

  use(storage: Storage): void {
    const entries = this.current();
    if (storage === "local") {
      if (!localStore()) {
        this.storage = "memory";
        this.held = entries;
        return;
      }
      this.storage = "local";
      this.held = [];
      this.write(entries);
      return;
    }
    try {
      localStore()?.removeItem(this.key);
    } catch {
      // nothing to remove
    }
    this.storage = storage;
    this.held = storage === "memory" ? entries : [];
  }

  private read(): Remembered[] {
    if (this.storage !== "local") return this.held;
    try {
      const raw = localStore()?.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter(isRemembered) : [];
    } catch {
      return [];
    }
  }

  private write(entries: Remembered[]): void {
    if (this.storage !== "local") {
      this.held = entries;
      return;
    }
    try {
      const store = localStore();
      if (!store) throw new Error("no localStorage");
      if (entries.length === 0) store.removeItem(this.key);
      else store.setItem(this.key, JSON.stringify(entries));
    } catch {
      this.storage = "memory";
      this.held = entries;
    }
  }
}
