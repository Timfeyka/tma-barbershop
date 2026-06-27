import uuid
import json
import urllib.request
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from app.core.database import get_db
from app.core.config import ADMIN_PASSWORD, BOT_TOKEN
from app.models import models
from app.schemas import schemas

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.post("/login", response_model=schemas.TokenResponse)
def admin_login(payload: schemas.AdminLogin):
    if payload.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Неверный пароль")
    return schemas.TokenResponse(access_token="admin_token_valid", token_type="bearer")


@router.get("/stats", response_model=schemas.AdminStats)
def get_stats(db: Session = Depends(get_db)):
    return schemas.AdminStats(
        total_bookings=db.query(models.Booking).count(),
        confirmed_bookings=db.query(models.Booking).filter(models.Booking.is_confirmed == True).count(),
        pending_bookings=db.query(models.Booking).filter(models.Booking.is_confirmed == False).count(),
        total_masters=db.query(models.Master).count(),
        total_services=db.query(models.Service).count(),
    )


# --- Мастеры (полный CRUD для админки) ---
@router.get("/masters", response_model=list[schemas.MasterResponse])
def admin_get_masters(db: Session = Depends(get_db)):
    return db.query(models.Master).all()


@router.post("/masters", response_model=schemas.MasterResponse)
def admin_create_master(master: schemas.MasterCreate, db: Session = Depends(get_db)):
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


@router.put("/masters/{master_id}", response_model=schemas.MasterResponse)
def admin_update_master(master_id: int, update: schemas.MasterUpdate, db: Session = Depends(get_db)):
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(master, key, value)
    db.commit()
    db.refresh(master)
    return master


@router.delete("/masters/{master_id}")
def admin_delete_master(master_id: int, db: Session = Depends(get_db)):
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")
    # Сначала удаляем все записи к этому мастеру
    db.query(models.Booking).filter(models.Booking.master_id == master_id).delete()
    db.delete(master)
    db.commit()
    return {"status": "deleted"}


# --- Услуги (полный CRUD для админки) ---
@router.get("/services", response_model=list[schemas.ServiceResponse])
def admin_get_services(db: Session = Depends(get_db)):
    return db.query(models.Service).all()


@router.post("/services", response_model=schemas.ServiceResponse)
def admin_create_service(service: schemas.ServiceCreate, db: Session = Depends(get_db)):
    db_service = models.Service(
        title=service.title,
        price=service.price,
        duration_minutes=service.duration_minutes,
        category=service.category,
    )
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service


@router.put("/services/{service_id}", response_model=schemas.ServiceResponse)
def admin_update_service(service_id: int, update: schemas.ServiceUpdate, db: Session = Depends(get_db)):
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(service, key, value)
    db.commit()
    db.refresh(service)
    return service


@router.delete("/services/{service_id}")
def admin_delete_service(service_id: int, db: Session = Depends(get_db)):
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")
    # Удаляем связи с мастерами
    db.query(models.MasterService).filter(models.MasterService.service_id == service_id).delete()
    db.delete(service)
    db.commit()
    return {"status": "deleted"}


# --- Инвайт-ссылки для регистрации мастеров ---

@router.post("/invite-link", response_model=schemas.InviteLinkResponse)
def create_invite_link(request: Request, db: Session = Depends(get_db)):
    """Создать инвайт-ссылку для регистрации мастера через Telegram"""
    token = uuid.uuid4().hex[:16]
    invite = models.MasterInvite(token=token)
    db.add(invite)
    db.commit()

    bot_username = _get_bot_username()
    if bot_username:
        invite_url = f"https://t.me/{bot_username}/app?startapp=invite_{token}"
    else:
        base_url = str(request.base_url).rstrip("/")
        invite_url = f"{base_url}?invite={token}"

    return schemas.InviteLinkResponse(url=invite_url, token=token)


@router.get("/bot-info")
def get_bot_info(request: Request):
    """Информация о боте + настройка @BotFather"""
    bot_username = _get_bot_username()
    current_url = str(request.base_url).rstrip("/")
    return {
        "bot_username": bot_username,
        "has_bot_token": bool(BOT_TOKEN),
        "mini_app_url": current_url,
        "botfather_help": (
            f"1. Откройте @BotFather\n"
            f"2. /mybots → выберите бота\n"
            f"3. Bot Settings → Menu Button → укажите: {current_url}\n"
            f"   Или: Bot Settings → Domain → укажите домен"
        ),
    }


def _get_bot_username() -> str | None:
    """Получить username бота через Telegram API"""
    if not BOT_TOKEN:
        return None
    try:
        req = urllib.request.Request(f"https://api.telegram.org/bot{BOT_TOKEN}/getMe")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read())
            if data.get("ok"):
                return data["result"].get("username", "")
    except Exception as e:
        print(f"⚠️ Не удалось получить username бота: {e}")
    return None


# --- Услуги мастера (админка) ---

@router.post("/masters/{master_id}/services", response_model=schemas.MasterServiceResponse)
def admin_link_service_to_master(master_id: int, payload: schemas.MasterServiceCreate, db: Session = Depends(get_db)):
    """Привязать услугу к мастеру"""
    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")

    service = db.query(models.Service).filter(models.Service.id == payload.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    # Проверяем, не привязана ли уже
    existing = db.query(models.MasterService).filter(
        models.MasterService.master_id == master_id,
        models.MasterService.service_id == payload.service_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Эта услуга уже привязана к мастеру")

    ms = models.MasterService(
        master_id=master_id,
        service_id=payload.service_id,
        price=payload.price,
        duration_minutes=payload.duration_minutes,
    )
    db.add(ms)
    db.commit()
    db.refresh(ms)

    # Загружаем с сервисом
    ms = db.query(models.MasterService).options(
        joinedload(models.MasterService.service)
    ).filter(models.MasterService.id == ms.id).first()
    return ms


@router.put("/masters/{master_id}/services/{ms_id}", response_model=schemas.MasterServiceResponse)
def admin_update_master_service(master_id: int, ms_id: int, payload: schemas.MasterServiceCreate, db: Session = Depends(get_db)):
    """Обновить цену/длительность услуги мастера"""
    ms = db.query(models.MasterService).options(
        joinedload(models.MasterService.service)
    ).filter(
        models.MasterService.id == ms_id,
        models.MasterService.master_id == master_id,
    ).first()
    if not ms:
        raise HTTPException(status_code=404, detail="Связь не найдена")

    if payload.price is not None:
        ms.price = payload.price
    if payload.duration_minutes is not None:
        ms.duration_minutes = payload.duration_minutes

    db.commit()
    db.refresh(ms)
    return ms


@router.delete("/masters/{master_id}/services/{ms_id}")
def admin_unlink_service_from_master(master_id: int, ms_id: int, db: Session = Depends(get_db)):
    """Отвязать услугу от мастера"""
    ms = db.query(models.MasterService).filter(
        models.MasterService.id == ms_id,
        models.MasterService.master_id == master_id,
    ).first()
    if not ms:
        raise HTTPException(status_code=404, detail="Связь не найдена")
    db.delete(ms)
    db.commit()
    return {"status": "deleted"}


# --- Записи (подтверждение/удаление) ---
@router.get("/bookings")
def admin_get_bookings(db: Session = Depends(get_db)):
    from sqlalchemy.orm import joinedload
    return db.query(models.Booking).options(
        joinedload(models.Booking.master),
        joinedload(models.Booking.service)
    ).order_by(models.Booking.booking_time.desc()).all()


@router.put("/bookings/{booking_id}/confirm")
def admin_confirm_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    booking.is_confirmed = True
    db.commit()
    return {"status": "confirmed"}


@router.delete("/bookings/{booking_id}")
def admin_delete_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    db.delete(booking)
    db.commit()
    return {"status": "deleted"}
