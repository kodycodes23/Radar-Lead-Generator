# Week 5: AI Lead Research and Outreach Agent

This folder contains the Week 5 project brief and reference docs for the build.

## Files

- `PRD.md`: the project brief
- `assets/icp-refinement-guide.md`: guidance for turning vague targeting into clear ICP criteria
- `assets/lead-qualification-guide.md`: guidance for judging whether a company fits the ICP
- `assets/outbound-copywriting-guide.md`: guidance for writing review-ready outbound copy
- `assets/lead-list-quality-guide.md`: guidance for checking list quality before submission
- `assets/outreach-safety-guide.md`: guidance for safe agent behavior and approval rules

Start with `PRD.md`, then use the files in `assets/` as the source material for the Claude Agent SDK skills you create inside your project.

## Setup

1. **Database**: open the Supabase SQL Editor for a fresh project and run all of `supabase/schema.sql`. It creates `runs`, `leads`, and `tool_calls` with RLS intentionally left off (server-only access via the service-role key -- reasoning is in the file's header comment).
2. **Environment**: copy `.env.local.example` to `.env.local` and fill in `ANTHROPIC_API_KEY`, `APIFY_API_TOKEN` (team account token, not personal), `FIRECRAWL_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. **Install & run**:
   ```bash
   npm install
   npm run dev
   ```
   Open `http://localhost:3000`, enter a qualification objective, and watch the run page for live tool-call and lead progress.

## How it's built

- **Agent runtime**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`), driven from `src/agent/runAgent.ts`. The agent decides which tool to call and when; the six custom tools it has access to (and nothing else -- built-in tools like Bash/Read/Write are disabled) live in `src/agent/tools.ts`.
- **Skills**: `.claude/skills/*/SKILL.md`, one per guide in `assets/`. The agent invokes them at the matching pipeline stage; `outreach-safety` is additionally baked into the system prompt (`src/agent/systemPrompt.ts`) as a standing constraint that applies for the whole run.
- **Hard limits**: enforced inside the tool implementations against the `runs` row's configured limits, not left to agent discretion -- see `logged()` and the per-tool budget checks in `src/agent/tools.ts`.
- **Company discovery**: Apify's pay-per-event `apify/google-search-scraper` actor only (`src/agent/apify.ts`), always called with a capped `maxPagesPerQuery`.
- **Website scraping**: Firecrawl (`src/agent/firecrawl.ts`). Scraped content is wrapped in `<untrusted_web_content>` tags by the tool code itself, not just described as untrusted in a prompt, so the prompt-injection defense survives context summarization.
- **Database**: Supabase (`src/lib/db.ts`), service-role key, server-only.
- **UI**: Next.js App Router. `/` starts a run, `/runs` lists run records, `/runs/[id]` shows live progress (polling `/api/runs/[id]` every 2s while the run is active) plus the full lead list and tool-call log.

### A note on where this runs

The agent runs as a single long-lived async call (`runAgent`) that can take several minutes for a full 10-lead run. It's started fire-and-forget from the `POST /api/runs` route handler and depends on the host process staying alive for that whole time -- true for `next dev`/`next start` and for a persistent host like Render/Railway, but **not** safe to assume on Vercel's request-scoped serverless functions without further work (background job queue, or Pro plan + Fluid Compute with careful tuning).
