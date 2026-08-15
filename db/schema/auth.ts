import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { pgEnum } from "drizzle-orm/pg-core";
import { users } from "./users";
import { createdAt } from "./common";

/**
 * Authentication domain — sessions and single-use auth tokens.
 *
 * Security: only SHA-256 hashes of tokens are stored; raw tokens are issued
 * to the client exactly once and never persisted.
 */

export const authTokenTypeEnum = pgEnum("auth_token_type", [
  "email_verification",
  "password_reset",
]);

/** Server-side revocable sessions. Token hash is unique. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt,
  },
  (table) => [
    uniqueIndex("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

/** Single-use email verification / password reset tokens. */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: authTokenTypeEnum("type").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    uniqueIndex("auth_tokens_token_hash_idx").on(table.tokenHash),
    index("auth_tokens_user_idx").on(table.userId, table.type),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type AuthToken = typeof authTokens.$inferSelect;
