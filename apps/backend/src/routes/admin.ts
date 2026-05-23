import { Router, type IRouter } from "express";
import { eq, and, isNull, desc, sql, gte, count } from "drizzle-orm";
import {
  db,
  tradieProfilesTable,
  tradieLicencesTable,
  usersTable,
  jobsTable,
  reviewsTable,
  disputesTable,
  portfolioImagesTable,
  adminVerificationLogsTable,
} from "@workspace/db";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { checkAndUpdateLiveStatus, formatProfileResponse, formatLicenceResponse } from "./tradies";

const router: IRouter = Router();

// ──────────── Dashboard ────────────

router.get("/admin/dashboard", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const activeTradies = await db.select({ id: tradieProfilesTable.id }).from(tradieProfilesTable)
    .where(and(eq(tradieProfilesTable.isLive, true), isNull(tradieProfilesTable.deletedAt)));

  const pendingVerifications = await db.select({ id: tradieLicencesTable.id }).from(tradieLicencesTable)
    .where(eq(tradieLicencesTable.verificationStatus, "PENDING"));

  const pendingIdentity = await db.select({ id: tradieProfilesTable.id }).from(tradieProfilesTable)
    .where(eq(tradieProfilesTable.identityStatus, "PENDING"));

  const expiredLicences = await db.select({ id: tradieLicencesTable.id }).from(tradieLicencesTable)
    .where(eq(tradieLicencesTable.verificationStatus, "EXPIRED"));

  const openDisputes = await db.select({ id: disputesTable.id }).from(disputesTable)
    .where(eq(disputesTable.status, "OPEN"));

  const recentJobs = await db.select({ id: jobsTable.id }).from(jobsTable)
    .where(gte(jobsTable.createdAt, thirtyDaysAgo));

  const recentTradies = await db.select({ id: tradieProfilesTable.id }).from(tradieProfilesTable)
    .where(gte(tradieProfilesTable.createdAt, thirtyDaysAgo));

  // MRR estimate: active tradies * $49 (simplified)
  const mrr = activeTradies.length * 49;

  res.json({
    mrr,
    activeTradies: activeTradies.length,
    pendingVerifications: pendingVerifications.length + pendingIdentity.length,
    expiredLicences: expiredLicences.length,
    expiredInsurance: 0,
    openDisputes: openDisputes.length,
    jobsLast30d: recentJobs.length,
    tradiesLast30d: recentTradies.length,
  });
});

// ──────────── Licence Verifications ────────────

router.get("/admin/verifications", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  let licences = await db.select({
    licence: tradieLicencesTable,
    profile: tradieProfilesTable,
  }).from(tradieLicencesTable)
    .innerJoin(tradieProfilesTable, eq(tradieLicencesTable.tradieId, tradieProfilesTable.id))
    .orderBy(desc(tradieLicencesTable.createdAt));

  if (status) {
    licences = licences.filter(l => l.licence.verificationStatus === status);
  }

  res.json(licences.map(({ licence: l, profile: p }) => ({
    licenceId: l.id,
    tradieId: p.id,
    tradieName: p.displayName || p.legalName,
    trade: l.trade,
    licenceClass: l.licenceClass,
    licenceNumber: l.licenceNumber,
    issuingState: l.issuingState,
    issuingAuthority: l.issuingAuthority,
    documentUrl: l.documentUrl,
    status: l.verificationStatus,
    submittedAt: l.createdAt.toISOString(),
  })));
});

router.post("/admin/verifications/:licenceId/approve", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const licenceId = Array.isArray(req.params.licenceId) ? req.params.licenceId[0] : req.params.licenceId;

  const [updated] = await db.update(tradieLicencesTable).set({
    verificationStatus: "VERIFIED",
    verifiedAt: new Date(),
    verifiedByAdminId: req.user!.userId,
    rejectionReason: null,
    updatedAt: new Date(),
  }).where(eq(tradieLicencesTable.id, licenceId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Licence not found" });
    return;
  }

  await db.insert(adminVerificationLogsTable).values({ licenceId, tradieId: updated.tradieId, adminId: req.user!.userId, action: "APPROVED" });
  await checkAndUpdateLiveStatus(updated.tradieId);

  res.json(formatLicenceResponse(updated));
});

router.post("/admin/verifications/:licenceId/reject", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const licenceId = Array.isArray(req.params.licenceId) ? req.params.licenceId[0] : req.params.licenceId;
  const { reason } = req.body as { reason: string };

  const [updated] = await db.update(tradieLicencesTable).set({
    verificationStatus: "REJECTED",
    rejectionReason: reason,
    updatedAt: new Date(),
  }).where(eq(tradieLicencesTable.id, licenceId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Licence not found" });
    return;
  }

  await db.insert(adminVerificationLogsTable).values({ licenceId, tradieId: updated.tradieId, adminId: req.user!.userId, action: "REJECTED", note: reason });

  res.json(formatLicenceResponse(updated));
});

// ──────────── Identity Verifications ────────────

router.get("/admin/identity", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  let profiles = await db.select().from(tradieProfilesTable)
    .where(isNull(tradieProfilesTable.deletedAt))
    .orderBy(desc(tradieProfilesTable.createdAt));

  if (status) {
    profiles = profiles.filter(p => p.identityStatus === status);
  } else {
    profiles = profiles.filter(p => p.identityStatus === "PENDING");
  }

  res.json(profiles.map(p => ({
    tradieId: p.id,
    tradieName: p.displayName || p.legalName,
    identityDocUrl: p.identityDocUrl,
    identityStatus: p.identityStatus,
    submittedAt: p.createdAt.toISOString(),
  })));
});

router.post("/admin/identity/:tradieId/approve", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const tradieId = Array.isArray(req.params.tradieId) ? req.params.tradieId[0] : req.params.tradieId;

  const [updated] = await db.update(tradieProfilesTable).set({
    identityStatus: "VERIFIED",
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, tradieId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Tradie not found" });
    return;
  }

  await db.insert(adminVerificationLogsTable).values({ tradieId, adminId: req.user!.userId, action: "IDENTITY_APPROVED" });
  await checkAndUpdateLiveStatus(tradieId);

  res.json(formatProfileResponse(updated));
});

router.post("/admin/identity/:tradieId/reject", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const tradieId = Array.isArray(req.params.tradieId) ? req.params.tradieId[0] : req.params.tradieId;
  const { reason } = req.body as { reason: string };

  const [updated] = await db.update(tradieProfilesTable).set({
    identityStatus: "REJECTED",
    identityRejectionReason: reason,
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, tradieId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Tradie not found" });
    return;
  }

  res.json(formatProfileResponse(updated));
});

// ──────────── Insurance Verifications ────────────

router.get("/admin/insurance", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  let profiles = await db.select().from(tradieProfilesTable)
    .where(and(isNull(tradieProfilesTable.deletedAt), eq(tradieProfilesTable.optedOutOfInsurance, false)))
    .orderBy(desc(tradieProfilesTable.createdAt));

  if (status) {
    profiles = profiles.filter(p => p.insuranceStatus === status);
  } else {
    profiles = profiles.filter(p => p.insuranceStatus === "PENDING" && p.insuranceCertUrl != null);
  }

  res.json(profiles.map(p => ({
    tradieId: p.id,
    tradieName: p.displayName || p.legalName,
    insurer: p.insuranceInsurer,
    coverAud: p.insuranceCoverAud,
    expiry: p.insuranceExpiry?.toISOString() ?? null,
    certUrl: p.insuranceCertUrl,
    insuranceStatus: p.insuranceStatus,
    submittedAt: p.createdAt.toISOString(),
  })));
});

router.post("/admin/insurance/:tradieId/approve", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const tradieId = Array.isArray(req.params.tradieId) ? req.params.tradieId[0] : req.params.tradieId;

  const [updated] = await db.update(tradieProfilesTable).set({
    insuranceStatus: "VERIFIED",
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, tradieId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Tradie not found" });
    return;
  }

  await db.insert(adminVerificationLogsTable).values({ tradieId, adminId: req.user!.userId, action: "INSURANCE_APPROVED" });
  await checkAndUpdateLiveStatus(tradieId);

  res.json(formatProfileResponse(updated));
});

router.post("/admin/insurance/:tradieId/reject", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const tradieId = Array.isArray(req.params.tradieId) ? req.params.tradieId[0] : req.params.tradieId;
  const { reason } = req.body as { reason: string };

  const [updated] = await db.update(tradieProfilesTable).set({
    insuranceStatus: "REJECTED",
    insuranceRejectionReason: reason,
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, tradieId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Tradie not found" });
    return;
  }

  res.json(formatProfileResponse(updated));
});

// ──────────── Tradie Management ────────────

router.get("/admin/tradies", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const { search } = req.query as { search?: string };

  const profiles = await db.select({
    profile: tradieProfilesTable,
    user: { email: usersTable.email },
  }).from(tradieProfilesTable)
    .innerJoin(usersTable, eq(tradieProfilesTable.userId, usersTable.id))
    .where(isNull(tradieProfilesTable.deletedAt))
    .orderBy(desc(tradieProfilesTable.createdAt));

  let results = profiles;
  if (search) {
    const s = search.toLowerCase();
    results = profiles.filter(({ profile: p, user: u }) =>
      p.displayName.toLowerCase().includes(s) ||
      p.legalName.toLowerCase().includes(s) ||
      u.email.toLowerCase().includes(s)
    );
  }

  res.json(results.map(({ profile: p, user: u }) => ({
    id: p.id,
    slug: p.slug,
    displayName: p.displayName || p.legalName,
    email: u.email,
    trades: p.trades,
    homeState: p.homeState,
    isLive: p.isLive,
    identityStatus: p.identityStatus,
    insuranceStatus: p.insuranceStatus,
    subscriptionStatus: p.subscriptionStatus,
    suspendedAt: p.suspendedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  })));
});

router.post("/admin/tradies/:tradieId/suspend", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const tradieId = Array.isArray(req.params.tradieId) ? req.params.tradieId[0] : req.params.tradieId;
  const { reason } = req.body as { reason: string };

  const [updated] = await db.update(tradieProfilesTable).set({
    suspendedAt: new Date(),
    suspendedReason: reason,
    isLive: false,
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, tradieId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Tradie not found" });
    return;
  }

  await db.insert(adminVerificationLogsTable).values({ tradieId, adminId: req.user!.userId, action: "SUSPENDED", note: reason });

  res.json(formatProfileResponse(updated));
});

router.post("/admin/tradies/:tradieId/reinstate", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const tradieId = Array.isArray(req.params.tradieId) ? req.params.tradieId[0] : req.params.tradieId;

  const [updated] = await db.update(tradieProfilesTable).set({
    suspendedAt: null,
    suspendedReason: null,
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, tradieId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Tradie not found" });
    return;
  }

  await db.insert(adminVerificationLogsTable).values({ tradieId, adminId: req.user!.userId, action: "REINSTATED" });
  await checkAndUpdateLiveStatus(tradieId);

  res.json(formatProfileResponse(updated));
});

// ──────────── Disputes ────────────

router.get("/admin/disputes", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };

  let disputes = await db.select().from(disputesTable).orderBy(desc(disputesTable.createdAt));
  if (status) {
    disputes = disputes.filter(d => d.status === status);
  }

  res.json(disputes.map(d => ({
    id: d.id,
    jobId: d.jobId,
    tradieId: d.tradieId,
    raisedById: d.raisedById,
    reason: d.reason,
    status: d.status,
    resolution: d.resolution,
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  })));
});

router.post("/admin/disputes/:disputeId/resolve", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const disputeId = Array.isArray(req.params.disputeId) ? req.params.disputeId[0] : req.params.disputeId;
  const { resolution, status } = req.body as { resolution: string; status: string };

  const [updated] = await db.update(disputesTable).set({
    status: status as "RESOLVED" | "DISMISSED",
    resolution,
    resolvedAt: new Date(),
  }).where(eq(disputesTable.id, disputeId)).returning();

  if (!updated) {
    res.status(404).json({ error: "Dispute not found" });
    return;
  }

  await db.insert(adminVerificationLogsTable).values({ tradieId: updated.tradieId, adminId: req.user!.userId, action: `DISPUTE_${status}`, note: resolution });

  res.json({
    id: updated.id,
    jobId: updated.jobId,
    tradieId: updated.tradieId,
    raisedById: updated.raisedById,
    reason: updated.reason,
    status: updated.status,
    resolution: updated.resolution,
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    createdAt: updated.createdAt.toISOString(),
  });
});

// ──────────── Moderation ────────────

router.get("/admin/moderation/reviews", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const flagged = await db.select().from(reviewsTable)
    .where(and(eq(reviewsTable.flagged, true), isNull(reviewsTable.removedAt)))
    .orderBy(desc(reviewsTable.createdAt));

  res.json(flagged.map(r => ({
    id: r.id, jobId: r.jobId, tradieId: r.tradieId, customerId: r.customerId,
    rating: r.rating, comment: r.comment, flagged: r.flagged,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/admin/moderation/reviews/:reviewId/remove", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const reviewId = Array.isArray(req.params.reviewId) ? req.params.reviewId[0] : req.params.reviewId;
  await db.update(reviewsTable).set({ removedAt: new Date() }).where(eq(reviewsTable.id, reviewId));
  res.sendStatus(204);
});

router.get("/admin/moderation/portfolio", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const flagged = await db.select().from(portfolioImagesTable)
    .where(and(eq(portfolioImagesTable.flagged, true), isNull(portfolioImagesTable.removedAt)))
    .orderBy(desc(portfolioImagesTable.createdAt));

  res.json(flagged.map(i => ({ id: i.id, url: i.url, caption: i.caption, createdAt: i.createdAt.toISOString() })));
});

router.post("/admin/moderation/portfolio/:imageId/remove", requireAuth, requireRole("ADMIN"), async (req: AuthRequest, res): Promise<void> => {
  const imageId = Array.isArray(req.params.imageId) ? req.params.imageId[0] : req.params.imageId;
  await db.update(portfolioImagesTable).set({ removedAt: new Date() }).where(eq(portfolioImagesTable.id, imageId));
  res.sendStatus(204);
});

export default router;
