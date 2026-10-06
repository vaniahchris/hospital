# Value Family Hospital feedback

A responsive Next.js App Router interface based on the supplied design. Includes a welcome screen, five feedback steps, editable answers when navigating back, optional comments, and a completion screen.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000.

Admin login is at http://localhost:3000/admin/login (Supabase Auth). The public form and admin dashboard read/write the connected Supabase project.

## Verify

```sh
npm run typecheck
npm run build
```

Copy `.env.example` to `.env` and set `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Shared inpatient feedback

The inpatient UI is a separate Next.js app in `../folder1`. Both apps use the same Supabase project. The shared `submissions` table stores `source` (`outpatient` or `inpatient`); inpatient ratings are stored in `inpatient_answers`. The admin responses screen has separate Outpatients and Inpatients views, and its exports respect the selected view. The dashboard's question statistics remain based on outpatient responses.

The additive schema change is in `database/inpatient-responses.sql`. It has been applied to the connected project. For another database, run it before deploying the inpatient UI. Set the same public Supabase URL and publishable/anon key on both hosts.
