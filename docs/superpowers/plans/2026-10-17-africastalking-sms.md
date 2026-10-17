# Africa's Talking SMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins upload a patient CSV, manage opt-outs, and send broadcast / single / feedback-invite SMS via Africa's Talking using a Supabase Edge Function.

**Architecture:** Next.js admin pages talk to Supabase for patient list and message history. Only Edge Function `sms-send` calls Africa's Talking (secrets stay in Supabase). Pure helpers in `lib/` cover Uganda phone normalization and SMS part limits.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + Auth + Edge Functions), Africa's Talking SMS REST API, Vitest for pure unit tests, shadcn UI already in the admin.

**Spec:** `docs/superpowers/specs/2026-10-17-africastalking-sms-design.md`

## Global Constraints

- Recipients come from `patients` CSV uploads only (not feedback form contacts).
- Targeting: everyone with `do_not_message = false` (no groups).
- Message kinds: `broadcast` | `single` | `feedback_invite`.
- Opt-out: staff toggle; enforced in Edge Function on every send.
- Transport: Supabase Edge Function `sms-send` (not Next.js API routes).
- List size assumed under 1,000; batch AT sends at ≤500 numbers.
- Sandbox first (`AT_USERNAME=sandbox`); never put AT secrets in Vercel or `NEXT_PUBLIC_*`.
- Body capped at 3 SMS parts (GSM-7 / UCS-2).
- Feedback invite default copy from the spec; if too long, UI offers outpatient-only or inpatient-only variants.
- Mirror existing RLS pattern: authenticated users manage; no public access to patients/SMS tables.
- Exclude `supabase/functions` from Next `tsconfig` (Deno runtime).

## File map

| Path | Responsibility |
|------|----------------|
| `database/sms-patients.sql` | Tables + RLS for patients / sms_messages / sms_recipients |
| `lib/phone.ts` | Uganda → E.164 normalize + validate |
| `lib/sms.ts` | SMS part counting, 3-part cap, invite templates |
| `lib/phone.test.ts` | Vitest for phone helpers |
| `lib/sms.test.ts` | Vitest for SMS length helpers |
| `supabase/functions/sms-send/index.ts` | Auth, recipients, AT API, DB writes |
| `supabase/functions/admin-account/index.ts` | Version existing deployed function |
| `app/admin/patients/page.tsx` | CSV upload, list, search, opt-out |
| `app/admin/messages/page.tsx` | Compose + history + sandbox banner |
| `app/admin/shared.tsx` | Sidebar links |
| `tsconfig.json` | Exclude `supabase/functions` |
| `package.json` | Add `vitest` + `test` script |
| `README.md` | SMS setup notes (sandbox secrets) |
| `.env.example` | Note that AT secrets are Supabase-only (comment only) |

---

### Task 1: Database schema and RLS

**Files:**
- Create: `database/sms-patients.sql`
- Apply via Supabase MCP `apply_migration` (name: `sms_patients`)

**Interfaces:**
- Produces: tables `public.patients`, `public.sms_messages`, `public.sms_recipients` with RLS for `authenticated`

- [ ] **Step 1: Write migration SQL**

Create `database/sms-patients.sql` with exactly:

```sql
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  do_not_message boolean not null default false,
  source_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint patients_phone_unique unique (phone)
);

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('broadcast', 'single', 'feedback_invite')),
  body text not null,
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'partial', 'failed')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_recipients (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.sms_messages (id) on delete cascade,
  patient_id uuid references public.patients (id) on delete set null,
  phone text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed')),
  provider_message_id text,
  error text,
  cost text
);

create index if not exists sms_recipients_message_id_idx on public.sms_recipients (message_id);
create index if not exists patients_name_idx on public.patients (name);

alter table public.patients enable row level security;
alter table public.sms_messages enable row level security;
alter table public.sms_recipients enable row level security;

create policy "Authenticated users manage patients"
  on public.patients for all to authenticated
  using (true) with check (true);

create policy "Authenticated users manage sms_messages"
  on public.sms_messages for all to authenticated
  using (true) with check (true);

create policy "Authenticated users manage sms_recipients"
  on public.sms_recipients for all to authenticated
  using (true) with check (true);
```

- [ ] **Step 2: Apply migration**

Use Supabase MCP `apply_migration` with name `sms_patients` and the SQL above.

- [ ] **Step 3: Verify tables exist**

Run via `execute_sql`:

```sql
select tablename from pg_tables
where schemaname = 'public'
  and tablename in ('patients', 'sms_messages', 'sms_recipients')
order by tablename;
```

Expected: three rows.

- [ ] **Step 4: Commit**

```bash
git add database/sms-patients.sql
git commit -m "Add patients and SMS tables with authenticated RLS."
```

---

### Task 2: Phone + SMS helpers (TDD)

**Files:**
- Create: `lib/phone.ts`, `lib/phone.test.ts`, `lib/sms.ts`, `lib/sms.test.ts`
- Modify: `package.json` (add vitest + script)

**Interfaces:**
- Produces:
  - `normalizeUgandanPhone(raw: string): string | null` — E.164 `+2567…` or null
  - `countSmsParts(body: string): { encoding: 'gsm7' | 'ucs2'; parts: number; length: number }`
  - `isWithinSmsPartLimit(body: string, maxParts?: number): boolean` — default `maxParts = 3`
  - `FEEDBACK_INVITE_BOTH`, `FEEDBACK_INVITE_OUTPATIENT`, `FEEDBACK_INVITE_INPATIENT` string constants
  - `pickFeedbackInviteBody(): string` — returns BOTH if within limit, else OUTPATIENT (UI can switch)

- [ ] **Step 1: Add Vitest**

```bash
npm install -D vitest
```

In `package.json` scripts add:

```json
"test": "vitest run"
```

- [ ] **Step 2: Write failing phone tests**

Create `lib/phone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { normalizeUgandanPhone } from './phone';

describe('normalizeUgandanPhone', () => {
  it('normalizes local 07 numbers', () => {
    expect(normalizeUgandanPhone('0775699700')).toBe('+256775699700');
  });
  it('normalizes 7… and 256… forms', () => {
    expect(normalizeUgandanPhone('775699700')).toBe('+256775699700');
    expect(normalizeUgandanPhone('256775699700')).toBe('+256775699700');
  });
  it('keeps already-E.164', () => {
    expect(normalizeUgandanPhone('+256775699700')).toBe('+256775699700');
  });
  it('rejects invalid', () => {
    expect(normalizeUgandanPhone('123')).toBeNull();
    expect(normalizeUgandanPhone('')).toBeNull();
    expect(normalizeUgandanPhone('abc')).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests — expect fail**

```bash
npm test -- lib/phone.test.ts
```

Expected: FAIL (module not found / export missing).

- [ ] **Step 4: Implement `lib/phone.ts`**

```ts
/** Normalize common UG mobile forms to E.164 (+256…). Returns null if invalid. */
export function normalizeUgandanPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '').replace(/^\+/, '');
  let national = digits;
  if (national.startsWith('256')) national = national.slice(3);
  else if (national.startsWith('0')) national = national.slice(1);
  if (!/^7\d{8}$/.test(national)) return null;
  return `+256${national}`;
}
```

- [ ] **Step 5: Re-run phone tests — expect pass**

```bash
npm test -- lib/phone.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write failing SMS tests**

Create `lib/sms.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  countSmsParts,
  isWithinSmsPartLimit,
  FEEDBACK_INVITE_BOTH,
  pickFeedbackInviteBody,
} from './sms';

describe('countSmsParts', () => {
  it('counts GSM-7 single part under 160', () => {
    const r = countSmsParts('Hello from Value Family Hospital');
    expect(r.encoding).toBe('gsm7');
    expect(r.parts).toBe(1);
  });
  it('uses UCS-2 when non-GSM characters present', () => {
    const r = countSmsParts('Hello 💜');
    expect(r.encoding).toBe('ucs2');
  });
});

describe('isWithinSmsPartLimit', () => {
  it('allows up to 3 parts', () => {
    expect(isWithinSmsPartLimit('Hi')).toBe(true);
  });
});

describe('pickFeedbackInviteBody', () => {
  it('returns a non-empty invite within 3 parts', () => {
    const body = pickFeedbackInviteBody();
    expect(body.length).toBeGreaterThan(20);
    expect(isWithinSmsPartLimit(body)).toBe(true);
    expect(body.includes('valuefamilyhospital.com')).toBe(true);
  });
});
```

- [ ] **Step 7: Implement `lib/sms.ts`**

```ts
const GSM7 =
  /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\r\n]*$/;

export const FEEDBACK_INVITE_BOTH =
  'Value Family Hospital: please share feedback. Outpatient: https://feedback.valuefamilyhospital.com/outpatient Inpatient: https://feedback.valuefamilyhospital.com/inpatient';

export const FEEDBACK_INVITE_OUTPATIENT =
  'Value Family Hospital: please share outpatient feedback: https://feedback.valuefamilyhospital.com/outpatient';

export const FEEDBACK_INVITE_INPATIENT =
  'Value Family Hospital: please share inpatient feedback: https://feedback.valuefamilyhospital.com/inpatient';

export function countSmsParts(body: string): {
  encoding: 'gsm7' | 'ucs2';
  parts: number;
  length: number;
} {
  const length = [...body].length;
  const gsm7 = GSM7.test(body);
  if (gsm7) {
    if (length <= 160) return { encoding: 'gsm7', parts: 1, length };
    return { encoding: 'gsm7', parts: Math.ceil(length / 153), length };
  }
  if (length <= 70) return { encoding: 'ucs2', parts: 1, length };
  return { encoding: 'ucs2', parts: Math.ceil(length / 67), length };
}

export function isWithinSmsPartLimit(body: string, maxParts = 3): boolean {
  return countSmsParts(body).parts <= maxParts;
}

export function pickFeedbackInviteBody(): string {
  if (isWithinSmsPartLimit(FEEDBACK_INVITE_BOTH)) return FEEDBACK_INVITE_BOTH;
  return FEEDBACK_INVITE_OUTPATIENT;
}
```

- [ ] **Step 8: Run all unit tests**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json lib/phone.ts lib/phone.test.ts lib/sms.ts lib/sms.test.ts
git commit -m "Add phone normalize and SMS part helpers with tests."
```

---

### Task 3: Edge Function `sms-send` + version `admin-account`

**Files:**
- Create: `supabase/functions/sms-send/index.ts`
- Create: `supabase/functions/admin-account/index.ts` (source mirror of deployed function)
- Modify: `tsconfig.json` exclude `supabase/functions`

**Interfaces:**
- Consumes: `patients` rows; secrets `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID` (optional)
- Produces: Edge Function invoke contract:

```ts
// send
{ action: 'send'; kind: 'broadcast' | 'single' | 'feedback_invite'; body: string; patientId?: string }
// → { ok: true, messageId, recipientCount, sentCount, failedCount, status, failures?: { phone, error }[] }
//    | { error: string }

// status
{ action: 'status' }
// → { sandbox: boolean } | { error: string }
```

Africa's Talking:
- Sandbox URL: `https://api.sandbox.africastalking.com/version1/messaging`
- Live URL: `https://api.africastalking.com/version1/messaging`
- Headers: `apiKey`, `Accept: application/json`, `Content-Type: application/x-www-form-urlencoded`
- Body: `username`, `to` (comma-separated), `message`, optional `from` when `AT_SENDER_ID` set
- Choose host from `AT_USERNAME === 'sandbox'`

- [ ] **Step 1: Exclude Deno functions from Next typecheck**

In `tsconfig.json` `"exclude"`:

```json
"exclude": ["node_modules", "supabase/functions"]
```

- [ ] **Step 2: Write `supabase/functions/sms-send/index.ts`**

Implement full handler (Deno):

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Kind = "broadcast" | "single" | "feedback_invite";

type Body = {
  action?: "send" | "status";
  kind?: Kind;
  body?: string;
  patientId?: string;
};

const MAX_PARTS = 3;
const BATCH = 500;

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function countParts(text: string): number {
  const gsm =
    /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./0-9:;<=>?¡A-ZÄÖÑÜ§¿a-zäöñüà\r\n]*$/
      .test(text);
  const length = [...text].length;
  if (gsm) return length <= 160 ? 1 : Math.ceil(length / 153);
  return length <= 70 ? 1 : Math.ceil(length / 67);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const atUsername = Deno.env.get("AT_USERNAME") ?? "";
    const atApiKey = Deno.env.get("AT_API_KEY") ?? "";
    const atSender = Deno.env.get("AT_SENDER_ID") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Not authenticated." }, 401);

    const payload = (await req.json()) as Body;
    if (payload.action === "status") {
      return json({ sandbox: atUsername === "sandbox" });
    }
    if (payload.action !== "send") return json({ error: "Unknown action." }, 400);

    if (!atUsername || !atApiKey) {
      return json({ error: "SMS is not configured. Set AT_USERNAME and AT_API_KEY secrets." }, 500);
    }

    const kind = payload.kind;
    const messageBody = (payload.body ?? "").trim();
    if (!kind || !["broadcast", "single", "feedback_invite"].includes(kind)) {
      return json({ error: "Invalid kind." }, 400);
    }
    if (!messageBody) return json({ error: "Message body is required." }, 400);
    if (countParts(messageBody) > MAX_PARTS) {
      return json({ error: "Message exceeds the 3-SMS-part limit." }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    type Patient = { id: string; phone: string; do_not_message: boolean };
    let recipients: Patient[] = [];

    if (kind === "single") {
      if (!payload.patientId) return json({ error: "patientId is required for single send." }, 400);
      const { data, error } = await admin
        .from("patients")
        .select("id, phone, do_not_message")
        .eq("id", payload.patientId)
        .maybeSingle();
      if (error || !data) return json({ error: "Patient not found." }, 400);
      if (data.do_not_message) return json({ error: "This patient is marked do not message." }, 400);
      recipients = [data];
    } else {
      const { data, error } = await admin
        .from("patients")
        .select("id, phone, do_not_message")
        .eq("do_not_message", false);
      if (error) return json({ error: error.message }, 400);
      recipients = data ?? [];
    }

    if (!recipients.length) return json({ error: "No recipients to message." }, 400);

    const { data: msg, error: msgError } = await admin
      .from("sms_messages")
      .insert({
        kind,
        body: messageBody,
        recipient_count: recipients.length,
        status: "pending",
        created_by: userData.user.id,
      })
      .select("id")
      .single();
    if (msgError || !msg) return json({ error: msgError?.message ?? "Could not create message." }, 400);

    const host =
      atUsername === "sandbox"
        ? "https://api.sandbox.africastalking.com"
        : "https://api.africastalking.com";

    let sentCount = 0;
    let failedCount = 0;
    const failures: { phone: string; error: string }[] = [];
    const recipientRows: Record<string, unknown>[] = [];

    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH);
      const form = new URLSearchParams();
      form.set("username", atUsername);
      form.set("to", batch.map((r) => r.phone).join(","));
      form.set("message", messageBody);
      if (atSender) form.set("from", atSender);

      const atRes = await fetch(`${host}/version1/messaging`, {
        method: "POST",
        headers: {
          apiKey: atApiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      const atJson = await atRes.json().catch(() => null);
      if (!atRes.ok) {
        const err =
          atJson?.SMSMessageData?.Message ??
          atJson?.message ??
          `Africa's Talking error (${atRes.status})`;
        for (const r of batch) {
          failedCount++;
          failures.push({ phone: r.phone, error: String(err) });
          recipientRows.push({
            message_id: msg.id,
            patient_id: r.id,
            phone: r.phone,
            status: "failed",
            error: String(err),
          });
        }
        continue;
      }

      const recipientsOut = atJson?.SMSMessageData?.Recipients ?? [];
      const byPhone = new Map<string, { statusCode: number; status: string; messageId?: string; cost?: string }>();
      for (const item of recipientsOut) {
        if (item?.number) byPhone.set(String(item.number), item);
      }

      for (const r of batch) {
        const hit = byPhone.get(r.phone);
        const ok = hit && Number(hit.statusCode) === 101;
        if (ok) {
          sentCount++;
          recipientRows.push({
            message_id: msg.id,
            patient_id: r.id,
            phone: r.phone,
            status: "sent",
            provider_message_id: hit?.messageId ?? null,
            cost: hit?.cost ?? null,
          });
        } else {
          failedCount++;
          const err = hit?.status ?? "Delivery rejected";
          failures.push({ phone: r.phone, error: String(err) });
          recipientRows.push({
            message_id: msg.id,
            patient_id: r.id,
            phone: r.phone,
            status: "failed",
            error: String(err),
            provider_message_id: hit?.messageId ?? null,
            cost: hit?.cost ?? null,
          });
        }
      }
    }

    const status =
      failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";

    await admin.from("sms_recipients").insert(recipientRows);
    await admin
      .from("sms_messages")
      .update({ sent_count: sentCount, failed_count: failedCount, status })
      .eq("id", msg.id);

    return json({
      ok: true,
      messageId: msg.id,
      recipientCount: recipients.length,
      sentCount,
      failedCount,
      status,
      failures: failures.slice(0, 20),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return json({ error: message }, 500);
  }
});
```

- [ ] **Step 3: Mirror `admin-account` into the repo**

Create `supabase/functions/admin-account/index.ts` with the same source previously deployed (password/email update via admin API). If the live source is unavailable from MCP `get_edge_function`, recreate from the conversation’s deployed version: verify JWT, `signInWithPassword` for current password, then `auth.admin.updateUserById` with `email_confirm: true`.

- [ ] **Step 4: Deploy `sms-send`**

Use Supabase MCP `deploy_edge_function` with `name: sms-send`, `verify_jwt: true`, and the file content from Step 2.

- [ ] **Step 5: Document secrets for the user (do not invent keys)**

In README (Task 7) and as a commit note: set Supabase Edge Function secrets `AT_USERNAME`, `AT_API_KEY`, optional `AT_SENDER_ID`. Until the user provides sandbox credentials, status/send will return “not configured”.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json supabase/functions/sms-send/index.ts supabase/functions/admin-account/index.ts
git commit -m "Add sms-send Edge Function and version admin-account."
```

---

### Task 4: Patients admin page

**Files:**
- Create: `app/admin/patients/page.tsx`
- Modify: `app/admin/shared.tsx` (add Patients nav link)

**Interfaces:**
- Consumes: `normalizeUgandanPhone` from `@/lib/phone`
- Produces: UI at `/admin/patients` — list, search, CSV preview/import, do-not-message toggle

- [ ] **Step 1: Add nav link in `app/admin/shared.tsx`**

Import `Users` from `lucide-react` and extend `links`:

```ts
{ href: '/admin/patients', label: 'Patients', icon: Users },
```

(Messages link added in Task 5.)

- [ ] **Step 2: Create patients page**

`app/admin/patients/page.tsx` (client component):

- Load: `supabase.from('patients').select('*').order('updated_at', { ascending: false })`
- Search: filter client-side by name/phone substring
- Toggle: `update({ do_not_message, updated_at: new Date().toISOString() }).eq('id', id)`
- CSV upload:
  1. Parse text: require header containing `name` and `phone` (case-insensitive)
  2. For each data row → `normalizeUgandanPhone`; build `{ valid, invalid, duplicatePhonesInFile }`
  3. Preview counts before import
  4. On confirm: `upsert` valid rows with `onConflict: 'phone'`, fields `{ name, phone, source_filename, updated_at }` — **do not** send `do_not_message` so existing opt-outs are preserved (Postgres upsert default keeps unspecified columns when using `ignoreDuplicates: false` — use explicit update columns: `name, phone, source_filename, updated_at` only)

Use existing shadcn: `AdminShell`, `Card`, `Table`, `Button`, `Input`, `Switch` or checkbox Button, `Alert`, `Badge`.

CSV parse helper inline:

```ts
function parsePatientCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { error: 'Empty file' as const };
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const nameIdx = headers.indexOf('name');
  const phoneIdx = headers.indexOf('phone');
  if (nameIdx < 0 || phoneIdx < 0) return { error: 'CSV must have name and phone columns' as const };
  // … map rows, normalize, track invalid + file duplicates …
}
```

- [ ] **Step 3: Manual check**

Run `npm run dev`, sign in, open `/admin/patients`, upload a 3-row sample CSV with one bad phone. Confirm preview and upsert.

- [ ] **Step 4: Commit**

```bash
git add app/admin/patients/page.tsx app/admin/shared.tsx
git commit -m "Add Patients admin page with CSV import and opt-out."
```

---

### Task 5: Messages admin page

**Files:**
- Create: `app/admin/messages/page.tsx`
- Modify: `app/admin/shared.tsx` (Messages nav link)

**Interfaces:**
- Consumes: `supabase.functions.invoke('sms-send', …)`, `lib/sms.ts` helpers, patients list for single-send select
- Produces: UI at `/admin/messages`

- [ ] **Step 1: Add Messages nav link**

```ts
{ href: '/admin/messages', label: 'Messages', icon: MessageSquareText },
```

(If `MessageSquareText` is already used for Responses, use `Send` from lucide instead.)

- [ ] **Step 2: Build messages page**

Features:

1. On mount: `invoke('sms-send', { body: { action: 'status' } })` → show amber Alert “Test mode (Africa's Talking sandbox)” when `sandbox === true`.
2. Kind tabs/segmented: Broadcast | Single | Feedback invite.
3. Body textarea; show `countSmsParts` live (`parts/3`). Disable Send when over limit.
4. Feedback invite: prefill `pickFeedbackInviteBody()`; if BOTH over limit, show Outpatient / Inpatient template buttons.
5. Single: `Select` of patients (exclude `do_not_message`).
6. Broadcast / feedback_invite: load eligible count (`do_not_message = false`). Confirm with `AlertDialog` showing count before send.
7. Send: `invoke('sms-send', { body: { action: 'send', kind, body, patientId } })`; disable button while loading; show result Alert.
8. History: table of `sms_messages` ordered by `created_at` desc; click row loads `sms_recipients` for that message.

Error parsing: same pattern as account settings (`invokeError.context.json()`).

- [ ] **Step 3: Manual check without AT secrets**

Expect clear “SMS is not configured…” (or status sandbox false / error). Confirm UI still loads history empty state.

- [ ] **Step 4: Commit**

```bash
git add app/admin/messages/page.tsx app/admin/shared.tsx
git commit -m "Add Messages admin page for compose and history."
```

---

### Task 6: Docs + typecheck/build

**Files:**
- Modify: `README.md`, `.env.example`

- [ ] **Step 1: README section**

Add:

```md
## SMS (Africa's Talking)

Patient broadcasts and invites use Supabase Edge Function `sms-send`.

1. Create an Africa's Talking sandbox app and API key.
2. In Supabase → Edge Functions → Secrets, set:
   - `AT_USERNAME` = `sandbox`
   - `AT_API_KEY` = your sandbox key
   - `AT_SENDER_ID` = optional (leave empty until approved)
3. Admin → Patients: upload CSV (`name,phone`).
4. Admin → Messages: send in Test mode; check the AT simulator.

Live cutover: change secrets to the live username/key (and Sender ID when approved). No code change.
```

- [ ] **Step 2: `.env.example` comment**

```
# Africa's Talking keys are NOT set here — configure as Supabase Edge Function secrets (AT_USERNAME, AT_API_KEY, AT_SENDER_ID).
```

- [ ] **Step 3: Verify**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all succeed. Routes include `/admin/patients` and `/admin/messages`.

- [ ] **Step 4: Commit**

```bash
git add README.md .env.example
git commit -m "Document Africa's Talking sandbox setup for SMS."
```

---

### Task 7: Sandbox smoke test (human + agent)

**Files:** none (ops)

- [ ] **Step 1: User provides sandbox credentials** (out of band — never paste into chat/git). Agent or user sets Supabase secrets.

- [ ] **Step 2: Redeploy `sms-send` if secrets were added after first deploy** (secrets apply without redeploy on Supabase; verify with status action).

- [ ] **Step 3: Checklist**

1. Upload CSV with valid + invalid + duplicate phones.
2. Toggle one patient do-not-message; confirm Messages eligible count drops.
3. Broadcast short test SMS → AT simulator + History `sent`/`partial`.
4. Single send to one patient.
5. Feedback invite send.
6. Attempt send to opted-out patient → error, no AT call.

- [ ] **Step 4: Final commit only if docs/fixes needed**

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| `patients` / `sms_*` tables + auth RLS | 1 |
| E.164 UG phones + CSV reject invalid | 2, 4 |
| Upsert preserves `do_not_message` | 4 |
| Patients UI + opt-out | 4 |
| Messages UI: broadcast / single / invite | 5 |
| 3-part cap UI + server | 2, 3, 5 |
| Confirmation + disable while sending | 5 |
| Sandbox banner via `status` | 3, 5 |
| History + recipient failures | 5 |
| Edge Function `sms-send` + AT REST | 3 |
| Secrets only in Supabase | 3, 6 |
| Version `admin-account` in repo | 3 |
| README / rollout notes | 6, 7 |

## Placeholder / consistency self-review

- No TBD steps; AT URLs and headers specified.
- `kind` union and table check constraints match.
- Function response fields match Messages page expectations.
- Nav icons: Patients=`Users`, Messages=`Send` (avoid clash with Responses).
