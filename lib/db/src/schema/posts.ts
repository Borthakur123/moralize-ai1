import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postsTable = pgTable("posts", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  externalId: text("external_id"),
  platform: text("platform").notNull().default("reddit"),
  subreddit: text("subreddit"),
  author: text("author"),
  title: text("title"),
  content: text("content").notNull(),
  url: text("url"),
  postedAt: text("posted_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true, createdAt: true });
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
