# Value Family Hospital feedback

A responsive Next.js App Router interface based on the supplied design. Includes a welcome screen, five feedback steps, editable answers when navigating back, optional comments, and a completion screen.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000.

- `/outpatient`: outpatient feedback form (questions managed from the admin)
- `/inpatient`: inpatient feedback form
- `/`: lets patients choose between the two forms

Admin login is at http://localhost:3000/admin/login (Supabase Auth). Both forms and the admin dashboard read/write the connected Supabase project.

## Verify

```sh
npm run typecheck
npm run build
```

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Shared inpatient feedback

The inpatient UI is a separate Next.js app in `../folder1`. Both apps use the same Supabase project. The shared `submissions` table stores `source` (`outpatient` or `inpatient`); inpatient ratings are stored in `inpatient_answers`. The admin responses screen has separate Outpatients and Inpatients views, and its exports respect the selected view. The dashboard's question statistics remain based on outpatient responses.

The additive schema change is in `database/inpatient-responses.sql`. It has been applied to the connected project. For another database, run it before deploying the inpatient UI. Set the same public Supabase URL and publishable/anon key on both hosts.

## SMS (Africa's Talking)

Patient broadcasts and invites use Supabase Edge Function `sms-send`.

1. Create an Africa's Talking sandbox app and API key.
2. In Supabase → Edge Functions → Secrets, set:
   - `AT_USERNAME` = `sandbox`
   - `AT_API_KEY` = your sandbox key
   - `AT_SENDER_ID` = optional (leave empty until approved)
   - `AT_DELIVERY_WEBHOOK_SECRET` = a long random token (for Outbox delivery sync)
3. Admin → Patients: upload CSV (`name,phone`).
4. Admin → Messages: send in Test mode; check the AT simulator.

### Delivery reports (Outbox sync)

Edge Function `sms-delivery-report` updates `sms_recipients` when Africa's Talking posts a final delivery status (`Success` → sent, `Failed` / `Rejected` / etc. → failed).

1. Set secret `AT_DELIVERY_WEBHOOK_SECRET` (same value as in the URL below).
2. In Africa's Talking → SMS → SMS Callback URLs → Delivery Reports, set:
   `https://<project-ref>.supabase.co/functions/v1/sms-delivery-report?token=<AT_DELIVERY_WEBHOOK_SECRET>`
3. JWT verification stays **off** for this function (AT cannot send a Supabase JWT).

Live cutover: change secrets to the live username/key (and Sender ID when approved). No code change.
