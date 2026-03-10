import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const { error } = await adminClient.auth.admin.deleteUser(id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('DELETE /api/users/[id] error:', e);
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
