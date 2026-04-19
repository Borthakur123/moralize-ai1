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
  mdmtReliable: boolean("mdmt_reliable").notNull().default(false),
  mdmtCapable: boolean("mdmt_capable").notNull().default(false),
  mdmtEthical: boolean("mdmt_ethical").notNull().default(false),
  mdmtSincere: boolean("mdmt_sincere").notNull().default(false),
  uncanny: text("uncanny").notNull().default("none"),
  socialRole: text("social_role").notNull().default("unclear"),
  blameTarget: text("blame_target").notNull().default("none"),
  moralFocus: text("moral_focus"),
  evidenceQuote: text("evidence_quote"),
  coderConfidence: integer("coder_confidence").notNull().default(2),
  needsHumanReview: boolean("needs_human_review").notNull().default(false),
  notes: text("notes"),
  authorOpenness: text("author_openness"),
  authorIdeology: text("author_ideology"),
  authorExpertise: text("author_expertise"),
  authorAffect: text("author_affect"),
  authorAgreeableness: text("author_agreeableness"),
  authorNeuroticism: text("author_neuroticism"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAnnotationSchema = createInsertSchema(annotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;
export type Annotation = typeof annotationsTable.$inferSelect;
