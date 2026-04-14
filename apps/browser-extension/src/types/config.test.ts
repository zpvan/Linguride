import { describe, expect, it } from "vitest";

import {
  MINIMAX_AI_API_BASE_URL,
  resolveConfigApiProvider,
} from "./config";

describe("resolveConfigApiProvider", () => {
  it("accepts minimax explicitly", () => {
    expect(
      resolveConfigApiProvider({
        api_provider: "minimax",
        api_base_url: "https://example.invalid",
      })
    ).toBe("minimax");
  });

  it("infers minimax from the api base url with a trailing slash", () => {
    expect(
      resolveConfigApiProvider({
        api_base_url: `${MINIMAX_AI_API_BASE_URL}/`,
      })
    ).toBe("minimax");
  });
});
