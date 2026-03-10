import { NextResponse } from 'next/server';
import { requireRoles } from '@/lib/supabase/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireRoles('ADMIN');
    const { id } = await params;

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(id, {
      password: 'password123',
    });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    console.error('POST /api/users/[id]/reset-password error:', e);
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
