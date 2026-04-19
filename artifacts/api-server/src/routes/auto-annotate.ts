import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, postsTable, annotationsTable, codersTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";

const router: IRouter = Router();

const ANNOTATION_PROMPT = `You are an annotation engine for a computational social science study on how people anthropomorphize and morally evaluate AI systems in social media discourse.

Read the text and return EXACTLY one JSON object. No prose, no markdown, no explanation outside the JSON.

ANNOTATION PRINCIPLES:
1. Code only what is supported by the text. Do not project likely attitudes unless the wording supports them.
2. When evidence is absent, code the lowest defensible value.
3. If the text contains sarcasm, irony, quotation, or mixed stance, lower coderConfidence and set needsHumanReview to true.
4. Do not use world knowledge to decide whether a claim about AI is true; annotate the speaker's expressed framing.
5. blameTarget captures who is held accountable, not merely who is mentioned.

REQUIRED JSON SCHEMA:
{
  "anthropomorphismLevel": "none" | "mild" | "strong",
  "mindPerception": "agency" | "experience" | "both" | "neither",
  "moralEvaluation": "praise" | "blame" | "concern" | "ambivalent" | "none",
  "mdmtReliable": true | false,
  "mdmtCapable": true | false,
  "mdmtEthical": true | false,
  "mdmtSincere": true | false,
  "uncanny": "eerie" | "creepy" | "fake-human" | "unsettling" | "none",
  "socialRole": "tool" | "assistant" | "companion" | "authority" | "manipulator" | "moral_agent" | "moral_patient" | "mixed" | "unclear",
  "blameTarget": "AI" | "developer" | "deployer" | "user" | "mixed" | "none",
  "moralFocus": "comma-separated list from: fairness, harm, responsibility, deception, dependence, rights, trust, autonomy, dignity, other — or empty string if moralEvaluation is none",
  "evidenceQuote": "verbatim span from the text that most strongly justifies the anthropomorphism and moral coding — or empty string",
  "coderConfidence": 1 | 2 | 3,
  "needsHumanReview": true | false,
  "notes": "1-2 sentences summarising reasoning"
}

FIELD DEFINITIONS:

ANTHROPOMORPHISM LEVEL (Epley, Waytz & Cacioppo, 2007):
- none: AI described as a pure tool, algorithm, or software with no human-like qualities
- mild: Some humanizing metaphors or casual human-like language, but overall framed as a tool
- strong: AI explicitly attributed human emotions, genuine intentions, moral standing, desires, or social identity

MIND PERCEPTION (Gray, Gray & Wegner, 2007):
- agency: AI described as planning, deciding, intending, lying, manipulating, refusing, choosing
- experience: AI described as feeling, suffering, caring, being lonely, being hurt, empathizing
- both: Both agency and experience present
- neither: No mental states attributed
Rule: Do not confuse capability ("it is accurate") with agency.

MORAL EVALUATION:
- praise: AI admired, morally approved of, trusted, seen as beneficial or noble
- blame: AI held responsible or culpable for harm; described as dangerous, unethical, or at fault
- concern: Worry, unease, or ethical risk expressed without clear blame
- ambivalent: Mixed, uncertain, or conflicted moral stance
- none: Morally neutral

MDMT TRUST CUES (Ullman & Sharkey, 2021) — set each independently, cues can be negative:
- mdmtReliable: AI described as dependable, consistent, predictable — or the opposite
- mdmtCapable: AI described as competent, skilled, effective, powerful — or the opposite
- mdmtEthical: AI described as principled, fair, morally good, value-aligned — or the opposite
- mdmtSincere: AI described as genuine, honest, transparent, not deceptive — or the opposite

UNCANNY VALLEY (Mori, 1970; Laakasuo et al., 2021):
- none: No unease or discomfort
- eerie: Subtle, hard-to-name unease; something feels slightly off
- creepy: Explicit aversion, disgust, or fear triggered by near-human quality
- fake-human: AI perceived as deceptively or disturbingly human-like (e.g., "it's pretending to feel")
- unsettling: General alarm or deeply disturbing reaction

SOCIAL ROLE — how the AI is positioned in the speaker's framing:
- tool: Instrumental object or utility
- assistant: Helper that supports the user but remains subordinate
- companion: Relational or emotionally supportive partner
- authority: Advisor, expert, evaluator, or decision-maker with influence
- manipulator: Strategic persuader, nudger, deceiver, or controller
- moral_agent: Being capable of right/wrong action
- moral_patient: Being that can be harmed or deserves moral concern
- mixed: Multiple roles present
- unclear: Cannot determine

BLAME TARGET — who is held accountable:
- AI: The AI system itself is framed as responsible
- developer: The people who built the AI
- deployer: The company or platform deploying it
- user: The human using it
- mixed: Multiple parties
- none: No accountability assigned

MORAL FOCUS — what kind of moral issue (only fill if moralEvaluation ≠ none):
fairness, harm, responsibility, deception, dependence, rights, trust, autonomy, dignity, other

CODER CONFIDENCE: 1 = low (ambiguous/sarcastic text), 2 = medium, 3 = high (clear evidence)
NEEDS HUMAN REVIEW: true when text is sarcastic, contradictory, too short, or contains quoted speech that may not reflect author's view

Return ONLY the JSON object.`;

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
            model: "gpt-4o-mini",
            max_completion_tokens: 512,
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
            socialRole: parsed.socialRole ?? "unclear",
            blameTarget: parsed.blameTarget ?? "none",
            moralFocus: parsed.moralFocus || null,
            evidenceQuote: parsed.evidenceQuote || null,
            coderConfidence: Number(parsed.coderConfidence) || 2,
            needsHumanReview: Boolean(parsed.needsHumanReview),
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
      { concurrency: 5, retries: 1 }
    );

    send({ type: "done", annotated: completed, total: posts.length, coderId: aiCoderId });
  } catch (err) {
    req.log.error({ err }, "Auto-annotate failed");
    send({ type: "fatal", message: String(err) });
  }

  res.end();
});

export default router;
