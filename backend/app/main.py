import os
import json
import urllib.request
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from app.core.database import engine, SessionLocal, DATABASE_URL
from app.core.config import BOT_TOKEN
from app.models import models
from app.api.endpoints import masters, bookings, services, admin, bot_webhook

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="TMA Barbershop API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(masters.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(bot_webhook.router, prefix="/api")


def _run_migration(db, sql_sqlite, sql_pg, label):
    """Выполнить миграцию, игнорируя ошибки если колонка уже есть."""
    try:
        if DATABASE_URL.startswith("sqlite"):
            db.execute(text(sql_sqlite))
        else:
            db.execute(text(sql_pg))
        db.commit()
        print(f"✅ Миграция: {label}")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Миграция {label}: {e} (возможно уже есть)")


def _auto_setup_menu_button(base_url: str):
    """Автоматически настроить Menu Button бота на текущий URL."""
    if not BOT_TOKEN:
        print("⚠️ BOT_TOKEN не задан — Menu Button не настроен")
        return

    url = f"https://api.telegram.org/bot{BOT_TOKEN}/setChatMenuButton"
    payload = json.dumps({
        "menu_button": {
            "type": "web_app",
            "text": "💈 Барбершоп",
            "web_app": {"url": base_url},
        }
    }).encode("utf-8")

    req = urllib.request.Request(
        url, data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=10)
        print(f"✅ Menu Button настроен: {base_url}")
    except Exception as e:
        print(f"⚠️ Ошибка настройки Menu Button: {e}")


@app.on_event("startup")
def startup():
    """Миграции + начальные данные"""
    db = SessionLocal()

    # Миграция: добавляем колонку telegram_id, если её нет
    _run_migration(
        db,
        "ALTER TABLE masters ADD COLUMN telegram_id INTEGER",
        "ALTER TABLE masters ADD COLUMN IF NOT EXISTS telegram_id INTEGER",
        "telegram_id на masters",
    )

    # Миграция: tg_username на masters
    _run_migration(
        db,
        "ALTER TABLE masters ADD COLUMN tg_username VARCHAR",
        "ALTER TABLE masters ADD COLUMN IF NOT EXISTS tg_username VARCHAR",
        "tg_username на masters",
    )

    # Миграция: customer_tg_id на bookings
    _run_migration(
        db,
        "ALTER TABLE bookings ADD COLUMN customer_tg_id INTEGER",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS customer_tg_id INTEGER",
        "customer_tg_id на bookings",
    )

    # Миграция: notifcation флаги на bookings
    _run_migration(
        db,
        "ALTER TABLE bookings ADD COLUMN notified_day_before INTEGER DEFAULT 0",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notified_day_before BOOLEAN DEFAULT FALSE",
        "notified_day_before на bookings",
    )
    _run_migration(
        db,
        "ALTER TABLE bookings ADD COLUMN notified_hour_before INTEGER DEFAULT 0",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notified_hour_before BOOLEAN DEFAULT FALSE",
        "notified_hour_before на bookings",
    )
    _run_migration(
        db,
        "ALTER TABLE bookings ADD COLUMN is_cancelled INTEGER DEFAULT 0",
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN DEFAULT FALSE",
        "is_cancelled на bookings",
    )
    _run_migration(
        db,
        "ALTER TABLE master_schedules ADD COLUMN slot_interval_minutes INTEGER DEFAULT 60",
        "ALTER TABLE master_schedules ADD COLUMN IF NOT EXISTS slot_interval_minutes INTEGER DEFAULT 60",
        "slot_interval_minutes на master_schedules",
    )

    # Миграция: customer_phone nullable
    try:
        if not DATABASE_URL.startswith("sqlite"):
            db.execute(text("ALTER TABLE bookings ALTER COLUMN customer_phone DROP NOT NULL"))
        db.commit()
        print("✅ Миграция: customer_phone теперь опциональный")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Миграция customer_phone: {e}")

    # Авто-настройка Menu Button + webhook
    try:
        base_url = str(os.getenv("BASE_URL", ""))
        if base_url:
            _auto_setup_menu_button(base_url)
            bot_webhook.register_webhook(base_url)
    except Exception as e:
        print(f"⚠️ Ошибка авто-настройки Menu Button / webhook: {e}")

    # Сидирование данных
    if db.query(models.Master).count() == 0:
        masters_data = [
            models.Master(
                name="Алексей",
                role="Топ-барбер",
                photo_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop",
                bio="Мастер с 8-летним стажем. Специализация — мужские стрижки и борода.",
            ),
            models.Master(
                name="Дмитрий",
                role="Барбер",
                photo_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
                bio="Молодой специалист, но уже зарекомендовал себя лучшим.",
            ),
            models.Master(
                name="Максим",
                role="Барбер",
                photo_url="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
                bio="Королевские бороды и стильные стрижки — мой конёк.",
            ),
        ]
        db.add_all(masters_data)
        db.commit()

        services_data = [
            models.Service(title="Мужская стрижка", price=1500, duration_minutes=45, category="Стрижка"),
            models.Service(title="Стрижка машинкой", price=1000, duration_minutes=30, category="Стрижка"),
            models.Service(title="Оформление бороды", price=800, duration_minutes=30, category="Борода"),
            models.Service(title="Королевская бритьё", price=1200, duration_minutes=45, category="Борода"),
            models.Service(title="Детская стрижка", price=1000, duration_minutes=30, category="Стрижка"),
            models.Service(title="Стрижка + борода", price=2200, duration_minutes=75, category="Комплекс"),
            models.Service(title="Укладка", price=500, duration_minutes=20, category="Дополнительно"),
            models.Service(title="Стрижка усов", price=300, duration_minutes=15, category="Борода"),
        ]
        db.add_all(services_data)
        db.commit()
        print("✅ База заполнена начальными данными")
    db.close()


# Раздача статики фронтенда (если папка существует)
FRONTEND_DIST = os.getenv(
    "FRONTEND_DIST",
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"),
)
if os.path.exists(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
    print(f"✅ Статика фронтенда подключена: {FRONTEND_DIST}")
else:
    print(f"ℹ️ Статика фронтенда не найдена: {FRONTEND_DIST}")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
