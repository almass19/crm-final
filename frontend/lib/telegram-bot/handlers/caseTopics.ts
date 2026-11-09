import type { SupabaseClient } from '@supabase/supabase-js';
import {
  answerCallbackQuery,
  copyMessages,
  createForumTopic,
  deleteTelegramMessage,
  editMessageReplyMarkup,
  sendTelegramKeyboard,
  sendTelegramMessage,
  sendTelegramTopicMessage,
  type InlineButton,
} from '@/lib/telegram';
import { setBotState, clearBotState, type BotStateRow } from '../state';
import { getProfileByChatId } from '../profile';
import type { TelegramMessage } from '../types';

const TOPIC_LIST_PAGE_SIZE = 8;
const TOPIC_NAME_MAX_LENGTH = 128;

interface CaseTopic {
  id: string;
  chat_id: number;
  thread_id: number;
  name: string;
}

// What the delivery flow hands over once the creative reached the
// targetologist: enough to copy the same messages into the portfolio group.
export interface CasePostContext {
  clientId: string;
  caption: string;
  fromChatId: number;
  messageIds: number[];
}

export function isTopicCommand(text: string | undefined): boolean {
  return Boolean(text && /^\/(topic|тема)(@\w+)?(\s|$)/i.test(text));
}

// `/topic` (or `/тема`) sent inside a topic of the portfolio group registers
// that topic. The name comes from the topic's creation service message
// Telegram attaches as reply_to_message; `/topic Название` overrides it.
// The command is deleted and the confirmation goes to the sender privately,
// so the portfolio stays clean.
export async function handleTopicRegistration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  message: TelegramMessage,
): Promise<void> {
  const senderId = message.from?.id;
  const threadId = message.is_topic_message ? message.message_thread_id : undefined;
  await deleteTelegramMessage(message.chat.id, message.message_id);
  if (!senderId) return;

  const profile = await getProfileByChatId(supabase, senderId);
  if (!profile) return;

  if (!threadId) {
    await sendTelegramMessage(senderId, 'Команду /topic нужно отправить внутри темы группы (не в General).');
    return;
  }

  const explicitName = message.text?.replace(/^\/\S+\s*/, '').trim();
  const name = (explicitName || message.reply_to_message?.forum_topic_created?.name || '').slice(0, TOPIC_NAME_MAX_LENGTH);
  if (!name) {
    await sendTelegramMessage(senderId, 'Не удалось определить название темы — отправьте /topic Название.');
    return;
  }

  const { error } = await supabase
    .from('case_topics')
    .upsert({ chat_id: message.chat.id, thread_id: threadId, name }, { onConflict: 'chat_id,thread_id' });

  await sendTelegramMessage(
    senderId,
    error ? '⚠️ Не удалось сохранить тему, попробуйте ещё раз.' : `✅ Тема «${name}» добавлена в портфолио.`,
  );
}

// Called at the end of a delivery. Asks the designer where in the portfolio
// to post — the client's last topic first, since that's almost always it —
// or does nothing when no portfolio topics are registered yet.
export async function askCaseTopic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  post: CasePostContext,
): Promise<boolean> {
  const { count } = await supabase.from('case_topics').select('id', { count: 'exact', head: true });
  if (!count) return false;

  await setBotState(supabase, chatId, 'AWAITING_CASE_TOPIC', { ...post });

  const { data: client } = await supabase
    .from('clients')
    .select('last_topic:case_topics!clients_last_case_topic_id_fkey(id, name)')
    .eq('id', post.clientId)
    .single();
  const lastTopic = (client as unknown as { last_topic: { id: string; name: string } | null } | null)?.last_topic;

  if (!lastTopic) {
    await sendTopicListPage(supabase, chatId, 0);
    return true;
  }

  await sendTelegramKeyboard(chatId, '📂 Выложить в портфолио?', [
    [{ text: `✅ В «${lastTopic.name}»`, callback_data: `case:${lastTopic.id}` }],
    [{ text: '📂 Другая тема', callback_data: 'case_list:0' }],
    [{ text: '🚫 Не выкладывать', callback_data: 'case_skip' }],
  ]);
  return true;
}

export async function sendTopicListPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  offset: number,
): Promise<void> {
  const { data: topics, count } = await supabase
    .from('case_topics')
    .select('id, name', { count: 'exact' })
    .order('name', { ascending: true })
    .range(offset, offset + TOPIC_LIST_PAGE_SIZE - 1);

  const buttons: InlineButton[][] = (topics || []).map((t: { id: string; name: string }) => [
    { text: t.name, callback_data: `case:${t.id}` },
  ]);

  const navRow: InlineButton[] = [];
  if (offset > 0) {
    navRow.push({ text: '◀️ Назад', callback_data: `case_list:${Math.max(0, offset - TOPIC_LIST_PAGE_SIZE)}` });
  }
  if (count != null && offset + TOPIC_LIST_PAGE_SIZE < count) {
    navRow.push({ text: 'Дальше ▶️', callback_data: `case_list:${offset + TOPIC_LIST_PAGE_SIZE}` });
  }
  if (navRow.length > 0) buttons.push(navRow);

  buttons.push([{ text: '➕ Новая тема', callback_data: 'case_new' }]);
  buttons.push([{ text: '🚫 Не выкладывать', callback_data: 'case_skip' }]);

  await sendTelegramKeyboard(chatId, '📂 В какую тему портфолио выложить?', buttons);
}

export async function handleCaseTopicPicked(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  messageId: number | undefined,
  callbackQueryId: string,
  stateRow: BotStateRow | null,
  topicId: string,
): Promise<void> {
  if (stateRow?.state !== 'AWAITING_CASE_TOPIC') {
    await answerCallbackQuery(callbackQueryId, 'Уже обработано');
    return;
  }

  const { data: topic } = await supabase
    .from('case_topics')
    .select('id, chat_id, thread_id, name')
    .eq('id', topicId)
    .single();

  if (!topic) {
    await answerCallbackQuery(callbackQueryId, 'Тема не найдена');
    return;
  }

  await answerCallbackQuery(callbackQueryId);
  if (messageId) await editMessageReplyMarkup(chatId, messageId, []);
  await publishToTopic(supabase, chatId, stateRow.context as unknown as CasePostContext, topic as CaseTopic);
}

export async function handleCaseSkip(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  messageId: number | undefined,
  callbackQueryId: string,
  stateRow: BotStateRow | null,
): Promise<void> {
  if (stateRow?.state !== 'AWAITING_CASE_TOPIC') {
    await answerCallbackQuery(callbackQueryId, 'Уже обработано');
    return;
  }
  await clearBotState(supabase, chatId);
  await answerCallbackQuery(callbackQueryId, 'Не выкладываем');
  if (messageId) await editMessageReplyMarkup(chatId, messageId, []);
}

export async function handleCaseNewStart(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  callbackQueryId: string,
  stateRow: BotStateRow | null,
): Promise<void> {
  if (stateRow?.state !== 'AWAITING_CASE_TOPIC') {
    await answerCallbackQuery(callbackQueryId, 'Уже обработано');
    return;
  }
  await setBotState(supabase, chatId, 'AWAITING_CASE_TOPIC_NAME', stateRow.context);
  await answerCallbackQuery(callbackQueryId);
  await sendTelegramMessage(chatId, 'Напишите название новой темы, например «Стоматология КРЕО».');
}

export async function handleCaseNewName(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  message: TelegramMessage,
  stateRow: BotStateRow,
): Promise<void> {
  const name = message.text?.trim().slice(0, TOPIC_NAME_MAX_LENGTH);
  if (!name) {
    await sendTelegramMessage(chatId, 'Напишите название темы текстом.');
    return;
  }

  // Every registered topic lives in the one portfolio group.
  const { data: anyTopic } = await supabase.from('case_topics').select('chat_id').limit(1).single();
  const groupChatId = anyTopic?.chat_id as number | undefined;
  const threadId = groupChatId ? await createForumTopic(groupChatId, name) : null;
  if (!groupChatId || !threadId) {
    await setBotState(supabase, chatId, 'AWAITING_CASE_TOPIC', stateRow.context);
    await sendTelegramMessage(chatId, '⚠️ Не удалось создать тему — у бота должно быть право «Управление темами». Выберите существующую.');
    await sendTopicListPage(supabase, chatId, 0);
    return;
  }

  const { data: topic } = await supabase
    .from('case_topics')
    .insert({ chat_id: groupChatId, thread_id: threadId, name })
    .select('id, chat_id, thread_id, name')
    .single();

  await publishToTopic(
    supabase,
    chatId,
    stateRow.context as unknown as CasePostContext,
    (topic as CaseTopic) ?? { id: '', chat_id: groupChatId, thread_id: threadId, name },
  );
}

async function publishToTopic(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  chatId: number,
  post: CasePostContext,
  topic: CaseTopic,
): Promise<void> {
  await clearBotState(supabase, chatId);

  const captionSent = await sendTelegramTopicMessage(topic.chat_id, topic.thread_id, post.caption);
  const copied = captionSent && (await copyMessages(topic.chat_id, post.fromChatId, post.messageIds, topic.thread_id));
  if (!copied) {
    await sendTelegramMessage(chatId, `⚠️ Не удалось выложить в «${topic.name}». Проверьте, что бот — админ группы.`);
    return;
  }

  if (topic.id) {
    await supabase.from('clients').update({ last_case_topic_id: topic.id }).eq('id', post.clientId);
  }
  await sendTelegramMessage(chatId, `📂 Выложено в «${topic.name}».`);
}
