import { Router, type IRouter } from "express";
import { eq, sql, and, isNull, or } from "drizzle-orm";
import { db, postsTable, annotationsTable, codersTable } from "@workspace/db";
import type { AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function postUserWhere(req: AuthRequest) {
  if (req.isAdmin) return or(eq(postsTable.userId, req.userId!), isNull(postsTable.userId));
  return eq(postsTable.userId, req.userId!);
}

function annUserWhere(req: AuthRequest) {
  if (req.isAdmin) return or(eq(annotationsTable.userId, req.userId!), isNull(annotationsTable.userId));
  return eq(annotationsTable.userId, req.userId!);
}

function coderUserWhere(req: AuthRequest) {
  if (req.isAdmin) return or(eq(codersTable.userId, req.userId!), isNull(codersTable.userId));
  return eq(codersTable.userId, req.userId!);
}

router.get("/stats/summary", async (req: AuthRequest, res): Promise<void> => {
  const [postStats] = await db
    .select({ total: sql<number>`count(*)` })
    .from(postsTable)
    .where(postUserWhere(req));

  const [annotationStats] = await db
    .select({ total: sql<number>`count(*)` })
    .from(annotationsTable)
    .where(annUserWhere(req));

  const [coderStats] = await db
    .select({ total: sql<number>`count(*)` })
    .from(codersTable)
    .where(coderUserWhere(req));

  const annotatedPostIds = db
    .selectDistinct({ id: annotationsTable.postId })
    .from(annotationsTable)
    .where(annUserWhere(req));

  const [annotatedCount] = await db
    .select({ total: sql<number>`count(*)` })
    .from(postsTable)
    .where(and(postUserWhere(req), sql`${postsTable.id} IN (${annotatedPostIds})`));

  const totalPosts = Number(postStats.total);
  const annotatedPosts = Number(annotatedCount.total);

  const anthropRows = await db
    .select({ level: annotationsTable.anthropomorphismLevel, cnt: sql<number>`count(*)` })
    .from(annotationsTable)
    .where(annUserWhere(req))
    .groupBy(annotationsTable.anthropomorphismLevel);

  const moralRows = await db
    .select({ level: annotationsTable.moralEvaluation, cnt: sql<number>`count(*)` })
    .from(annotationsTable)
    .where(annUserWhere(req))
    .groupBy(annotationsTable.moralEvaluation);

  const mindRows = await db
    .select({ level: annotationsTable.mindPerception, cnt: sql<number>`count(*)` })
    .from(annotationsTable)
    .where(annUserWhere(req))
    .groupBy(annotationsTable.mindPerception);

  const anthropBreakdown = { none: 0, mild: 0, strong: 0 };
  for (const row of anthropRows) {
    if (row.level in anthropBreakdown) {
      anthropBreakdown[row.level as keyof typeof anthropBreakdown] = Number(row.cnt);
    }
  }

  const moralBreakdown = { praise: 0, blame: 0, concern: 0, ambivalent: 0, none: 0 };
  for (const row of moralRows) {
    if (row.level in moralBreakdown) {
      moralBreakdown[row.level as keyof typeof moralBreakdown] = Number(row.cnt);
    }
  }

  const mindBreakdown = { agency: 0, experience: 0, both: 0, neither: 0 };
  for (const row of mindRows) {
    if (row.level in mindBreakdown) {
      mindBreakdown[row.level as keyof typeof mindBreakdown] = Number(row.cnt);
    }
  }

  res.json({
    totalPosts,
    annotatedPosts,
    unannotatedPosts: totalPosts - annotatedPosts,
    totalAnnotations: Number(annotationStats.total),
    totalCoders: Number(coderStats.total),
    anthropomorphismBreakdown: anthropBreakdown,
    moralEvaluationBreakdown: moralBreakdown,
    mindPerceptionBreakdown: mindBreakdown,
  });
});

router.get("/stats/by-subreddit", async (req: AuthRequest, res): Promise<void> => {
  const rows = await db
    .select({
      subreddit: postsTable.subreddit,
      postCount: sql<number>`count(distinct ${postsTable.id})`,
      annotationCount: sql<number>`count(${annotationsTable.id})`,
    })
    .from(postsTable)
    .leftJoin(
      annotationsTable,
      and(eq(postsTable.id, annotationsTable.postId), annUserWhere(req))
    )
    .where(postUserWhere(req))
    .groupBy(postsTable.subreddit)
    .orderBy(sql`count(distinct ${postsTable.id}) desc`);

  res.json(
    rows.map((r) => ({
      subreddit: r.subreddit,
      postCount: Number(r.postCount),
      annotationCount: Number(r.annotationCount),
      topMoralEvaluation: null,
    }))
  );
});

router.get("/stats/agreement", async (req: AuthRequest, res): Promise<void> => {
  const multipleRows = await db
    .select({ postId: annotationsTable.postId, cnt: sql<number>`count(*)` })
    .from(annotationsTable)
    .where(annUserWhere(req))
    .groupBy(annotationsTable.postId)
    .having(sql`count(*) > 1`);

  const postsWithMultiple = multipleRows.length;

  if (postsWithMultiple === 0) {
    res.json({
      postsWithMultipleAnnotations: 0,
      anthropomorphismAgreementPct: 0,
      mindPerceptionAgreementPct: 0,
      moralEvaluationAgreementPct: 0,
      uncannyAgreementPct: 0,
    });
    return;
  }

  const postIds = multipleRows.map((r) => r.postId);

  let anthropAgree = 0;
  let mindAgree = 0;
  let moralAgree = 0;
  let uncannyAgree = 0;

  for (const postId of postIds) {
    const anns = await db
      .select({
        anthropomorphismLevel: annotationsTable.anthropomorphismLevel,
        mindPerception: annotationsTable.mindPerception,
        moralEvaluation: annotationsTable.moralEvaluation,
        uncanny: annotationsTable.uncanny,
      })
      .from(annotationsTable)
      .where(and(annUserWhere(req), eq(annotationsTable.postId, postId)));

    const allSame = (field: keyof typeof anns[0]) =>
      anns.every((a) => a[field] === anns[0][field]);

    if (allSame("anthropomorphismLevel")) anthropAgree++;
    if (allSame("mindPerception")) mindAgree++;
    if (allSame("moralEvaluation")) moralAgree++;
    if (allSame("uncanny")) uncannyAgree++;
  }

  const pct = (n: number) => Math.round((n / postsWithMultiple) * 100);

  res.json({
    postsWithMultipleAnnotations: postsWithMultiple,
    anthropomorphismAgreementPct: pct(anthropAgree),
    mindPerceptionAgreementPct: pct(mindAgree),
    moralEvaluationAgreementPct: pct(moralAgree),
    uncannyAgreementPct: pct(uncannyAgree),
  });
});

export default router;
