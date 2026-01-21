import axios from 'axios';

export async function sendTelegramHtml({ botToken, chatId, text, disablePreview }) {
  if (!botToken || !chatId) {
    throw new Error('Не заданы botToken или chatId для Telegram');
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await axios.post(
    url,
    {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: disablePreview ?? false,
    },
    { timeout: 15000 },
  );
}

