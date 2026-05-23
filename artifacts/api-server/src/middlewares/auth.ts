import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/auth";

export interface AuthRequest extends Request {
  user?: { userId: string; role: string };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token;
  if (!token) {
    res.status(401).json({ error: "Unauthenticated" });
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.access_token;
  if (token) {
    try {
      req.user = verifyAccessToken(token);
    } catch {
      // ignore
    }
  }
  next();
}
