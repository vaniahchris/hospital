# Task 3 Report: Edge Functions

## Status

Completed Task 3 only.

## Changes

- Added `supabase/functions/sms-send/index.ts` using the task brief's handler structure and API contract.
- Mirrored the deployed `admin-account` version 1 source into `supabase/functions/admin-account/index.ts`.
- Excluded `supabase/functions` from the Next.js TypeScript project.

## Deployment

- Deployed `sms-send` version 1 to Supabase project `kfbmhgrabxgkozvhllfl` (`kitende`).
- Deployment status: `ACTIVE`.
- JWT verification: enabled (`verify_jwt: true`).
- Retrieved the deployed function after deployment and confirmed its source and settings.

## Verification

- `npm run typecheck`: passed.
- `npm test`: passed (2 files, 8 tests).
- IDE lint diagnostics for all three task files: none.
- `git diff --check`: passed.
- Self-review found no deviations from the requested handler structure or deployed `admin-account` source.

## Secrets / Concerns

Africa's Talking secrets were intentionally not set. The user must provide Supabase Edge Function secrets `AT_USERNAME`, `AT_API_KEY`, and optionally `AT_SENDER_ID`. Until configured, authenticated status reports `{ "sandbox": false }` and send requests return the documented “SMS is not configured” error. This status behavior follows the verbatim handler, although the brief's Step 5 prose says status would report “not configured.”

Pre-existing uncommitted changes in `database/sms-patients.sql`, `lib/phone.ts`, `lib/phone.test.ts`, `lib/sms.ts`, and `lib/sms.test.ts` were left untouched and excluded from the Task 3 commit.

## Important Review Fixes

- Counted UCS-2 SMS length in UTF-16 code units on both client and server, including an emoji boundary regression test.
- Paginated broadcast and feedback-invite patient queries in deterministic 1,000-row ranges until all eligible recipients are loaded.
- Checked both post-send database writes, attempted both writes even if one failed, and now return HTTP 500 with an explicit provider-send/persistence error instead of `ok: true`.
- Redeployed `sms-send` version 2 (`ACTIVE`) with `verify_jwt: true` and verified the deployed source.

## Fix Verification

- `npm test -- lib/sms.test.ts`: passed (1 file, 5 tests).
- `npm test`: passed (2 files, 9 tests).
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- IDE lint diagnostics for the edited files: none.
