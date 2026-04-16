import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const annotationsTable = pgTable("annotations", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  coderId: integer("coder_id").notNull(),
  anthropomorphismLevel: text("anthropomorphism_level").notNull().default("none"),
  mindPerception: text("mind_perception").notNull().default("neither"),
  moralEvaluation: text("moral_evaluation").notNull().default("none"),
  vassValues: boolean("vass_values").notNull().default(false),
  vassAutonomy: boolean("vass_autonomy").notNull().default(false),
  vassSocialConnection: boolean("vass_social_connection").notNull().default(false),
  vassSelfAwareEmotions: boolean("vass_self_aware_emotions").notNull().default(false),
  uncanny: text("uncanny").notNull().default("none"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAnnotationSchema = createInsertSchema(annotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type Annotation = typeof annotationsTable.$inferSelect;
