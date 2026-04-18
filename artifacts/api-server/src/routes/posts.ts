import { Router, type IRouter } from "express";
import { eq, sql, and, isNull, notInArray } from "drizzle-orm";
import { db, postsTable, annotationsTable } from "@workspace/db";
import {
  ListPostsQueryParams,
  CreatePostBody,
  BulkCreatePostsBody,
  GetPostParams,
  DeletePostParams,
  GetNextPostToAnnotateQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/posts", async (req, res): Promise<void> => {
  const parsed = ListPostsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { subreddit, annotated, limit = 500, offset = 0 } = parsed.data;

  const countSq = db
    .select({ postId: annotationsTable.postId, cnt: sql<number>`count(*)`.as("cnt") })
    .from(annotationsTable)
    .groupBy(annotationsTable.postId)
    .as("annotation_counts");

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
    .$dynamic();

  if (subreddit) {
    query = query.where(eq(postsTable.subreddit, subreddit));
  }

  if (annotated === "yes") {
    query = query.where(sql`coalesce(${countSq.cnt}, 0) > 0`);
  } else if (annotated === "no") {
    query = query.where(sql`coalesce(${countSq.cnt}, 0) = 0`);
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

router.post("/posts", async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [post] = await db.insert(postsTable).values(parsed.data).returning();
  res.status(201).json({ ...post, annotationCount: 0 });
});

router.post("/posts/bulk", async (req, res): Promise<void> => {
  const parsed = BulkCreatePostsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let imported = 0;
  let skipped = 0;

  for (const postData of parsed.data.posts) {
    if (postData.externalId) {
      const existing = await db
        .select({ id: postsTable.id })
        .from(postsTable)
        .where(eq(postsTable.externalId, postData.externalId))
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }
    }
    await db.insert(postsTable).values(postData);
    imported++;
  }

  res.status(201).json({ imported, skipped, total: parsed.data.posts.length });
});

router.get("/posts/next-to-annotate", async (req, res): Promise<void> => {
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
    .where(
      sql`${postsTable.id} NOT IN (${alreadyAnnotated})`
    )
    .orderBy(postsTable.id)
    .limit(1);

  if (!post) {
    res.status(404).json({ error: "No more posts to annotate" });
    return;
  }

  res.json({ ...post, annotationCount: 0 });
});

router.get("/posts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetPostParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const countSq = db
    .select({ postId: annotationsTable.postId, cnt: sql<number>`count(*)`.as("cnt") })
    .from(annotationsTable)
    .where(eq(annotationsTable.postId, params.data.id))
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
    .where(eq(postsTable.id, params.data.id));

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json({ ...post, annotationCount: Number(post.annotationCount) });
});

router.post("/posts/fetch-reddit", async (req, res): Promise<void> => {
  const { subreddit, limit = 100, searchQuery } = req.body as { subreddit: string; limit?: number; searchQuery?: string };

  if (!subreddit || typeof subreddit !== "string") {
    res.status(400).json({ error: "subreddit is required" });
    return;
  }

  const maxPosts = Math.min(Number(limit) || 100, 500);
  const batchSize = 100;
  const allPosts: Record<string, unknown>[] = [];
  let after: string | null = null;

  try {
    while (allPosts.length < maxPosts) {
      const remaining = maxPosts - allPosts.length;
      const fetchCount = Math.min(batchSize, remaining);

      let url: string;
      if (searchQuery) {
        url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(searchQuery)}&restrict_sr=1&sort=new&limit=${fetchCount}`;
      } else {
        url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/new.json?limit=${fetchCount}`;
      }
      if (after) url += `&after=${after}`;

      const response = await fetch(url, {
        headers: { "User-Agent": "MoralizeAI/1.0 (computational social science research)" },
      });

      if (!response.ok) {
        res.status(502).json({ error: `Reddit returned ${response.status}` });
        return;
      }

      const json = await response.json() as { data?: { children?: { kind: string; data: Record<string, unknown> }[]; after?: string | null } };
      const children = json?.data?.children ?? [];
      const posts = children.filter(c => c.kind === "t3").map(c => c.data);
      allPosts.push(...posts);
      after = json?.data?.after ?? null;

      if (!after || posts.length === 0) break;
    }

    res.json({ posts: allPosts.slice(0, maxPosts) });
  } catch (err) {
    res.status(502).json({ error: `Failed to fetch from Reddit: ${String(err)}` });
  }
});

router.delete("/posts/all", async (req, res): Promise<void> => {
  await db.delete(annotationsTable);
  await db.delete(postsTable);
  res.json({ message: "All posts and annotations deleted." });
});

router.delete("/posts/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePostParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(postsTable).where(eq(postsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
