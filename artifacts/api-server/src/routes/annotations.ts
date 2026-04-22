import { Router, type IRouter } from "express";
import { eq, and, isNull, or, sql } from "drizzle-orm";
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
import type { AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function annUserWhere(req: AuthRequest) {
  if (req.isAdmin) return or(eq(annotationsTable.userId, req.userId!), isNull(annotationsTable.userId));
  return eq(annotationsTable.userId, req.userId!);
}

const annotationWithCoderName = (req: AuthRequest, coderId?: number, postId?: number) => {
  const baseWhere = annUserWhere(req);
  let query = db
    .select({
      id: annotationsTable.id,
      postId: annotationsTable.postId,
      coderId: annotationsTable.coderId,
      coderName: codersTable.name,
      anthropomorphismLevel: annotationsTable.anthropomorphismLevel,
      mindPerception: annotationsTable.mindPerception,
      moralEvaluation: annotationsTable.moralEvaluation,
      mdmtReliable: annotationsTable.mdmtReliable,
      mdmtCapable: annotationsTable.mdmtCapable,
      mdmtEthical: annotationsTable.mdmtEthical,
      mdmtSincere: annotationsTable.mdmtSincere,
      uncanny: annotationsTable.uncanny,
      socialRole: annotationsTable.socialRole,
      blameTarget: annotationsTable.blameTarget,
      moralFocus: annotationsTable.moralFocus,
      evidenceQuote: annotationsTable.evidenceQuote,
      coderConfidence: annotationsTable.coderConfidence,
      needsHumanReview: annotationsTable.needsHumanReview,
      notes: annotationsTable.notes,
      authorOpenness: annotationsTable.authorOpenness,
      authorIdeology: annotationsTable.authorIdeology,
      authorExpertise: annotationsTable.authorExpertise,
      authorAffect: annotationsTable.authorAffect,
      authorAgreeableness: annotationsTable.authorAgreeableness,
      authorNeuroticism: annotationsTable.authorNeuroticism,
      createdAt: annotationsTable.createdAt,
      updatedAt: annotationsTable.updatedAt,
    })
    .from(annotationsTable)
    .leftJoin(codersTable, eq(annotationsTable.coderId, codersTable.id))
    .where(baseWhere)
    .$dynamic();

  if (coderId != null) {
    query = query.where(and(baseWhere, eq(annotationsTable.coderId, coderId)));
  }
  if (postId != null) {
    query = query.where(and(baseWhere, eq(annotationsTable.postId, postId)));
  }

  return query;
};

router.get("/posts/:id/annotations", async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPostAnnotationsParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const annotations = await annotationWithCoderName(req, undefined, params.data.id);
  res.json(annotations);
});

router.get("/annotations/export", async (req: AuthRequest, res): Promise<void> => {
  // Deduplicated export:
  // 1. For each post URL, use the lowest post_id as the canonical post (resolves duplicate imports)
  // 2. For each (canonical URL, coder) pair, keep only the most recent annotation (resolves re-coding)
  const userCondition = req.isAdmin
    ? sql`(a.user_id = ${req.userId} OR a.user_id IS NULL)`
    : sql`a.user_id = ${req.userId}`;

  const rows = await db.execute(sql`
    WITH canonical_posts AS (
      SELECT url, MIN(id) AS canonical_id
      FROM posts
      WHERE url IS NOT NULL AND url <> ''
      GROUP BY url
    ),
    deduped AS (
      SELECT DISTINCT ON (cp.url, a.coder_id)
        a.id                        AS annotation_id,
        cp.canonical_id             AS post_id,
        p.subreddit                 AS post_subreddit,
        p.platform                  AS post_platform,
        p.author                    AS post_author,
        p.title                     AS post_title,
        p.content                   AS post_content,
        p.url                       AS post_url,
        p.posted_at                 AS post_posted_at,
        a.coder_id,
        c.name                      AS coder_name,
        a.anthropomorphism_level,
        a.mind_perception,
        a.moral_evaluation,
        a.mdmt_reliable,
        a.mdmt_capable,
        a.mdmt_ethical,
        a.mdmt_sincere,
        a.uncanny,
        a.social_role,
        a.blame_target,
        a.moral_focus,
        a.evidence_quote,
        a.coder_confidence,
        a.needs_human_review,
        a.notes,
        a.author_openness,
        a.author_ideology,
        a.author_expertise,
        a.author_affect,
        a.author_agreeableness,
        a.author_neuroticism,
        a.created_at                AS annotated_at
      FROM annotations a
      JOIN posts p ON a.post_id = p.id
      JOIN canonical_posts cp ON p.url = cp.url
      JOIN posts p2 ON p2.id = cp.canonical_id
      LEFT JOIN coders c ON a.coder_id = c.id
      WHERE ${userCondition}
      ORDER BY cp.url, a.coder_id, a.id DESC
    )
    SELECT * FROM deduped ORDER BY annotation_id
  `);

  const headers = [
    "annotation_id", "post_id", "post_subreddit", "post_platform", "post_author",
    "post_title", "post_content", "post_url", "post_posted_at",
    "coder_id", "coder_name",
    "anthropomorphism_level", "mind_perception", "moral_evaluation",
    "mdmt_reliable", "mdmt_capable", "mdmt_ethical", "mdmt_sincere",
    "uncanny", "social_role", "blame_target", "moral_focus",
    "evidence_quote", "coder_confidence", "needs_human_review",
    "notes",
    "author_openness", "author_ideology", "author_expertise",
    "author_affect", "author_agreeableness", "author_neuroticism",
    "annotated_at"
  ];

  const escape = (v: unknown): string => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const dataRows = (rows as unknown as { rows: Record<string, unknown>[] }).rows;

  const lines = [
    headers.join(","),
    ...dataRows.map((row) =>
      headers.map((h) => escape(row[h])).join(",")
    ),
  ];

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="moralize-ai-annotations-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(lines.join("\n"));
});

router.get("/annotations", async (req: AuthRequest, res): Promise<void> => {
  const parsed = ListAnnotationsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { coderId, postId } = parsed.data;
  const annotations = await annotationWithCoderName(
    req,
    coderId ?? undefined,
    postId ?? undefined
  );
  res.json(annotations);
});

router.post("/annotations", async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateAnnotationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [annotation] = await db
    .insert(annotationsTable)
    .values({ ...parsed.data, userId: req.userId })
    .returning();
  const [coder] = await db
    .select({ name: codersTable.name })
    .from(codersTable)
    .where(eq(codersTable.id, annotation.coderId));

  res.status(201).json({ ...annotation, coderName: coder?.name ?? null });
});

router.get("/annotations/:id", async (req: AuthRequest, res): Promise<void> => {
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
      mdmtReliable: annotationsTable.mdmtReliable,
      mdmtCapable: annotationsTable.mdmtCapable,
      mdmtEthical: annotationsTable.mdmtEthical,
      mdmtSincere: annotationsTable.mdmtSincere,
      uncanny: annotationsTable.uncanny,
      socialRole: annotationsTable.socialRole,
      blameTarget: annotationsTable.blameTarget,
      moralFocus: annotationsTable.moralFocus,
      evidenceQuote: annotationsTable.evidenceQuote,
      coderConfidence: annotationsTable.coderConfidence,
      needsHumanReview: annotationsTable.needsHumanReview,
      notes: annotationsTable.notes,
      createdAt: annotationsTable.createdAt,
      updatedAt: annotationsTable.updatedAt,
    })
    .from(annotationsTable)
    .leftJoin(codersTable, eq(annotationsTable.coderId, codersTable.id))
    .where(and(annUserWhere(req), eq(annotationsTable.id, params.data.id)));

  if (!annotation) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }
  res.json(annotation);
});

router.patch("/annotations/:id", async (req: AuthRequest, res): Promise<void> => {
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
    mdmtReliable: boolean;
    mdmtCapable: boolean;
    mdmtEthical: boolean;
    mdmtSincere: boolean;
    uncanny: string;
    notes: string | null;
  }> = {};

  const d = parsed.data;
  if (d.anthropomorphismLevel != null) updateData.anthropomorphismLevel = d.anthropomorphismLevel;
  if (d.mindPerception != null) updateData.mindPerception = d.mindPerception;
  if (d.moralEvaluation != null) updateData.moralEvaluation = d.moralEvaluation;
  if (d.mdmtReliable != null) updateData.mdmtReliable = d.mdmtReliable;
  if (d.mdmtCapable != null) updateData.mdmtCapable = d.mdmtCapable;
  if (d.mdmtEthical != null) updateData.mdmtEthical = d.mdmtEthical;
  if (d.mdmtSincere != null) updateData.mdmtSincere = d.mdmtSincere;
  if (d.uncanny != null) updateData.uncanny = d.uncanny;
  if ("notes" in d) updateData.notes = d.notes ?? null;

  const [updated] = await db
    .update(annotationsTable)
    .set(updateData)
    .where(and(annUserWhere(req), eq(annotationsTable.id, params.data.id)))
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

router.delete("/annotations/:id", async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAnnotationParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(annotationsTable)
    .where(and(annUserWhere(req), eq(annotationsTable.id, params.data.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Annotation not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
