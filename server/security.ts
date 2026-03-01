import type { Request, Response, NextFunction, RequestHandler } from "express";

type KeyGenerator = (req: Request) => string;

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: KeyGenerator;
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

function getClientIp(req: Request): string {
  const header = req.headers["x-forwarded-for"];
  const first = Array.isArray(header) ? header[0] : header;
  if (typeof first === "string" && first.length > 0) {
    return first.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();
  const windowMs = Math.max(1000, options.windowMs);
  const max = Math.max(1, options.max);
  const keyGenerator = options.keyGenerator || ((req: Request) => getClientIp(req));

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.min(windowMs, 60_000)).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyGenerator(req);

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", String(max - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + windowMs) / 1000)));
      return next();
    }

    if (existing.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.setHeader("X-RateLimit-Limit", String(max));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(existing.resetAt / 1000)));
      return res.status(429).json({
        error: options.message || "Too many requests. Please try again later.",
      });
    }

    existing.count += 1;
    buckets.set(key, existing);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - existing.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(existing.resetAt / 1000)));
    next();
  };
}
