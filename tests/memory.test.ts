import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DecisionMemory, type Remembered } from "../src/memory";

class MapStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
  removeItem(key: string): void {
    this.items.delete(key);
  }
}

function entry(loop: string, overrides: Partial<Remembered> = {}): Remembered {
  return {
    loop,
    metric: "purchase",
    requestId: `rid-${loop}`,
    expiresAt: Date.now() + 60_000,
    ...overrides,
  };
}

let store: MapStorage;

beforeEach(() => {
  store = new MapStorage();
  vi.stubGlobal("localStorage", store);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("DecisionMemory", () => {
  it("keeps the latest decision per loop", () => {
    const memory = new DecisionMemory("local", "ws");
    memory.remember(entry("headline"));
    memory.remember(entry("button"));
    memory.remember(entry("headline", { requestId: "newer" }));

    expect(memory.current().map((e) => e.requestId)).toEqual(["rid-button", "newer"]);
  });

  it("is read by another client on the same device, as after a reload", () => {
    new DecisionMemory("local", "ws").remember(entry("headline"));

    expect(new DecisionMemory("local", "ws").current()).toHaveLength(1);
    expect(new DecisionMemory("local", "other").current()).toHaveLength(0);
  });

  it("filters by metric", () => {
    const memory = new DecisionMemory("local", "ws");
    memory.remember(entry("headline", { metric: "add_to_cart" }));
    memory.remember(entry("button"));

    expect(memory.current("purchase").map((e) => e.loop)).toEqual(["button"]);
  });

  it("forgets a decision once its window closes", () => {
    vi.useFakeTimers();
    const memory = new DecisionMemory("local", "ws");
    memory.remember(entry("headline", { expiresAt: Date.now() + 1_000 }));
    memory.remember(entry("button", { expiresAt: Date.now() + 5_000 }));

    vi.advanceTimersByTime(2_000);

    expect(memory.current().map((e) => e.loop)).toEqual(["button"]);
    expect(store.items.size).toBe(1);
  });

  it("keeps at most 50, dropping the oldest", () => {
    const memory = new DecisionMemory("local", "ws");
    for (let i = 0; i < 52; i++) memory.remember(entry(`loop-${i}`));

    const loops = memory.current().map((e) => e.loop);
    expect(loops).toHaveLength(50);
    expect(loops[0]).toBe("loop-2");
  });

  it("writes nothing to the device with memory storage", () => {
    const memory = new DecisionMemory("memory", "ws");
    memory.remember(entry("headline"));

    expect(memory.current()).toHaveLength(1);
    expect(store.items.size).toBe(0);
  });

  it("remembers nothing with none", () => {
    const memory = new DecisionMemory("none", "ws");
    memory.remember(entry("headline"));

    expect(memory.current()).toEqual([]);
  });

  it("moves to the device once switched to local, and off it once switched back", () => {
    const memory = new DecisionMemory("memory", "ws");
    memory.remember(entry("headline"));

    memory.use("local");
    expect(store.items.size).toBe(1);
    expect(new DecisionMemory("local", "ws").current()).toHaveLength(1);

    memory.use("memory");
    expect(store.items.size).toBe(0);
    expect(memory.current()).toHaveLength(1);
  });

  it("falls back to memory when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    });
    const memory = new DecisionMemory("local", "ws");

    expect(() => memory.remember(entry("headline"))).not.toThrow();
    expect(memory.current()).toHaveLength(1);
  });

  it("falls back to memory when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    const memory = new DecisionMemory("local", "ws");
    memory.remember(entry("headline"));

    expect(memory.current()).toHaveLength(1);
  });

  it("ignores a corrupted entry", () => {
    const memory = new DecisionMemory("local", "ws");
    memory.remember(entry("headline"));
    const [key] = [...store.items.keys()];
    store.setItem(key as string, "{not json");

    expect(memory.current()).toEqual([]);
  });
});
