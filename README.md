# MoralizeAI

A full-stack web application for collecting and annotating Reddit posts about AI, built for the *Moralizing Machines Online* computational social science study. The platform supports human coding, GPT-assisted auto-annotation, inter-rater reliability analysis, and CSV data export.

---

## Overview

MoralizeAI is a structured annotation tool designed to help research teams systematically code how AI is discussed in social media discourse. Coders work through a queue of Reddit posts, applying a multi-dimensional coding scheme. A GPT auto-annotation feature provides first-pass codes that human coders can verify or override.

---

## Coding Scheme

Each post is annotated across seven dimensions:

| Dimension | Values |
|---|---|
| **Anthropomorphism Level** | None / Minimal / Moderate / Strong |
| **Mind Perception** | None / Agency / Experience / Both |
| **Moral Evaluation** | None / Positive / Negative / Mixed |
| **MDMT Trust Cues** | Reliable, Capable, Ethical, Sincere (each boolean) |
| **Uncanny Valley** | None / Subtle / Moderate / Strong |
| **Social Role of AI** | Tool / Assistant / Companion / Authority / Manipulator / Moral Agent / Moral Patient / Mixed / Unclear |
| **Blame / Accountability Target** | None / AI / Developer / Deployer / User / Mixed |

Additional fields: Moral Focus (free text), Evidence Quote, Coder Confidence (1–3), Needs Human Review flag, and Qualitative Notes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| API contract | OpenAPI 3.1 → generated React hooks (Orval) + Zod schemas |
| AI annotation | OpenAI GPT-4o |
| Monorepo | pnpm workspaces |

---

## Features

- **Post management** — import posts manually, paste JSON, or fetch live from any public subreddit via Reddit's public API (browser-side fetch to avoid cloud-IP blocks)
- **Human annotation** — split-pane interface showing post text alongside the coding form; coders are identified by name
- **GPT auto-annotation** — one-click AI-assisted coding of the full scheme, with evidence quotes; human coders can review and override
- **Inter-rater reliability** — Cohen's κ and percentage agreement calculated per dimension across all coder pairs
- **CSV export** — all annotations with all fields, ready for R / SPSS / Python analysis
- **Dashboard** — annotation progress, per-coder counts, and completion status

---

## Project Structure

```
artifacts/
  api-server/        Express REST API
  moralize-ai/       React frontend (Vite)
lib/
  db/                Drizzle schema + migrations
  api-spec/          OpenAPI specification
  api-client-react/  Generated TanStack Query hooks
  api-zod/           Generated Zod validation schemas
```

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the project root (never commit this):

```env
DATABASE_URL=postgresql://user:password@localhost:5432/moralize_ai
SESSION_SECRET=your-random-secret-here
OPENAI_API_KEY=sk-...        # Required for GPT auto-annotation
```

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push-force
```

### 4. Start the development servers

In two separate terminals:

```bash
# API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Frontend (Vite dev server)
pnpm --filter @workspace/moralize-ai run dev
```

The frontend will be available at `http://localhost:5173` (or the port Vite assigns).

### Regenerating the API client

If you modify `lib/api-spec/openapi.yaml`:

```bash
cd lib/api-spec && npx orval --config ./orval.config.ts
```

---

## Deployment

The app is designed to run as two services (API + frontend) behind a reverse proxy. Set the same environment variables listed above on your server. Any PostgreSQL-compatible host works (Supabase, Neon, Railway, etc.).

---

## Citation

If you use this tool in published research, please cite the repository:

```
[Author(s)]. (2025). MoralizeAI: An annotation platform for AI discourse coding.
GitHub. https://github.com/[your-username]/moralize-ai
```

---

## License

MIT
