import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, postsTable, annotationsTable, codersTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";

const router: IRouter = Router();

const ANNOTATION_PROMPT = `You are a research assistant helping code social media posts for a study on how people anthropomorphize and morally evaluate AI systems.

Analyze the post and return ONLY valid JSON with exactly these fields:

{
  "anthropomorphismLevel": "none" | "mild" | "strong",
  "mindPerception": "agency" | "experience" | "both" | "neither",
  "moralEvaluation": "praise" | "blame" | "concern" | "ambivalent" | "none",
  "vassValues": true | false,
  "vassAutonomy": true | false,
  "vassSocialConnection": true | false,
  "vassSelfAwareEmotions": true | false,
  "uncanny": "eerie" | "creepy" | "fake-human" | "unsettling" | "none",
  "notes": "1-2 sentence rationale"
}

Coding guide:
- anthropomorphismLevel: none=AI treated as pure tool; mild=some humanizing language; strong=AI has human traits/emotions/moral standing
- mindPerception: agency=AI plans/decides/lies/chooses; experience=AI feels/suffers/cares/is hurt; both=both; neither=no mental states
- moralEvaluation: praise=AI admired/trusted; blame=AI held responsible for harm; concern=worry about AI; ambivalent=mixed; none=no moral stance
- vassValues: true if AI described as having ethics, principles, or values
- vassAutonomy: true if AI described as independent, self-directed, or autonomous
- vassSocialConnection: true if AI is framed as a companion, friend, or relationship partner
- vassSelfAwareEmotions: true if AI is described as emotionally self-aware
- uncanny: none=no unease; eerie=subtle; creepy=explicit disgust; fake-human=AI deceptively human-like; unsettling=general alarm

Return ONLY the JSON object, no preamble or explanation.`;

router.post("/annotations/auto-annotate", async (req, res): Promise<void> => {
  const { coderId } = req.body as { coderId?: number };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // Find or create the AI coder
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

    // Get posts this coder hasn't annotated yet
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
            post.subreddit ? `Subreddit: ${post.subreddit}` : null,
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

          // Extract the first JSON object found in the response
          const jsonMatch = clean.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error(`No JSON in response: ${clean.slice(0, 100)}`);
          const parsed = JSON.parse(jsonMatch[0]);

          await db.insert(annotationsTable).values({
            postId: post.id,
            coderId: aiCoderId!,
            anthropomorphismLevel: parsed.anthropomorphismLevel ?? "none",
            mindPerception: parsed.mindPerception ?? "neither",
            moralEvaluation: parsed.moralEvaluation ?? "none",
            vassValues: Boolean(parsed.vassValues),
            vassAutonomy: Boolean(parsed.vassAutonomy),
            vassSocialConnection: Boolean(parsed.vassSocialConnection),
            vassSelfAwareEmotions: Boolean(parsed.vassSelfAwareEmotions),
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
