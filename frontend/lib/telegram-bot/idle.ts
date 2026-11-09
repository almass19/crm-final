import { sendTelegramReplyKeyboard, clearTelegramReplyKeyboard } from '@/lib/telegram';
import { idleKeyboardFor } from './keyboards';

// Ends a flow: shows the role's idle keyboard, or removes the keyboard for
// roles that have none.
export async function sendIdle(chatId: number, text: string, role: string | null): Promise<void> {
  const keyboard = idleKeyboardFor(role);
  if (keyboard) {
    await sendTelegramReplyKeyboard(chatId, text, keyboard);
  } else {
    await clearTelegramReplyKeyboard(chatId, text);
  }
}
