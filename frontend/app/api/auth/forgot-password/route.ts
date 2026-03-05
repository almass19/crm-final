import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ message: 'Email обязателен' }, { status: 400 });
    }

    const origin = request.headers.get('origin') || '';
    const supabase = await createClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Письмо отправлено' });
  } catch {
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
