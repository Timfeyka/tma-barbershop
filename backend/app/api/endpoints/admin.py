from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import ADMIN_PASSWORD
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
    db.delete(service)
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
