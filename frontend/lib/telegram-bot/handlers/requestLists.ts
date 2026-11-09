import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramKeyboard, sendTelegramMessage, type InlineButton } from '@/lib/telegram';
import { CREATIVE_TYPE_LABELS } from '@/lib/constants';
import { escapeHtml, formatAlmatyTime, truncate } from '../format';
import type { BotProfile } from '../profile';

// Keeps one list message well under Telegram's 4096-character limit.
const MAX_ITEMS_PER_SECTION = 15;
const DESCRIPTION_PREVIEW_LENGTH = 120;
const DELIVERED_LOOKBACK_DAYS = 7;

interface RequestRow {
  id: string;
  type: string;
  status: 'PENDING' | 'ACCEPTED' | 'DELIVERED' | 'CANCELLED';
  description: string | null;
  created_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  client: { full_name: string | null; company_name: string | null } | null;
  designer?: { full_name: string } | null;
}

function clientNameOf(row: RequestRow): string {
  return row.client?.company_name || row.client?.full_name || '—';
}

function typeLabelOf(row: RequestRow): string {
  return CREATIVE_TYPE_LABELS[row.type] || row.type;
}

function section(title: string, lines: string[], total: number): string {
  const more = total > lines.length ? `\n…и ещё ${total - lines.length}` : '';
  return `<b>${title} (${total})</b>\n${lines.join('\n\n')}${more}`;
}

// "📋 Мои заявки" — everything the targetologist ordered that's still open,
// plus what was delivered recently, so parallel requests for several
// clients are all visible in one place.
export async function sendTargetologistRequests(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
): Promise<void> {
  const deliveredSince = new Date(Date.now() - DELIVERED_LOOKBACK_DAYS * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('creative_requests')
    .select(`
      id, type, status, description, created_at, accepted_at, delivered_at,
      client:clients(full_name, company_name),
      designer:profiles!creative_requests_designer_id_fkey(full_name)
    `)
    .eq('requested_by_id', profile.id)
    .or(`status.in.(PENDING,ACCEPTED),and(status.eq.DELIVERED,delivered_at.gte.${deliveredSince})`)
    .order('created_at', { ascending: true });

  if (error) {
    await sendTelegramMessage(chatId, '⚠️ Не удалось загрузить заявки, попробуйте ещё раз.');
    return;
  }

  const rows = (data || []) as unknown as RequestRow[];
  if (rows.length === 0) {
    await sendTelegramMessage(chatId, 'Активных заявок нет.');
    return;
  }

  const line = (r: RequestRow, timeLine: string) =>
    `• <b>${escapeHtml(clientNameOf(r))}</b> — ${typeLabelOf(r)}\n`
    + `   ${escapeHtml(r.designer?.full_name || '—')} · ${timeLine}`;

  const pending = rows.filter((r) => r.status === 'PENDING');
  const inWork = rows.filter((r) => r.status === 'ACCEPTED');
  const delivered = rows.filter((r) => r.status === 'DELIVERED').reverse();

  const sections: string[] = [];
  if (pending.length) {
    sections.push(section('⏳ Ждут дизайнера', pending.slice(0, MAX_ITEMS_PER_SECTION)
      .map((r) => line(r, `отправлена ${formatAlmatyTime(r.created_at)}`)), pending.length));
  }
  if (inWork.length) {
    sections.push(section('🛠 В работе', inWork.slice(0, MAX_ITEMS_PER_SECTION)
      .map((r) => line(r, `принята ${formatAlmatyTime(r.accepted_at || r.created_at)}`)), inWork.length));
  }
  if (delivered.length) {
    sections.push(section(`✅ Готово за ${DELIVERED_LOOKBACK_DAYS} дней`, delivered.slice(0, MAX_ITEMS_PER_SECTION)
      .map((r) => line(r, `сдана ${formatAlmatyTime(r.delivered_at || r.created_at)}`)), delivered.length));
  }

  await sendTelegramMessage(chatId, sections.join('\n\n'));
}

// "📋 Мои задачи" — the designer's open requests, oldest first within each
// group (new, then in work), each with when it came in and its description.
// Buttons accept or deliver a specific request straight from the list.
export async function sendDesignerTasks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  profile: BotProfile,
  chatId: number,
): Promise<void> {
  const { data, error } = await supabase
    .from('creative_requests')
    .select(`
      id, type, status, description, created_at, accepted_at, delivered_at,
      client:clients(full_name, company_name),
      requester:profiles!creative_requests_requested_by_id_fkey(full_name)
    `)
    .eq('designer_id', profile.id)
    .in('status', ['PENDING', 'ACCEPTED'])
    .order('created_at', { ascending: true });

  if (error) {
    await sendTelegramMessage(chatId, '⚠️ Не удалось загрузить задачи, попробуйте ещё раз.');
    return;
  }

  const rows = (data || []) as unknown as (RequestRow & { requester: { full_name: string } | null })[];
  if (rows.length === 0) {
    await sendTelegramMessage(chatId, 'Открытых задач нет 🎉');
    return;
  }

  const pending = rows.filter((r) => r.status === 'PENDING').slice(0, MAX_ITEMS_PER_SECTION);
  const inWork = rows.filter((r) => r.status === 'ACCEPTED').slice(0, MAX_ITEMS_PER_SECTION);
  const pendingTotal = rows.filter((r) => r.status === 'PENDING').length;
  const inWorkTotal = rows.filter((r) => r.status === 'ACCEPTED').length;

  // Numbered across both sections so a button "№3" maps to one line.
  let n = 0;
  const buttons: InlineButton[][] = [];
  const line = (r: (typeof rows)[number]) => {
    n += 1;
    const description = r.description
      ? `\n   📝 <i>${escapeHtml(truncate(r.description, DESCRIPTION_PREVIEW_LENGTH))}</i>`
      : '';
    return `<b>${n}. ${escapeHtml(clientNameOf(r))}</b> — ${typeLabelOf(r)}\n`
      + `   🕒 поступила ${formatAlmatyTime(r.created_at)} · от ${escapeHtml(r.requester?.full_name || '—')}`
      + description;
  };

  const sections: string[] = [];
  if (pending.length) {
    const lines = pending.map(line);
    pending.forEach((r, i) => buttons.push([{
      text: `✅ Принять №${n - pending.length + i + 1} · ${truncate(clientNameOf(r), 30)}`,
      callback_data: `accept:${r.id}`,
    }]));
    sections.push(section('🆕 Новые', lines, pendingTotal));
  }
  if (inWork.length) {
    const lines = inWork.map(line);
    inWork.forEach((r, i) => buttons.push([{
      text: `📎 Сдать №${n - inWork.length + i + 1} · ${truncate(clientNameOf(r), 30)}`,
      callback_data: `deliver_start:${r.id}`,
    }]));
    sections.push(section('🛠 В работе', lines, inWorkTotal));
  }

  await sendTelegramKeyboard(chatId, sections.join('\n\n'), buttons);
}
