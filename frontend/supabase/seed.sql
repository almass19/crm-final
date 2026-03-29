-- =============================================================
-- CRM Seed Data
-- =============================================================
-- NOTE: Auth users must be created first via Supabase Admin API
-- or the Supabase Dashboard. After creating auth users, their
-- profiles will be auto-created by the on_auth_user_created trigger.
--
-- Then run the role updates and test data below.
--
-- Test accounts to create in Supabase Auth (password: password123):
--   admin@crm.local     → Иванов Петр Сергеевич
--   sales@crm.local     → Сидорова Анна Михайловна
--   spec1@crm.local     → Козлов Дмитрий Андреевич
--   spec2@crm.local     → Морозова Елена Викторовна
--   designer1@crm.local → Петрова Мария Алексеевна
-- =============================================================

-- After creating auth users, update their roles in profiles:
update profiles set role = 'ADMIN' where email = 'admin@crm.local';
update profiles set role = 'SALES_MANAGER' where email = 'sales@crm.local';
update profiles set role = 'TARGETOLOGIST' where email = 'spec1@crm.local';
update profiles set role = 'TARGETOLOGIST' where email = 'spec2@crm.local';
update profiles set role = 'DESIGNER' where email = 'designer1@crm.local';

-- =============================================================
-- Test Clients
-- =============================================================

-- We need the actual UUIDs from profiles, so use subqueries
do $$
declare
  v_sales_id uuid;
  v_spec1_id uuid;
  v_spec2_id uuid;
  v_client1_id uuid;
  v_client2_id uuid;
  v_client3_id uuid;
  v_current_month text;
  v_prev_month text;
begin
  select id into v_sales_id from profiles where email = 'sales@crm.local';
  select id into v_spec1_id from profiles where email = 'spec1@crm.local';
  select id into v_spec2_id from profiles where email = 'spec2@crm.local';

  -- Calculate current and previous month
  v_current_month := to_char(now(), 'YYYY-MM');
  v_prev_month := to_char(now() - interval '1 month', 'YYYY-MM');

  -- Client 1
  insert into clients (
    full_name, company_name, phone, group_name, services,
    status, created_by_id, assigned_to_id, assigned_at, assignment_seen
  ) values (
    'Смирнов Алексей Иванович', 'ООО Ромашка', '+7 (777) 123-45-67',
    'Группа А', '{"Таргетированная реклама","СММ"}',
    'IN_WORK', v_sales_id, v_spec1_id, '2026-01-15'::timestamptz, true
  ) returning id into v_client1_id;

  -- Client 2
  insert into clients (
    full_name, company_name, phone, group_name, services,
    status, created_by_id, assigned_to_id, assigned_at, assignment_seen
  ) values (
    'Кузнецова Мария Петровна', 'ИП Кузнецова', '+7 (777) 234-56-78',
    'Группа Б', '{"Сайт","Контекстная реклама"}',
    'IN_WORK', v_sales_id, v_spec1_id, '2026-01-10'::timestamptz, true
  ) returning id into v_client2_id;

  -- Client 3
  insert into clients (
    full_name, company_name, phone, group_name, services,
    status, created_by_id, assigned_to_id, assigned_at, assignment_seen
  ) values (
    'Попов Николай Сергеевич', 'ТОО Прогресс', '+7 (777) 345-67-89',
    'Группа А', '{"Таргетированная реклама"}',
    'IN_WORK', v_sales_id, v_spec2_id, '2026-01-20'::timestamptz, true
  ) returning id into v_client3_id;

  -- Payments
  -- Client 1: first payment + renewal
  insert into payments (amount, month, is_renewal, client_id, manager_id)
  values (150000, v_prev_month, false, v_client1_id, v_sales_id);

  insert into payments (amount, month, is_renewal, client_id, manager_id)
  values (150000, v_current_month, true, v_client1_id, v_sales_id);

  -- Client 2: first payment + renewal
  insert into payments (amount, month, is_renewal, client_id, manager_id)
  values (200000, v_prev_month, false, v_client2_id, v_sales_id);

  insert into payments (amount, month, is_renewal, client_id, manager_id)
  values (200000, v_current_month, true, v_client2_id, v_sales_id);

  -- Client 3: first payment only
  insert into payments (amount, month, is_renewal, client_id, manager_id)
  values (100000, v_current_month, false, v_client3_id, v_sales_id);

  raise notice 'Seed data created successfully!';
  raise notice 'Clients: %, %, %', v_client1_id, v_client2_id, v_client3_id;
end $$;
