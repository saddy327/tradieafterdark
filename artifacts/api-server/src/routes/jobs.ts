import { Router, type IRouter } from "express";
import { eq, and, or, desc } from "drizzle-orm";
import {
  db,
  jobsTable,
  messagesTable,
  reviewsTable,
  disputesTable,
  tradieProfilesTable,
  usersTable,
} from "@workspace/db";
import {
  CreateJobBody,
  CancelJobBody,
  OpenDisputeBody,
  SendMessageBody,
  SubmitReviewBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { broadcastToJob } from "../lib/ws-manager";

const router: IRouter = Router();

const CONTACT_PATTERN = /(\b\d{4}[\s-]?\d{3}[\s-]?\d{3}\b|\b\d{10}\b|[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}|whatsapp|signal|telegram|my number|call me)/i;

// ──────────── helpers ────────────

async function buildJobResponse(job: typeof jobsTable.$inferSelect, currentUserId: string) {
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.id, job.tradieId));
  const [customer] = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, job.customerId));
  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.jobId, job.id));

  const unreadCount = await db.select({ id: messagesTable.id }).from(messagesTable)
    .where(and(
      eq(messagesTable.jobId, job.id),
      eq(messagesTable.flagged, false),
    )).then(msgs => msgs.filter(m => {
      return true; // simplified — actual unread needs readAt check per recipient
    }));

  return {
    id: job.id,
    tradieId: job.tradieId,
    customerId: job.customerId,
    status: job.status,
    description: job.description,
    postcode: job.postcode,
    preferredStart: job.preferredStart?.toISOString() ?? null,
    preferredEnd: job.preferredEnd?.toISOString() ?? null,
    acceptedAt: job.acceptedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    cancelledAt: job.cancelledAt?.toISOString() ?? null,
    cancelledReason: job.cancelledReason,
    tradie: profile ? {
      id: profile.id,
      slug: profile.slug,
      displayName: profile.displayName,
      photo: profile.photo,
      trades: profile.trades,
      homeSuburb: profile.homeSuburb,
      homeState: profile.homeState,
      hourlyRate: profile.hourlyRate,
      availableEvenings: profile.availableEvenings,
      availableWeekends: profile.availableWeekends,
      identityVerified: profile.identityStatus === "VERIFIED",
      insuranceVerified: profile.insuranceStatus === "VERIFIED",
      avgRating: null,
      reviewCount: 0,
    } : null,
    customer: customer ? { id: customer.id, email: customer.email } : null,
    review: review ? {
      id: review.id,
      jobId: review.jobId,
      tradieId: review.tradieId,
      customerId: review.customerId,
      rating: review.rating,
      comment: review.comment,
      flagged: review.flagged,
      createdAt: review.createdAt.toISOString(),
    } : null,
    unreadCount: 0,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

// ──────────── Routes ────────────

router.get("/jobs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { status } = req.query as { status?: string };
  const userId = req.user!.userId;
  const role = req.user!.role;

  let query;
  if (role === "TRADIE") {
    const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, userId));
    if (!profile) {
      res.json([]);
      return;
    }
    query = db.select().from(jobsTable).where(eq(jobsTable.tradieId, profile.id));
  } else {
    query = db.select().from(jobsTable).where(eq(jobsTable.customerId, userId));
  }

  let jobs = await query.orderBy(desc(jobsTable.updatedAt));

  if (status) {
    jobs = jobs.filter(j => j.status === status);
  }

  const results = await Promise.all(jobs.map(j => buildJobResponse(j, userId)));
  res.json(results);
});

router.post("/jobs", requireAuth, requireRole("CUSTOMER"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db.insert(jobsTable).values({
    tradieId: parsed.data.tradieId,
    customerId: req.user!.userId,
    description: parsed.data.description,
    postcode: parsed.data.postcode,
    preferredStart: parsed.data.preferredStart ? new Date(parsed.data.preferredStart as unknown as string) : null,
    preferredEnd: parsed.data.preferredEnd ? new Date(parsed.data.preferredEnd as unknown as string) : null,
  }).returning();

  const result = await buildJobResponse(job, req.user!.userId);
  res.status(201).json(result);
});

router.get("/jobs/:jobId", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  // Auth check
  const userId = req.user!.userId;
  const role = req.user!.role;
  if (role === "CUSTOMER" && job.customerId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const result = await buildJobResponse(job, userId);
  res.json(result);
});

router.post("/jobs/:jobId/accept", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));

  if (!job || !profile || job.tradieId !== profile.id) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.status !== "ENQUIRY") {
    res.status(400).json({ error: "Job is not in ENQUIRY status" });
    return;
  }

  const [updated] = await db.update(jobsTable).set({
    status: "ACCEPTED",
    acceptedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(jobsTable.id, jobId)).returning();

  res.json(await buildJobResponse(updated, req.user!.userId));
});

router.post("/jobs/:jobId/start", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));

  if (!job || !profile || job.tradieId !== profile.id || job.status !== "ACCEPTED") {
    res.status(400).json({ error: "Cannot start job" });
    return;
  }

  const [updated] = await db.update(jobsTable).set({
    status: "IN_PROGRESS",
    updatedAt: new Date(),
  }).where(eq(jobsTable.id, jobId)).returning();

  res.json(await buildJobResponse(updated, req.user!.userId));
});

router.post("/jobs/:jobId/complete", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const isTradie = profile && job.tradieId === profile.id;
  const isCustomer = job.customerId === req.user!.userId;

  if (!isTradie && !isCustomer) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  if (!["IN_PROGRESS", "ACCEPTED"].includes(job.status)) {
    res.status(400).json({ error: "Cannot complete job in current status" });
    return;
  }

  const [updated] = await db.update(jobsTable).set({
    status: "COMPLETED",
    completedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(jobsTable.id, jobId)).returning();

  res.json(await buildJobResponse(updated, req.user!.userId));
});

router.post("/jobs/:jobId/cancel", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const parsed = CancelJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const isOwner = job.customerId === req.user!.userId || (profile && job.tradieId === profile.id);
  if (!isOwner) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [updated] = await db.update(jobsTable).set({
    status: "CANCELLED",
    cancelledAt: new Date(),
    cancelledReason: parsed.data.reason,
    updatedAt: new Date(),
  }).where(eq(jobsTable.id, jobId)).returning();

  res.json(await buildJobResponse(updated, req.user!.userId));
});

router.post("/jobs/:jobId/dispute", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const parsed = OpenDisputeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const isParty = job.customerId === req.user!.userId || (profile && job.tradieId === profile.id);
  if (!isParty) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [dispute] = await db.insert(disputesTable).values({
    jobId,
    tradieId: job.tradieId,
    raisedById: req.user!.userId,
    reason: parsed.data.reason,
  }).returning();

  await db.update(jobsTable).set({ status: "DISPUTED", updatedAt: new Date() }).where(eq(jobsTable.id, jobId));

  res.status(201).json({
    id: dispute.id,
    jobId: dispute.jobId,
    tradieId: dispute.tradieId,
    raisedById: dispute.raisedById,
    reason: dispute.reason,
    status: dispute.status,
    resolution: dispute.resolution,
    resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    createdAt: dispute.createdAt.toISOString(),
  });
});

// ──────────── Messages ────────────

router.get("/jobs/:jobId/messages", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const isParty = job.customerId === req.user!.userId || (profile && job.tradieId === profile.id);
  const isAdmin = req.user!.role === "ADMIN";
  if (!isParty && !isAdmin) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const messages = await db.select().from(messagesTable)
    .where(eq(messagesTable.jobId, jobId))
    .orderBy(messagesTable.createdAt);

  res.json(messages.map(m => ({
    id: m.id,
    jobId: m.jobId,
    senderId: m.senderId,
    body: m.body,
    readAt: m.readAt?.toISOString() ?? null,
    flagged: m.flagged,
    createdAt: m.createdAt.toISOString(),
  })));
});

router.post("/jobs/:jobId/messages", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const isParty = job.customerId === req.user!.userId || (profile && job.tradieId === profile.id);
  if (!isParty) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const flagged = job.status === "ENQUIRY" && CONTACT_PATTERN.test(parsed.data.body);

  const [message] = await db.insert(messagesTable).values({
    jobId,
    senderId: req.user!.userId,
    body: parsed.data.body,
    flagged,
  }).returning();

  const response = {
    id: message.id,
    jobId: message.jobId,
    senderId: message.senderId,
    body: message.body,
    readAt: message.readAt?.toISOString() ?? null,
    flagged: message.flagged,
    createdAt: message.createdAt.toISOString(),
  };

  broadcastToJob(jobId, { type: "message", data: response });

  if (flagged) {
    res.status(201).json({ ...response, warning: "Contact details detected. You can share contact info once the job is accepted." });
    return;
  }

  res.status(201).json(response);
});

router.get("/inbox", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const userId = req.user!.userId;
  const role = req.user!.role;

  let jobs: typeof jobsTable.$inferSelect[];

  if (role === "TRADIE") {
    const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, userId));
    if (!profile) {
      res.json([]);
      return;
    }
    jobs = await db.select().from(jobsTable).where(eq(jobsTable.tradieId, profile.id)).orderBy(desc(jobsTable.updatedAt));
  } else {
    jobs = await db.select().from(jobsTable).where(eq(jobsTable.customerId, userId)).orderBy(desc(jobsTable.updatedAt));
  }

  const threads = await Promise.all(jobs.map(async job => {
    const [lastMsg] = await db.select().from(messagesTable)
      .where(eq(messagesTable.jobId, job.id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(1);

    const jobData = await buildJobResponse(job, userId);
    return {
      job: jobData,
      lastMessage: lastMsg ? {
        id: lastMsg.id,
        jobId: lastMsg.jobId,
        senderId: lastMsg.senderId,
        body: lastMsg.body,
        readAt: lastMsg.readAt?.toISOString() ?? null,
        flagged: lastMsg.flagged,
        createdAt: lastMsg.createdAt.toISOString(),
      } : null,
      unreadCount: 0,
    };
  }));

  res.json(threads);
});

// ──────────── Reviews ────────────

router.post("/jobs/:jobId/review", requireAuth, requireRole("CUSTOMER"), async (req: AuthRequest, res): Promise<void> => {
  const jobId = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const parsed = SubmitReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, jobId));
  if (!job || job.customerId !== req.user!.userId || job.status !== "COMPLETED") {
    res.status(400).json({ error: "Cannot review this job" });
    return;
  }

  const existing = await db.select().from(reviewsTable).where(eq(reviewsTable.jobId, jobId));
  if (existing.length > 0) {
    res.status(409).json({ error: "Review already submitted" });
    return;
  }

  const [review] = await db.insert(reviewsTable).values({
    jobId,
    tradieId: job.tradieId,
    customerId: req.user!.userId,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  }).returning();

  res.status(201).json({
    id: review.id,
    jobId: review.jobId,
    tradieId: review.tradieId,
    customerId: review.customerId,
    rating: review.rating,
    comment: review.comment,
    flagged: review.flagged,
    createdAt: review.createdAt.toISOString(),
  });
});

export default router;
