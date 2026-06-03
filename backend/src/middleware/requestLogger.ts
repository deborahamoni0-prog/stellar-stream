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
  const requestId = crypto.randomUUID();
  req.requestId = requestId;

  const start = Date.now();

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
      logger.error(logEntry, message);
    } else if (res.statusCode >= 400) {
      logger.warn(logEntry, message);
    } else {
      logger.info(logEntry, message);
    }
  });

  next();
}
