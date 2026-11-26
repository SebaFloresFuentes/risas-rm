<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## RadarRisas project rules

- Preserve the existing public site and the manual approval flow for new event candidates.
- Treat each dated performance as a distinct event. Never merge different dates or times merely because they share an artist, show, venue, or ticket URL.
- Interpret event dates and times in `America/Santiago`. Do not infer a missing year unless the source provides verifiable evidence.
- Normalize ticket providers, event URLs, Chilean communes, CLP prices, dates, and times through shared helpers instead of source-specific ad hoc rules.
- Availability is one of `available`, `limited`, `sold_out`, or `unknown`. Only use `sold_out` when the complete performance is explicitly unavailable; a sold-out sector is insufficient evidence. Only use `limited` for an explicit last-tickets indication.
- HTTP errors, blocks, timeouts, parsing failures, and missing availability evidence produce `unknown`; they must not overwrite the last confirmed commercial state.
- Keep availability evidence, source, last attempt, and last successful verification. Commercial updates to published events must not overwrite manually maintained editorial fields.
- Reuse HTML or JSON already downloaded during discovery. Use bounded retries with moderate backoff and respect source request limits.
- New events must enter the existing candidate review flow. Automated ingestion and updates must be idempotent and support a dry-run mode.
- Never expose secrets. Do not commit environment files, service-role keys, API tokens, scraped raw credentials, or authenticated responses.
- Do not run Supabase migrations or production writes, deploy, commit, or push without explicit authorization. Database migrations must be incremental and non-destructive, and must preserve compatibility with the existing `sold_out` field.
- Generated discovery feeds and diagnostics must not invent prices, availability, locations, dates, or shows. Retain uncertainty explicitly for manual review.
