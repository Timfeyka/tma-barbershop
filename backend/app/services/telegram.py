import json
import os
import urllib.request
import urllib.error
from datetime import datetime
from app.core.config import BOT_TOKEN


def _send_telegram_message(chat_id: int, text: str, parse_mode: str = "HTML") -> bool:
    if not BOT_TOKEN:
        print("⚠️ BOT_TOKEN не задан, сообщение не отправлено")
        return False
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
    }).encode("utf-8")
    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        return True
    except urllib.error.URLError as e:
        print(f"❌ Ошибка отправки сообщения: {e}")
        return False


def send_booking_notification(
    chat_id: int,
    client_name: str,
    client_username: str | None,
    master_name: str,
    service_title: str,
    service_price: float,
    booking_time: datetime,
) -> bool:
    """Отправить мастеру уведомление о новой записи через Telegram Bot API."""
    time_str = booking_time.strftime("%d.%m.%Y в %H:%M")
    username_str = f" (@{client_username})" if client_username else ""

    text = (
        f"✂️ <b>Новая запись!</b>\n\n"
        f"👤 <b>Клиент:</b> {client_name}{username_str}\n"
        f"💇 <b>Мастер:</b> {master_name}\n"
        f"📋 <b>Услуга:</b> {service_title}\n"
        f"💰 <b>Цена:</b> {service_price} ₽\n"
        f"📅 <b>Время:</b> {time_str}"
    )
    return _send_telegram_message(chat_id, text)


def send_client_confirmation(
    chat_id: int,
    client_name: str,
    master_name: str,
    service_title: str,
    service_price: float,
    booking_time: datetime,
) -> bool:
    """Отправить клиенту подтверждение записи."""
    time_str = booking_time.strftime("%d.%m.%Y в %H:%M")
    booking_url = os.getenv("BASE_URL", "")

    text = (
        f"✅ <b>Вы записаны!</b>\n\n"
        f"💇 <b>Мастер:</b> {master_name}\n"
        f"📋 <b>Услуга:</b> {service_title}\n"
        f"💰 <b>Цена:</b> {service_price} ₽\n"
        f"📅 <b>Время:</b> {time_str}\n\n"
    )
    if booking_url:
        text += f"<a href='{booking_url}'>📲 Открыть приложение</a>"
    else:
        text += "Не забудьте прийти вовремя!"

    return _send_telegram_message(chat_id, text)


def send_reminder(
    chat_id: int,
    client_name: str,
    master_name: str,
    service_title: str,
    booking_time: datetime,
    hours_before: int,
) -> bool:
    """Отправить напоминание клиенту."""
    time_str = booking_time.strftime("%d.%m.%Y в %H:%M")
    if hours_before > 12:
        prefix = "🔔 <b>Напоминание!</b>\n\nЗавтра"
    else:
        prefix = "🔔 <b>Напоминание!</b>\n\nЧерез час"

    text = (
        f"{prefix} у вас запись:\n\n"
        f"💇 <b>Мастер:</b> {master_name}\n"
        f"📋 <b>Услуга:</b> {service_title}\n"
        f"📅 <b>Время:</b> {time_str}\n\n"
        f"Пожалуйста, не опаздывайте!"
    )
    return _send_telegram_message(chat_id, text)
