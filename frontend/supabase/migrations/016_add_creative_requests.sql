-- Telegram bot workflow for ordering creatives from designers.
--
-- Fixed creative types live in a CHECK constraint rather than a Postgres
-- enum — extending the list later is a one-line migration, no ALTER TYPE
-- ordering gotchas (see the client_status enum history).

-- Which designer is responsible for each creative type (exactly one per type).
create table creative_type_assignments (
  type text primary key check (type in ('STATIC_TEMPLATE','STATIC_CUSTOM','VIDEO')),
  designer_id uuid not null references profiles(id),
  updated_at timestamptz default now() not null
);

alter table creative_type_assignments enable row level security;

create policy "creative_type_assignments_select" on creative_type_assignments for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'LEAD_DESIGNER', 'DESIGNER', 'TARGETOLOGIST'))
);

create policy "creative_type_assignments_write" on creative_type_assignments for all using (
  exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'LEAD_DESIGNER'))
) with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'LEAD_DESIGNER'))
);

-- A single creative-request ticket: targetologist asks, one designer (per
-- type) is responsible, status tracks it through to delivery. Created before
-- client_creative_briefs below, since that table's RLS policy references it.
create table creative_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text not null check (type in ('STATIC_TEMPLATE','STATIC_CUSTOM','VIDEO')),
  requested_by_id uuid not null references profiles(id),
  designer_id uuid not null references profiles(id),
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','DELIVERED','CANCELLED')),
  accepted_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz default now() not null
);

create index idx_creative_requests_designer on creative_requests(designer_id);
create index idx_creative_requests_client on creative_requests(client_id);
create index idx_creative_requests_status on creative_requests(status);

alter table creative_requests enable row level security;

create policy "creative_requests_select" on creative_requests for select using (
  exists (
    select 1 from profiles p where p.id = auth.uid()
    and (
      p.role in ('ADMIN', 'LEAD_DESIGNER')
      or (p.role = 'TARGETOLOGIST' and creative_requests.requested_by_id = auth.uid())
      or (p.role = 'DESIGNER' and creative_requests.designer_id = auth.uid())
    )
  )
);

-- Writes happen server-side via the service role (bot webhook has no user
-- session), so the policies above are defense in depth, same as
-- client_attachments.

-- One creative brief per client, reused for every future request regardless
-- of type. Stores references to the Telegram messages themselves (chat_id +
-- message_ids) rather than re-hosting the files — forwardMessage can replay
-- them later, so there's no file-storage pipeline to build.
create table client_creative_briefs (
  client_id uuid primary key references clients(id) on delete cascade,
  from_chat_id bigint not null,
  message_ids int[] not null,
  submitted_by_id uuid not null references profiles(id),
  created_at timestamptz default now() not null
);

alter table client_creative_briefs enable row level security;

create policy "client_creative_briefs_select" on client_creative_briefs for select using (
  exists (
    select 1 from clients c
    join profiles p on p.id = auth.uid()
    where c.id = client_creative_briefs.client_id
    and (
      p.role in ('ADMIN', 'LEAD_DESIGNER')
      or (p.role = 'TARGETOLOGIST' and c.assigned_to_id = auth.uid())
      or (p.role = 'DESIGNER' and exists (
        select 1 from creative_requests cr where cr.client_id = c.id and cr.designer_id = auth.uid()
      ))
    )
  )
);

-- Ephemeral per-chat conversation state for the Telegram bot FSM — one row
-- per active chat, cleared on completion/cancel. No RLS needed: only ever
-- touched by the service-role webhook handler, never from the browser.
create table telegram_bot_state (
  chat_id bigint primary key,
  state text not null,
  context jsonb not null default '{}',
  updated_at timestamptz default now() not null
);

-- Tag each manually-or-bot-logged creative with the type that was actually
-- requested, so designer payroll can eventually be broken down the same way
-- targetologist renewal/new-client bonuses already are.
alter table creatives add column type text check (type in ('STATIC_TEMPLATE','STATIC_CUSTOM','VIDEO'));
