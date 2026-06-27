"""
Webhook для Telegram бота.
Обрабатывает команды от пользователей, в первую очередь /start invite_XXX.
"""

import json
import os
import urllib.request
import urllib.error
from fastapi import APIRouter, Request
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")

router = APIRouter(prefix="/bot", tags=["Bot"])


def _send_telegram_message(chat_id: int, text: str, reply_markup: dict | None = None) -> bool:
    if not BOT_TOKEN:
        print("⚠️ BOT_TOKEN не задан")
        return False
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        return True
    except urllib.error.URLError as e:
        print(f"❌ Ошибка отправки сообщения: {e}")
        return False


def _handle_start_command(chat_id: int, text: str, base_url: str):
    """
    Обработать /start [параметр].
    Если параметр — invite_XXX, отправляем кнопку для открытия Mini App.
    """
    parts = text.strip().split(maxsplit=1)
    param = parts[1] if len(parts) > 1 else ""

    if param.startswith("invite_"):
        token = param.replace("invite_", "")
        invite_url = f"{base_url}?invite={token}"

        _send_telegram_message(
            chat_id=chat_id,
            text=(
                "🎉 <b>Вы получили приглашение стать мастером!</b>\n\n"
                "Нажмите кнопку ниже, чтобы зарегистрироваться.\n"
                "Ваши данные (имя, фото) подтянутся из Telegram автоматически."
            ),
            reply_markup={
                "inline_keyboard": [[
                    {
                        "text": "🚀 Стать мастером",
                        "web_app": {"url": invite_url},
                    }
                ]]
            },
        )
        print(f"✅ Отправлена кнопка web_app для invite {token} (chat_id={chat_id})")
        return True

    # Если просто /start без параметра — приветствие
    _send_telegram_message(
        chat_id=chat_id,
        text=(
            "👋 <b>Добро пожаловать в Барбершоп!</b>\n\n"
            "Записаться на стрижку можно в нашем Mini App:"
        ),
        reply_markup={
            "inline_keyboard": [[
                {
                    "text": "💈 Открыть приложение",
                    "web_app": {"url": base_url},
                }
            ]]
        },
    )
    return True


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """
    Принимает обновления от Telegram Bot API.
    """
    if not BOT_TOKEN:
        return {"ok": False, "error": "BOT_TOKEN не задан"}

    try:
        body = await request.json()
    except Exception:
        return {"ok": False, "error": "Invalid JSON"}

    update_id = body.get("update_id")
    message = body.get("message", {})

    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")

    if not chat_id or not text:
        # Игнорируем другие типы обновлений
        return {"ok": True}

    # BASE_URL должен быть установлен через ENV при деплое (см. deploy.sh)
    base_url = str(os.getenv("BASE_URL", ""))
    if not base_url:
        # Fallback: читаем из заголовков (если proxy передаёт)
        forwarded = request.headers.get("X-Forwarded-Host", "")
        if forwarded:
            base_url = f"https://{forwarded.split(',')[0].strip()}"
        else:
            base_url = str(request.base_url).rstrip("/")

    if text.startswith("/start"):
        _handle_start_command(chat_id, text, base_url)

    return {"ok": True}


def register_webhook(webhook_url: str) -> bool:
    """
    Зарегистрировать webhook URL для бота.
    Вызывается при запуске (после того как туннель запущен).
    """
    if not BOT_TOKEN:
        print("⚠️ BOT_TOKEN не задан — webhook не зарегистрирован")
        return False

    hook_url = webhook_url.rstrip("/") + "/api/bot/webhook"
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook"
    payload = json.dumps({
        "url": hook_url,
        "allowed_updates": ["message"],
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            if data.get("ok"):
                print(f"✅ Webhook зарегистрирован: {hook_url}")
                return True
            else:
                print(f"⚠️ Ошибка регистрации webhook: {data}")
                return False
    except Exception as e:
        print(f"⚠️ Ошибка регистрации webhook: {e}")
        return False


def delete_webhook() -> bool:
    """Удалить webhook (при остановке)."""
    if not BOT_TOKEN:
        return False
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/deleteWebhook"
    try:
        urllib.request.urlopen(url, timeout=5)
        print("✅ Webhook удалён")
        return True
    except Exception as e:
        print(f"⚠️ Ошибка удаления webhook: {e}")
        return False
