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
});
