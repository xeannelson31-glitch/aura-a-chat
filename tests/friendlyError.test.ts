import { describe, it, expect } from "vitest";
import { friendlyError } from "@/lib/friendlyError";

describe("friendlyError", () => {
  it("maps 429 to rate-limit message", () => {
    expect(friendlyError(new Error("nope"), 429)).toMatch(/too fast/i);
  });

  it("maps 402 to credits-exhausted message", () => {
    expect(friendlyError(new Error("nope"), 402)).toMatch(/credits/i);
  });

  it("maps 401/403 to authorization message", () => {
    expect(friendlyError(new Error("x"), 401)).toMatch(/not authorized/i);
    expect(friendlyError(new Error("x"), 403)).toMatch(/not authorized/i);
  });

  it("maps 5xx to a generic service unavailable message", () => {
    expect(friendlyError(new Error("x"), 500)).toMatch(/temporarily unavailable/i);
    expect(friendlyError(new Error("x"), 503)).toMatch(/temporarily unavailable/i);
  });

  it("maps 408/504 to timeout message", () => {
    expect(friendlyError(new Error("x"), 408)).toMatch(/took too long/i);
    expect(friendlyError(new Error("x"), 504)).toMatch(/took too long/i);
  });

  it("recognizes AbortError", () => {
    const err = new Error("aborted");
    err.name = "AbortError";
    expect(friendlyError(err)).toMatch(/stopped/i);
  });

  it("maps TypeError to network message", () => {
    expect(friendlyError(new TypeError("fetch failed"))).toMatch(/network/i);
  });

  it("falls back to the error message when no status matches", () => {
    expect(friendlyError(new Error("custom failure"))).toBe("custom failure");
  });

  it("has a sensible fallback for unknown values", () => {
    expect(friendlyError("weird")).toMatch(/went wrong/i);
  });
});
