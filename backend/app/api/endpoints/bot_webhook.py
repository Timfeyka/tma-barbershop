"""
Webhook для Telegram бота.
Обрабатывает команды от пользователей, в первую очередь /start invite_XXX.
"""

import json
import os
import urllib.request
import urllib.error
from fastapi import APIRouter, Request
from app.core.config import BOT_TOKEN

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

        sent = _send_telegram_message(
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
        if sent:
            print(f"✅ Отправлена кнопка web_app для invite {token} (chat_id={chat_id})")
        else:
            print(f"❌ Не удалось отправить кнопку invite {token} (chat_id={chat_id})")
        return sent

    # Если просто /start без параметра — приветствие
    sent = _send_telegram_message(
        chat_id=chat_id,
        text=(
            "👋 <b>Добро пожаловать в Барбершоп!</b>\n\n"
            "Записаться на стрижку можно в нашем Mini App."
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
    return sent


@router.post("/webhook")
async def telegram_webhook(request: Request):
    """
    Принимает обновления от Telegram Bot API.
    """
    if not BOT_TOKEN:
        return {"ok": False, "error": "BOT_TOKEN не задан. Проверьте .env файл"}

    try:
        body = await request.json()
    except Exception:
        return {"ok": False, "error": "Invalid JSON"}

    update_id = body.get("update_id")
    message = body.get("message", {})

    chat_id = message.get("chat", {}).get("id")
    text = message.get("text", "")

    if not chat_id or not text:
        return {"ok": True}

    # BASE_URL должен быть установлен через ENV при деплое (см. deploy.sh)
    base_url = str(os.getenv("BASE_URL", ""))
    if not base_url:
        forwarded = request.headers.get("X-Forwarded-Host", "")
        if forwarded:
            base_url = f"https://{forwarded.split(',')[0].strip()}"

    if not base_url:
        print(f"⚠️ Webhook: нет BASE_URL, не могу ответить на /start от chat_id={chat_id}")
        return {"ok": True, "warning": "BASE_URL is not set"}

    if text.startswith("/start"):
        _handle_start_command(chat_id, text, base_url)

    return {"ok": True}


@router.get("/webhook-status")
def webhook_status():
    """Проверить статус webhook и бота (GET, для диагностики)."""
    result = {
        "has_bot_token": bool(BOT_TOKEN),
        "has_token_length": len(BOT_TOKEN) if BOT_TOKEN else 0,
    }

    if not BOT_TOKEN:
        result["error"] = "BOT_TOKEN не задан в .env"
        return result

    # Проверяем getMe
    try:
        req = urllib.request.Request(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            result["bot"] = data.get("result", {}) if data.get("ok") else None
            result["bot_ok"] = data.get("ok", False)
    except Exception as e:
        result["bot_error"] = str(e)

    # Проверяем getWebhookInfo
    try:
        req = urllib.request.Request(f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            result["webhook"] = data.get("result", {}) if data.get("ok") else None
            result["webhook_ok"] = data.get("ok", False)
    except Exception as e:
        result["webhook_error"] = str(e)

    result["base_url_env"] = os.getenv("BASE_URL", "")

    return result


def register_webhook(webhook_url: str, max_retries: int = 5) -> bool:
    """
    Зарегистрировать webhook URL для бота.
    Делает несколько попыток — туннель может быть ещё не готов.
    """
    import time

    if not BOT_TOKEN:
        print("⚠️ BOT_TOKEN не задан — webhook не зарегистрирован")
        return False

    hook_url = webhook_url.rstrip("/") + "/api/bot/webhook"
    api_url = f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook"

    for attempt in range(max_retries):
        payload = json.dumps({
            "url": hook_url,
            "allowed_updates": ["message"],
        }).encode("utf-8")

        print(f"🔌 Регистрирую webhook ({attempt + 1}/{max_retries}): {hook_url}")
        req = urllib.request.Request(
            api_url, data=payload,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                if data.get("ok"):
                    print(f"✅ Webhook зарегистрирован: {hook_url}")
                    return True
                else:
                    desc = data.get("description", str(data))
                    print(f"⚠️ Webhook обновился: {desc}")
                    return True if "already" in desc.lower() else False
        except Exception as e:
            print(f"⚠️ Попытка {attempt + 1}/{max_retries}: {e}")
            if attempt < max_retries - 1:
                print("   ⏳ Жду 3 секунды...")
                time.sleep(3)

    print(f"❌ Webhook не зарегистрирован после {max_retries} попыток")
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
