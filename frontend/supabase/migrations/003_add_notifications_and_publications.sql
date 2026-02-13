-- =============================================================
-- Notifications
-- =============================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  link text,
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

create index idx_notifications_user on notifications(user_id);
create index idx_notifications_user_unread on notifications(user_id) where is_read = false;
create index idx_notifications_created_at on notifications(created_at desc);

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications for select
  using (auth.uid() = user_id);
create policy "notifications_update_own" on notifications for update
  using (auth.uid() = user_id);
create policy "notifications_insert" on notifications for insert
  with check (true);

-- =============================================================
-- Publications
-- =============================================================
create table publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  author_id uuid not null references profiles(id),
  created_at timestamptz default now() not null
);

create index idx_publications_created_at on publications(created_at desc);
create index idx_publications_author on publications(author_id);

alter table publications enable row level security;

create policy "publications_select" on publications for select
  using (true);
create policy "publications_insert_admin" on publications for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );
create policy "publications_delete_admin" on publications for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );
