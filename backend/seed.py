from app.models.models import Master, Service, Booking
from app.core.database import SessionLocal, engine
from app.models import models

models.Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Проверяем, есть ли уже данные
if db.query(models.Master).count() == 0:
    masters = [
        models.Master(
            name="Алексей",
            role="Топ-барбер",
            photo_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop",
            bio="Мастер с 8-летним стажем. Специализация — мужские стрижки и борода."
        ),
        models.Master(
            name="Дмитрий",
            role="Барбер",
            photo_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
            bio="Молодой специалист, но уже зарекомендовал себя лучшим."
        ),
        models.Master(
            name="Максим",
            role="Барбер",
            photo_url="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
            bio="Королевские бороды и стильные стрижки — мой конёк."
        ),
    ]
    db.add_all(masters)
    db.commit()
    print("✅ Мастера добавлены")

    services = [
        models.Service(title="Мужская стрижка", price=1500, duration_minutes=45, category="Стрижка"),
        models.Service(title="Стрижка машинкой", price=1000, duration_minutes=30, category="Стрижка"),
        models.Service(title="Оформление бороды", price=800, duration_minutes=30, category="Борода"),
        models.Service(title="Королевская бритьё", price=1200, duration_minutes=45, category="Борода"),
        models.Service(title="Детская стрижка (до 12 лет)", price=1000, duration_minutes=30, category="Стрижка"),
        models.Service(title="Стрижка + борода (комплекс)", price=2200, duration_minutes=75, category="Комплекс"),
        models.Service(title="Укладка", price=500, duration_minutes=20, category="Дополнительно"),
        models.Service(title="Стрижка усов", price=300, duration_minutes=15, category="Борода"),
    ]
    db.add_all(services)
    db.commit()
    print("✅ Услуги добавлены")
else:
    print("ℹ️ Данные уже есть, пропускаем")

db.close()
