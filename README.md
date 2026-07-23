# CRM System

Web + mobile CRM for managing clients, task assignments, and payments with role-based access control.

## Tech Stack

- **Backend:** Next.js Route Handlers (`frontend/app/api`) — there is no separate backend service
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Supabase Auth)
- **Frontend:** Next.js 14 (TypeScript, App Router), Tailwind CSS
- **Mobile:** Expo / React Native (`mobile/`)
- **Notifications:** In-app + Telegram bot integration

Auth uses Supabase Auth sessions (cookie-based via `@supabase/ssr`), not a hand-rolled JWT layer. Every request is additionally scoped by Postgres Row Level Security policies (see `frontend/supabase/schema.sql` and `frontend/supabase/migrations/`), so access control is enforced both in the API route handlers and at the database layer.

## Prerequisites

- Node.js 18+
- A Supabase project (cloud or local via the Supabase CLI)

## Setup

### 1. Supabase project

Create a project at [supabase.com](https://supabase.com), then apply the schema:

```bash
# Using the Supabase CLI, from frontend/
npx supabase db push
```

or run `frontend/supabase/schema.sql` followed by the files in `frontend/supabase/migrations/` (in numeric order) via the SQL editor in the Supabase dashboard.

### 2. Environment variables

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, never exposed to the client

# Required in production — these endpoints fail closed without them
CRON_SECRET=generate-a-random-secret
TELEGRAM_WEBHOOK_SECRET=generate-a-random-secret
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### 3. Frontend (web) setup

```bash
cd frontend
npm install
npm run dev
```

Runs on http://localhost:3000

### 4. Mobile setup

```bash
cd mobile
npm install
npm run start
```

Update the Supabase URL/anon key in `mobile/lib/supabase.ts` (or migrate to `EXPO_PUBLIC_*` env vars) to point at the same Supabase project as the frontend.

## User Roles

| Role | Access |
|------|--------|
| ADMIN | Full access to all clients, users, payments, and settings |
| SALES_MANAGER | Creates clients, sees only clients they sold |
| LEAD_DESIGNER | Views all clients, manages designer assignments |
| TARGETOLOGIST | Sees only clients assigned to them |
| DESIGNER | Sees only clients assigned to them for creative work |

## Project Structure

```
crm-system/
├── frontend/
│   ├── app/
│   │   ├── api/                # Route handlers — the application's backend
│   │   ├── clients/            # Client list & detail pages
│   │   ├── dashboard/          # KPI / analytics dashboards
│   │   └── tasks/              # Task management
│   ├── components/             # Shared UI components
│   ├── lib/
│   │   ├── supabase/           # Browser, server, and admin Supabase clients
│   │   └── utils/              # Case transforms, filter escaping, etc.
│   └── supabase/
│       ├── schema.sql          # Base schema, enums, RLS policies
│       └── migrations/         # Incremental migrations, applied in order
├── mobile/                     # Expo app (shares the same Supabase backend)
└── README.md
```

## Security Notes

- Row Level Security is enabled on every table; API routes additionally enforce role checks before querying.
- `CRON_SECRET` and `TELEGRAM_WEBHOOK_SECRET` are required in production — the cron and Telegram webhook routes reject requests if these are unset rather than allowing them through.
- The Supabase **service role key** (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS and is only used server-side in a small number of privileged routes (password resets, Telegram account linking, file attachments). Never expose it to the client.
