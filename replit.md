# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind + Recharts + Wouter
- **Auth**: Clerk (authentication + per-user data isolation)

## Application: MoralizeAI — AI Discourse Annotation Platform

A research data collection and annotation platform for the "Moralizing Machines Online" computational social science study. Researchers collect social media posts (Reddit etc.) about AI and annotate them with a psychologically-informed coding scheme.

### Key Features
- Corpus management: add posts individually or bulk import via JSON
- Annotation workspace: coding form with auto-advance to next post
- **AI Auto-Annotate**: one-click GPT batch annotation with live SSE progress (Posts page)
- Coders: manage annotator profiles (includes auto-created "AI Annotator (GPT)" coder)
- Dashboard: real-time corpus statistics with Recharts visualizations
- Agreement: inter-rater reliability statistics across coding dimensions
- CSV export: download all annotations joined with post metadata
- **Per-user data isolation**: each user has their own silo of posts, coders, and annotations
- **User settings**: configurable annotation fields and custom GPT system prompts
- **Configurable annotation fields**: users choose which of 13 field groups appear in the annotation form and are included in GPT auto-annotation

### Coding Dimensions (full scheme)
1. **Anthropomorphism**: none / mild / strong
2. **Mind Perception**: agency / experience / both / neither
3. **Moral Evaluation**: praise / blame / concern / ambivalent / none
4. **MDMT Trust Cues**: Reliable, Capable (Capacity) + Ethical, Sincere (Moral) — booleans
5. **Uncanny markers**: eerie / creepy / fake-human / unsettling / none
6. **Social Role**: tool / assistant / agent / partner / authority / none
7. **Blame Target**: developer / deployer / AI-itself / user / society / none
8. **Moral Focus**: fairness / harm / responsibility / deception / dependence / rights / trust / autonomy / dignity / other
9. **Evidence Quote**: free text quote from post
10. **Coder Confidence**: 1=Low / 2=Med / 3=High
11. **Needs Human Review**: checkbox flag
12. **Notes**: qualitative free text
13. **Author Signals**: openness / ideology / expertise / affect / agreeableness / neuroticism

### Database Tables
- `posts` — social media posts with `userId` column for per-user isolation
- `coders` — annotator profiles with `userId` column
- `annotations` — full annotation records with `userId` column; all 13 coding dimensions
- `user_settings` — per-user settings: `annotationFields` (JSON array) + `customPrompt` (text)

### Data Isolation Pattern
- Admin users: `WHERE userId = req.userId OR userId IS NULL` (see legacy NULL-owned rows)
- Regular users: `WHERE userId = req.userId` (strict isolation)
- All inserts include `userId: req.userId`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/db run push-force` — force push DB schema (bypasses diff confirmation)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- Rebuild DB types after schema changes: `cd lib/db && npx tsc --build`

## AI Integration

Uses Replit AI Integrations for OpenAI access (no user API key needed, billed to Replit credits).
- Package: `@workspace/integrations-openai-ai-server` (lib/integrations-openai-ai-server)
- Model: `gpt-4o-mini` with structured JSON output for annotation
- Batch processing via `batchProcess` (concurrency=2, per-item error recovery, rate-limit retries)
- Endpoint: `POST /api/annotations/auto-annotate` — SSE stream, creates "AI Annotator (GPT)" coder automatically per user
- GPT prompt and JSON schema are dynamically built based on user's selected `annotationFields`
- Users can override the system prompt via `customPrompt` in their settings

## Settings Page

`/settings` route in the frontend — users can:
- Toggle 13 annotation field groups on/off (saved as `annotationFields` JSON in `user_settings`)
- Write a custom GPT system prompt (saved as `customPrompt` in `user_settings`)
- Reset to defaults (all fields enabled, no custom prompt)

## Note on Codegen

The `lib/api-spec/package.json` codegen script patches `lib/api-zod/src/index.ts` post-generation to avoid duplicate export conflicts between `./generated/api` (Zod schemas) and `./generated/types` (TypeScript types).

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
