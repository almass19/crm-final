import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/supabase/auth-helpers';

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST() {
  try {
    const user = await requireAuth();
    const supabase = await createClient();

    const code = generateCode();
    const botUsername = process.env.TELEGRAM_BOT_USERNAME;

    // Удалить старые коды пользователя
    await supabase
      .from('telegram_verifications')
      .delete()
      .eq('user_id', user.id);

    const { error } = await supabase.from('telegram_verifications').insert({
      user_id: user.id,
      code,
    });

    if (error) throw error;

    return NextResponse.json({
      url: `https://t.me/${botUsername}?start=${code}`,
      code,
    });
  } catch (e) {
    if (e instanceof NextResponse) return e;
    return NextResponse.json({ message: 'Ошибка сервера' }, { status: 500 });
  }
}
