import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTelegramNotification } from '@/lib/telegram';
import { checkCronAuth } from '@/lib/cron-auth';
import { daysUntilBirthday, formatBirthdayDay, todayInAlmaty } from '@/lib/birthdays';

// Remind the team a few days ahead (time to collect for a gift) and again
// on the day. The birthday person isn't notified about their own birthday.
const REMIND_DAYS_BEFORE = 3;

interface Employee {
  id: string;
  full_name: string;
  birth_date: string | null;
  telegram_chat_id: number | null;
}

export async function GET(request: NextRequest) {
  const authError = checkCronAuth(request);
  if (authError) return authError;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, birth_date, telegram_chat_id')
    .not('role', 'is', null);

  if (error) {
    return NextResponse.json({ message: 'Ошибка запроса', error: error.message }, { status: 500 });
  }

  const employees = (data || []) as Employee[];
  const today = todayInAlmaty();
  let notified = 0;

  for (const person of employees) {
    if (!person.birth_date) continue;
    const days = daysUntilBirthday(person.birth_date, today);
    if (days !== 0 && days !== REMIND_DAYS_BEFORE) continue;

    const name = person.full_name.trim();
    const date = formatBirthdayDay(person.birth_date);
    const title = days === 0 ? '🎂 Сегодня день рождения' : '🎁 Скоро день рождения';
    const message = days === 0
      ? `Сегодня день рождения у ${name}. Не забудьте поздравить!`
      : `Через ${days} дня, ${date}, день рождения у ${name}.`;
    const tgText = days === 0
      ? `<b>${title}</b>\nСегодня день рождения у <b>${name}</b>. Не забудьте поздравить! 🎉`
      : `<b>${title}</b>\nЧерез ${days} дня, <b>${date}</b>, день рождения у <b>${name}</b>.`;

    for (const colleague of employees) {
      if (colleague.id === person.id) continue;
      await supabase.from('notifications').insert({
        user_id: colleague.id,
        type: 'BIRTHDAY',
        title,
        message,
        link: null,
      });
      if (colleague.telegram_chat_id) {
        await sendTelegramNotification(colleague.telegram_chat_id, tgText);
      }
    }
    notified++;
  }

  return NextResponse.json({ notified });
}
