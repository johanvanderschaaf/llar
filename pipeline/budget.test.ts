import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBudget, withDeadline, withTiming } from "./budget";
import { ok, type AdapterResult } from "@/adapters/types";

describe("createBudget", () => {
  it("counts time from creation and never goes negative", () => {
    let t = 1_000;
    const b = createBudget(() => t);
    expect(b.elapsed()).toBe(0);
    t = 11_000;
    expect(b.elapsed()).toBe(10_000);
    expect(b.until(45_000)).toBe(35_000);
    t = 60_000;
    expect(b.until(45_000)).toBe(0);
  });
});

describe("withDeadline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("passes a result through when it arrives in time", async () => {
    const r = await withDeadline("flood", Promise.resolve(ok("flood", 42)), 1_000);
    expect(r.status).toBe("ok");
    expect(r.data).toBe(42);
  });

  it("returns a failed result when the source hangs", async () => {
    const hang = new Promise<AdapterResult<number>>(() => {});
    const p = withDeadline("amenities", hang, 8_000);
    await vi.advanceTimersByTimeAsync(8_000);
    const r = await p;
    expect(r.status).toBe("error");
    expect(r.toVerify).toBe(true);
    expect(r.source).toBe("amenities");
    expect(r.note).toMatch(/Timed out after 8s/);
  });

  it("turns an adapter that throws into a failed result", async () => {
    const boom = Promise.reject(new Error("socket hang up"));
    const r = await withDeadline("heritage", boom, 1_000);
    expect(r.status).toBe("error");
    expect(r.note).toMatch(/socket hang up/);
  });
});

describe("withTiming", () => {
  it("appends the duration to the note", () => {
    expect(withTiming(ok("ipv", 1, { note: "from cache" }), 1_234).note).toBe(
      "from cache [1.2s]",
    );
    expect(withTiming(ok("ipv", 1), 500).note).toBe("[0.5s]");
  });
});
