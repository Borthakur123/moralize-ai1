import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, annotationsTable, postsTable, codersTable } from "@workspace/db";
import {
  ListAnnotationsQueryParams,
  CreateAnnotationBody,
  GetAnnotationParams,
  UpdateAnnotationParams,
  UpdateAnnotationBody,
  DeleteAnnotationParams,
  GetPostAnnotationsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const annotationWithCoderName = (coderId?: number, postId?: number) => {
  let query = db
    .select({
      id: annotationsTable.id,
      postId: annotationsTable.postId,
      coderId: annotationsTable.coderId,
      coderName: codersTable.name,
      anthropomorphismLevel: annotationsTable.anthropomorphismLevel,
      mindPerception: annotationsTable.mindPerception,
      moralEvaluation: annotationsTable.moralEvaluation,
      vassValues: annotationsTable.vassValues,
      vassAutonomy: annotationsTable.vassAutonomy,
      vassSocialConnection: annotationsTable.vassSocialConnection,
      vassSelfAwareEmotions: annotationsTable.vassSelfAwareEmotions,
      uncanny: annotationsTable.uncanny,
      notes: annotationsTable.notes,
      createdAt: annotationsTable.createdAt,
      updatedAt: annotationsTable.updatedAt,
    })
    .from(annotationsTable)
    .leftJoin(codersTable, eq(annotationsTable.coderId, codersTable.id))
    .$dynamic();

  if (coderId != null) {
    query = query.where(eq(annotationsTable.coderId, coderId));
  }
  if (postId != null) {
    query = query.where(eq(annotationsTable.postId, postId));
  }

  return query;
};

router.get("/posts/:id/annotations", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPostAnnotationsParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const annotations = await annotationWithCoderName(undefined, params.data.id);
  res.json(annotations);
});

router.get("/annotations", async (req, res): Promise<void> => {
  const parsed = ListAnnotationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { coderId, postId } = parsed.data;
  const annotations = await annotationWithCoderName(
    coderId ?? undefined,
    postId ?? undefined
  );
  res.json(annotations);
});

router.post("/annotations", async (req, res): Promise<void> => {
  const parsed = CreateAnnotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [annotation] = await db.insert(annotationsTable).values(parsed.data).returning();

  const [coder] = await db
    .select({ name: codersTable.name })
    .from(codersTable)
    .where(eq(codersTable.id, annotation.coderId));

  res.status(201).json({ ...annotation, coderName: coder?.name ?? null });
});

router.get("/annotations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetAnnotationParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [annotation] = await db
    .select({
      id: annotationsTable.id,
      postId: annotationsTable.postId,
      coderId: annotationsTable.coderId,
      coderName: codersTable.name,
      anthropomorphismLevel: annotationsTable.anthropomorphismLevel,
      mindPerception: annotationsTable.mindPerception,
      moralEvaluation: annotationsTable.moralEvaluation,
      vassValues: annotationsTable.vassValues,
      vassAutonomy: annotationsTable.vassAutonomy,
      vassSocialConnection: annotationsTable.vassSocialConnection,
      vassSelfAwareEmotions: annotationsTable.vassSelfAwareEmotions,
      uncanny: annotationsTable.uncanny,
      notes: annotationsTable.notes,
      createdAt: annotationsTable.createdAt,
      updatedAt: annotationsTable.updatedAt,
    })
    .from(annotationsTable)
    .leftJoin(codersTable, eq(annotationsTable.coderId, codersTable.id))
    .where(eq(annotationsTable.id, params.data.id));

  if (!annotation) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }

  res.json(annotation);
});

router.patch("/annotations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAnnotationParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAnnotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<{
    anthropomorphismLevel: string;
    mindPerception: string;
    moralEvaluation: string;
    vassValues: boolean;
    vassAutonomy: boolean;
    vassSocialConnection: boolean;
    vassSelfAwareEmotions: boolean;
    uncanny: string;
    notes: string | null;
  }> = {};
  const d = parsed.data;
  if (d.anthropomorphismLevel != null) updateData.anthropomorphismLevel = d.anthropomorphismLevel;
  if (d.mindPerception != null) updateData.mindPerception = d.mindPerception;
  if (d.moralEvaluation != null) updateData.moralEvaluation = d.moralEvaluation;
  if (d.vassValues != null) updateData.vassValues = d.vassValues;
  if (d.vassAutonomy != null) updateData.vassAutonomy = d.vassAutonomy;
  if (d.vassSocialConnection != null) updateData.vassSocialConnection = d.vassSocialConnection;
  if (d.vassSelfAwareEmotions != null) updateData.vassSelfAwareEmotions = d.vassSelfAwareEmotions;
  if (d.uncanny != null) updateData.uncanny = d.uncanny;
  if ("notes" in d) updateData.notes = d.notes ?? null;

  const [updated] = await db
    .update(annotationsTable)
    .set(updateData)
    .where(eq(annotationsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }

  const [coder] = await db
    .select({ name: codersTable.name })
    .from(codersTable)
    .where(eq(codersTable.id, updated.coderId));

  res.json({ ...updated, coderName: coder?.name ?? null });
});

router.delete("/annotations/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAnnotationParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(annotationsTable)
    .where(eq(annotationsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
