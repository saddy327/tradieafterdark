import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roleEnum = pgEnum("role", ["TRADIE", "CUSTOMER", "ADMIN"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("CUSTOMER"),
  emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
  acceptedTermsAt: timestamp("accepted_terms_at", { withTimezone: true }),
  acceptedPrivacyAt: timestamp("accepted_privacy_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const refreshTokensTable = pgTable("refresh_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  tokenHash: text("token_hash").notNull().unique(),
  familyId: text("family_id").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_refresh_tokens_family").on(t.familyId),
  index("idx_refresh_tokens_user").on(t.userId),
]);

export const passwordResetTokensTable = pgTable("password_reset_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id),
  tokenHash: text("token_hash").notNull().unique(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RefreshToken = typeof refreshTokensTable.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
