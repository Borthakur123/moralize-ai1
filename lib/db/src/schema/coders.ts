import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const codersTable = pgTable("coders", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("coder"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoderSchema = createInsertSchema(codersTable).omit({ id: true, createdAt: true });
export type InsertCoder = z.infer<typeof insertCoderSchema>;
export type Coder = typeof codersTable.$inferSelect;
