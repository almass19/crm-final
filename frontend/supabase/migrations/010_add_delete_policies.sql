-- Allow admin to delete payments
create policy "payments_delete" on payments for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);

-- Allow admin to delete comments
create policy "comments_delete" on comments for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);

-- Allow admin to delete tasks
create policy "tasks_delete" on tasks for delete using (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);
