import { Router, type IRouter } from "express";
import { eq, sql, and, isNull, or } from "drizzle-orm";
import { db, postsTable, annotationsTable, codersTable } from "@workspace/db";
import {
  ListPostsQueryParams,
  CreatePostBody,
  BulkCreatePostsBody,
  GetPostParams,
  DeletePostParams,
  GetNextPostToAnnotateQueryParams,
} from "@workspace/api-zod";
import type { AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();
const FREE_POST_LIMIT = 500;

function postUserWhere(req: AuthRequest) {
  if (req.isAdmin) {
    return or(eq(postsTable.userId, req.userId!), isNull(postsTable.userId));
  }
  return eq(postsTable.userId, req.userId!);
}

function annotationUserWhere(req: AuthRequest) {
  if (req.isAdmin) {
    return or(eq(annotationsTable.userId, req.userId!), isNull(annotationsTable.userId));
  }
  return eq(annotationsTable.userId, req.userId!);
}

router.get("/posts", async (req: AuthRequest, res): Promise<void> => {
  const parsed = ListPostsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { subreddit, annotated, limit = 500, offset = 0 } = parsed.data;

  const countSq = db
    .select({ postId: annotationsTable.postId, cnt: sql<number>`count(*)`.as("cnt") })
    .from(annotationsTable)
    .where(annotationUserWhere(req))
    .groupBy(annotationsTable.postId)
    .as("annotation_counts");

  const baseWhere = postUserWhere(req);

  let query = db
    .select({
      id: postsTable.id,
      externalId: postsTable.externalId,
      platform: postsTable.platform,
      subreddit: postsTable.subreddit,
      author: postsTable.author,
      title: postsTable.title,
      content: postsTable.content,
      url: postsTable.url,
      postedAt: postsTable.postedAt,
      createdAt: postsTable.createdAt,
      annotationCount: sql<number>`coalesce(${countSq.cnt}, 0)`.as("annotation_count"),
    })
    .from(postsTable)
    .leftJoin(countSq, eq(postsTable.id, countSq.postId))
    .where(baseWhere)
    .$dynamic();

  if (subreddit) {
    query = query.where(and(baseWhere, eq(postsTable.subreddit, subreddit)));
  }

  if (annotated === "yes") {
    query = query.where(and(baseWhere, sql`coalesce(${countSq.cnt}, 0) > 0`));
  } else if (annotated === "no") {
    query = query.where(and(baseWhere, sql`coalesce(${countSq.cnt}, 0) = 0`));
  }

  if (limit != null) {
    query = query.limit(limit);
  }
  if (offset != null) {
    query = query.offset(offset);
  }

  const posts = await query;
  res.json(posts.map((p) => ({ ...p, annotationCount: Number(p.annotationCount) })));
});

router.post("/posts", async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [post] = await db.insert(postsTable).values({ ...parsed.data, userId: req.userId }).returning();
  res.status(201).json({ ...post, annotationCount: 0 });
});

router.post("/posts/bulk", async (req: AuthRequest, res): Promise<void> => {
  const parsed = BulkCreatePostsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!req.isAdmin) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(postsTable)
      .where(postUserWhere(req));
    const currentCount = Number(countRow?.count ?? 0);
    if (currentCount >= FREE_POST_LIMIT) {
      res.status(403).json({
        error: `Post limit reached. Free accounts are capped at ${FREE_POST_LIMIT} posts. Please contact the administrator to increase your limit.`,
        limitReached: true,
        current: currentCount,
        limit: FREE_POST_LIMIT,
      });
      return;
    }
  }

  let imported = 0;
  let skipped = 0;

  for (const postData of parsed.data.posts) {
    if (!req.isAdmin) {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(postsTable)
        .where(postUserWhere(req));
      if (Number(countRow?.count ?? 0) >= FREE_POST_LIMIT) {
        skipped += parsed.data.posts.length - imported - skipped;
        break;
      }
    }

    // Deduplicate by externalId first, then fall back to URL
    if (postData.externalId) {
      const existing = await db
        .select({ id: postsTable.id })
        .from(postsTable)
        .where(and(postUserWhere(req), eq(postsTable.externalId, postData.externalId)))
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }
    } else if (postData.url) {
      const existing = await db
        .select({ id: postsTable.id })
        .from(postsTable)
        .where(and(postUserWhere(req), eq(postsTable.url, postData.url)))
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }
    }
    await db.insert(postsTable).values({ ...postData, userId: req.userId });
    imported++;
  }

  res.status(201).json({ imported, skipped, total: parsed.data.posts.length });
});

router.get("/posts/next-to-annotate", async (req: AuthRequest, res): Promise<void> => {
  const parsed = GetNextPostToAnnotateQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { coderId } = parsed.data;

  const alreadyAnnotated = db
    .select({ postId: annotationsTable.postId })
    .from(annotationsTable)
    .where(eq(annotationsTable.coderId, coderId));

  const [post] = await db
    .select({
      id: postsTable.id,
      externalId: postsTable.externalId,
      platform: postsTable.platform,
      subreddit: postsTable.subreddit,
      author: postsTable.author,
      title: postsTable.title,
      content: postsTable.content,
      url: postsTable.url,
      postedAt: postsTable.postedAt,
      createdAt: postsTable.createdAt,
    })
    .from(postsTable)
    .where(and(postUserWhere(req), sql`${postsTable.id} NOT IN (${alreadyAnnotated})`))
    .orderBy(postsTable.id)
    .limit(1);

  if (!post) {
    res.status(404).json({ error: "No more posts to annotate" });
    return;
  }

  res.json({ ...post, annotationCount: 0 });
});

router.get("/posts/:id", async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPostParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const countSq = db
    .select({ postId: annotationsTable.postId, cnt: sql<number>`count(*)`.as("cnt") })
    .from(annotationsTable)
    .where(and(annotationUserWhere(req), eq(annotationsTable.postId, params.data.id)))
    .groupBy(annotationsTable.postId)
    .as("ac");

  const [post] = await db
    .select({
      id: postsTable.id,
      externalId: postsTable.externalId,
      platform: postsTable.platform,
      subreddit: postsTable.subreddit,
      author: postsTable.author,
      title: postsTable.title,
      content: postsTable.content,
      url: postsTable.url,
      postedAt: postsTable.postedAt,
      createdAt: postsTable.createdAt,
      annotationCount: sql<number>`coalesce(${countSq.cnt}, 0)`.as("annotation_count"),
    })
    .from(postsTable)
    .leftJoin(countSq, eq(postsTable.id, countSq.postId))
    .where(and(postUserWhere(req), eq(postsTable.id, params.data.id)));

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json({ ...post, annotationCount: Number(post.annotationCount) });
});

router.post("/posts/fetch-reddit", async (req: AuthRequest, res): Promise<void> => {
  const { subreddit, limit = 100, searchQuery, direction = "newer" } = req.body as {
    subreddit: string; limit?: number; searchQuery?: string; direction?: "newer" | "older";
  };

  if (!subreddit || typeof subreddit !== "string") {
    res.status(400).json({ error: "subreddit is required" });
    return;
  }

  // Determine the anchor timestamp based on direction:
  // "newer" → fetch posts AFTER the most recent post we already have
  // "older" → fetch posts BEFORE the oldest post we already have
  let anchorTimestamp: number | null = null;
  try {
    const subredditLower = subreddit.toLowerCase();
    if (direction === "newer") {
      const [newest] = await db
        .select({ postedAt: postsTable.postedAt })
        .from(postsTable)
        .where(and(postUserWhere(req), sql`LOWER(${postsTable.subreddit}) = ${subredditLower}`, sql`${postsTable.postedAt} IS NOT NULL`))
        .orderBy(sql`${postsTable.postedAt} DESC`)
        .limit(1);
      if (newest?.postedAt) anchorTimestamp = Math.floor(new Date(newest.postedAt).getTime() / 1000);
    } else {
      const [oldest] = await db
        .select({ postedAt: postsTable.postedAt })
        .from(postsTable)
        .where(and(postUserWhere(req), sql`LOWER(${postsTable.subreddit}) = ${subredditLower}`, sql`${postsTable.postedAt} IS NOT NULL`))
        .orderBy(sql`${postsTable.postedAt} ASC`)
        .limit(1);
      if (oldest?.postedAt) anchorTimestamp = Math.floor(new Date(oldest.postedAt).getTime() / 1000);
    }
  } catch {
    // If lookup fails, proceed without anchor
  }

  const maxPosts = Math.min(Number(limit) || 100, 500);
  const batchSize = 100;
  const allPosts: Record<string, unknown>[] = [];
  let before: number | null = direction === "older" && anchorTimestamp !== null ? anchorTimestamp : null;

  try {
    while (allPosts.length < maxPosts) {
      const fetchCount = Math.min(batchSize, maxPosts - allPosts.length);

      const params = new URLSearchParams({
        subreddit,
        size: String(fetchCount),
        sort: "desc",
        sort_type: "created_utc",
      });
      if (searchQuery) params.set("q", searchQuery);
      // For "newer": filter to posts after anchor; for "older": paginate backwards via before
      if (direction === "newer" && anchorTimestamp !== null) params.set("after", String(anchorTimestamp));
      if (before !== null) params.set("before", String(before));

      const response = await fetch(`https://api.pullpush.io/reddit/search/submission/?${params}`, {
        headers: { "User-Agent": "MoralizeAI/1.0 research tool" },
        signal: AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        res.status(502).json({ error: `Reddit archive returned ${response.status}` });
        return;
      }

      const json = await response.json() as { data?: Record<string, unknown>[] };
      const posts = json?.data ?? [];
      allPosts.push(...posts);

      if (posts.length < fetchCount) break;
      const oldest = posts[posts.length - 1] as { created_utc?: number };
      before = oldest.created_utc ?? null;
      if (before === null) break;
    }

    res.json({
      posts: allPosts.slice(0, maxPosts),
      fetchedAfter: anchorTimestamp ? new Date(anchorTimestamp * 1000).toISOString() : null,
    });
  } catch (err) {
    res.status(502).json({ error: `Failed to fetch posts: ${String(err)}` });
  }
});

router.post("/posts/claim-legacy", async (req: AuthRequest, res): Promise<void> => {
  if (!req.isAdmin) {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  const uid = req.userId!;
  const [p, c, a] = await Promise.all([
    db.update(postsTable).set({ userId: uid }).where(isNull(postsTable.userId)).returning({ id: postsTable.id }),
    db.update(codersTable).set({ userId: uid }).where(isNull(codersTable.userId)).returning({ id: codersTable.id }),
    db.update(annotationsTable).set({ userId: uid }).where(isNull(annotationsTable.userId)).returning({ id: annotationsTable.id }),
  ]);
  res.json({ posts: p.length, coders: c.length, annotations: a.length });
});

router.delete("/posts/all", async (req: AuthRequest, res): Promise<void> => {
  await db.delete(annotationsTable).where(annotationUserWhere(req));
  await db.delete(postsTable).where(postUserWhere(req));
  res.json({ message: "All posts and annotations deleted." });
});

router.delete("/posts/:id", async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePostParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(postsTable)
    .where(and(postUserWhere(req), eq(postsTable.id, params.data.id)))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
