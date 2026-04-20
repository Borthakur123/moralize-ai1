import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const ALL_ANNOTATION_FIELDS = [
  "anthropomorphism",
  "mindPerception",
  "moralEvaluation",
  "mdmtTrust",
  "uncanny",
  "socialRole",
  "blameTarget",
  "moralFocus",
  "evidenceQuote",
  "coderConfidence",
  "needsHumanReview",
  "notes",
  "authorSignals",
] as const;

export type AnnotationField = typeof ALL_ANNOTATION_FIELDS[number];

export const userSettingsTable = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  annotationFields: text("annotation_fields").notNull().default(ALL_ANNOTATION_FIELDS.join(",")),
  customPrompt: text("custom_prompt"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UserSettings = typeof userSettingsTable.$inferSelect;
