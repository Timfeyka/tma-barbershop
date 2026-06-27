import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from app.core.database import engine, SessionLocal, DATABASE_URL
from app.models import models
from app.api.endpoints import masters, bookings, services, admin

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


@app.on_event("startup")
def startup():
    """Миграции + начальные данные"""
    db = SessionLocal()

    # Миграция: добавляем колонку telegram_id, если её нет
    try:
        if DATABASE_URL.startswith("sqlite"):
            db.execute(text("ALTER TABLE masters ADD COLUMN telegram_id INTEGER"))
        else:
            db.execute(text("ALTER TABLE masters ADD COLUMN IF NOT EXISTS telegram_id INTEGER"))
        db.commit()
        print("✅ Миграция: колонка telegram_id добавлена")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Миграция telegram_id: {e} (возможно колонка уже есть)")

    # Миграция: делаем customer_phone опциональным
    try:
        if not DATABASE_URL.startswith("sqlite"):
            db.execute(text("ALTER TABLE bookings ALTER COLUMN customer_phone DROP NOT NULL"))
        # SQLite не поддерживает DROP NOT NULL, но у нас nullable=True в модели — SQLite его игнорирует
        db.commit()
        print("✅ Миграция: customer_phone теперь опциональный")
    except Exception as e:
        db.rollback()
        print(f"⚠️ Миграция customer_phone: {e}")

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
