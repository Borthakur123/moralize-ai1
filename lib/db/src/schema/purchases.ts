import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  postCount: integer("post_count").notNull(),
  amountCents: integer("amount_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Purchase = typeof purchasesTable.$inferSelect;
