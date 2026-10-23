const CRM_URL = 'https://crm.resultingagency.kz';

// Two bots: CRM notifications go out through @resulting_notificationbot, the
// creative-ordering dialog runs in @resultingagency_bot. Both chats share a
// user's chat_id (a private chat id is the user's Telegram id), so one
// telegram_chat_id link works for both.
export type TelegramBot = 'notifications' | 'creative';

function botToken(bot: TelegramBot): string | undefined {
  if (bot === 'creative') {
    return process.env.TELEGRAM_CREATIVE_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  }
  return process.env.TELEGRAM_BOT_TOKEN;
}

export async function sendTelegramNotification(
  chatId: number | bigint,
  text: string,
  path?: string,
) {
  const token = botToken('notifications');
  if (!token || !chatId) return;
  try {
    const body: Record<string, unknown> = {
      chat_id: Number(chatId),
      text,
      parse_mode: 'HTML',
    };
    if (path) {
      body.reply_markup = {
        inline_keyboard: [[{ text: '🔗 Открыть в CRM', url: `${CRM_URL}${path}` }]],
      };
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    // Не блокируем основной поток при ошибке Telegram
  }
}

export async function sendTelegramMessage(
  chatId: number | bigint,
  text: string,
  bot: TelegramBot = 'creative',
) {
  await callTelegramApi('sendMessage', { chat_id: Number(chatId), text, parse_mode: 'HTML' }, bot);
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

// Telegram webhooks must always resolve (Telegram retries on failure), so
// every helper below swallows errors and reports failure via a null/falsy
// return rather than throwing — callers decide whether that's fatal.
async function callTelegramApi(
  method: string,
  payload: Record<string, unknown>,
  bot: TelegramBot = 'creative',
): Promise<Record<string, unknown> | null> {
  const token = botToken(bot);
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.ok ? (data.result as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Sends a message with an arbitrary inline keyboard (rows of buttons), each
// either a callback button (routed back through the webhook) or a plain URL
// button. Returns the sent message's id so it can later be edited.
export async function sendTelegramKeyboard(
  chatId: number | bigint,
  text: string,
  keyboard: InlineButton[][],
): Promise<number | null> {
  const result = await callTelegramApi('sendMessage', {
    chat_id: Number(chatId),
    text,
    parse_mode: 'HTML',
    reply_markup: { inline_keyboard: keyboard },
  });
  return (result?.message_id as number) ?? null;
}

// Acknowledges a callback_query — Telegram shows a loading spinner on the
// tapped button until this is called.
export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  await callTelegramApi('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

// Replaces (or clears, with an empty array) the buttons on an already-sent
// message — used to take the "Принять" button away once a designer accepts.
export async function editMessageReplyMarkup(
  chatId: number | bigint,
  messageId: number,
  keyboard: InlineButton[][],
) {
  await callTelegramApi('editMessageReplyMarkup', {
    chat_id: Number(chatId),
    message_id: messageId,
    reply_markup: { inline_keyboard: keyboard },
  });
}

// Relays a message (text/photo/video/document) into another chat without
// re-uploading the file — how briefs and finished creatives move between
// targetologist and designer.
export async function forwardMessage(
  toChatId: number | bigint,
  fromChatId: number | bigint,
  messageId: number,
) {
  await callTelegramApi('forwardMessage', {
    chat_id: Number(toChatId),
    from_chat_id: Number(fromChatId),
    message_id: messageId,
  });
}

// Sets (or replaces) the persistent reply keyboard shown below the chat
// input — unlike an inline keyboard, this isn't attached to one message:
// it stays until a later message sets a different one or removes it.
// `rows` is plain button labels; the bot matches them as ordinary text.
export async function sendTelegramReplyKeyboard(
  chatId: number | bigint,
  text: string,
  rows: string[][],
) {
  await callTelegramApi('sendMessage', {
    chat_id: Number(chatId),
    text,
    parse_mode: 'HTML',
    reply_markup: {
      keyboard: rows.map((row) => row.map((label) => ({ text: label }))),
      resize_keyboard: true,
    },
  });
}

// Removes the persistent reply keyboard (used once a flow that doesn't have
// its own idle keyboard — e.g. a designer's delivery flow — finishes).
export async function clearTelegramReplyKeyboard(chatId: number | bigint, text: string) {
  await callTelegramApi('sendMessage', {
    chat_id: Number(chatId),
    text,
    parse_mode: 'HTML',
    reply_markup: { remove_keyboard: true },
  });
}
