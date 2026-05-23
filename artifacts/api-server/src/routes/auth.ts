import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { db, usersTable, refreshTokensTable, passwordResetTokensTable, tradieProfilesTable } from "@workspace/db";
import {
  SignupBody,
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "@workspace/api-zod";
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  hashToken,
  storeRefreshToken,
  rotateRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  generateSlug,
  verifyAccessToken,
} from "../lib/auth";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, role, acceptedTerms, acceptedPrivacy } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();

  const [user] = await db.insert(usersTable).values({
    email,
    passwordHash,
    role: role as "TRADIE" | "CUSTOMER",
    acceptedTermsAt: acceptedTerms ? now : undefined,
    acceptedPrivacyAt: acceptedPrivacy ? now : undefined,
  }).returning();

  // Create tradie profile stub if tradie
  let tradieProfileId: string | null = null;
  let tradieSlug: string | null = null;
  if (role === "TRADIE") {
    const slug = await generateSlug(email.split("@")[0]);
    const [profile] = await db.insert(tradieProfilesTable).values({
      userId: user.id,
      slug,
    }).returning();
    tradieProfileId = profile.id;
    tradieSlug = profile.slug;
  }

  const familyId = crypto.randomUUID();
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, familyId });
  await storeRefreshToken(user.id, refreshToken, familyId);
  setAuthCookies(res, accessToken, refreshToken);

  res.status(201).json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      tradieProfileId,
      tradieSlug,
      onboardingComplete: false,
    },
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !(await comparePassword(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (user.deletedAt) {
    res.status(401).json({ error: "Account deleted" });
    return;
  }

  let tradieProfileId: string | null = null;
  let tradieSlug: string | null = null;
  let onboardingComplete = false;

  if (user.role === "TRADIE") {
    const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, user.id));
    if (profile) {
      tradieProfileId = profile.id;
      tradieSlug = profile.slug;
      onboardingComplete = profile.paymentConfirmed;
    }
  }

  const familyId = crypto.randomUUID();
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role, familyId });
  await storeRefreshToken(user.id, refreshToken, familyId);
  setAuthCookies(res, accessToken, refreshToken);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      tradieProfileId,
      tradieSlug,
      onboardingComplete,
    },
  });
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const token = req.cookies?.refresh_token;
  if (token) {
    const hash = hashToken(token);
    await db.update(refreshTokensTable).set({ revokedAt: new Date() }).where(eq(refreshTokensTable.tokenHash, hash));
  }
  clearAuthCookies(res);
  res.sendStatus(204);
});

router.post("/auth/refresh", async (req, res): Promise<void> => {
  const token = req.cookies?.refresh_token;
  if (!token) {
    res.status(401).json({ error: "No refresh token" });
    return;
  }

  const result = await rotateRefreshToken(token);
  if (!result) {
    clearAuthCookies(res);
    res.status(401).json({ error: "Invalid or expired refresh token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, result.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  let tradieProfileId: string | null = null;
  let tradieSlug: string | null = null;
  let onboardingComplete = false;

  if (user.role === "TRADIE") {
    const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, user.id));
    if (profile) {
      tradieProfileId = profile.id;
      tradieSlug = profile.slug;
      onboardingComplete = profile.paymentConfirmed;
    }
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  setAuthCookies(res, accessToken, result.newRefreshToken);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      tradieProfileId,
      tradieSlug,
      onboardingComplete,
    },
  });
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await db.insert(passwordResetTokensTable).values({ userId: user.id, tokenHash, expiresAt });
    req.log.info({ email: parsed.data.email }, "Password reset token generated");
    // In prod: send email with rawToken
  }

  res.json({ message: "If that email exists, a reset link has been sent." });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.tokenHash, tokenHash));

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    res.status(400).json({ error: "Invalid or expired reset token" });
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, resetToken.userId));
  await db.update(passwordResetTokensTable).set({ usedAt: new Date() }).where(eq(passwordResetTokensTable.id, resetToken.id));

  res.json({ message: "Password reset successfully" });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  let tradieProfileId: string | null = null;
  let tradieSlug: string | null = null;
  let onboardingComplete = false;

  if (user.role === "TRADIE") {
    const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, user.id));
    if (profile) {
      tradieProfileId = profile.id;
      tradieSlug = profile.slug;
      onboardingComplete = profile.paymentConfirmed;
    }
  }

  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      tradieProfileId,
      tradieSlug,
      onboardingComplete,
    },
  });
});

export default router;
