import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db, usersTable, refreshTokensTable, tradieProfilesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "./logger";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "access-secret-dev";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "refresh-secret-dev";

export interface TokenPayload {
  userId: string;
  role: string;
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}

export function signRefreshToken(payload: TokenPayload & { familyId: string }): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "30d" });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload & { familyId: string } {
  return jwt.verify(token, REFRESH_SECRET) as TokenPayload & { familyId: string };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function generateSlug(displayName: string): Promise<string> {
  const base = displayName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

  const [existing] = await db
    .select({ slug: tradieProfilesTable.slug })
    .from(tradieProfilesTable)
    .where(eq(tradieProfilesTable.slug, base));

  if (!existing) return base;

  const suffix = crypto.randomBytes(2).toString("hex");
  return `${base}-${suffix}`;
}

export async function storeRefreshToken(
  userId: string,
  token: string,
  familyId: string,
): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(refreshTokensTable).values({ userId, tokenHash, familyId, expiresAt });
}

export async function rotateRefreshToken(
  oldToken: string,
): Promise<{ userId: string; role: string; newRefreshToken: string; familyId: string } | null> {
  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(oldToken);
  } catch {
    return null;
  }

  const oldHash = hashToken(oldToken);
  const [stored] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.tokenHash, oldHash));

  if (!stored) {
    // Token not found — possibly reuse attack, revoke family
    logger.warn({ familyId: payload.familyId }, "Refresh token reuse detected — revoking family");
    await db
      .update(refreshTokensTable)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokensTable.familyId, payload.familyId));
    return null;
  }

  if (stored.revokedAt || stored.expiresAt < new Date()) {
    return null;
  }

  // Revoke old token
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokensTable.id, stored.id));

  // Issue new token
  const newRefreshToken = jwt.sign(
    { userId: payload.userId, role: payload.role, familyId: payload.familyId },
    REFRESH_SECRET,
    { expiresIn: "30d" },
  );

  await storeRefreshToken(payload.userId, newRefreshToken, payload.familyId);

  return { userId: payload.userId, role: payload.role, newRefreshToken, familyId: payload.familyId };
}

export function setAuthCookies(
  res: import("express").Response,
  accessToken: string,
  refreshToken: string,
): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookies(res: import("express").Response): void {
  res.clearCookie("access_token");
  res.clearCookie("refresh_token", { path: "/api/auth" });
}
