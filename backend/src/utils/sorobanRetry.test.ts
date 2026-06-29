import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { retryWithBackoff, SorobanSubmitError } from "./sorobanRetry";
import { logger } from "../logger";

function makeError(message: string, status?: number): Error {
  return Object.assign(new Error(message), status !== undefined ? { status } : {});
}

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result on first attempt without retrying", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and succeeds on second attempt", async () => {
    const err = makeError("Service Unavailable", 503);
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 504 and succeeds on second attempt", async () => {
    const err = makeError("Gateway Timeout", 504);
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on ECONNREFUSED network error and succeeds", async () => {
    const err = makeError("connect ECONNREFUSED 127.0.0.1:443");
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("data");

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on ECONNRESET network error", async () => {
    const err = makeError("socket hang up ECONNRESET");
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("data");

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on timeout error", async () => {
    const err = makeError("request timeout");
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("data");

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe("data");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400 error", async () => {
    const err = makeError("Bad Request", 400);
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retryWithBackoff(fn)).rejects.toThrow("Bad Request");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 401 error", async () => {
    const err = makeError("Unauthorized", 401);
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retryWithBackoff(fn)).rejects.toThrow("Unauthorized");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 422 error", async () => {
    const err = makeError("Unprocessable Entity", 422);
    const fn = vi.fn().mockRejectedValue(err);

    await expect(retryWithBackoff(fn)).rejects.toThrow("Unprocessable Entity");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("applies exponential delays: 1s then 2s then 4s between attempts", async () => {
    const err = makeError("Service Unavailable", 503);
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");

    const promise = retryWithBackoff(fn);

    // Initial attempt fires immediately, then 1s delay
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // After 2s more (3s total): 3rd attempt
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    // After 4s more (7s total): 4th attempt
    await vi.advanceTimersByTimeAsync(4000);
    await promise;
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("does not retry before the delay elapses", async () => {
    const err = makeError("Service Unavailable", 503);
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");

    const promise = retryWithBackoff(fn);

    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(500);
    await promise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("logs at warn level on each retry with attempt number", async () => {
    const err = makeError("Service Unavailable", 503);
    const fn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");

    const promise = retryWithBackoff(fn);
    await vi.advanceTimersByTimeAsync(3000);
    await promise;

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect((logger.warn as any).mock.calls[0][0]).toMatchObject({ attempt: 1 });
    expect((logger.warn as any).mock.calls[0][1]).toContain("attempt 1");
    expect((logger.warn as any).mock.calls[1][0]).toMatchObject({ attempt: 2 });
    expect((logger.warn as any).mock.calls[1][1]).toContain("attempt 2");
  });

  it("throws SorobanSubmitError after exhausting all retries", async () => {
    const err = makeError("Service Unavailable", 503);
    const fn = vi.fn().mockRejectedValue(err);

    const promise = retryWithBackoff(fn);
    await Promise.all([
      expect(promise).rejects.toBeInstanceOf(SorobanSubmitError),
      vi.advanceTimersByTimeAsync(7000),
    ]);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("SorobanSubmitError includes statusCode and retryAfter suggestion", async () => {
    const err = makeError("Service Unavailable", 503);
    const fn = vi.fn().mockRejectedValue(err);

    const promise = retryWithBackoff(fn);
    let caughtError!: SorobanSubmitError;
    await Promise.all([
      promise.catch((e) => { caughtError = e as SorobanSubmitError; }),
      vi.advanceTimersByTimeAsync(7000),
    ]);

    expect(caughtError).toBeInstanceOf(SorobanSubmitError);
    expect(caughtError.statusCode).toBe(503);
    expect(caughtError.retryAfter).toBe(10);
    expect(caughtError.message).toContain("3 retries");
  });

  it("SorobanSubmitError includes retryAfter for network error with no HTTP status", async () => {
    const err = makeError("fetch failed");
    const fn = vi.fn().mockRejectedValue(err);

    const promise = retryWithBackoff(fn);
    let caughtError!: SorobanSubmitError;
    await Promise.all([
      promise.catch((e) => { caughtError = e as SorobanSubmitError; }),
      vi.advanceTimersByTimeAsync(7000),
    ]);

    expect(caughtError).toBeInstanceOf(SorobanSubmitError);
    expect(caughtError.retryAfter).toBe(10);
    expect(caughtError.statusCode).toBeUndefined();
  });
});
