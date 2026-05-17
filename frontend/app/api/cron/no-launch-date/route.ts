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

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const { data: clients, error } = await supabase
    .from('clients')
    .select(`
      id, full_name, company_name, purchase_date, assigned_to_id,
      specialist:profiles!clients_assigned_to_id_fkey(telegram_chat_id)
    `)
    .is('launch_date', null)
    .lt('purchase_date', threeDaysAgo)
    .in('status', ['ASSIGNED', 'ONBOARDING', 'SETUP', 'IN_WORK'])
    .eq('archived', false);

  if (error) {
    return NextResponse.json({ message: 'Ошибка запроса', error: error.message }, { status: 500 });
  }

  if (!clients || clients.length === 0) {
    return NextResponse.json({ notified: 0 });
  }

  // Also get admins with telegram connected for cross-notification
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id')
    .eq('role', 'ADMIN')
    .not('telegram_chat_id', 'is', null);

  let notified = 0;

  for (const client of clients) {
    const clientName = client.company_name || client.full_name;
    const title = '⏰ Не указана дата запуска';
    const message = `Клиент «${clientName}» куплен 3+ дней назад, дата запуска не установлена.`;
    const tgText = `<b>${title}</b>\nКлиент «<b>${clientName}</b>» куплен 3+ дней назад, дата запуска не установлена.`;
    const link = `/clients/${client.id}`;

    // Notify specialist
    if (client.assigned_to_id) {
      await supabase.from('notifications').insert({
        user_id: client.assigned_to_id,
        type: 'NO_LAUNCH_DATE',
        title,
        message,
        link,
      });

      const specialistData = client.specialist as unknown;
      const specialist = Array.isArray(specialistData)
        ? (specialistData[0] as { telegram_chat_id: number | null } | null)
        : (specialistData as { telegram_chat_id: number | null } | null);

      if (specialist?.telegram_chat_id) {
        await sendTelegramNotification(specialist.telegram_chat_id, tgText, link);
      }
    }

    // Notify admins
    if (admins) {
      for (const admin of admins) {
        if (admin.id === client.assigned_to_id) continue;
        await supabase.from('notifications').insert({
          user_id: admin.id,
          type: 'NO_LAUNCH_DATE',
          title,
          message,
          link,
        });
        if (admin.telegram_chat_id) {
          await sendTelegramNotification(admin.telegram_chat_id, tgText, link);
        }
      }
    }

    notified++;
  }

  return NextResponse.json({ notified });
}
