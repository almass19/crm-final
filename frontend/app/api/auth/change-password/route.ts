import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const currentUser = await requireAuth();
    const { password } = await request.json();

    if (!password || password.length < 6) {
      return NextResponse.json(
        { message: 'Пароль должен содержать минимум 6 символов' },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient.auth.admin.updateUserById(currentUser.id, { password });
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
