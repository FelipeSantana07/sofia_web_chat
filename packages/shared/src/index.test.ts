import { describe, expect, it } from "vitest";
import { PROJETO } from "./index.js";

describe("shared", () => {
  it("exporta o nome do projeto", () => {
    expect(PROJETO).toBe("sofia-web-chat");
  });
});
