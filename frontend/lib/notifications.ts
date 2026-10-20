import { SupabaseClient } from '@supabase/supabase-js';
import { sendTelegramNotification } from './telegram';

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый', ASSIGNED: 'Назначен', ONBOARDING: 'Брифинг',
  SETUP: 'Настройка', IN_WORK: 'Ведение', PAUSED: 'На паузе',
  RENEWAL: 'В процессе продления', DONE: 'Завершён', REFUND: 'Возврат',
};

async function getTelegramChatId(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', userId)
    .single();
  return data?.telegram_chat_id ?? null;
}

async function notifyUser(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  message: string,
  link: string,
  tgText: string,
) {
  await supabase.from('notifications').insert({ user_id: userId, type, title, message, link });
  const chatId = await getTelegramChatId(supabase, userId);
  if (chatId) await sendTelegramNotification(chatId, tgText, link);
}

// ─── Task assigned ────────────────────────────────────────────────────────────

interface TaskAssignedParams {
  assigneeId: string;
  taskTitle: string;
  clientId: string;
  clientName: string;
  assignerName: string;
}

export async function createTaskAssignedNotification(
  supabase: SupabaseClient,
  { assigneeId, taskTitle, clientId, clientName, assignerName }: TaskAssignedParams,
) {
  const title = 'Новая задача';
  const message = `${assignerName} назначил вам задачу: ${taskTitle} (${clientName})`;
  const tgText = `<b>📋 Новая задача</b>\n${assignerName} назначил вам задачу: <b>${taskTitle}</b>\nКлиент: <b>${clientName}</b>`;
  await notifyUser(supabase, assigneeId, 'TASK_ASSIGNED', title, message, `/clients/${clientId}`, tgText);
}

// ─── Client assigned ──────────────────────────────────────────────────────────

interface ClientAssignedParams {
  assigneeId: string;
  clientId: string;
  clientName: string;
  assignerName: string;
  role: 'specialist' | 'designer';
}

export async function createClientAssignedNotification(
  supabase: SupabaseClient,
  { assigneeId, clientId, clientName, assignerName, role }: ClientAssignedParams,
) {
  const title = role === 'specialist' ? 'Назначен клиент' : 'Назначен клиент (дизайн)';
  const message = `${assignerName} назначил вам клиента: ${clientName}`;
  const emoji = role === 'specialist' ? '👤' : '🎨';
  const tgText = `<b>${emoji} ${title}</b>\n${assignerName} назначил вам клиента: <b>${clientName}</b>`;
  const type = role === 'specialist' ? 'CLIENT_ASSIGNED' : 'CLIENT_DESIGNER_ASSIGNED';
  await notifyUser(supabase, assigneeId, type, title, message, `/clients/${clientId}`, tgText);
}

// ─── Client status changed ────────────────────────────────────────────────────

interface ClientStatusChangedParams {
  specialistId: string;
  clientId: string;
  clientName: string;
  newStatus: string;
}

export async function createClientStatusChangedNotification(
  supabase: SupabaseClient,
  { specialistId, clientId, clientName, newStatus }: ClientStatusChangedParams,
) {
  const statusLabel = STATUS_LABELS[newStatus] || newStatus;
  const title = 'Статус клиента изменён';
  const message = `Клиент «${clientName}» → ${statusLabel}`;
  const tgText = `<b>📊 Статус клиента изменён</b>\nКлиент «<b>${clientName}</b>» → <b>${statusLabel}</b>`;
  await notifyUser(supabase, specialistId, 'CLIENT_STATUS_CHANGED', title, message, `/clients/${clientId}`, tgText);
}

// ─── New comment ──────────────────────────────────────────────────────────────

interface CommentNotificationParams {
  specialistId: string;
  clientId: string;
  clientName: string;
  commentText: string;
  authorName: string;
}

export async function createCommentNotification(
  supabase: SupabaseClient,
  { specialistId, clientId, clientName, commentText, authorName }: CommentNotificationParams,
) {
  const preview = commentText.length > 100 ? commentText.slice(0, 100) + '...' : commentText;
  const title = 'Новый комментарий';
  const message = `${authorName}: ${preview}`;
  const tgText = `<b>💬 Новый комментарий</b>\nКлиент «<b>${clientName}</b>»\n<i>${preview}</i>`;
  await notifyUser(supabase, specialistId, 'CLIENT_COMMENT', title, message, `/clients/${clientId}`, tgText);
}

// ─── Publication ──────────────────────────────────────────────────────────────

interface PublicationNotificationParams {
  authorId: string;
  title: string;
  content: string;
}

export async function createPublicationNotification(
  supabase: SupabaseClient,
  { authorId, title, content }: PublicationNotificationParams,
) {
  const preview = content.length > 200 ? content.slice(0, 200) + '...' : content;
  const notifTitle = 'Новая публикация';
  const notifMessage = `${title}: ${preview}`;
  const tgText = `<b>📢 Новость от руководства</b>\n<b>${title}</b>\n\n<i>${preview}</i>`;

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id')
    .neq('id', authorId);

  if (!profiles) return;

  await Promise.all(
    profiles.map(async (profile) => {
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'PUBLICATION',
        title: notifTitle,
        message: notifMessage,
        link: '/news',
      });
      if (profile.telegram_chat_id) {
        await sendTelegramNotification(profile.telegram_chat_id, tgText, '/news');
      }
    }),
  );
}

// ─── Task status changed ──────────────────────────────────────────────────────

interface TaskStatusChangedParams {
  creatorId: string;
  taskTitle: string;
  clientId: string;
}

export async function createTaskDoneNotification(
  supabase: SupabaseClient,
  { creatorId, taskTitle, clientId }: TaskStatusChangedParams,
) {
  const title = 'Задача выполнена';
  const message = `«${taskTitle}» отмечена как выполненная`;
  const tgText = `<b>✅ Задача выполнена</b>\n«<b>${taskTitle}</b>»`;
  await notifyUser(supabase, creatorId, 'TASK_STATUS_CHANGED', title, message, `/clients/${clientId}`, tgText);
}

// ─── Creative requests (Telegram bot) ─────────────────────────────────────────
//
// The Telegram bot itself already delivers the interactive part (buttons,
// forwarded files) directly — these just mirror each step into the regular
// notifications feed, same as every other CRM event, via the same
// notifyUser() used above.

const CREATIVE_TYPE_LABELS: Record<string, string> = {
  STATIC_TEMPLATE: 'Статика шаблон',
  STATIC_CUSTOM: 'Статика новая',
  VIDEO: 'Видео',
};

interface CreativeRequestedParams {
  designerId: string;
  clientId: string;
  clientName: string;
  type: string;
  requesterName: string;
}

export async function createCreativeRequestedNotification(
  supabase: SupabaseClient,
  { designerId, clientId, clientName, type, requesterName }: CreativeRequestedParams,
) {
  const typeLabel = CREATIVE_TYPE_LABELS[type] || type;
  const title = 'Новая заявка на креатив';
  const message = `${requesterName} запросил «${typeLabel}» для клиента «${clientName}»`;
  const tgText = `<b>🎨 Новая заявка на креатив</b>\n${requesterName} запросил <b>${typeLabel}</b>\nКлиент: <b>${clientName}</b>`;
  await notifyUser(supabase, designerId, 'CREATIVE_REQUESTED', title, message, `/clients/${clientId}`, tgText);
}

interface CreativeAcceptedParams {
  requestedById: string;
  clientId: string;
  clientName: string;
  type: string;
  designerName: string;
}

export async function createCreativeAcceptedNotification(
  supabase: SupabaseClient,
  { requestedById, clientId, clientName, type, designerName }: CreativeAcceptedParams,
) {
  const typeLabel = CREATIVE_TYPE_LABELS[type] || type;
  const title = 'Заявка на креатив принята';
  const message = `${designerName} взял в работу «${typeLabel}» для клиента «${clientName}»`;
  const tgText = `<b>👍 Принято в работу</b>\n${designerName} взял <b>${typeLabel}</b>\nКлиент: <b>${clientName}</b>`;
  await notifyUser(supabase, requestedById, 'CREATIVE_ACCEPTED', title, message, `/clients/${clientId}`, tgText);
}

interface CreativeDeliveredParams {
  requestedById: string;
  clientId: string;
  clientName: string;
  type: string;
  designerName: string;
}

export async function createCreativeDeliveredNotification(
  supabase: SupabaseClient,
  { requestedById, clientId, clientName, type, designerName }: CreativeDeliveredParams,
) {
  const typeLabel = CREATIVE_TYPE_LABELS[type] || type;
  const title = 'Креатив готов';
  const message = `${designerName} сдал «${typeLabel}» для клиента «${clientName}»`;
  const tgText = `<b>✅ Креатив готов</b>\n${designerName} сдал <b>${typeLabel}</b>\nКлиент: <b>${clientName}</b>\nФайлы выше ⬆️ — не забудьте выложить в кейсы`;
  await notifyUser(supabase, requestedById, 'CREATIVE_DELIVERED', title, message, `/clients/${clientId}`, tgText);
}
