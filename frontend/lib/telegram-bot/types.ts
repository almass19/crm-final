// Minimal shapes for the subset of the Telegram Bot API this app uses —
// not a full typing of the API.

export interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: string;
  title?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  message_thread_id?: number;
  is_topic_message?: boolean;
  reply_to_message?: TelegramMessage;
  forum_topic_created?: { name: string };
  photo?: unknown[];
  video?: unknown;
  document?: unknown;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export function hasMedia(message: TelegramMessage): boolean {
  return Boolean(message.photo?.length || message.video || message.document);
}
