import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, postsTable, annotationsTable, codersTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";

const router: IRouter = Router();

const ANNOTATION_PROMPT = `You are a research assistant helping code social media posts for a computational social science study on how people anthropomorphize and morally evaluate AI systems online.

Analyze the post and return ONLY valid JSON with exactly these fields:

{
  "anthropomorphismLevel": "none" | "mild" | "strong",
  "mindPerception": "agency" | "experience" | "both" | "neither",
  "moralEvaluation": "praise" | "blame" | "concern" | "ambivalent" | "none",
  "mdmtReliable": true | false,
  "mdmtCapable": true | false,
  "mdmtEthical": true | false,
  "mdmtSincere": true | false,
  "uncanny": "eerie" | "creepy" | "fake-human" | "unsettling" | "none",
  "notes": "1-2 sentence rationale"
}

Coding guide:

ANTHROPOMORPHISM LEVEL (Epley, Waytz & Cacioppo, 2007):
- none: AI described as a pure tool, algorithm, or software with no human-like qualities
- mild: Some humanizing metaphors or casual human-like language, but overall framed as a tool
- strong: AI explicitly attributed human emotions, intentions, moral standing, desires, or social identity

MIND PERCEPTION (Gray, Gray & Wegner, 2007):
- agency: AI described as planning, deciding, intending, lying, manipulating, choosing
- experience: AI described as feeling, suffering, caring, being lonely, being hurt, having needs
- both: Both agency and experience present
- neither: No mental states attributed to the AI

MORAL EVALUATION:
- praise: AI admired, trusted, morally approved of; seen as beneficial or noble
- blame: AI held responsible or culpable for harm; described as dangerous, wrong, or at fault
- concern: Worry, unease, or ethical risk expressed about AI without clear blame assignment
- ambivalent: Mixed, uncertain, or conflicted moral stance
- none: Morally neutral description of the AI or its behavior

MDMT TRUST CUES (Multi-Dimensional Measure of Trust):
These four dimensions form two trust domains:
Capacity Trust:
- mdmtReliable: true if AI described as dependable, consistent, predictable, or trustworthy in performance
- mdmtCapable: true if AI described as competent, skilled, effective, powerful, or impressive
Moral Trust:
- mdmtEthical: true if AI described as principled, fair, morally good, or acting according to values
- mdmtSincere: true if AI described as genuine, honest, transparent, or not deceptive
Set each independently; multiple can be true.

UNCANNY VALLEY (Mori, 1970; Laakasuo et al., 2021):
- none: No unease or discomfort expressed
- eerie: Subtle, hard-to-name unease; something feels slightly off
- creepy: Explicit aversion, disgust, or fear triggered by the AI's near-human quality
- fake-human: AI perceived as deceptively or disturbingly human-like (e.g., "it's pretending to feel")
- unsettling: General alarm or deeply disturbing reaction not fitting the above

Return ONLY the JSON object, no preamble or explanation.`;

router.post("/annotations/auto-annotate", async (req, res): Promise<void> => {
  const { coderId } = req.body as { coderId?: number };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    let aiCoderId = coderId;
    if (!aiCoderId) {
      const existing = await db
        .select()
        .from(codersTable)
        .where(eq(codersTable.role, "ai"))
        .limit(1);

      if (existing.length > 0) {
        aiCoderId = existing[0].id;
      } else {
        const [created] = await db
          .insert(codersTable)
          .values({ name: "AI Annotator (GPT)", role: "ai" })
          .returning();
        aiCoderId = created.id;
      }
    }

    const alreadyAnnotated = db
      .select({ postId: annotationsTable.postId })
      .from(annotationsTable)
      .where(eq(annotationsTable.coderId, aiCoderId));

    const posts = await db
      .select()
      .from(postsTable)
      .where(sql`${postsTable.id} NOT IN (${alreadyAnnotated})`)
      .orderBy(postsTable.id);

    if (posts.length === 0) {
      send({ type: "done", annotated: 0, message: "All posts already annotated by this coder." });
      res.end();
      return;
    }

    send({ type: "start", total: posts.length, coderId: aiCoderId });

    let completed = 0;
    let failed = 0;

    await batchProcess(
      posts,
      async (post) => {
        try {
          const postText = [
            post.title ? `Title: ${post.title}` : null,
            `Content: ${post.content}`,
            post.subreddit ? `Subreddit: r/${post.subreddit}` : null,
          ]
            .filter(Boolean)
            .join("\n");

          const response = await openai.chat.completions.create({
            model: "gpt-5-mini",
            max_completion_tokens: 1024,
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: ANNOTATION_PROMPT },
              { role: "user", content: postText },
            ],
          });

          const raw = response.choices[0]?.message?.content ?? "";
          if (!raw.trim()) {
            throw new Error(`Empty response from model (finish_reason: ${response.choices[0]?.finish_reason})`);
          }
          const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

          const jsonMatch = clean.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error(`No JSON in response: ${clean.slice(0, 100)}`);
          const parsed = JSON.parse(jsonMatch[0]);

          await db.insert(annotationsTable).values({
            postId: post.id,
            coderId: aiCoderId!,
            anthropomorphismLevel: parsed.anthropomorphismLevel ?? "none",
            mindPerception: parsed.mindPerception ?? "neither",
            moralEvaluation: parsed.moralEvaluation ?? "none",
            mdmtReliable: Boolean(parsed.mdmtReliable),
            mdmtCapable: Boolean(parsed.mdmtCapable),
            mdmtEthical: Boolean(parsed.mdmtEthical),
            mdmtSincere: Boolean(parsed.mdmtSincere),
            uncanny: parsed.uncanny ?? "none",
            notes: parsed.notes ?? null,
          });

          completed++;
          send({
            type: "progress",
            completed,
            total: posts.length,
            postId: post.id,
            pct: Math.round((completed / posts.length) * 100),
          });
          return parsed;
        } catch (err) {
          failed++;
          send({ type: "item-error", postId: post.id, error: String(err) });
          return null;
        }
      },
      { concurrency: 2, retries: 0 }
    );

    send({ type: "done", annotated: completed, total: posts.length, coderId: aiCoderId });
  } catch (err) {
    req.log.error({ err }, "Auto-annotate failed");
    send({ type: "fatal", message: String(err) });
  }

  res.end();
});

export default router;
