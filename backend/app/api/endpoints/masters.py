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

    # Проверяем, не зарегистрирован ли уже этот Telegram ID
    existing = db.query(models.Master).filter(
        models.Master.telegram_id == payload.telegram_id
    ).first()
    if existing:
        # Если мастер уже существует с таким telegram_id — просто помечаем и возвращаем его
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
        telegram_id=payload.telegram_id,
        bio=f"Telegram: @{bot_username}" if bot_username else None,
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
