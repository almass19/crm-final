-- Sales department (ОП) daily funnel, replacing the monthly Google Sheets
-- «<Месяц> Resulting ОП <год>». Sales count and payment sum are not stored
-- here: they come from clients (sold_by_id + purchase_date + payment_amount).

-- Monthly plan per sales manager, set by an admin. The other plan rows
-- (ЦА, calls, contracts…) are derived from leads_plan in code.
create table sales_plans (
  id uuid primary key default gen_random_uuid(),
  month text not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  manager_id uuid not null references profiles(id) on delete cascade,
  leads_plan int not null default 0 check (leads_plan >= 0),
  sales_plan int not null default 0 check (sales_plan >= 0),
  avg_check int not null default 80000 check (avg_check >= 0),
  ad_budget_plan int not null default 0 check (ad_budget_plan >= 0),
  updated_at timestamptz default now() not null,
  unique (month, manager_id)
);

-- One row per manager per day: what the manager typed in (ad_budget is
-- written by an admin only, enforced in the API route).
create table sales_funnel_days (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  leads int check (leads >= 0),
  qualified int check (qualified >= 0),
  rejected int check (rejected >= 0),
  calls_set int check (calls_set >= 0),
  calls_done int check (calls_done >= 0),
  requisites int check (requisites >= 0),
  contracts int check (contracts >= 0),
  ad_budget int check (ad_budget >= 0),
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz default now() not null,
  unique (manager_id, day)
);

create index idx_sales_funnel_days_day on sales_funnel_days(day);

create trigger sales_plans_updated_at before update on sales_plans
  for each row execute function update_updated_at();
create trigger sales_funnel_days_updated_at before update on sales_funnel_days
  for each row execute function update_updated_at();

alter table sales_plans enable row level security;
alter table sales_funnel_days enable row level security;

create policy "sales_plans_select" on sales_plans for select using (
  manager_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "sales_plans_write_admin" on sales_plans for all using (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
) with check (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);

create policy "sales_funnel_days_select" on sales_funnel_days for select using (
  manager_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "sales_funnel_days_write" on sales_funnel_days for all using (
  manager_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
) with check (
  manager_id = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);
