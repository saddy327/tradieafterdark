import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { tradieProfilesTable } from "./tradies";

export const jobStatusEnum = pgEnum("job_status", [
  "ENQUIRY",
  "ACCEPTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
]);

export const disputeStatusEnum = pgEnum("dispute_status", [
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "DISMISSED",
]);

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tradieId: text("tradie_id").notNull().references(() => tradieProfilesTable.id),
  customerId: text("customer_id").notNull().references(() => usersTable.id),
  status: jobStatusEnum("status").notNull().default("ENQUIRY"),
  description: text("description").notNull(),
  postcode: text("postcode").notNull(),
  preferredStart: timestamp("preferred_start", { withTimezone: true }),
  preferredEnd: timestamp("preferred_end", { withTimezone: true }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  cancelledReason: text("cancelled_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_jobs_tradie_status").on(t.tradieId, t.status),
  index("idx_jobs_customer_status").on(t.customerId, t.status),
]);

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id").notNull().references(() => jobsTable.id),
  senderId: text("sender_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  flagged: boolean("flagged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_messages_job_created").on(t.jobId, t.createdAt),
]);

export const reviewsTable = pgTable("reviews", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id").notNull().unique().references(() => jobsTable.id),
  tradieId: text("tradie_id").notNull().references(() => tradieProfilesTable.id),
  customerId: text("customer_id").notNull().references(() => usersTable.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  flagged: boolean("flagged").notNull().default(false),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_reviews_tradie").on(t.tradieId),
]);

export const disputesTable = pgTable("disputes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  jobId: text("job_id").notNull().unique().references(() => jobsTable.id),
  tradieId: text("tradie_id").notNull().references(() => tradieProfilesTable.id),
  raisedById: text("raised_by_id").notNull().references(() => usersTable.id),
  reason: text("reason").notNull(),
  status: disputeStatusEnum("status").notNull().default("OPEN"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_disputes_status").on(t.status),
]);

export const stripeWebhookEventsTable = pgTable("stripe_webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminVerificationLogsTable = pgTable("admin_verification_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  licenceId: text("licence_id"),
  tradieId: text("tradie_id"),
  adminId: text("admin_id").notNull().references(() => usersTable.id),
  action: text("action").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Job = typeof jobsTable.$inferSelect;
export type Message = typeof messagesTable.$inferSelect;
export type Review = typeof reviewsTable.$inferSelect;
export type Dispute = typeof disputesTable.$inferSelect;
