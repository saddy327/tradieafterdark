import { db, usersTable, tradieProfilesTable, tradieLicencesTable, jobsTable, reviewsTable, portfolioImagesTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function main() {
  console.log("🌱 Seeding TradieAfterDark...");

  // ── Admin ──
  const [admin] = await db.insert(usersTable).values({
    email: "admin@tradieafterdark.com.au",
    passwordHash: await hashPassword("Admin1234!"),
    role: "ADMIN",
    acceptedTermsAt: new Date(),
    acceptedPrivacyAt: new Date(),
  }).onConflictDoNothing().returning();
  console.log("✓ Admin:", admin?.email ?? "already exists");

  // ── Customers ──
  const customerData = [
    { email: "alice@example.com", password: "Customer123!" },
    { email: "bob@example.com", password: "Customer123!" },
    { email: "carol@example.com", password: "Customer123!" },
    { email: "dave@example.com", password: "Customer123!" },
    { email: "eve@example.com", password: "Customer123!" },
  ];

  const customers = [];
  for (const c of customerData) {
    const [u] = await db.insert(usersTable).values({
      email: c.email,
      passwordHash: await hashPassword(c.password),
      role: "CUSTOMER",
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
    }).onConflictDoNothing().returning();
    if (u) customers.push(u);
  }
  console.log(`✓ ${customers.length} customers seeded`);

  // ── Tradies ──
  const tradieData = [
    {
      email: "mike.sparks@tradieafterdark.com.au",
      displayName: "Mike's Electrical",
      legalName: "Michael Sparks",
      trade: "Electrician",
      homeSuburb: "Fortitude Valley",
      homeState: "QLD",
      hourlyRate: 110,
      yearsExp: 12,
      bio: "Licensed electrician with 12 years experience. Specialise in residential after-hours callouts — switchboard upgrades, powerpoints, lighting, and fault-finding. QBCC certified.",
      availableEvenings: true,
      availableWeekends: true,
      servicePostcodes: ["4000", "4001", "4005", "4006", "4007", "4010"],
      issuingState: "QLD",
      licenceClass: "Open",
      slug: "mikes-electrical",
    },
    {
      email: "sarah.pipes@tradieafterdark.com.au",
      displayName: "Sarah's Plumbing",
      legalName: "Sarah Pipesworth",
      trade: "Plumber",
      homeSuburb: "Newstead",
      homeState: "QLD",
      hourlyRate: 130,
      yearsExp: 8,
      bio: "Reliable licensed plumber available evenings and weekends. From blocked drains to hot water systems — no job too big or small. All work guaranteed.",
      availableEvenings: true,
      availableWeekends: false,
      servicePostcodes: ["4000", "4006", "4010", "4011", "4012"],
      issuingState: "QLD",
      licenceClass: "Unrestricted",
      slug: "sarahs-plumbing",
    },
    {
      email: "tony.build@tradieafterdark.com.au",
      displayName: "Tony's Building & Carpentry",
      legalName: "Tony Buildmore",
      trade: "Builder",
      homeSuburb: "West End",
      homeState: "QLD",
      hourlyRate: 95,
      yearsExp: 20,
      bio: "20+ years in residential and commercial construction. Weekend renovations, decks, pergolas, fencing — love helping homeowners transform their spaces.",
      availableEvenings: false,
      availableWeekends: true,
      servicePostcodes: ["4000", "4101", "4102", "4103", "4105"],
      issuingState: "QLD",
      licenceClass: "Open Builder",
      slug: "tonys-building-carpentry",
    },
    {
      email: "lily.tiles@tradieafterdark.com.au",
      displayName: "Lily's Tiling",
      legalName: "Lily Tilesworth",
      trade: "Tiler",
      homeSuburb: "Paddington",
      homeState: "QLD",
      hourlyRate: 85,
      yearsExp: 6,
      bio: "Specialist tiler for kitchens, bathrooms, and alfresco areas. Weekend and evening availability. Obsessed with precision and clean finishes.",
      availableEvenings: true,
      availableWeekends: true,
      servicePostcodes: ["4000", "4064", "4065", "4066", "4068"],
      issuingState: "QLD",
      licenceClass: "Tiling",
      slug: "lilys-tiling",
    },
  ];

  const tradies = [];
  for (const t of tradieData) {
    const [user] = await db.insert(usersTable).values({
      email: t.email,
      passwordHash: await hashPassword("Tradie123!"),
      role: "TRADIE",
      acceptedTermsAt: new Date(),
      acceptedPrivacyAt: new Date(),
    }).onConflictDoNothing().returning();

    if (!user) {
      console.log(`  ⚠ Tradie ${t.email} already exists, skipping`);
      continue;
    }

    const [profile] = await db.insert(tradieProfilesTable).values({
      userId: user.id,
      slug: t.slug,
      legalName: t.legalName,
      displayName: t.displayName,
      bio: t.bio,
      trades: [t.trade],
      homeSuburb: t.homeSuburb,
      homeState: t.homeState,
      hourlyRate: t.hourlyRate,
      yearsExp: t.yearsExp,
      abn: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
      availableEvenings: t.availableEvenings,
      availableWeekends: t.availableWeekends,
      servicePostcodes: t.servicePostcodes,
      identityStatus: "VERIFIED",
      insuranceStatus: "VERIFIED",
      paymentConfirmed: true,
      subscriptionStatus: "active",
      isLive: true,
    }).onConflictDoNothing().returning();

    if (!profile) continue;

    await db.insert(tradieLicencesTable).values({
      tradieId: profile.id,
      trade: t.trade,
      licenceClass: t.licenceClass,
      issuingAuthority: "QBCC",
      issuingState: t.issuingState,
      verificationStatus: "VERIFIED",
      verifiedAt: new Date(),
      isSelfDeclared: false,
    }).onConflictDoNothing();

    tradies.push({ user, profile });
  }
  console.log(`✓ ${tradies.length} tradies seeded`);

  // ── Jobs + Messages + Reviews ──
  if (tradies.length > 0 && customers.length > 0) {
    const [job1] = await db.insert(jobsTable).values({
      tradieId: tradies[0].profile.id,
      customerId: customers[0].id,
      description: "Need the switchboard upgraded and 3 extra powerpoints installed in the living room. Available Sat morning.",
      postcode: "4000",
      status: "COMPLETED",
      acceptedAt: new Date(Date.now() - 7 * 86400000),
      completedAt: new Date(Date.now() - 6 * 86400000),
    }).returning();

    if (job1) {
      await db.insert(reviewsTable).values({
        jobId: job1.id,
        tradieId: tradies[0].profile.id,
        customerId: customers[0].id,
        rating: 5,
        comment: "Mike was prompt, professional and the work is immaculate. Highly recommend!",
      }).onConflictDoNothing();
    }

    if (tradies.length > 1 && customers.length > 1) {
      await db.insert(jobsTable).values({
        tradieId: tradies[1].profile.id,
        customerId: customers[1].id,
        description: "Blocked drain in the kitchen, also want hot water system serviced. Can do weekday evenings.",
        postcode: "4006",
        status: "ACCEPTED",
        acceptedAt: new Date(Date.now() - 2 * 86400000),
      }).onConflictDoNothing();
    }

    if (tradies.length > 2 && customers.length > 2) {
      await db.insert(jobsTable).values({
        tradieId: tradies[2].profile.id,
        customerId: customers[2].id,
        description: "Want a 6x4m deck built at the back of the house. Composite timber preferred. Happy to do weekend work.",
        postcode: "4101",
        status: "ENQUIRY",
      }).onConflictDoNothing();
    }

    if (tradies.length > 0 && customers.length > 3) {
      const [job4] = await db.insert(jobsTable).values({
        tradieId: tradies[0].profile.id,
        customerId: customers[3].id,
        description: "Lights flickering in the bedroom and bathroom. Urgently need someone to look at it.",
        postcode: "4007",
        status: "COMPLETED",
        acceptedAt: new Date(Date.now() - 14 * 86400000),
        completedAt: new Date(Date.now() - 13 * 86400000),
      }).returning();

      if (job4) {
        await db.insert(reviewsTable).values({
          jobId: job4.id,
          tradieId: tradies[0].profile.id,
          customerId: customers[3].id,
          rating: 4,
          comment: "Good work, found the issue quickly. Slightly pricey but fair for after-hours.",
        }).onConflictDoNothing();
      }
    }
  }

  console.log("✓ Jobs and reviews seeded");
  console.log("\n🎉 Seed complete!\n");
  console.log("Login credentials:");
  console.log("  Admin:    admin@tradieafterdark.com.au / Admin1234!");
  console.log("  Customer: alice@example.com / Customer123!");
  console.log("  Tradie:   mike.sparks@tradieafterdark.com.au / Tradie123!");
}

main().catch(console.error).finally(() => process.exit(0));
