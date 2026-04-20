import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, userSettingsTable, ALL_ANNOTATION_FIELDS } from "@workspace/db";
import type { AuthRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/settings", async (req: AuthRequest, res): Promise<void> => {
  const [row] = await db
    .select()
    .from(userSettingsTable)
    .where(eq(userSettingsTable.userId, req.userId!));

  if (!row) {
    res.json({
      annotationFields: [...ALL_ANNOTATION_FIELDS],
      customPrompt: null,
    });
    return;
  }

  res.json({
    annotationFields: row.annotationFields.split(",").filter(Boolean),
    customPrompt: row.customPrompt ?? null,
  });
});

router.put("/settings", async (req: AuthRequest, res): Promise<void> => {
  const { annotationFields, customPrompt } = req.body as {
    annotationFields?: string[];
    customPrompt?: string | null;
  };

  const fieldsValue = Array.isArray(annotationFields)
    ? annotationFields.join(",")
    : ALL_ANNOTATION_FIELDS.join(",");

  await db
    .insert(userSettingsTable)
    .values({
      userId: req.userId!,
      annotationFields: fieldsValue,
      customPrompt: customPrompt ?? null,
    })
    .onConflictDoUpdate({
      target: userSettingsTable.userId,
      set: {
        annotationFields: fieldsValue,
        customPrompt: customPrompt ?? null,
      },
    });

  res.json({
    annotationFields: fieldsValue.split(",").filter(Boolean),
    customPrompt: customPrompt ?? null,
  });
});

export default router;
