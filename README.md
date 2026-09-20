# Ndejje Health Centre feedback

A responsive Next.js App Router interface based on the supplied design. Includes a welcome screen, five feedback steps, editable answers when navigating back, optional comments, and a completion screen.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000.

The frontend-only admin preview is available at http://localhost:3000/admin/login. It includes a preview login, analytics, editable question management, response review, and CSV export using mock data until Supabase is connected. Enter any password with the prefilled email to test the local login flow.

## Verify

```sh
npm run typecheck
npm run build
```

This is a frontend preview. Responses live only in React state and are cleared on refresh or returning home after completion. There are no network submissions, database integrations, or admin routes yet. Supabase persistence and an admin dashboard are the next phase.
