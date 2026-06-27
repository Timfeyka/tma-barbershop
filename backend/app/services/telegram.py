import json
import os
import urllib.request
import urllib.error
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN", "")


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
    if not BOT_TOKEN:
        print("⚠️ BOT_TOKEN не задан, уведомление не отправлено")
        return False

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

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        urllib.request.urlopen(req, timeout=10)
        print(f"✅ Уведомление отправлено мастеру (chat_id={chat_id})")
        return True
    except urllib.error.URLError as e:
        print(f"❌ Ошибка отправки уведомления: {e}")
        return False
