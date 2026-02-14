-- =============================================================
-- CRM Supabase Schema
-- =============================================================

-- Enums
create type user_role as enum ('ADMIN', 'SPECIALIST', 'SALES_MANAGER', 'DESIGNER', 'LEAD_DESIGNER');
create type client_status as enum ('NEW', 'ASSIGNED', 'IN_WORK', 'DONE', 'REJECTED');
create type task_status as enum ('NEW', 'IN_PROGRESS', 'DONE');

-- =============================================================
-- Profiles (linked to auth.users)
-- =============================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role user_role,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    null
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Clients
-- =============================================================
create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  company_name text,
  phone text not null,
  group_name text,
  services text[] default '{}',
  notes text,
  payment_amount numeric(12,2),
  status client_status default 'NEW' not null,
  archived boolean default false not null,

  created_by_id uuid not null references profiles(id),
  assigned_to_id uuid references profiles(id),
  assigned_at timestamptz,
  assignment_seen boolean default false not null,

  sold_by_id uuid references profiles(id),
  designer_id uuid references profiles(id),
  designer_assigned_at timestamptz,
  designer_assignment_seen boolean default false not null,

  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =============================================================
-- Assignment History
-- =============================================================
create table assignment_history (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text default 'SPECIALIST' not null,
  specialist_id uuid references profiles(id),
  designer_id uuid references profiles(id),
  assigned_by_id uuid not null references profiles(id),
  assigned_at timestamptz default now() not null
);

-- =============================================================
-- Comments
-- =============================================================
create table comments (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  client_id uuid not null references clients(id) on delete cascade,
  author_id uuid not null references profiles(id),
  created_at timestamptz default now() not null
);

-- =============================================================
-- Audit Logs
-- =============================================================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  details text,
  client_id uuid references clients(id) on delete set null,
  user_id uuid not null references profiles(id),
  created_at timestamptz default now() not null
);

-- =============================================================
-- Tasks
-- =============================================================
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  priority int default 50 not null,
  status task_status default 'NEW' not null,
  client_id uuid not null references clients(id) on delete cascade,
  creator_id uuid not null references profiles(id),
  assignee_id uuid references profiles(id),
  due_date timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- =============================================================
-- Payments
-- =============================================================
create table payments (
  id uuid primary key default gen_random_uuid(),
  amount int not null,
  month text not null,
  is_renewal boolean default false not null,
  client_id uuid not null references clients(id) on delete cascade,
  manager_id uuid not null references profiles(id),
  created_at timestamptz default now() not null
);

-- =============================================================
-- Indexes
-- =============================================================
create index idx_clients_created_by on clients(created_by_id);
create index idx_clients_assigned_to on clients(assigned_to_id);
create index idx_clients_sold_by on clients(sold_by_id);
create index idx_clients_designer on clients(designer_id);
create index idx_clients_status on clients(status);
create index idx_clients_archived on clients(archived);
create index idx_assignment_history_client on assignment_history(client_id);
create index idx_comments_client on comments(client_id);
create index idx_audit_logs_client on audit_logs(client_id);
create index idx_tasks_client on tasks(client_id);
create index idx_tasks_assignee on tasks(assignee_id);
create index idx_tasks_creator on tasks(creator_id);
create index idx_tasks_status on tasks(status);
create index idx_payments_client on payments(client_id);
create index idx_payments_month on payments(month);
create index idx_payments_renewal on payments(is_renewal);

-- =============================================================
-- Creatives
-- =============================================================
create table creatives (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  designer_id uuid not null references profiles(id),
  count integer not null check (count > 0),
  month text not null,
  created_at timestamptz default now() not null
);
create index idx_creatives_client on creatives(client_id);

-- =============================================================
-- Notifications
-- =============================================================
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,           -- e.g. 'TASK_ASSIGNED'
  title text not null,
  message text not null,
  link text,                    -- e.g. '/clients/xxx'
  is_read boolean default false not null,
  created_at timestamptz default now() not null
);

create index idx_notifications_user on notifications(user_id);
create index idx_notifications_user_unread on notifications(user_id) where is_read = false;
create index idx_notifications_created_at on notifications(created_at desc);

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

-- =============================================================
-- Updated_at triggers
-- =============================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles
  for each row execute function update_updated_at();

create trigger set_updated_at before update on clients
  for each row execute function update_updated_at();

create trigger set_updated_at before update on tasks
  for each row execute function update_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table clients enable row level security;
alter table assignment_history enable row level security;
alter table comments enable row level security;
alter table audit_logs enable row level security;
alter table tasks enable row level security;
alter table payments enable row level security;
alter table creatives enable row level security;

-- Profiles: everyone can read, users update their own, admin updates any
create policy "profiles_select" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update
  using (auth.uid() = id);
create policy "profiles_update_admin" on profiles for update
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );

-- Clients: access based on role
create policy "clients_select" on clients for select using (
  exists (
    select 1 from profiles p where p.id = auth.uid()
    and (
      p.role in ('ADMIN', 'SALES_MANAGER', 'LEAD_DESIGNER')
      or (p.role = 'SPECIALIST' and clients.assigned_to_id = auth.uid())
      or (p.role = 'DESIGNER' and clients.designer_id = auth.uid())
    )
  )
);
create policy "clients_insert" on clients for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('SALES_MANAGER', 'ADMIN'))
  );
create policy "clients_update" on clients for update using (true);

-- Assignment history: read for authenticated
create policy "assignment_history_select" on assignment_history for select using (true);
create policy "assignment_history_insert" on assignment_history for insert with check (true);

-- Comments: read all, create own
create policy "comments_select" on comments for select using (true);
create policy "comments_insert" on comments for insert
  with check (auth.uid() = author_id);

-- Audit logs: read all, insert via service
create policy "audit_logs_select" on audit_logs for select using (true);
create policy "audit_logs_insert" on audit_logs for insert with check (true);

-- Tasks: read all, create/update, delete admin only
create policy "tasks_select" on tasks for select using (true);
create policy "tasks_insert" on tasks for insert with check (true);
create policy "tasks_update" on tasks for update using (true);
create policy "tasks_delete" on tasks for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);

-- Payments: admin and sales_manager
create policy "payments_select" on payments for select using (
  exists (
    select 1 from profiles where id = auth.uid()
    and role in ('ADMIN', 'SALES_MANAGER', 'SPECIALIST')
  )
);
create policy "payments_insert" on payments for insert with check (
  exists (
    select 1 from profiles where id = auth.uid()
    and role in ('ADMIN', 'SALES_MANAGER')
  )
);

-- Creatives: read for admin/designer/lead_designer, insert for designer/lead_designer
create policy "creatives_select" on creatives for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'DESIGNER', 'LEAD_DESIGNER'))
);
create policy "creatives_insert" on creatives for insert with check (
  exists (select 1 from profiles where id = auth.uid() and role in ('DESIGNER', 'LEAD_DESIGNER'))
);

-- Notifications: read/update own, insert for all authenticated
alter table notifications enable row level security;
create policy "notifications_select_own" on notifications for select
  using (auth.uid() = user_id);
create policy "notifications_update_own" on notifications for update
  using (auth.uid() = user_id);
create policy "notifications_insert" on notifications for insert
  with check (true);

-- Publications: read all, insert/delete admin only
alter table publications enable row level security;
create policy "publications_select" on publications for select using (true);
create policy "publications_insert_admin" on publications for insert
  with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );
create policy "publications_delete_admin" on publications for delete
  using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );
