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

## Application: MoralizeAI — AI Discourse Annotation Platform

A research data collection and annotation platform for the "Moralizing Machines Online" computational social science study. Researchers collect social media posts (Reddit etc.) about AI and annotate them with a psychologically-informed coding scheme.

### Key Features
- Corpus management: add posts individually or bulk import via JSON
- Annotation workspace: 6-dimension coding form with auto-advance to next post
- Coders: manage annotator profiles
- Dashboard: real-time corpus statistics with Recharts visualizations
- Agreement: inter-rater reliability statistics across coding dimensions

### Coding Dimensions (per proposal)
1. **Anthropomorphism Level**: none / mild / strong
2. **Mind Perception**: agency / experience / both / neither
3. **Moral Evaluation**: praise / blame / concern / ambivalent / none
4. **VASS Cues**: Values, Autonomy, Social Connection, Self-Aware Emotions (checkboxes)
5. **Uncanny**: eerie / creepy / fake-human / unsettling / none
6. **Notes**: free text

### Database Tables
- `posts` — social media posts (Reddit, YouTube etc.)
- `coders` — annotator profiles
- `annotations` — annotation records linking posts + coders with all 6 dimensions

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Note on Codegen

The `lib/api-spec/package.json` codegen script patches `lib/api-zod/src/index.ts` post-generation to avoid duplicate export conflicts between `./generated/api` (Zod schemas) and `./generated/types` (TypeScript types).

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
