# Africa's Talking SMS — Design Spec

**Date:** 2026-10-17  
**Status:** Approved for implementation planning  
**Product:** Value Family Hospital feedback admin

## Problem

Hospital staff need to send SMS to patients from a contact list: broadcasts, one-off messages, and invitations to fill the feedback form. Contacts come from hospital CSV exports, not from feedback form submissions.

## Goals

- Upload patient name + phone from CSV into a managed list.
- Send broadcasts to everyone who has not opted out.
- Send a single SMS to one patient.
- Send SMS invitations that include the feedback form links.
- Enforce "do not message" on the server for every send.
- Keep Africa's Talking API secrets off the browser and off Vercel.

## Non-goals (this iteration)

- Automated opt-out via patient reply of STOP (needs 2-way / shortcode).
- Group or tag-based targeting (e.g. Maternity only).
- Sync from an EMR/HMIS.
- Message queues for lists larger than ~1,000 (not needed; list size is under 1,000).
- Two-way conversational SMS.

## Constraints

- Patient list size: under 1,000.
- Africa's Talking account: not created yet; build against **sandbox** first.
- Sender ID: apply in parallel; optional until approved.
- Opt-out: staff mark "do not message" in admin.
- Hosting: forms + admin stay on Vercel; SMS sending runs on **Supabase Edge Functions**.

## Architecture

```
Admin UI (Next.js, Vercel)
  ├── Patients page  → Supabase DB (direct client, RLS/auth)
  ├── Messages page  → Supabase DB (history) + Edge Function (send)
  └──
Supabase Edge Function: sms-send
  ├── Verifies signed-in admin JWT
  ├── Loads recipients from patients (respects do_not_message)
  ├── Writes sms_messages + sms_recipients
  └── Calls Africa's Talking SMS API
```

Browser never holds `AT_API_KEY`. Vercel env stays Supabase-only for this feature.

## Data model

### `patients`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `name` | text | Required |
| `phone` | text | Unique, E.164 (`+256…`) |
| `do_not_message` | boolean | Default false |
| `source_filename` | text nullable | Last CSV that created/updated the row |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

CSV import upserts by `phone`. Existing `do_not_message` is preserved on upsert.

### `sms_messages`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `kind` | text | `broadcast` \| `single` \| `feedback_invite` |
| `body` | text | Exact SMS text sent |
| `recipient_count` | int | |
| `sent_count` | int | |
| `failed_count` | int | |
| `status` | text | `pending` \| `sent` \| `partial` \| `failed` |
| `created_by` | uuid nullable | Auth user id |
| `created_at` | timestamptz | |

### `sms_recipients`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid PK | |
| `message_id` | uuid FK → sms_messages | |
| `patient_id` | uuid nullable FK → patients | |
| `phone` | text | |
| `status` | text | `queued` \| `sent` \| `failed` |
| `provider_message_id` | text nullable | Africa's Talking messageId |
| `error` | text nullable | |
| `cost` | text nullable | Provider cost string if returned |

### Access

- Only authenticated admin users may read/write these tables (same auth model as the rest of admin).
- Edge Function uses the service role only after validating the caller's JWT is a real signed-in user.

## Phone numbers

- Canonical storage: E.164 for Uganda, e.g. `+2567XXXXXXXX`.
- Import accepts common local forms (`07…`, `7…`, `256…`) and normalizes.
- Invalid or unparseable numbers are rejected in the CSV preview and never saved.
- Duplicates in one file collapse to one row (last wins).

## Admin UI

### Navigation

Add sidebar links:

- **Patients** → `/admin/patients`
- **Messages** → `/admin/messages`

### Patients (`/admin/patients`)

- Table: name, phone, do-not-message toggle, source filename, updated date.
- **Upload CSV**: columns `name`, `phone` (header row required). Preview shows valid / invalid / duplicates before import.
- Search by name or phone.
- Toggle "do not message" inline; skipped by every send.

### Messages (`/admin/messages`)

Three actions (same compose surface, different defaults):

1. **Broadcast** — body only; recipients = all patients where `do_not_message = false`.
2. **Single** — pick one patient + body.
3. **Feedback invite** — editable template; default body:

   > Value Family Hospital: please share feedback. Outpatient: https://feedback.valuefamilyhospital.com/outpatient Inpatient: https://feedback.valuefamilyhospital.com/inpatient

   If that exceeds the 3-part cap after length check, the UI shortens to one link at a time (staff chooses outpatient or inpatient invite). Still subject to the length cap before send.

Rules:

- Confirmation dialog before every broadcast (shows recipient count).
- Send button disabled while a send is in flight.
- Body capped so the message is at most **3 SMS parts** (GSM-7 / UCS-2 length rules applied in UI helper).
- When `AT_USERNAME === sandbox`, show a clear **Test mode** banner (function `status` action reports this).
- **History**: past `sms_messages` with status counts; drill into recipients for failures.

## Edge Function: `sms-send`

Path in repo: `supabase/functions/sms-send/`.

Also check `admin-account` into `supabase/functions/admin-account/` so Edge Function source is versioned (it currently exists only as a deployed function).

### Actions

**`POST` body `{ action: "send", kind, body, patientId? }`**

1. Require `Authorization` JWT; reject if missing/invalid.
2. Resolve recipients:
   - `broadcast` / `feedback_invite`: all patients with `do_not_message = false`.
   - `single`: one patient by `patientId`; reject if missing or opted out.
3. Reject empty recipient set or empty body; enforce length cap server-side.
4. Insert `sms_messages` (`status: pending`).
5. Call Africa's Talking SMS API in batches of ≤500 numbers.
6. Insert `sms_recipients` rows; update message counts and final status (`sent` / `partial` / `failed`).
7. Return summary: totals + sample of failures.

**`POST` body `{ action: "status" }`**

- Returns `{ sandbox: boolean }` based on `AT_USERNAME` (true when `sandbox`).

### Secrets (Supabase Edge Function secrets)

| Secret | Purpose |
|--------|---------|
| `AT_USERNAME` | `sandbox` in test; live username later |
| `AT_API_KEY` | API key |
| `AT_SENDER_ID` | Optional; omit until approved |

Never prefix these with `NEXT_PUBLIC_`. Never store them in Vercel for this feature.

## Africa's Talking

- Sandbox first: messages appear in the AT phone simulator; no real SMS cost.
- Live cutover: change secrets only; no app code change expected.
- Sender ID: apply early (≤11 characters, e.g. `VALUEFAMILY`); until approved, omit `from` / sender so AT default applies.

## Error handling

| Case | Behavior |
|------|----------|
| Not signed in | 401 from function |
| Opted-out single target | 400 with clear message |
| AT rejects whole request (bad key, no credit) | Message marked `failed`; admin sees reason |
| Some numbers fail | Message `partial`; per-recipient errors in History |
| Empty list | 400; no AT call |

## Testing

1. Create AT sandbox; set secrets in Supabase.
2. Upload small CSV with valid/invalid/duplicate rows; verify preview + upsert.
3. Toggle do-not-message; confirm broadcast count drops.
4. Broadcast + single + feedback invite; verify History and simulator.
5. `npm run typecheck` and `npm run build` for the Next app.
6. Deploy function via Supabase tooling already used for this project.

## Rollout

1. Ship Patients + Messages + function against sandbox.
2. Finish AT live account + Sender ID approval.
3. Flip secrets to live; send a tiny test broadcast to staff phones.
4. Optional later: point old `vhf-teal` redirect at custom domain if not already done.

## Open items for implementation plan (not blockers)

- Exact AT REST endpoint and auth header shape for Uganda SMS (use current AT docs at implement time).
- RLS policies: mirror existing admin-only patterns on `submissions` / auth usage.

## Approval record

- Recipients: separate patient list (CSV), not feedback contacts.
- Targeting: everyone not opted out.
- Message kinds: broadcast, single, feedback invite.
- Opt-out: staff toggle.
- Transport: Supabase Edge Function `sms-send` (not Next.js API routes).
- List size: under 1,000.
- Account: sandbox first; AT not created at design time.
