import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { requestLogger } from "./requestLogger";
import { logger } from "../logger";
import type { Request, Response } from "express";

describe("requestLogger", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const loggerInfoSpy = vi.spyOn(logger, "info").mockImplementation(() => logger);

  beforeEach(() => {
    loggerInfoSpy.mockClear();
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("should not log Authorization headers", () => {
    const authHeader = "Bearer secret-token";
    const req = {
      method: "POST",
      originalUrl: "/api/streams",
      headers: {
        authorization: authHeader,
      },
    } as unknown as Request;

    const res = new EventEmitter() as Response;
    (res as any).statusCode = 201;

    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();

    res.emit("finish");

    expect(loggerInfoSpy).toHaveBeenCalledTimes(1);
    const logPayload = loggerInfoSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(logPayload).toMatchObject({
      method: "POST",
      route: "/api/streams",
      statusCode: 201,
    });
    expect(JSON.stringify(logPayload)).not.toContain(authHeader);
    expect(JSON.stringify(logPayload).toLowerCase()).not.toContain("authorization");
  });

  it("should set X-Request-ID response header", () => {
    const req = {
      method: "GET",
      originalUrl: "/api/streams",
      headers: {},
    } as unknown as Request;

    const res = new EventEmitter() as Response;
    (res as any).statusCode = 200;
    (res as any).setHeader = vi.fn();

    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((res as any).setHeader).toHaveBeenCalledWith("X-Request-ID", expect.any(String));
    expect(req.requestId).toBeDefined();
  });

  it("should use existing X-Request-ID from headers", () => {
    const existingRequestId = "existing-request-id-123";
    const req = {
      method: "GET",
      originalUrl: "/api/streams",
      headers: {
        "x-request-id": existingRequestId,
      },
    } as unknown as Request;

    const res = new EventEmitter() as Response;
    (res as any).statusCode = 200;
    (res as any).setHeader = vi.fn();

    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((res as any).setHeader).toHaveBeenCalledWith("X-Request-ID", existingRequestId);
    expect(req.requestId).toBe(existingRequestId);
  });

  it("should generate new UUID for invalid request ID format", () => {
    const invalidRequestId = "invalid@id#with!special";
    const req = {
      method: "GET",
      originalUrl: "/api/streams",
      headers: {
        "x-request-id": invalidRequestId,
      },
    } as unknown as Request;

    const res = new EventEmitter() as Response;
    (res as any).statusCode = 200;
    (res as any).setHeader = vi.fn();

    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.requestId).toBeDefined();
    expect(req.requestId).not.toBe(invalidRequestId);
    // Should be a valid UUID format
    expect(req.requestId).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("should handle array of request IDs by using first value", () => {
    const req = {
      method: "GET",
      originalUrl: "/api/streams",
      headers: {
        "x-request-id": ["first-id", "second-id"],
      },
    } as unknown as Request;

    const res = new EventEmitter() as Response;
    (res as any).statusCode = 200;
    (res as any).setHeader = vi.fn();

    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((res as any).setHeader).toHaveBeenCalledWith("X-Request-ID", "first-id");
    expect(req.requestId).toBe("first-id");
  });
});
