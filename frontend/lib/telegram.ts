const CRM_URL = 'https://crm.resultingagency.kz';

export async function sendTelegramNotification(
  chatId: number | bigint,
  text: string,
  path?: string,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
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

export async function sendTelegramMessage(chatId: number | bigint, text: string) {
  await sendTelegramNotification(chatId, text);
}
