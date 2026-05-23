import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  boolean,
  integer,
  real,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const verificationStatusEnum = pgEnum("verification_status", [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
  "SELF_DECLARED",
]);

export const tradieProfilesTable = pgTable("tradie_profiles", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  slug: text("slug").notNull().unique(),
  legalName: text("legal_name").notNull().default(""),
  displayName: text("display_name").notNull().default(""),
  bio: text("bio").notNull().default(""),
  photo: text("photo"),
  trades: text("trades").array().notNull().default([]),
  homeSuburb: text("home_suburb").notNull().default(""),
  homeState: text("home_state").notNull().default(""),
  servicePostcodes: text("service_postcodes").array().notNull().default([]),
  serviceRadiusKm: integer("service_radius_km"),
  centralLat: real("central_lat"),
  centralLng: real("central_lng"),
  hourlyRate: real("hourly_rate").notNull().default(0),
  yearsExp: integer("years_exp"),
  abn: text("abn").notNull().default(""),
  abnVerifiedAt: timestamp("abn_verified_at", { withTimezone: true }),
  identityStatus: verificationStatusEnum("identity_status").notNull().default("PENDING"),
  identityDocUrl: text("identity_doc_url"),
  identityRejectionReason: text("identity_rejection_reason"),
  insuranceStatus: verificationStatusEnum("insurance_status").notNull().default("PENDING"),
  insuranceInsurer: text("insurance_insurer"),
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceCoverAud: integer("insurance_cover_aud"),
  insuranceExpiry: timestamp("insurance_expiry", { withTimezone: true }),
  insuranceCertUrl: text("insurance_cert_url"),
  insuranceRejectionReason: text("insurance_rejection_reason"),
  optedOutOfInsurance: boolean("opted_out_of_insurance").notNull().default(false),
  availableEvenings: boolean("available_evenings").notNull().default(false),
  availableWeekends: boolean("available_weekends").notNull().default(false),
  availableDayMask: integer("available_day_mask").notNull().default(0),
  isLive: boolean("is_live").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  paymentConfirmed: boolean("payment_confirmed").notNull().default(false),
  responseRatePct: integer("response_rate_pct"),
  avgResponseMinutes: integer("avg_response_minutes"),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedReason: text("suspended_reason"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_tradie_profiles_is_live").on(t.isLive),
  index("idx_tradie_profiles_slug").on(t.slug),
]);

export const tradieLicencesTable = pgTable("tradie_licences", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tradieId: text("tradie_id").notNull().references(() => tradieProfilesTable.id),
  trade: text("trade").notNull(),
  licenceNumber: text("licence_number"),
  licenceClass: text("licence_class"),
  issuingAuthority: text("issuing_authority"),
  issuingState: text("issuing_state").notNull(),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  documentUrl: text("document_url"),
  verificationStatus: verificationStatusEnum("verification_status").notNull().default("PENDING"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedByAdminId: text("verified_by_admin_id"),
  rejectionReason: text("rejection_reason"),
  isSelfDeclared: boolean("is_self_declared").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_tradie_licences_tradie").on(t.tradieId),
  index("idx_tradie_licences_status").on(t.verificationStatus),
]);

export const portfolioImagesTable = pgTable("portfolio_images", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tradieId: text("tradie_id").notNull().references(() => tradieProfilesTable.id),
  url: text("url").notNull(),
  caption: text("caption"),
  flagged: boolean("flagged").notNull().default(false),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_portfolio_images_tradie").on(t.tradieId),
]);

export const customerFavouritesTable = pgTable("customer_favourites", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  customerId: text("customer_id").notNull().references(() => usersTable.id),
  tradieId: text("tradie_id").notNull().references(() => tradieProfilesTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_customer_favourites_customer").on(t.customerId),
]);

export type TradieProfile = typeof tradieProfilesTable.$inferSelect;
export type TradieLicence = typeof tradieLicencesTable.$inferSelect;
export type PortfolioImage = typeof portfolioImagesTable.$inferSelect;
