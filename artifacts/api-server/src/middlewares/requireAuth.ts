import { getAuth, clerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const auth = getAuth(req);
  const userId = auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.userId = userId;

  const meta = (auth?.sessionClaims?.public_metadata ?? {}) as Record<string, unknown>;
  let isAdmin = meta?.role === "admin";

  if (!isAdmin && ADMIN_EMAILS.length > 0) {
    try {
      const user = await clerkClient.users.getUser(userId);
      const primaryEmail = user.emailAddresses.find(
        (e) => e.id === user.primaryEmailAddressId
      )?.emailAddress ?? "";
      isAdmin = ADMIN_EMAILS.includes(primaryEmail.toLowerCase());
    } catch {
      // If user lookup fails, fall back to metadata-only check
    }
  }

  req.isAdmin = isAdmin;
  next();
};
