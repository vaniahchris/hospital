# Ndejje Health Centre feedback

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
