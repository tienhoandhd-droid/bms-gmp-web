# Pressure FMS Invalid-Marker Hotfix Design

## Context

The production Edge smoke test after version 3 proved the lease gate works: two simultaneous requests produced one `FAILED` run and one `SKIPPED_LOCKED`. The claimed run reported 57/57 room failures with `giá trị sensor không hợp lệ`. Immediately before that, the verified legacy Edge source stored 114 finite points from the same 57 rooms. The real FMS payload therefore contains invalid/missing marker points alongside usable points; treating one marker as a transaction-wide room failure discards all usable minute data.

## Options

1. **Keep failing a room on any invalid marker.** This preserves strict observability but production has shown it rejects all 57 rooms and cannot meet the one-minute data requirement.
2. **Recommended: keep finite points, ignore invalid markers, fail only an all-invalid candidate window.** This preserves every usable minute sample, never serializes `NaN`/`Infinity`/blank values, and still reports a room failure when FMS claims to have new samples but provides no finite value at all.
3. **Fail the whole run on any invalid marker.** This is safer only superficially; in the observed payload it guarantees global backoff and complete data loss.

## Behavior

For each room, evaluate only datapoints whose normalized timestamp is newer than the clamped per-sensor cursor.

- Mark that a candidate was seen.
- For `null`, `undefined`, empty/whitespace strings, `NaN`, or infinite numeric conversions: increment a private invalid counter and continue without creating a row.
- For finite values: append the normalized minute row.
- After all monitored sensors in the room:
  - if at least one finite row exists, append all finite rows and do not fail the room;
  - if candidates existed but every candidate was invalid, fail that room with the fixed non-secret message `giá trị sensor không hợp lệ`;
  - if no candidate exists, return a normal zero-row room result.

No raw FMS values are logged or returned. Claim/finish, concurrency 3, ten-minute clamp, deadlines, error threshold, auth, and status schema remain unchanged.

## Tests and rollout

- RED: mixed finite + invalid markers currently fails and drops the finite row.
- GREEN: mixed payload upserts only finite rows and finishes successfully.
- Regression: an all-invalid candidate window still fails its room and never upserts `null`/non-finite data.
- Run the full local suite, Edge parse/bundle, and independent review.
- Deploy from an isolated staging directory with its own `supabase/config.toml`; download production source afterward and compare SHA-256.
- Wait for a new FMS minute, then repeat the two-request viewer smoke. Acceptance is one real run with no global invalid-marker failure plus one `SKIPPED_LOCKED`/`SKIPPED_FRESH`, followed by viewer cleanup.

## Rollback

If the hotfix fails acceptance, deploy the downloaded version-1 source from `/tmp/bms-pressure-rollout.J5R39Q/project` and keep the viewer-gated migration in place so zero viewers still produce zero FMS work. Do not push the web until Edge acceptance passes.
