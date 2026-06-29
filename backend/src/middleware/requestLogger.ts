import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { logger } from "../logger";

declare global {
  namespace Express {
    interface Request {
      requestId?: string; // Unique ID for log correlation
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  // Validate and normalize x-request-id header
  let requestId: string;
  const headerValue = req.headers["x-request-id"];

  if (Array.isArray(headerValue)) {
    // Use the first value if multiple headers are sent
    requestId = headerValue[0];
  } else if (typeof headerValue === "string") {
    requestId = headerValue;
  } else {
    requestId = crypto.randomUUID();
  }

  // Validate format: should be a UUID-like string, max 128 chars, alphanumeric + hyphens
  const isValidId = /^[a-zA-Z0-9-]{1,128}$/.test(requestId);
  if (!isValidId) {
    requestId = crypto.randomUUID();
  }

  req.requestId = requestId;

  const requestLogger = logger.child({ requestId });

  const start = Date.now();

  res.setHeader("X-Request-ID", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - start;

    const logEntry = {
      requestId,
      method: req.method,
      route: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };

    const message = "request completed";
    if (res.statusCode >= 500) {
      requestLogger.error(logEntry, message);
    } else if (res.statusCode >= 400) {
      requestLogger.warn(logEntry, message);
    } else {
      requestLogger.info(logEntry, message);
    }
  });

  next();
}
