from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.services.telegram import send_booking_notification

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.get("/", response_model=List[schemas.BookingResponse])
def get_bookings(db: Session = Depends(get_db)):
    bookings = db.query(models.Booking).options(
        joinedload(models.Booking.master),
        joinedload(models.Booking.service)
    ).all()
    return bookings


@router.get("/master/{master_id}", response_model=List[schemas.BookingResponse])
def get_bookings_by_master(master_id: int, db: Session = Depends(get_db)):
    bookings = db.query(models.Booking).options(
        joinedload(models.Booking.master),
        joinedload(models.Booking.service)
    ).filter(models.Booking.master_id == master_id).all()
    return bookings


@router.get("/available-slots/{master_id}/{date}")
def get_available_slots(master_id: int, date: str, db: Session = Depends(get_db)):
    """Получить доступные слоты для мастера на определённую дату (по его расписанию)"""
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный формат даты. Используйте YYYY-MM-DD")

    master = db.query(models.Master).filter(models.Master.id == master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")

    # Получаем расписание мастера на этот день недели (0=пн ... 6=вс)
    day_of_week = target_date.weekday()

    schedule = db.query(models.MasterSchedule).filter(
        models.MasterSchedule.master_id == master_id,
        models.MasterSchedule.day_of_week == day_of_week,
    ).first()

    if not schedule or not schedule.is_working:
        return {"date": date, "slots": [], "note": "Мастер не работает в этот день"}

    # Генерируем слоты по расписанию
    try:
        start_h, start_m = map(int, schedule.start_time.split(":"))
        end_h, end_m = map(int, schedule.end_time.split(":"))
    except ValueError:
        raise HTTPException(status_code=500, detail="Ошибка в формате расписания")

    all_slots = []
    hour = start_h
    minute = start_m
    while hour < end_h or (hour == end_h and minute < end_m):
        all_slots.append(f"{hour:02d}:{minute:02d}")
        minute += 30
        if minute >= 60:
            hour += 1
            minute = 0

    # Получаем занятые слоты
    day_start = datetime.combine(target_date, datetime.min.time().replace(hour=start_h, minute=start_m))
    day_end = datetime.combine(target_date, datetime.min.time().replace(hour=end_h, minute=end_m))

    booked = db.query(models.Booking).filter(
        models.Booking.master_id == master_id,
        models.Booking.booking_time >= day_start,
        models.Booking.booking_time < day_end,
    ).all()

    booked_times = set()
    for b in booked:
        booked_times.add(b.booking_time.strftime("%H:%M"))

    available = []
    for slot in all_slots:
        available.append({
            "time": slot,
            "available": slot not in booked_times
        })

    return {"date": date, "slots": available}


@router.post("/", response_model=schemas.BookingResponse)
def create_booking(booking: schemas.BookingCreate, db: Session = Depends(get_db)):
    # Проверяем существование мастера
    master = db.query(models.Master).filter(models.Master.id == booking.master_id).first()
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")

    # Проверяем существование услуги
    service = db.query(models.Service).filter(models.Service.id == booking.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Услуга не найдена")

    # Проверяем не занят ли слот
    existing = db.query(models.Booking).filter(
        models.Booking.master_id == booking.master_id,
        models.Booking.booking_time == booking.booking_time,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Это время уже занято")

    db_booking = models.Booking(
        master_id=booking.master_id,
        service_id=booking.service_id,
        customer_name=booking.customer_name,
        customer_phone=booking.customer_phone,
        customer_tg_username=booking.customer_tg_username,
        booking_time=booking.booking_time,
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)

    # Загружаем связанные данные
    db_booking = db.query(models.Booking).options(
        joinedload(models.Booking.master),
        joinedload(models.Booking.service)
    ).filter(models.Booking.id == db_booking.id).first()

    # Отправляем уведомление мастеру в Telegram
    if master.telegram_id:
        send_booking_notification(
            chat_id=master.telegram_id,
            client_name=booking.customer_name,
            client_username=booking.customer_tg_username,
            master_name=master.name,
            service_title=service.title,
            service_price=service.price,
            booking_time=booking.booking_time,
        )

    return db_booking


@router.put("/{booking_id}/confirm", response_model=schemas.BookingResponse)
def confirm_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    booking.is_confirmed = True
    db.commit()
    db.refresh(booking)
    return booking


@router.delete("/{booking_id}")
def delete_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    db.delete(booking)
    db.commit()
    return {"status": "deleted"}
