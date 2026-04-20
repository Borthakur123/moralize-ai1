import { Router, type IRouter } from "express";
import { eq, sql, and, isNull, or } from "drizzle-orm";
import { db, codersTable, annotationsTable } from "@workspace/db";
import {
  CreateCoderBody,
  GetCoderParams,
} from "@workspace/api-zod";
import type { AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

function coderUserWhere(req: AuthRequest) {
  if (req.isAdmin) {
    return or(eq(codersTable.userId, req.userId!), isNull(codersTable.userId));
  }
  return eq(codersTable.userId, req.userId!);
}

router.get("/coders", async (req: AuthRequest, res): Promise<void> => {
  const countSq = db
    .select({ coderId: annotationsTable.coderId, cnt: sql<number>`count(*)`.as("cnt") })
    .from(annotationsTable)
    .groupBy(annotationsTable.coderId)
    .as("annotation_counts");

  const coders = await db
    .select({
      id: codersTable.id,
      name: codersTable.name,
      email: codersTable.email,
      role: codersTable.role,
      createdAt: codersTable.createdAt,
      annotationCount: sql<number>`coalesce(${countSq.cnt}, 0)`.as("annotation_count"),
    })
    .from(codersTable)
    .leftJoin(countSq, eq(codersTable.id, countSq.coderId))
    .where(coderUserWhere(req))
    .orderBy(codersTable.createdAt);

  res.json(coders.map((c) => ({ ...c, annotationCount: Number(c.annotationCount) })));
});

router.post("/coders", async (req: AuthRequest, res): Promise<void> => {
  const parsed = CreateCoderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [coder] = await db
    .insert(codersTable)
    .values({ ...parsed.data, userId: req.userId })
    .returning();
  res.status(201).json({ ...coder, annotationCount: 0 });
});

router.get("/coders/:id", async (req: AuthRequest, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetCoderParams.safeParse({ id: raw });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const countSq = db
    .select({ coderId: annotationsTable.coderId, cnt: sql<number>`count(*)`.as("cnt") })
    .from(annotationsTable)
    .where(eq(annotationsTable.coderId, params.data.id))
    .groupBy(annotationsTable.coderId)
    .as("ac");

  const [coder] = await db
    .select({
      id: codersTable.id,
      name: codersTable.name,
      email: codersTable.email,
      role: codersTable.role,
      createdAt: codersTable.createdAt,
      annotationCount: sql<number>`coalesce(${countSq.cnt}, 0)`.as("annotation_count"),
    })
    .from(codersTable)
    .leftJoin(countSq, eq(codersTable.id, countSq.coderId))
    .where(and(coderUserWhere(req), eq(codersTable.id, params.data.id)));

  if (!coder) {
    res.status(404).json({ error: "Coder not found" });
    return;
  }

  res.json({ ...coder, annotationCount: Number(coder.annotationCount) });
});

export default router;
