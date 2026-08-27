# Pressure Invalid-Marker Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve every finite FMS minute point when the same room payload also contains invalid/missing markers, while still failing an all-invalid new-data window.

**Architecture:** Keep room-local row accumulation. Track whether post-cursor candidates and invalid markers were seen; skip invalid markers, commit finite room rows, and raise the existing generic room error only when candidates exist but none are finite.

**Tech Stack:** Supabase Edge Function (Deno TypeScript), Node 24 `node:test`, esbuild.

## Global Constraints

- Modify only the Edge function and its unit test.
- Never serialize or upsert non-finite/blank values.
- Preserve claim/finish, auth, deadlines, ten-minute clamp, concurrency three, failure threshold, and sanitized errors.
- Do not push `main` until production Edge smoke passes.

---

### Task 1: Tolerate invalid markers beside finite points

**Files:**
- Modify: `web/test/pressure-edge-core.test.mjs`
- Modify: `supabase/functions/capnhat-phut-8h/index.ts`

**Interfaces:**
- Consumes the existing room-local `roomRows` array and Edge result schema.
- Produces unchanged public statuses/counts while ensuring `rows` contains finite values only.

- [ ] **Step 1: Write the failing mixed-payload test**

Change the existing invalid-value test so a room containing one valid point plus `null`, blank, whitespace, `NaN`, and `Infinity` expects HTTP 200 `FINISHED`, one finite upsert row, and zero room errors. Add a separate all-invalid room test expecting `FAILED`, zero upsert rows, one room error, and the fixed generic message.

- [ ] **Step 2: Run RED**

Run:

```bash
PATH=/home/admin1/.nvm/versions/node/v24.18.0/bin:$PATH node --test web/test/pressure-edge-core.test.mjs
```

Expected: the mixed-payload test fails because current code throws on the first invalid marker and rolls back the valid row.

- [ ] **Step 3: Implement the minimum room-local filtering**

Within each room worker, add candidate/invalid counters. After cursor filtering, continue over invalid values rather than throwing immediately. After all sensor loops, throw `giá trị sensor không hợp lệ` only when at least one candidate was seen, invalid values were seen, and `roomRows.length === 0`; otherwise append finite `roomRows`.

- [ ] **Step 4: Run GREEN and regressions**

Run the focused Edge tests, full `npm --prefix web run test:unit`, Node TypeScript syntax check, esbuild bundle, and `git diff --check`. All must pass.

- [ ] **Step 5: Review and commit**

Use one independent high-risk reviewer. Apply accepted findings with a new RED test. Commit the two production/test files plus this spec/plan with message:

```bash
git commit -m "fix: tolerate missing FMS pressure markers"
```

- [ ] **Step 6: Production acceptance and continue rollout**

Deploy from a temporary isolated Supabase project directory, download and checksum the deployed source, run the controlled concurrent viewer smoke after a new minute is available, then proceed to fast-forward/push `main` only on acceptance.
