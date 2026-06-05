# Refactoring Plan

This plan is based on a code audit of the current AltSearch project. The project is feature-complete, so the goal is not to add product scope, but to harden existing behavior, remove stale Wiki/Wikigen assumptions, and make the codebase easier to maintain.

## Executive Summary

The highest-risk areas are not visual or naming issues. They are ownership checks, privacy boundaries, and concurrent edits while the agent is running.

Priority order:

1. Fix authorization and privacy leaks.
2. Add server-side edit/run/delete invariants so users cannot corrupt event state.
3. Make file writes and DB updates transactional from the application perspective.
4. Normalize site routing and remove leftover Wiki/Wikigen coupling.
5. Clean the root directory and document which operational files are intentional.
6. Refactor large UI/API modules only after behavior is protected by tests.

## Critical Issues

### 1. Server Actions Can Mutate Events Without Ownership Checks

Affected files:

- `src/actions/delete-event.ts`
- `src/actions/publish-event.ts`
- `src/app/hub/events/page.tsx`
- `src/components/ConsoleClient.tsx`

Current behavior:

- `deleteEventAction` accepts `eventId` from form data and calls `deleteEvent(eventId)` without checking the current session or event ownership.
- `publishEventAction` updates `events.isPrivate` by id without checking ownership.
- `/hub/events` uses `getAllEvents()`, so an authenticated user can see all events, not only their own.

Risks:

- A user can potentially delete or publish/unpublish another user's event if they can submit a forged form/action payload.
- Private event metadata can appear in another user's event list.

Refactor plan:

- Replace generic mutation actions with owner-scoped helpers:
  - `deleteEventForUser(eventId, userId)`
  - `setEventPrivacyForUser(eventId, userId, isPrivate)`
  - `getEventsByUserId(userId)` for hub event listing.
- Make actions call `auth()` and fail with `Unauthorized` or `Forbidden`.
- Avoid returning different error shapes that reveal whether a foreign event exists.
- Add tests for delete/publish/list isolation across two users.

### 2. Private Generated Site Pages Are Public By Direct URL

Affected files:

- `src/app/site/[eventId]/wikipedia/page.tsx`
- `src/app/reddit/[eventId]/page.tsx`
- `src/app/reddit/[eventId]/post/[postKey]/page.tsx`
- `src/app/youtube/[eventId]/page.tsx`
- `src/app/youtube/[eventId]/watch/[videoKey]/page.tsx`
- `src/app/news/[eventId]/page.tsx`
- `src/app/news/[eventId]/article/[articleKey]/page.tsx`
- `src/app/chan/[eventId]/page.tsx`
- `src/app/chan/[eventId]/thread/[threadKey]/page.tsx`
- `src/app/search/[id]/page.tsx`

Current behavior:

- Site routes check that the event and generated site exist.
- They do not consistently check `event.isPrivate`.
- They do not allow owner access to private pages while denying non-owners.
- `/search/[id]` lists complete sites for an event without privacy or ownership checks.

Risks:

- Anyone with an event id can open private generated content directly.
- Private metadata can be exposed even if global search filters it out.

Refactor plan:

- Add a shared access helper, for example:
  - `canViewEvent(event, sessionUserId)`
  - `requireEventViewer(eventId)`
  - `requireEventOwner(eventId)`
- Use it in every generated site route, article/detail route, search-by-event route, export route, and editor route.
- Define policy clearly:
  - Public events: visible to everyone.
  - Private events: visible only to owner.
  - Missing or forbidden private events should normally return `notFound()` to avoid event-id probing.
- Add route tests for public/private/owner/non-owner cases.

### 3. Event Deletion Leaves Files And Active Runs Behind

Affected files:

- `src/lib/events.ts`
- `src/lib/event-files.ts`
- `src/lib/agent/state.ts`
- `src/app/api/events/[id]/stop/route.ts`

Current behavior:

- `deleteEvent(id)` deletes the DB row only.
- Event files under the data root remain on disk.
- Active agent runs are not stopped before deletion.
- In-memory `runControllers` can outlive the event row until the process finishes.

Risks:

- Orphaned files accumulate under `/data/events`.
- An active agent may continue writing files after the event is deleted.
- DB cascade and filesystem cleanup can diverge.

Refactor plan:

- Replace direct delete with an event deletion workflow:
  1. Load event with owner check.
  2. Mark active runs as failed/cancelled.
  3. Abort active in-memory controller if present.
  4. Delete DB records in a transaction.
  5. Remove the event workspace directory after DB success.
  6. Log cleanup failures clearly.
- Consider soft-deleting first if hard deletion during active generation is too risky.
- Add a startup cleanup that marks stale `queued` or `running` runs as failed when no controller exists.

## User-Breakage And Concurrency Risks

### 4. UI Disables Edits While Agent Runs, But API Does Not Enforce It

Affected files:

- `src/components/ConsoleClient.tsx`
- `src/app/api/events/[id]/files/route.ts`
- `src/lib/agent/tools.ts`
- `src/lib/event-files.ts`

Current behavior:

- The editor disables Save/Delete buttons while `isRunning`.
- The server still accepts `PUT /api/events/:id/files` and `DELETE /api/events/:id/files`.
- A stale browser tab can save old content after the agent completes.
- The agent can write the same file that the user is editing.

Risks:

- Lost updates.
- File content and site metadata can become inconsistent.
- The chat history may say the user edited or the agent wrote content that is no longer true.

Refactor plan:

- Enforce a simple write policy server-side:
  - reject all manual file edits while an active run exists;
  - reject all manual site deletes while an active run exists;
  - require the user to stop the agent before editing generated files or event notes.
- Avoid a full per-file revision table for now.
- Use lightweight save preconditions instead:
  - `GET /files` returns `contentHash` for the loaded file;
  - `PUT /files` requires `baseContentHash`;
  - if the current file hash differs from `baseContentHash`, return `409 Conflict`.
- For site metadata edits, also return and require `metadataHash` based on `title`, `displayUrl`, and `snippet`.
- On mismatch, return `409 Conflict` with latest hashes so the client can reload.
- Keep `hasUnsavedChanges` UI, but treat it as convenience only.

### 5. File Writes Are Not Atomic With Metadata And Change History

Affected files:

- `src/lib/event-files.ts`
- `src/lib/agent/tools.ts`
- `src/app/api/events/[id]/files/route.ts`
- `src/lib/global-search.ts`

Current behavior:

- `writeEventFile` uses synchronous full-file overwrite.
- Agent writes file content, then inserts `consoleFileChanges`, then may update `site_files`.
- Manual save writes file, touches event, updates site metadata, appends a system action.
- Embedding refresh is started asynchronously when site metadata changes, because embeddings are based on searchable metadata rather than full site file content.

Risks:

- A failure between file write and DB update leaves DB status stale.
- A failure after metadata update but before embedding update leaves search stale.
- Full-file overwrite is vulnerable to partial writes if the process crashes.

Refactor plan:

- Introduce a single file mutation service:
  - `saveEventFileMutation({ eventId, path, content, actor, expectedRevision, metadata })`
  - `resetSiteMutation({ eventId, siteName, actor, expectedRevision })`
- Use temp-file then atomic rename for file writes.
- Wrap DB updates in transactions where possible.
- Record mutation audit entries before and after writes.
- Rebuild embeddings only for metadata changes via a durable queue or explicit stale marker instead of fire-and-forget promises.
- Do not refresh embeddings for content-only edits unless metadata also changes.

### 6. Stop/Abort Is Process-Local And Run Retention Is Undefined

Affected files:

- `src/lib/agent/state.ts`
- `src/lib/agent/index.ts`
- `src/app/api/events/[id]/stop/route.ts`
- `src/lib/console.ts`
- `src/instrumentation.ts`

Current behavior:

- Active run controllers live in a module-level `Map`.
- `stop` aborts only if the controller exists in the current process.
- On server startup, `src/instrumentation.ts` marks existing `queued` or `running` rows as `failed`, so a normal restart should clear stale active runs.
- `getActiveConsoleRun` only checks latest run status.
- `console_runs` stores completed and failed historical runs with no retention policy.
- This is probably less urgent than `console_messages` growth, because run rows are small and created only once per user command.

Risks:

- Stop is not reliable in multi-process deployments because the controller may exist in another process.
- If a controller is missing before a restart path runs, `/stop` reports that no controller exists but does not itself resolve the active row.
- `console_runs` can grow forever, even though only recent runs are useful for UI state and diagnostics.

Refactor plan:

- Keep `console_runs` as lightweight run history, not only an active-run lock table.
- Add a retention policy:
  - always keep active `queued` and `running` rows;
  - keep the last 5 terminal rows (`complete` or `failed`) per event;
  - delete older terminal rows after each run finishes or during startup cleanup.
- Optionally use a combined policy later: keep the last 5 terminal rows per event, plus any terminal rows newer than 30 days.
- Add an index for latest-run and cleanup queries, for example `(event_id, status, created_at DESC)`.
- Let `/stop` set a DB cancellation flag or terminal status even if no controller exists.
- Make the agent loop check DB cancellation before and after each model/tool call.
- Keep the existing startup kill switch, but make its behavior explicit in tests.
- Add `heartbeat_at` to `console_runs`.

### 7. Closing The Editor Page Has No Explicit Unsaved-Change Protection

Affected file:

- `src/components/ConsoleClient.tsx`

Current behavior:

- The component tracks `hasUnsavedChanges`.
- It does not register a `beforeunload` guard.
- Switching active file or switching preview/edit mode can reset local editing state.

Risks:

- User loses manual edits by closing the tab, refreshing, changing site, or navigating away.

Refactor plan:

- Add a `beforeunload` guard while `hasUnsavedChanges`.
- Prompt before changing active file, leaving edit mode, deleting a site, deleting event, or starting a new agent command.
- Do not allow starting a new agent command while unsaved file edits exist; require save or discard first so the model does not work from stale disk state.
- Keep an autosave draft in `localStorage` keyed by `eventId:path:contentHash`.
- Clear draft only after successful save for the same loaded content hash.

## Wiki/Wikigen Naming And Routing Cleanup

### 8. Project Name Still Uses Wikigen In Operational Files

Affected files:

- `package.json`
- `README.md`
- `config.yaml`
- `drizzle.config.ts`
- `docker-compose.yml`
- `start*.sh`
- `start*.bat`
- `stop*.sh`
- `stop*.bat`
- `src/lib/db.ts`
- `src/lib/config.ts`
- `src/auth.ts`

Current leftovers:

- Package name is `wikigen`.
- Default DB path is `/data/wikigen.db`.
- Docker volume is `wikigen_data`.
- Startup scripts print `Wikigen`.
- Local auth email is `local@wikigen.local`.
- Global DB cache variables are named `_wikigenDb*`.

Refactor plan:

- Pick one canonical product/internal name, likely `altsearch`.
- Rename operational identifiers carefully:
  - package name: `altsearch`
  - DB file: `/data/altsearch.db`
  - Docker volume: `altsearch_data`
  - local auth email: `local@altsearch.local`
  - global cache variables: `_altsearchDb*`
- Provide a migration note for existing deployments:
  - either keep reading old `/data/wikigen.db` if present,
  - or document a one-time rename.
- Update README and scripts in the same change.

### 9. Wikipedia Is Still Treated As The Generic Site Route

Affected files:

- `src/app/site/[eventId]/wikipedia/page.tsx`
- `src/app/wiki.css`
- `src/app/layout.tsx`
- `src/lib/sites-config.ts`
- `src/app/hub/events/[id]/public/PublicEventView.tsx`

Current behavior:

- Reddit, YouTube, News, and Chan have their own top-level route folders.
- Wikipedia lives under `/site/[eventId]/wikipedia`.
- `src/app/wiki.css` is imported globally for every page.
- `getSiteUrl` falls back to Wikipedia for unknown site types.
- `PublicEventView` constructs links manually as `/site/${eventId}/${siteName.toLowerCase()}`, bypassing `getSiteUrl`.

Risks:

- Inconsistent routing and broken links for non-Wikipedia sites.
- Wikipedia-specific CSS can leak globally.
- Adding a new site type requires touching routing logic in multiple places.

Refactor plan:

- Move Wikipedia to `src/app/wikipedia/[eventId]/page.tsx` or create a consistent `src/app/sites/wikipedia/[eventId]` route.
- Rename `src/app/wiki.css` to `src/app/wikipedia.css` or colocate it under the Wikipedia route.
- Stop importing Wikipedia CSS from `src/app/layout.tsx`; import it only in the Wikipedia page or a Wikipedia shell component.
- Replace tag-based route detection with an explicit route field in `SITES`:
  - `routeBase: "/wikipedia"`
  - `routeBase: "/reddit"`
  - `routeBase: "/youtube"`
  - `routeBase: "/news"`
  - `routeBase: "/chan"`
- Make all UI links call `getSiteUrl(eventId, siteName)`.
- Remove `/site/...` fallback after adding redirects or compatibility handling.

### 10. Wikipedia Template And Branding Are Still Correct Domain-Specific Assets

Affected files:

- `src/templates/wikipedia.md`
- `src/app/site/[eventId]/wikipedia/page.tsx`
- `src/app/wiki.css`

Not all Wiki references are bad. Some are part of the generated Wikipedia-style site and should remain domain-specific.

Keep:

- Wikipedia page visual language.
- `Wikipedia` site name in `SITES`.
- `src/templates/wikipedia.md` as the content template.
- CSS classes that intentionally model MediaWiki HTML, if scoped to the Wikipedia page.

Rename or relocate:

- Generic app-level `wiki.css`.
- Generic `/site` route naming.
- Old project identity strings like Wikigen.

## Root Directory Audit

### Likely Keep

- `package.json`
- `package-lock.json`
- `next.config.ts`
- `tsconfig.json`
- `Dockerfile`
- `docker-compose.yml`
- `config.yaml`
- `.env.example`
- `.dockerignore`
- `.gitignore`
- `drizzle.config.ts`
- `drizzle/`
- `public/`
- `src/`

### Keep If These Scripts Are Part Of Distribution

- `start.sh`
- `start.bat`
- `start-npm.sh`
- `start-npm.bat`
- `start-proxy.sh`
- `start-proxy.bat`
- `start-full.sh`
- `start-full.bat`
- `stop.sh`
- `stop.bat`
- `cli_config.yaml`
- `cli_auths/`

Recommended cleanup:

- Move operational scripts into `scripts/devops/` or `scripts/deploy/`.
- Keep tiny root aliases only if they are documented public entrypoints.
- Do not keep real auth state in the repo root. `cli_auths/codex-...json` should be checked carefully and probably moved outside the project or ignored.

### Likely Remove Or Move To Archive

- `test_wiki.html`
- `test_libsql.js`
- `cleanup.sql`
- `reset-db.ts`
- `example/`

Notes:

- `test_wiki.html`, `test_libsql.js`, `cleanup.sql`, and `reset-db.ts` are not referenced by source code or package scripts.
- `example/` appears to contain static design/prototype files. If still useful, move it to `docs/prototypes/`; otherwise delete it.
- Before deleting, check whether any deployment notes or external scripts reference them.

## Code Organization Refactors

### 11. Split Large Client Component

Affected file:

- `src/components/ConsoleClient.tsx`

Current behavior:

- Chat, SSE, polling, file list, file editor, deletion, publish toggle, attachments, and run controls live in one component.

Refactor plan:

- Split into:
  - `ConsoleClient`
  - `ChatPane`
  - `Composer`
  - `WorkspacePane`
  - `FileList`
  - `FileEditor`
  - `RunControls`
  - hooks: `useConsoleStream`, `useEventPolling`, `useUnsavedFileDraft`
- Keep behavior unchanged until server invariants are in place.

### 12. Centralize Event Access And Mutation Services

Current behavior:

- Ownership checks, event loading, file loading, and mutation behavior are repeated in routes/actions.

Refactor plan:

- Create service modules:
  - `src/lib/event-access.ts`
  - `src/lib/event-mutations.ts`
  - `src/lib/site-routing.ts`
  - `src/lib/file-mutations.ts`
- API routes and server actions should be thin wrappers around these services.

### 13. Harden Generated HTML Rendering

Affected file:

- `src/app/site/[eventId]/wikipedia/page.tsx`

Current behavior:

- Wikipedia HTML is rendered via `dangerouslySetInnerHTML`.
- Sanitization is regex-based and removes some scripts, styles, iframes, and inline handlers.

Risks:

- Regex sanitization is easy to bypass with malformed HTML or less common dangerous attributes.

Refactor plan:

- Use a real HTML sanitizer for generated HTML.
- Define an allowlist matching the Wikipedia template tags/classes.
- Consider rendering generated article fragments through a parser/transformer instead of raw HTML.
- Add tests with dangerous fixtures:
  - `<script>`
  - `onerror`
  - `javascript:`
  - SVG event handlers
  - malformed nested tags

## Testing Plan

Add focused tests before broad refactoring:

1. Authorization tests:
   - owner can delete/publish/edit/export private event.
   - non-owner cannot delete/publish/edit/view private event.
   - event list returns only current user's events.
2. Privacy route tests:
   - all generated site routes deny private events to anonymous/non-owner users.
   - public events remain visible.
3. Concurrency tests:
   - manual save while run active returns `409`.
   - stale `baseContentHash` save returns `409`.
   - stale site metadata hash save returns `409`.
   - stop after process-local controller missing marks run cancelled/stale.
4. File mutation tests:
   - path traversal is rejected.
   - atomic write updates content and metadata together.
   - reset site clears content, status, embeddings, and touches event.
5. Routing tests:
   - `getSiteUrl` returns correct route for every `SITES` entry.
   - public event site cards use the same routing helper.

## Suggested Execution Phases

### Phase 1: Security And Privacy

- Add shared event access helpers.
- Fix delete/publish/list ownership.
- Protect all generated site routes and `/search/[id]`.
- Add tests for the above.

### Phase 2: Run And File Safety

- Add durable run cancellation/stale handling.
- Add server-side active-run write rejection.
- Add file hash and metadata hash conflict detection.
- Add unsaved-change navigation protection.

### Phase 3: Atomic File Mutations

- Introduce a central file mutation service.
- Use atomic temp-file writes.
- Consolidate manual and agent write paths.
- Make embedding refresh durable or explicitly stale/retryable.

### Phase 4: Naming And Route Normalization

- Rename Wikigen operational identifiers to AltSearch.
- Move/rename Wikipedia route and CSS.
- Add explicit `routeBase` to site config.
- Replace manual site URL construction.

### Phase 5: Root Cleanup

- Remove or archive unreferenced test/prototype files.
- Move deployment scripts into a documented scripts directory if desired.
- Ensure secrets/auth files are ignored and not distributed accidentally.

### Phase 6: Component And Module Cleanup

- Split `ConsoleClient`.
- Thin API routes around shared services.
- Add sanitizer for generated Wikipedia HTML.
- Update README to describe current architecture.

## First Pull Request Recommendation

Start with a small, high-value PR:

1. Add `event-access` helpers.
2. Fix `deleteEventAction`, `publishEventAction`, and `/hub/events`.
3. Protect all generated site routes and `/search/[id]`.
4. Add basic route/action tests or at least server helper tests.

This gives the project a safer foundation before changing routing names, CSS layout, or file organization.
