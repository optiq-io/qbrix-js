import { describe, expect, it } from "vitest";
import { QbrixClient } from "../src/index";

describe("scaffold smoke", () => {
  it("constructs a client and stores options", () => {
    const client = new QbrixClient({ apiKey: "optiq_test" });
    expect(client).toBeInstanceOf(QbrixClient);
    expect(client.options.apiKey).toBe("optiq_test");
  });

  it("defaults options to an empty object", () => {
    const client = new QbrixClient();
    expect(client.options).toEqual({});
  });
});
