import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramNotification } from '@/lib/telegram';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  }

  const supabase = await createClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, full_name, company_name, assigned_to_id, profiles!clients_assigned_to_id_fkey(telegram_chat_id)')
    .eq('status', 'IN_WORK')
    .lt('updated_at', sevenDaysAgo)
    .not('assigned_to_id', 'is', null);

  if (error) {
    return NextResponse.json({ message: 'Ошибка запроса', error: error.message }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  let notified = 0;

  for (const client of clients) {
    const profileData = client.profiles as unknown;
    const specialist = Array.isArray(profileData)
      ? (profileData[0] as { telegram_chat_id: number | null } | null)
      : (profileData as { telegram_chat_id: number | null } | null);
    if (!specialist || !client.assigned_to_id) continue;

    const clientName = client.company_name || client.full_name;
    const title = '⚠️ Зависший клиент';
    const message = `Клиент «${clientName}» не обновлялся более 7 дней. Проверьте статус.`;

    await supabase.from('notifications').insert({
      user_id: client.assigned_to_id,
      type: 'STALE_CLIENT',
      title,
      message,
      link: `/clients/${client.id}`,
    });

    if (specialist.telegram_chat_id) {
      const tgText = `<b>${title}</b>\nКлиент «<b>${clientName}</b>» не обновлялся более 7 дней. Проверьте статус.`;
      await sendTelegramNotification(specialist.telegram_chat_id, tgText, `/clients/${client.id}`);
    }

    notified++;
  }

  return NextResponse.json({ notified });
}
