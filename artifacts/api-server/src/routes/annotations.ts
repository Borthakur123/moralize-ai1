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

router.get("/annotations/export", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      annotation_id: annotationsTable.id,
      post_id: annotationsTable.postId,
      post_subreddit: postsTable.subreddit,
      post_platform: postsTable.platform,
      post_author: postsTable.author,
      post_title: postsTable.title,
      post_content: postsTable.content,
      post_url: postsTable.url,
      post_posted_at: postsTable.postedAt,
      coder_id: annotationsTable.coderId,
      coder_name: codersTable.name,
      anthropomorphism_level: annotationsTable.anthropomorphismLevel,
      mind_perception: annotationsTable.mindPerception,
      moral_evaluation: annotationsTable.moralEvaluation,
      vass_values: annotationsTable.vassValues,
      vass_autonomy: annotationsTable.vassAutonomy,
      vass_social_connection: annotationsTable.vassSocialConnection,
      vass_self_aware_emotions: annotationsTable.vassSelfAwareEmotions,
      uncanny: annotationsTable.uncanny,
      notes: annotationsTable.notes,
      annotated_at: annotationsTable.createdAt,
    })
    .from(annotationsTable)
    .leftJoin(postsTable, eq(annotationsTable.postId, postsTable.id))
    .leftJoin(codersTable, eq(annotationsTable.coderId, codersTable.id))
    .orderBy(annotationsTable.id);

  const headers = [
    "annotation_id", "post_id", "post_subreddit", "post_platform", "post_author",
    "post_title", "post_content", "post_url", "post_posted_at",
    "coder_id", "coder_name",
    "anthropomorphism_level", "mind_perception", "moral_evaluation",
    "vass_values", "vass_autonomy", "vass_social_connection", "vass_self_aware_emotions",
    "uncanny", "notes", "annotated_at"
  ];

  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => escape((row as Record<string, unknown>)[h])).join(",")
    ),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="moralize-ai-annotations-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(lines.join("\n"));
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
