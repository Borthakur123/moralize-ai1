import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;
  const meta = (auth?.sessionClaims?.public_metadata ?? {}) as Record<string, unknown>;
  req.isAdmin = meta?.role === "admin";

  next();
};
