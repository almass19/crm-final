export async function sendTelegramMessage(chatId: number | bigint, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: Number(chatId), text, parse_mode: 'HTML' }),
    });
  } catch {
    // Не блокируем основной поток при ошибке Telegram
  }
}
