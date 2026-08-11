import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set");
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  tokenVersion: number;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET as string) as JwtPayload;
}

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

/** Async because a "kick" (or ban) needs to take effect immediately, not just at next login —
 * that requires a DB check on every request rather than trusting the JWT's own signature alone.
 * A tokenVersion mismatch means this token was issued before an admin kicked the user; an
 * active ban is checked here too, closing the same gap (a banned user's already-issued token
 * kept working for every API call until it naturally expired, up to 30 days). */
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true, bannedAt: true },
  });
  if (!user || user.tokenVersion !== payload.tokenVersion) {
    res.status(401).json({ error: "Session no longer valid — please log in again" });
    return;
  }
  if (user.bannedAt) {
    res.status(403).json({ error: "This account has been banned." });
    return;
  }

  req.user = payload;
  next();
}

/** Must run after requireAuth. Role is baked into the JWT at login time — a freshly
 * promoted admin needs to log out/in again before this passes. */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}
