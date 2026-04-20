import { Router, type IRouter } from "express";
import { eq, sql, and, isNull, or } from "drizzle-orm";
import { db, postsTable, annotationsTable, codersTable, userSettingsTable, ALL_ANNOTATION_FIELDS, type AnnotationField } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { batchProcess } from "@workspace/integrations-openai-ai-server/batch";
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

const TASK_DESCRIPTION = `You are an annotation engine for a computational social science study on how people anthropomorphize and morally evaluate AI systems in social media discourse.

Read the text and return EXACTLY one JSON object. No prose, no markdown, no explanation outside the JSON.

ANNOTATION PRINCIPLES:
1. Code only what is supported by the text. Do not project likely attitudes unless the wording supports them.
2. When evidence is absent, code the lowest defensible value.
3. If the text contains sarcasm, irony, quotation, or mixed stance, lower coderConfidence and set needsHumanReview to true.
4. Do not use world knowledge to decide whether a claim about AI is true; annotate the speaker's expressed framing.
5. blameTarget captures who is held accountable, not merely who is mentioned.`;

const FIELD_DEFINITIONS: Record<string, string> = {
  anthropomorphism: `ANTHROPOMORPHISM LEVEL (Epley, Waytz & Cacioppo, 2007):
- none: AI described as a pure tool, algorithm, or software with no human-like qualities
- mild: Some humanizing metaphors or casual human-like language, but overall framed as a tool
- strong: AI explicitly attributed human emotions, genuine intentions, moral standing, desires, or social identity`,

  mindPerception: `MIND PERCEPTION (Gray, Gray & Wegner, 2007):
- agency: AI described as planning, deciding, intending, lying, manipulating, refusing, choosing
- experience: AI described as feeling, suffering, caring, being lonely, being hurt, empathizing
- both: Both agency and experience present
- neither: No mental states attributed
Rule: Do not confuse capability ("it is accurate") with agency.`,

  moralEvaluation: `MORAL EVALUATION:
- praise: AI admired, morally approved of, trusted, seen as beneficial or noble
- blame: AI held responsible or culpable for harm; described as dangerous, unethical, or at fault
- concern: Worry, unease, or ethical risk expressed without clear blame
- ambivalent: Mixed, uncertain, or conflicted moral stance
- none: Morally neutral`,

  mdmtTrust: `MDMT TRUST CUES (Ullman & Sharkey, 2021) — set each independently, cues can be negative:
- mdmtReliable: AI described as dependable, consistent, predictable — or the opposite
- mdmtCapable: AI described as competent, skilled, effective, powerful — or the opposite
- mdmtEthical: AI described as principled, fair, morally good, value-aligned — or the opposite
- mdmtSincere: AI described as genuine, honest, transparent, not deceptive — or the opposite`,

  uncanny: `UNCANNY VALLEY (Mori, 1970; Laakasuo et al., 2021):
- none: No unease or discomfort
- eerie: Subtle, hard-to-name unease; something feels slightly off
- creepy: Explicit aversion, disgust, or fear triggered by near-human quality
- fake-human: AI perceived as deceptively or disturbingly human-like (e.g., "it's pretending to feel")
- unsettling: General alarm or deeply disturbing reaction`,

  socialRole: `SOCIAL ROLE — how the AI is positioned in the speaker's framing:
- tool: Instrumental object or utility
- assistant: Helper that supports the user but remains subordinate
- companion: Relational or emotionally supportive partner
- authority: Advisor, expert, evaluator, or decision-maker with influence
- manipulator: Strategic persuader, nudger, deceiver, or controller
- moral_agent: Being capable of right/wrong action
- moral_patient: Being that can be harmed or deserves moral concern
- mixed: Multiple roles present
- unclear: Cannot determine`,

  blameTarget: `BLAME TARGET — who is held accountable:
- AI: The AI system itself is framed as responsible
- developer: The people who built the AI
- deployer: The company or platform deploying it
- user: The human using it
- mixed: Multiple parties
- none: No accountability assigned`,

  moralFocus: `MORAL FOCUS — what kind of moral issue (only fill if moralEvaluation ≠ none):
fairness, harm, responsibility, deception, dependence, rights, trust, autonomy, dignity, other`,

  evidenceQuote: `EVIDENCE QUOTE: verbatim span from the text that most strongly justifies the primary coding — or empty string`,

  coderConfidence: `CODER CONFIDENCE: 1 = low (ambiguous/sarcastic text), 2 = medium, 3 = high (clear evidence)`,

  needsHumanReview: `NEEDS HUMAN REVIEW: true when text is sarcastic, contradictory, too short, or contains quoted speech that may not reflect author's view`,

  notes: `NOTES: 1-2 sentences summarising reasoning`,

  authorSignals: `AUTHOR SIGNALS — infer from writing style only. Return "unclear" when the post is too short or topically constrained to support inference:

authorOpenness (Big Five Openness expressed in text):
- high: rich vocabulary, intellectual curiosity, abstract/nuanced thinking, comfort with uncertainty
- medium: some complexity but also concrete or conventional thinking
- low: black-and-white reasoning, resistance to novelty, preference for simple concrete answers
- unclear: post is too short or topically constrained

authorIdeology (political orientation signalled by framing and language):
- very_liberal | liberal | moderate | conservative | very_conservative | unclear

authorExpertise (AI/tech domain knowledge):
- none | casual | technical | expert

authorAffect (overall emotional tone toward AI in this post):
- positive | negative | neutral | mixed

authorAgreeableness (Big Five Agreeableness expressed in tone):
- high | medium | low | unclear

authorNeuroticism (Big Five Neuroticism expressed in emotional register):
- high | medium | low | unclear`,
};

function buildSchemaForFields(fields: AnnotationField[]): string {
  const lines: string[] = ["{"];
  if (fields.includes("anthropomorphism")) lines.push(`  "anthropomorphismLevel": "none" | "mild" | "strong",`);
  if (fields.includes("mindPerception")) lines.push(`  "mindPerception": "agency" | "experience" | "both" | "neither",`);
  if (fields.includes("moralEvaluation")) lines.push(`  "moralEvaluation": "praise" | "blame" | "concern" | "ambivalent" | "none",`);
  if (fields.includes("mdmtTrust")) {
    lines.push(`  "mdmtReliable": true | false,`);
    lines.push(`  "mdmtCapable": true | false,`);
    lines.push(`  "mdmtEthical": true | false,`);
    lines.push(`  "mdmtSincere": true | false,`);
  }
  if (fields.includes("uncanny")) lines.push(`  "uncanny": "eerie" | "creepy" | "fake-human" | "unsettling" | "none",`);
  if (fields.includes("socialRole")) lines.push(`  "socialRole": "tool" | "assistant" | "companion" | "authority" | "manipulator" | "moral_agent" | "moral_patient" | "mixed" | "unclear",`);
  if (fields.includes("blameTarget")) lines.push(`  "blameTarget": "AI" | "developer" | "deployer" | "user" | "mixed" | "none",`);
  if (fields.includes("moralFocus")) lines.push(`  "moralFocus": "comma-separated list from: fairness, harm, responsibility, deception, dependence, rights, trust, autonomy, dignity, other — or empty string",`);
  if (fields.includes("evidenceQuote")) lines.push(`  "evidenceQuote": "verbatim span from text or empty string",`);
  if (fields.includes("coderConfidence")) lines.push(`  "coderConfidence": 1 | 2 | 3,`);
  if (fields.includes("needsHumanReview")) lines.push(`  "needsHumanReview": true | false,`);
  if (fields.includes("notes")) lines.push(`  "notes": "1-2 sentence summary",`);
  if (fields.includes("authorSignals")) {
    lines.push(`  "authorOpenness": "low" | "medium" | "high" | "unclear",`);
    lines.push(`  "authorIdeology": "very_liberal" | "liberal" | "moderate" | "conservative" | "very_conservative" | "unclear",`);
    lines.push(`  "authorExpertise": "none" | "casual" | "technical" | "expert",`);
    lines.push(`  "authorAffect": "positive" | "negative" | "neutral" | "mixed",`);
    lines.push(`  "authorAgreeableness": "low" | "medium" | "high" | "unclear",`);
    lines.push(`  "authorNeuroticism": "low" | "medium" | "high" | "unclear",`);
  }
  lines.push("}");
  return lines.join("\n");
}

function buildPrompt(fields: AnnotationField[], customPrompt: string | null): string {
  const taskSection = customPrompt?.trim()
    ? customPrompt.trim()
    : TASK_DESCRIPTION;

  const fieldDefs = fields
    .map((f) => FIELD_DEFINITIONS[f])
    .filter(Boolean)
    .join("\n\n");

  const schema = buildSchemaForFields(fields);

  return `${taskSection}

REQUIRED JSON SCHEMA:
${schema}

FIELD DEFINITIONS:
${fieldDefs}

Return ONLY the JSON object.`;
}

router.post("/annotations/auto-annotate", async (req: AuthRequest, res): Promise<void> => {
  const { coderId } = req.body as { coderId?: number };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    const [settingsRow] = await db
      .select()
      .from(userSettingsTable)
      .where(eq(userSettingsTable.userId, req.userId!));

    const activeFields: AnnotationField[] = settingsRow
      ? (settingsRow.annotationFields.split(",").filter(Boolean) as AnnotationField[])
      : [...ALL_ANNOTATION_FIELDS];

    const customPrompt = settingsRow?.customPrompt ?? null;
    const systemPrompt = buildPrompt(activeFields, customPrompt);

    let aiCoderId = coderId;
    if (!aiCoderId) {
      const existing = await db
        .select()
        .from(codersTable)
        .where(and(coderUserWhere(req), eq(codersTable.role, "ai")))
        .limit(1);

      if (existing.length > 0) {
        aiCoderId = existing[0].id;
      } else {
        const [created] = await db
          .insert(codersTable)
          .values({ name: "AI Annotator (GPT)", role: "ai", userId: req.userId })
          .returning();
        aiCoderId = created.id;
      }
    }

    const alreadyAnnotated = db
      .select({ postId: annotationsTable.postId })
      .from(annotationsTable)
      .where(and(annUserWhere(req), eq(annotationsTable.coderId, aiCoderId)));

    const posts = await db
      .select()
      .from(postsTable)
      .where(and(postUserWhere(req), sql`${postsTable.id} NOT IN (${alreadyAnnotated})`))
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
      async (post: typeof posts[number]) => {
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
              { role: "system", content: systemPrompt },
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
            userId: req.userId,
            postId: post.id,
            coderId: aiCoderId!,
            anthropomorphismLevel: activeFields.includes("anthropomorphism") ? (parsed.anthropomorphismLevel ?? "none") : "none",
            mindPerception: activeFields.includes("mindPerception") ? (parsed.mindPerception ?? "neither") : "neither",
            moralEvaluation: activeFields.includes("moralEvaluation") ? (parsed.moralEvaluation ?? "none") : "none",
            mdmtReliable: activeFields.includes("mdmtTrust") ? Boolean(parsed.mdmtReliable) : false,
            mdmtCapable: activeFields.includes("mdmtTrust") ? Boolean(parsed.mdmtCapable) : false,
            mdmtEthical: activeFields.includes("mdmtTrust") ? Boolean(parsed.mdmtEthical) : false,
            mdmtSincere: activeFields.includes("mdmtTrust") ? Boolean(parsed.mdmtSincere) : false,
            uncanny: activeFields.includes("uncanny") ? (parsed.uncanny ?? "none") : "none",
            socialRole: activeFields.includes("socialRole") ? (parsed.socialRole ?? "unclear") : "unclear",
            blameTarget: activeFields.includes("blameTarget") ? (parsed.blameTarget ?? "none") : "none",
            moralFocus: activeFields.includes("moralFocus") ? (parsed.moralFocus || null) : null,
            evidenceQuote: activeFields.includes("evidenceQuote") ? (parsed.evidenceQuote || null) : null,
            coderConfidence: activeFields.includes("coderConfidence") ? (Number(parsed.coderConfidence) || 2) : 2,
            needsHumanReview: activeFields.includes("needsHumanReview") ? Boolean(parsed.needsHumanReview) : false,
            notes: activeFields.includes("notes") ? (parsed.notes ?? null) : null,
            authorOpenness: activeFields.includes("authorSignals") ? (parsed.authorOpenness || null) : null,
            authorIdeology: activeFields.includes("authorSignals") ? (parsed.authorIdeology || null) : null,
            authorExpertise: activeFields.includes("authorSignals") ? (parsed.authorExpertise || null) : null,
            authorAffect: activeFields.includes("authorSignals") ? (parsed.authorAffect || null) : null,
            authorAgreeableness: activeFields.includes("authorSignals") ? (parsed.authorAgreeableness || null) : null,
            authorNeuroticism: activeFields.includes("authorSignals") ? (parsed.authorNeuroticism || null) : null,
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
