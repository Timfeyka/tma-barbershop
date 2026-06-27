import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from typing import List
from app.core.database import get_db
from app.models import models
from app.schemas import schemas

router = APIRouter(prefix="/masters", tags=["Masters"])


@router.get("/", response_model=List[schemas.MasterResponse])
def get_masters(db: Session = Depends(get_db)):
    return db.query(models.Master).all()


@router.get("/{master_id}", response_model=schemas.MasterResponse)
def get_master(master_id: int, db: Session = Depends(get_db)):
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")
    return master


@router.post("/", response_model=schemas.MasterResponse)
def create_master(master: schemas.MasterCreate, db: Session = Depends(get_db)):
    db_master = models.Master(
        name=master.name,
        role=master.role,
        photo_url=master.photo_url,
        bio=master.bio,
    )
    db.add(db_master)
    db.commit()
    db.refresh(db_master)
    return db_master


# --- Услуги мастера ---

@router.get("/{master_id}/services", response_model=List[schemas.MasterServiceResponse])
def get_master_services(master_id: int, db: Session = Depends(get_db)):
    """Получить услуги конкретного мастера"""
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")

    services = db.query(models.MasterService).options(
        joinedload(models.MasterService.service)
    ).filter(models.MasterService.master_id == master_id).all()
    return services


# --- Регистрация мастера по инвайт-ссылке ---

@router.post("/register-by-invite", response_model=schemas.MasterRegisterResponse)
def register_by_invite(payload: schemas.RegisterByInvite, db: Session = Depends(get_db)):
    """Зарегистрировать мастера через инвайт-ссылку (данные из Telegram)"""
    # Проверяем токен
    invite = db.query(models.MasterInvite).filter(
        models.MasterInvite.token == payload.token,
        models.MasterInvite.is_used == False,
    ).first()
    if not invite:
        raise HTTPException(status_code=400, detail="Недействительная или уже использованная ссылка")

    # Проверяем, не зарегистрирован ли уже этот Telegram ID (только если > 0)
    if payload.telegram_id and payload.telegram_id > 0:
        existing = db.query(models.Master).filter(
            models.Master.telegram_id == payload.telegram_id
        ).first()
        if existing:
            invite.is_used = True
            invite.used_by_telegram_id = payload.telegram_id
            db.commit()
            return schemas.MasterRegisterResponse(
                master=schemas.MasterResponse.model_validate(existing),
                message="Вы уже зарегистрированы как мастер. Добро пожаловать!",
            )

    # Создаём мастера
    bot_username = payload.username or ""
    photo_url = payload.photo_url or ""
    db_master = models.Master(
        name=payload.name,
        role="Барбер",
        photo_url=photo_url,
        telegram_id=payload.telegram_id if payload.telegram_id and payload.telegram_id > 0 else None,
        tg_username=bot_username,
        bio=bot_username,
    )
    db.add(db_master)
    db.commit()
    db.refresh(db_master)

    # Помечаем инвайт как использованный
    invite.is_used = True
    invite.used_by_telegram_id = payload.telegram_id
    db.commit()

    return schemas.MasterRegisterResponse(
        master=schemas.MasterResponse.model_validate(db_master),
        message=f"Добро пожаловать, {payload.name}! Вы зарегистрированы как мастер.",
    )


# --- Расписание мастера ---

@router.get("/{master_id}/schedule", response_model=List[schemas.MasterScheduleItem])
def get_master_schedule(master_id: int, db: Session = Depends(get_db)):
    """Получить расписание мастера (возвращает 7 дней, даже если не задано — дефолт)"""
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")

    schedule = db.query(models.MasterSchedule).filter(
        models.MasterSchedule.master_id == master_id
    ).order_by(models.MasterSchedule.day_of_week).all()

    # Если расписания нет — возвращаем дефолтное
    if not schedule:
        defaults = [
            {"day_of_week": 0, "is_working": True, "start_time": "10:00", "end_time": "20:00"},
            {"day_of_week": 1, "is_working": True, "start_time": "10:00", "end_time": "20:00"},
            {"day_of_week": 2, "is_working": True, "start_time": "10:00", "end_time": "20:00"},
            {"day_of_week": 3, "is_working": True, "start_time": "10:00", "end_time": "20:00"},
            {"day_of_week": 4, "is_working": True, "start_time": "10:00", "end_time": "20:00"},
            {"day_of_week": 5, "is_working": True, "start_time": "10:00", "end_time": "18:00"},
            {"day_of_week": 6, "is_working": False, "start_time": "10:00", "end_time": "18:00"},
        ]
        return [schemas.MasterScheduleItem(**d) for d in defaults]

    return schedule


@router.put("/{master_id}/schedule", response_model=List[schemas.MasterScheduleItem])
def update_master_schedule(master_id: int, payload: schemas.MasterScheduleUpdate, db: Session = Depends(get_db)):
    """Сохранить расписание мастера (заменяет всё)"""
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")

    # Удаляем старое расписание
    db.query(models.MasterSchedule).filter(
        models.MasterSchedule.master_id == master_id
    ).delete()

    # Вставляем новое
    for item in payload.schedule:
        if item.day_of_week < 0 or item.day_of_week > 6:
            raise HTTPException(status_code=400, detail="day_of_week должен быть от 0 (пн) до 6 (вс)")
        db_schedule = models.MasterSchedule(
            master_id=master_id,
            day_of_week=item.day_of_week,
            is_working=item.is_working,
            start_time=item.start_time,
            end_time=item.end_time,
        )
        db.add(db_schedule)

    db.commit()

    # Возвращаем новое расписание
    return get_master_schedule(master_id, db)


# --- Особые даты мастера ---

@router.get("/{master_id}/date-overrides", response_model=List[schemas.DateOverrideResponse])
def get_date_overrides(master_id: int, year: int = None, month: int = None, db: Session = Depends(get_db)):
    """Получить особые даты мастера. Можно отфильтровать по году/месяцу."""
    query = db.query(models.MasterDateOverride).filter(
        models.MasterDateOverride.master_id == master_id
    )
    if year and month:
        prefix = f"{year:04d}-{month:02d}"
        query = query.filter(models.MasterDateOverride.date.like(f"{prefix}%"))
    return query.order_by(models.MasterDateOverride.date).all()


@router.put("/{master_id}/date-overrides", response_model=schemas.DateOverrideResponse)
def upsert_date_override(master_id: int, payload: schemas.DateOverrideCreate, db: Session = Depends(get_db)):
    """Создать или обновить особую дату мастера."""
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")

    existing = db.query(models.MasterDateOverride).filter(
        models.MasterDateOverride.master_id == master_id,
        models.MasterDateOverride.date == payload.date,
    ).first()

    if existing:
        existing.is_working = payload.is_working
        existing.max_bookings = payload.max_bookings
        existing.note = payload.note
    else:
        existing = models.MasterDateOverride(
            master_id=master_id,
            date=payload.date,
            is_working=payload.is_working,
            max_bookings=payload.max_bookings,
            note=payload.note,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return existing


@router.delete("/{master_id}/date-overrides/{override_id}")
def delete_date_override(master_id: int, override_id: int, db: Session = Depends(get_db)):
    """Удалить особую дату."""
    override = db.query(models.MasterDateOverride).filter(
        models.MasterDateOverride.id == override_id,
        models.MasterDateOverride.master_id == master_id,
    ).first()
    if not override:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    db.delete(override)
    db.commit()
    return {"status": "deleted"}


# --- Привязка Telegram к мастеру ---

@router.put("/{master_id}/link-telegram", response_model=schemas.MasterResponse)
def link_telegram(master_id: int, payload: schemas.LinkTelegramRequest, db: Session = Depends(get_db)):
    """Привязать Telegram ID к мастеру (из Mini App)."""
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")

    # Проверяем, не привязан ли этот TG ID к другому мастеру
    existing = db.query(models.Master).filter(
        models.Master.telegram_id == payload.telegram_id,
        models.Master.id != master_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Этот Telegram уже привязан к другому мастеру")

    master.telegram_id = payload.telegram_id
    master.tg_username = payload.tg_username or master.tg_username
    db.commit()
    db.refresh(master)
    return master
