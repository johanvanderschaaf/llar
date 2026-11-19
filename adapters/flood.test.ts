import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFlood } from "./flood";

const OUTSIDE = JSON.stringify({ features: [{ properties: { GRAY_INDEX: 999 } }] });
const INSIDE = JSON.stringify({ features: [{ properties: { GRAY_INDEX: 1 } }] });
const BCN = { lat: 41.4, lon: 2.16 };

afterEach(() => vi.unstubAllGlobals());

describe("fetchFlood", () => {
  it("retries the intermittent SNCZI 503s instead of losing the check", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        // Every layer's first attempt fails, like the live service often does.
        return calls <= 3 ? new Response("", { status: 503 }) : new Response(OUTSIDE);
      }),
    );
    const r = await fetchFlood(BCN);
    expect(r.status).toBe("ok");
    expect(r.data?.level).toBe("low");
  });

  it("reports an error after repeated failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));
    const r = await fetchFlood(BCN);
    expect(r.status).toBe("error");
    expect(r.note).toMatch(/503 \(after retries\)/);
  });

  it("does not retry a client error", async () => {
    const f = vi.fn(async () => new Response("", { status: 400 }));
    vi.stubGlobal("fetch", f);
    await fetchFlood(BCN);
    expect(f).toHaveBeenCalledTimes(3); // one per layer, no retries
  });

  it("classifies a T10 zone as high", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(INSIDE)));
    expect((await fetchFlood(BCN)).data?.level).toBe("high");
  });
});
