import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

// Every column across the schema that references profiles(id) without
// ON DELETE CASCADE/SET NULL. Deleting a profile with any of these still
// pointing at it fails with a foreign-key violation, so before deleting we
// reassign that history/ownership to the admin performing the deletion.
const OWNERSHIP_COLUMNS: { table: string; column: string }[] = [
  { table: 'clients', column: 'created_by_id' },
  { table: 'clients', column: 'assigned_to_id' },
  { table: 'clients', column: 'sold_by_id' },
  { table: 'clients', column: 'designer_id' },
  { table: 'assignment_history', column: 'specialist_id' },
  { table: 'assignment_history', column: 'designer_id' },
  { table: 'assignment_history', column: 'assigned_by_id' },
  { table: 'comments', column: 'author_id' },
  { table: 'audit_logs', column: 'user_id' },
  { table: 'tasks', column: 'creator_id' },
  { table: 'tasks', column: 'assignee_id' },
  { table: 'payments', column: 'manager_id' },
  { table: 'creatives', column: 'designer_id' },
  { table: 'publications', column: 'author_id' },
  { table: 'client_attachments', column: 'uploaded_by_id' },
];

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireRoles('ADMIN');
    const { id } = await params;

    if (id === currentUser.id) {
      return NextResponse.json({ message: 'Нельзя удалить собственный аккаунт' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    for (const { table, column } of OWNERSHIP_COLUMNS) {
      const { error: reassignError } = await adminClient
        .from(table)
        .update({ [column]: currentUser.id })
        .eq(column, id);
      if (reassignError) throw reassignError;
    }

    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('DELETE /api/users/[id] error:', e);
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
