import { randomBytes, createHash } from "crypto";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { comparePassword, hashPassword, requireAuth, signToken, type AuthedRequest } from "../lib/auth";
import { sendNotificationEmail } from "../lib/email";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes — within the 15-60 minute spec range

function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function publicAppUrl(): string {
  return process.env.PUBLIC_APP_URL ?? process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
}

authRouter.post("/signup", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email, passwordHash } });

  const token = signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion });
  res.status(201).json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (user.bannedAt) {
    return res.status(403).json({ error: "This account has been banned." });
  }
  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: user.tokenVersion });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

/** Always responds with the same generic message regardless of whether the email is
 * registered — a differing response (404 vs 200, different copy, timing) would leak account
 * existence to anyone probing emails, which is exactly what this endpoint must not do. */
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body ?? {};
  const GENERIC_RESPONSE = { message: "If an account exists for that email, we've sent a password reset link." };

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    // Still generic — an invalid email format reveals nothing an attacker doesn't already know.
    return res.json(GENERIC_RESPONSE);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.bannedAt) {
    const rawToken = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(rawToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${publicAppUrl()}/reset-password?token=${rawToken}`;
    await sendNotificationEmail(
      user.email,
      "Reset your Cue password",
      `Someone requested a password reset for your Cue account. This link expires in 30 minutes and can only be used once:\n\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    );
    // RESEND_API_KEY is unset, so the send above silently no-op'd (see lib/email.ts) — log the
    // link server-side so the flow is still usable/testable without live email infra configured.
    if (!process.env.RESEND_API_KEY) {
      console.log(`[forgot-password] RESEND_API_KEY not set — reset link for ${user.email}: ${resetUrl}`);
    }
  }

  res.json(GENERIC_RESPONSE);
});

authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body ?? {};
  if (typeof token !== "string" || !token) {
    return res.status(400).json({ error: "Reset token is required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired. Request a new one." });
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
  ]);

  res.json({ message: "Password updated. You can now log in with your new password." });
});

/** In-account change, distinct from the forgot-password email flow — requires proving you
 * already know the current password rather than proving ownership of the inbox. */
authRouter.post("/change-password", requireAuth, async (req: AuthedRequest, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Current and new password are required" });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters" });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ message: "Password updated." });
});
