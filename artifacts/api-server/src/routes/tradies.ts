import { Router, type IRouter } from "express";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import {
  db,
  tradieProfilesTable,
  tradieLicencesTable,
  portfolioImagesTable,
  usersTable,
  reviewsTable,
  customerFavouritesTable,
  jobsTable,
} from "@workspace/db";
import {
  SubmitIdentityBody,
  SubmitTradeInfoBody,
  SubmitAvailabilityBody,
  SubmitLicenceBody,
  SubmitInsuranceBody,
  CreateCheckoutSessionBody,
  UpdateMyProfileBody,
  AddPortfolioImageBody,
  GetUploadUrlBody,
} from "@workspace/api-zod";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";
import { generateSlug } from "../lib/auth";
import Stripe from "stripe";
import crypto from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// ────────────────────────── helpers ──────────────────────────

async function buildTradieCard(profile: typeof tradieProfilesTable.$inferSelect) {
  const reviews = await db.select({ rating: reviewsTable.rating }).from(reviewsTable)
    .where(and(eq(reviewsTable.tradieId, profile.id), isNull(reviewsTable.removedAt)));
  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviewCount
    : null;

  return {
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
    avgRating,
    reviewCount,
  };
}

async function checkAndUpdateLiveStatus(tradieId: string): Promise<void> {
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.id, tradieId));
  if (!profile) return;

  const licences = await db.select().from(tradieLicencesTable).where(eq(tradieLicencesTable.tradieId, tradieId));
  const licencesOk = licences.length === 0 || licences.every(
    l => l.verificationStatus === "VERIFIED" || l.verificationStatus === "SELF_DECLARED"
  );
  const insuranceOk = profile.insuranceStatus === "VERIFIED" || profile.optedOutOfInsurance;

  const isLive =
    profile.paymentConfirmed &&
    profile.identityStatus === "VERIFIED" &&
    licencesOk &&
    insuranceOk &&
    !profile.suspendedAt &&
    !profile.deletedAt;

  await db.update(tradieProfilesTable).set({ isLive }).where(eq(tradieProfilesTable.id, tradieId));
}

// ────────────────────────── Public ──────────────────────────

router.get("/tradies", async (req, res): Promise<void> => {
  const { trade, postcode, availability, page = "1", limit = "12" } = req.query as Record<string, string>;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [eq(tradieProfilesTable.isLive, true), isNull(tradieProfilesTable.deletedAt)];

  const allProfiles = await db.select().from(tradieProfilesTable)
    .where(and(...conditions))
    .orderBy(desc(tradieProfilesTable.createdAt));

  let filtered = allProfiles.filter(p => {
    if (trade && !p.trades.some(t => t.toLowerCase().includes(trade.toLowerCase()))) return false;
    if (postcode && !p.servicePostcodes.includes(postcode)) return false;
    if (availability === "evenings" && !p.availableEvenings) return false;
    if (availability === "weekends" && !p.availableWeekends) return false;
    if (availability === "both" && (!p.availableEvenings || !p.availableWeekends)) return false;
    return true;
  });

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limitNum);

  const tradies = await Promise.all(paginated.map(buildTradieCard));

  res.json({ tradies, total, page: pageNum, limit: limitNum });
});

router.get("/tradies/:slug/reviews", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.slug, raw));
  if (!profile) {
    res.status(404).json({ error: "Tradie not found" });
    return;
  }
  const reviews = await db.select().from(reviewsTable)
    .where(and(eq(reviewsTable.tradieId, profile.id), isNull(reviewsTable.removedAt)))
    .orderBy(desc(reviewsTable.createdAt));

  res.json(reviews.map(r => ({
    id: r.id,
    jobId: r.jobId,
    tradieId: r.tradieId,
    customerId: r.customerId,
    rating: r.rating,
    comment: r.comment,
    flagged: r.flagged,
    createdAt: r.createdAt.toISOString(),
  })));
});

router.get("/tradies/:slug", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.slug, raw));
  if (!profile || (!profile.isLive && !profile.deletedAt)) {
    res.status(404).json({ error: "Tradie not found" });
    return;
  }

  const licences = await db.select().from(tradieLicencesTable).where(eq(tradieLicencesTable.tradieId, profile.id));
  const portfolio = await db.select().from(portfolioImagesTable)
    .where(and(eq(portfolioImagesTable.tradieId, profile.id), isNull(portfolioImagesTable.removedAt)));
  const reviews = await db.select({ rating: reviewsTable.rating }).from(reviewsTable)
    .where(and(eq(reviewsTable.tradieId, profile.id), isNull(reviewsTable.removedAt)));

  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviewCount : null;

  res.json({
    id: profile.id,
    slug: profile.slug,
    displayName: profile.displayName,
    bio: profile.bio,
    photo: profile.photo,
    trades: profile.trades,
    homeSuburb: profile.homeSuburb,
    homeState: profile.homeState,
    servicePostcodes: profile.servicePostcodes,
    hourlyRate: profile.hourlyRate,
    yearsExp: profile.yearsExp,
    availableEvenings: profile.availableEvenings,
    availableWeekends: profile.availableWeekends,
    identityVerified: profile.identityStatus === "VERIFIED",
    insuranceVerified: profile.insuranceStatus === "VERIFIED",
    optedOutOfInsurance: profile.optedOutOfInsurance,
    avgRating,
    reviewCount,
    responseRatePct: profile.responseRatePct,
    avgResponseMinutes: profile.avgResponseMinutes,
    licences: licences.map(l => ({
      id: l.id,
      trade: l.trade,
      licenceClass: l.licenceClass,
      issuingAuthority: l.issuingAuthority,
      issuingState: l.issuingState,
      expiryMonthYear: l.expiryDate ? `${l.expiryDate.toLocaleString("default", { month: "short" })} ${l.expiryDate.getFullYear()}` : null,
      verificationStatus: l.verificationStatus,
      isSelfDeclared: l.isSelfDeclared,
    })),
    portfolio: portfolio.map(p => ({ id: p.id, url: p.url, caption: p.caption, createdAt: p.createdAt.toISOString() })),
  });
});

router.get("/config/trades", async (_req, res): Promise<void> => {
  const trades = [
    "Electrician", "Plumber", "Builder", "Carpenter", "Painter",
    "Tiler", "Roofer", "Landscaper", "Concreter", "Plasterer",
    "Handyman", "Air Conditioning & Refrigeration", "Locksmith",
    "Pest Control", "Cleaner", "Pool & Spa",
  ];
  res.json(trades);
});

// ────────────────────────── Tradie Onboarding ──────────────────────────

router.post("/tradie/onboarding/identity", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const IdentitySchema = SubmitIdentityBody.extend({
    dob: SubmitIdentityBody.shape.dob.optional(),
    mobile: SubmitIdentityBody.shape.mobile.optional(),
    abn: SubmitIdentityBody.shape.abn.optional(),
  });
  const parsed = IdentitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { legalName, mobile, homeSuburb, homeState, abn, identityDocUrl } = parsed.data;
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const [updated] = await db.update(tradieProfilesTable).set({
    legalName,
    homeSuburb,
    homeState,
    abn,
    identityDocUrl: identityDocUrl ?? null,
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, profile.id)).returning();

  res.json(formatProfileResponse(updated));
});

router.post("/tradie/onboarding/trade", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = SubmitTradeInfoBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  // Regenerate slug if display name changed
  const slug = parsed.data.displayName !== profile.displayName
    ? await generateSlug(parsed.data.displayName)
    : profile.slug;

  const [updated] = await db.update(tradieProfilesTable).set({
    displayName: parsed.data.displayName,
    bio: parsed.data.bio,
    trades: parsed.data.trades,
    servicePostcodes: parsed.data.servicePostcodes,
    serviceRadiusKm: parsed.data.serviceRadiusKm ?? null,
    hourlyRate: parsed.data.hourlyRate,
    yearsExp: parsed.data.yearsExp ?? null,
    slug,
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, profile.id)).returning();

  res.json(formatProfileResponse(updated));
});

router.post("/tradie/onboarding/availability", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = SubmitAvailabilityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const [updated] = await db.update(tradieProfilesTable).set({
    availableEvenings: parsed.data.availableEvenings,
    availableWeekends: parsed.data.availableWeekends,
    availableDayMask: parsed.data.availableDayMask,
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, profile.id)).returning();

  res.json(formatProfileResponse(updated));
});

router.post("/tradie/onboarding/licence", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = SubmitLicenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const STATE_AUTHORITY_MAP: Record<string, string> = {
    QLD: "QBCC",
    NSW: "NSW Fair Trading",
    VIC: "VBA",
    SA: "CBS",
    WA: "Building Commission WA",
    TAS: "CBOS",
    ACT: "Access Canberra",
    NT: "NT Building Advisory Services",
  };

  const issuingAuthority = STATE_AUTHORITY_MAP[parsed.data.issuingState] ?? parsed.data.issuingState;

  const [existing] = await db.select().from(tradieLicencesTable)
    .where(and(eq(tradieLicencesTable.tradieId, profile.id), eq(tradieLicencesTable.trade, parsed.data.trade)));

  let licence;
  if (existing) {
    [licence] = await db.update(tradieLicencesTable).set({
      licenceNumber: parsed.data.licenceNumber ?? null,
      licenceClass: parsed.data.licenceClass ?? null,
      issuingAuthority,
      issuingState: parsed.data.issuingState,
      expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate as unknown as string) : null,
      documentUrl: parsed.data.documentUrl ?? null,
      verificationStatus: parsed.data.isSelfDeclared ? "SELF_DECLARED" : "PENDING",
      isSelfDeclared: parsed.data.isSelfDeclared,
      rejectionReason: null,
      updatedAt: new Date(),
    }).where(eq(tradieLicencesTable.id, existing.id)).returning();
  } else {
    [licence] = await db.insert(tradieLicencesTable).values({
      tradieId: profile.id,
      trade: parsed.data.trade,
      licenceNumber: parsed.data.licenceNumber ?? null,
      licenceClass: parsed.data.licenceClass ?? null,
      issuingAuthority,
      issuingState: parsed.data.issuingState,
      expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate as unknown as string) : null,
      documentUrl: parsed.data.documentUrl ?? null,
      verificationStatus: parsed.data.isSelfDeclared ? "SELF_DECLARED" : "PENDING",
      isSelfDeclared: parsed.data.isSelfDeclared,
    }).returning();
  }

  const [updatedProfile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.id, profile.id));
  res.json(formatProfileResponse(updatedProfile));
});

router.post("/tradie/onboarding/insurance", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = SubmitInsuranceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const [updated] = await db.update(tradieProfilesTable).set({
    optedOutOfInsurance: parsed.data.optedOut,
    insuranceInsurer: parsed.data.insurer ?? null,
    insurancePolicyNumber: parsed.data.policyNumber ?? null,
    insuranceCoverAud: parsed.data.coverAud ?? null,
    insuranceExpiry: parsed.data.expiry ? new Date(parsed.data.expiry as unknown as string) : null,
    insuranceCertUrl: parsed.data.certUrl ?? null,
    insuranceStatus: parsed.data.optedOut ? "PENDING" : "PENDING",
    updatedAt: new Date(),
  }).where(eq(tradieProfilesTable.id, profile.id)).returning();

  res.json(formatProfileResponse(updated));
});

router.post("/tradie/onboarding/checkout", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateCheckoutSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile || !user) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  if (!stripe) {
    // Dev mode: simulate checkout
    const [updated] = await db.update(tradieProfilesTable).set({
      paymentConfirmed: true,
      subscriptionStatus: "active",
      updatedAt: new Date(),
    }).where(eq(tradieProfilesTable.id, profile.id)).returning();
    await checkAndUpdateLiveStatus(profile.id);
    res.json({ checkoutUrl: `${process.env.APP_BASE_URL || ""}/?checkout=success` });
    return;
  }

  const priceId = parsed.data.plan === "annual"
    ? process.env.STRIPE_ANNUAL_PRICE_ID
    : process.env.STRIPE_MONTHLY_PRICE_ID;

  let customerId = profile.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({ email: user.email, metadata: { tradieId: profile.id } });
    customerId = customer.id;
    await db.update(tradieProfilesTable).set({ stripeCustomerId: customerId }).where(eq(tradieProfilesTable.id, profile.id));
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.APP_BASE_URL || ""}/?checkout=success`,
    cancel_url: `${process.env.APP_BASE_URL || ""}/onboarding`,
    metadata: { tradieId: profile.id },
  });

  res.json({ checkoutUrl: session.url });
});

// ────────────────────────── Upload URL ──────────────────────────

router.post("/tradie/upload-url", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const parsed = GetUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    // Dev fallback
    res.json({
      uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
      publicId: `dev/${Date.now()}`,
      signature: "dev-signature",
      timestamp: Math.floor(Date.now() / 1000),
      apiKey: apiKey ?? "demo",
      cloudName: cloudName ?? "demo",
    });
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `tradieafterdark/${parsed.data.purpose}`;
  const publicId = `${folder}/${req.user!.userId}_${Date.now()}`;
  const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = require("crypto")
    .createHash("sha256")
    .update(paramsToSign + apiSecret)
    .digest("hex");

  res.json({
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    publicId,
    signature,
    timestamp,
    apiKey,
    cloudName,
  });
});

// ────────────────────────── Tradie Dashboard ──────────────────────────

router.get("/tradie/profile", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.json(formatProfileResponse(profile));
});

router.patch("/tradie/profile", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const updates: Partial<typeof tradieProfilesTable.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.displayName != null) updates.displayName = parsed.data.displayName;
  if (parsed.data.bio != null) updates.bio = parsed.data.bio;
  if (parsed.data.photo != null) updates.photo = parsed.data.photo;
  if (parsed.data.hourlyRate != null) updates.hourlyRate = parsed.data.hourlyRate;
  if (parsed.data.yearsExp != null) updates.yearsExp = parsed.data.yearsExp;
  if (parsed.data.availableEvenings != null) updates.availableEvenings = parsed.data.availableEvenings;
  if (parsed.data.availableWeekends != null) updates.availableWeekends = parsed.data.availableWeekends;
  if (parsed.data.availableDayMask != null) updates.availableDayMask = parsed.data.availableDayMask;
  if (parsed.data.servicePostcodes != null) updates.servicePostcodes = parsed.data.servicePostcodes;

  const [updated] = await db.update(tradieProfilesTable).set(updates).where(eq(tradieProfilesTable.id, profile.id)).returning();
  res.json(formatProfileResponse(updated));
});

router.get("/tradie/subscription", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  let currentPeriodEnd: string | null = null;
  let plan: string | null = null;

  if (stripe && profile.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId);
      currentPeriodEnd = new Date((sub as any).current_period_end * 1000).toISOString();
      plan = (sub as any).items?.data?.[0]?.price?.recurring?.interval === "year" ? "annual" : "monthly";
    } catch (e) {
      logger.warn({ err: e }, "Stripe subscription fetch failed");
    }
  }

  res.json({
    status: profile.subscriptionStatus,
    plan,
    currentPeriodEnd,
    paymentConfirmed: profile.paymentConfirmed,
  });
});

router.post("/tradie/billing-portal", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile || !stripe || !profile.stripeCustomerId) {
    res.json({ portalUrl: "/tradie/dashboard" });
    return;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${process.env.APP_BASE_URL || ""}/tradie/dashboard`,
  });

  res.json({ portalUrl: session.url });
});

router.get("/tradie/licences", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  const licences = await db.select().from(tradieLicencesTable).where(eq(tradieLicencesTable.tradieId, profile.id));
  res.json(licences.map(formatLicenceResponse));
});

router.post("/tradie/licences/:licenceId/resubmit", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const licenceId = Array.isArray(req.params.licenceId) ? req.params.licenceId[0] : req.params.licenceId;
  const parsed = SubmitLicenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  const [licence] = await db.select().from(tradieLicencesTable)
    .where(and(eq(tradieLicencesTable.id, licenceId), eq(tradieLicencesTable.tradieId, profile?.id ?? "")));

  if (!licence) {
    res.status(404).json({ error: "Licence not found" });
    return;
  }

  const [updated] = await db.update(tradieLicencesTable).set({
    licenceNumber: parsed.data.licenceNumber ?? null,
    licenceClass: parsed.data.licenceClass ?? null,
    issuingState: parsed.data.issuingState,
    expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate as unknown as string) : null,
    documentUrl: parsed.data.documentUrl ?? null,
    verificationStatus: "PENDING",
    rejectionReason: null,
    updatedAt: new Date(),
  }).where(eq(tradieLicencesTable.id, licenceId)).returning();

  res.json(formatLicenceResponse(updated));
});

router.post("/tradie/portfolio", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const parsed = AddPortfolioImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const existing = await db.select().from(portfolioImagesTable)
    .where(and(eq(portfolioImagesTable.tradieId, profile.id), isNull(portfolioImagesTable.removedAt)));
  if (existing.length >= 8) {
    res.status(400).json({ error: "Maximum 8 portfolio images allowed" });
    return;
  }

  const [image] = await db.insert(portfolioImagesTable).values({
    tradieId: profile.id,
    url: parsed.data.url,
    caption: parsed.data.caption ?? null,
  }).returning();

  res.status(201).json({ id: image.id, url: image.url, caption: image.caption, createdAt: image.createdAt.toISOString() });
});

router.delete("/tradie/portfolio/:imageId", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const imageId = Array.isArray(req.params.imageId) ? req.params.imageId[0] : req.params.imageId;
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));

  await db.update(portfolioImagesTable).set({ removedAt: new Date() })
    .where(and(eq(portfolioImagesTable.id, imageId), eq(portfolioImagesTable.tradieId, profile?.id ?? "")));

  res.sendStatus(204);
});

router.get("/tradie/stats", requireAuth, requireRole("TRADIE"), async (req: AuthRequest, res): Promise<void> => {
  const [profile] = await db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.userId, req.user!.userId));
  if (!profile) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }

  const jobs = await db.select({ status: jobsTable.status }).from(jobsTable).where(eq(jobsTable.tradieId, profile.id));
  const totalJobs = jobs.length;
  const activeJobs = jobs.filter(j => ["ENQUIRY", "ACCEPTED", "IN_PROGRESS"].includes(j.status)).length;
  const completedJobs = jobs.filter(j => j.status === "COMPLETED").length;

  res.json({
    totalJobs,
    activeJobs,
    completedJobs,
    avgResponseMinutes: profile.avgResponseMinutes,
    responseRatePct: profile.responseRatePct,
  });
});

// ────────────────────────── Customer Favourites ──────────────────────────

router.get("/customer/favourites", requireAuth, requireRole("CUSTOMER"), async (req: AuthRequest, res): Promise<void> => {
  const favs = await db.select({ tradieId: customerFavouritesTable.tradieId })
    .from(customerFavouritesTable).where(eq(customerFavouritesTable.customerId, req.user!.userId));

  const profiles = await Promise.all(
    favs.map(f => db.select().from(tradieProfilesTable).where(eq(tradieProfilesTable.id, f.tradieId)).then(r => r[0]))
  );

  const cards = await Promise.all(profiles.filter(Boolean).map(buildTradieCard));
  res.json(cards);
});

router.post("/customer/favourites/:tradieId", requireAuth, requireRole("CUSTOMER"), async (req: AuthRequest, res): Promise<void> => {
  const tradieId = Array.isArray(req.params.tradieId) ? req.params.tradieId[0] : req.params.tradieId;
  const existing = await db.select().from(customerFavouritesTable)
    .where(and(eq(customerFavouritesTable.customerId, req.user!.userId), eq(customerFavouritesTable.tradieId, tradieId)));
  if (!existing.length) {
    await db.insert(customerFavouritesTable).values({ customerId: req.user!.userId, tradieId });
  }
  res.sendStatus(204);
});

router.delete("/customer/favourites/:tradieId", requireAuth, requireRole("CUSTOMER"), async (req: AuthRequest, res): Promise<void> => {
  const tradieId = Array.isArray(req.params.tradieId) ? req.params.tradieId[0] : req.params.tradieId;
  await db.delete(customerFavouritesTable)
    .where(and(eq(customerFavouritesTable.customerId, req.user!.userId), eq(customerFavouritesTable.tradieId, tradieId)));
  res.sendStatus(204);
});

// ────────────────────────── Helpers ──────────────────────────

function formatProfileResponse(profile: typeof tradieProfilesTable.$inferSelect) {
  return {
    id: profile.id,
    userId: profile.userId,
    slug: profile.slug,
    legalName: profile.legalName,
    displayName: profile.displayName,
    bio: profile.bio,
    photo: profile.photo,
    trades: profile.trades,
    homeSuburb: profile.homeSuburb,
    homeState: profile.homeState,
    servicePostcodes: profile.servicePostcodes,
    serviceRadiusKm: profile.serviceRadiusKm,
    hourlyRate: profile.hourlyRate,
    yearsExp: profile.yearsExp,
    abn: profile.abn,
    identityStatus: profile.identityStatus,
    insuranceStatus: profile.insuranceStatus,
    optedOutOfInsurance: profile.optedOutOfInsurance,
    availableEvenings: profile.availableEvenings,
    availableWeekends: profile.availableWeekends,
    availableDayMask: profile.availableDayMask,
    isLive: profile.isLive,
    subscriptionStatus: profile.subscriptionStatus,
    paymentConfirmed: profile.paymentConfirmed,
    suspendedAt: profile.suspendedAt?.toISOString() ?? null,
    createdAt: profile.createdAt.toISOString(),
  };
}

function formatLicenceResponse(l: typeof tradieLicencesTable.$inferSelect) {
  return {
    id: l.id,
    tradieId: l.tradieId,
    trade: l.trade,
    licenceNumber: l.licenceNumber,
    licenceClass: l.licenceClass,
    issuingAuthority: l.issuingAuthority,
    issuingState: l.issuingState,
    expiryDate: l.expiryDate?.toISOString() ?? null,
    documentUrl: l.documentUrl,
    verificationStatus: l.verificationStatus,
    verifiedAt: l.verifiedAt?.toISOString() ?? null,
    rejectionReason: l.rejectionReason,
    isSelfDeclared: l.isSelfDeclared,
    createdAt: l.createdAt.toISOString(),
  };
}

export { checkAndUpdateLiveStatus, formatProfileResponse, formatLicenceResponse };
export default router;
