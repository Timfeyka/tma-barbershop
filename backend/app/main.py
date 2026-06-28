import os
import json
import urllib.request
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.database import engine, SessionLocal, DATABASE_URL
from app.core.config import BOT_TOKEN
from app.models import models
from app.api.endpoints import masters, bookings, services, admin, bot_webhook

# Alembic для версионирования схемы БД
from alembic.config import Config
from alembic import command

app = FastAPI(title="TMA Barbershop API")

# Fallback: создаём таблицы если БД пустая (на случай ошибки Alembic)
models.Base.metadata.create_all(bind=engine)

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


def _run_alembic_migrations():
    """Запустить миграции Alembic при старте."""
    try:
        alembic_cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
        print("✅ Alembic: все миграции применены")
    except Exception as e:
        print(f"⚠️ Ошибка при запуске Alembic: {e}")


def _auto_setup_menu_button(base_url: str):
    """Автоматически настроить Menu Button + описание бота на текущий URL."""
    if not BOT_TOKEN:
        print("⚠️ BOT_TOKEN не задан — Menu Button не настроен")
        return

    # 1. Menu Button (открывает Mini App)
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

    # 2. Описание бота (показывает текущий URL для справки)
    description_url = f"https://api.telegram.org/bot{BOT_TOKEN}/setMyDescription"
    desc_payload = json.dumps({
        "description": (
            f"💈 Барбершоп — запись онлайн через Mini App.\n\n"
            f"🌐 Актуальная ссылка: {base_url}\n\n"
            f"Нажмите кнопку «💈 Барбершоп» ниже, чтобы открыть приложение."
        )
    }).encode("utf-8")
    req2 = urllib.request.Request(
        description_url, data=desc_payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req2, timeout=10)
        print(f"✅ Описание бота обновлено: {base_url}")
    except Exception as e:
        print(f"⚠️ Ошибка обновления описания: {e}")

    # 3. Short description (показывается в списке ботов)
    short_url = f"https://api.telegram.org/bot{BOT_TOKEN}/setMyShortDescription"
    short_payload = json.dumps({
        "short_description": f"💈 Запись в барбершоп. Открыть: {base_url}"
    }).encode("utf-8")
    req3 = urllib.request.Request(
        short_url, data=short_payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req3, timeout=10)
        print(f"✅ Short description бота обновлено")
    except Exception as e:
        print(f"⚠️ Ошибка обновления short description: {e}")


@app.on_event("startup")
def startup():
    """Миграции + начальные данные"""
    db = SessionLocal()

    # Миграции через Alembic (версионированная схема БД)
    _run_alembic_migrations()

    # Авто-настройка Menu Button + webhook
    try:
        base_url = str(os.getenv("BASE_URL", ""))
        if base_url:
            _auto_setup_menu_button(base_url)
            bot_webhook.register_webhook(base_url)
    except Exception as e:
        print(f"⚠️ Ошибка авто-настройки Menu Button / webhook: {e}")

    # Сидирование данных (только услуги, мастеров нет)
    if db.query(models.Service).count() == 0:
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


# Раздача загруженных файлов (фото мастеров и т.д.)
# ВАЖНО: монтируем ДО фронтенда, иначе catch-all "/" перехватит запросы
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
if os.path.exists(UPLOADS_DIR):
    app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")
    print(f"✅ Папка загрузок подключена: {UPLOADS_DIR}")

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
