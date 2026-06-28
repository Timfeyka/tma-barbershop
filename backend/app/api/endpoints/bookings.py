import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime, timedelta
from app.core.database import get_db
from app.models import models
from app.schemas import schemas
from app.services.telegram import send_booking_notification, send_client_confirmation, send_reminder, _send_telegram_message

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

    # Проверяем особые даты (date override)
    override = db.query(models.MasterDateOverride).filter(
        models.MasterDateOverride.master_id == master_id,
        models.MasterDateOverride.date == date,
    ).first()

    if override and not override.is_working:
        return {"date": date, "slots": [], "note": "Мастер не работает в этот день"}

    # Если есть working_intervals — используем их вместо расписания
    if override and override.working_intervals:
        try:
            intervals = json.loads(override.working_intervals)
        except (json.JSONDecodeError, TypeError):
            intervals = None

        if intervals and len(intervals) > 0:
            all_slots = []
            for interval in intervals:
                start_time = interval.get("start", "10:00")
                end_time = interval.get("end", "20:00")
                start_h, start_m = map(int, start_time.split(":"))
                end_h, end_m = map(int, end_time.split(":"))
                hour = start_h
                minute = start_m
                while hour < end_h or (hour == end_h and minute < end_m):
                    all_slots.append(f"{hour:02d}:{minute:02d}")
                    minute += 60  # интервал 1 час
                    if minute >= 60:
                        hour += 1
                        minute = 0

            # Получаем занятые слоты
            day_start = datetime.combine(target_date, datetime.min.time())
            day_end = day_start + timedelta(days=1)

            booked = db.query(models.Booking).filter(
                models.Booking.master_id == master_id,
                models.Booking.is_cancelled == False,
                models.Booking.booking_time >= day_start - timedelta(days=2),
                models.Booking.booking_time < day_end + timedelta(days=2),
            ).all()

            booked_times = set()
            for b in booked:
                b_date = b.booking_time.date() if hasattr(b.booking_time, 'date') else target_date
                if b_date == target_date:
                    booked_times.add(b.booking_time.strftime("%H:%M"))

            available = [{"time": slot, "available": slot not in booked_times} for slot in all_slots]
            return {"date": date, "slots": available}

    max_bookings = 999

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
        interval = schedule.slot_interval_minutes or 60
    except ValueError:
        raise HTTPException(status_code=500, detail="Ошибка в формате расписания")

    all_slots = []
    hour = start_h
    minute = start_m
    while hour < end_h or (hour == end_h and minute < end_m):
        all_slots.append(f"{hour:02d}:{minute:02d}")
        minute += interval
        if minute >= 60:
            hour += 1
            minute = minute - 60 if minute >= 60 else 0

    # Получаем занятые слоты (проверяем шире — ±2 дня, чтобы учесть старые записи
    # с UTC-смещением, и фильтруем уже в Python по дате)
    day_start = datetime.combine(target_date, datetime.min.time().replace(hour=start_h, minute=start_m))
    day_end = datetime.combine(target_date, datetime.min.time().replace(hour=end_h, minute=end_m))

    booked = db.query(models.Booking).filter(
        models.Booking.master_id == master_id,
        models.Booking.is_cancelled == False,
        models.Booking.booking_time >= day_start - timedelta(days=2),
        models.Booking.booking_time < day_end + timedelta(days=2),
    ).all()

    booked_times = set()
    for b in booked:
        # Сравниваем ТОЛЬКО по дате (без времени) — так не ломается при смене
        # формата хранения времени (UTC → local и т.д.)
        b_date = b.booking_time.date() if hasattr(b.booking_time, 'date') else target_date
        if b_date == target_date:
            booked_times.add(b.booking_time.strftime("%H:%M"))

    available = []
    available_count = 0
    for slot in all_slots:
        is_available = slot not in booked_times
        if is_available and available_count >= max_bookings:
            available.append({"time": slot, "available": False, "note": "Лимит записей на этот день"})
        else:
            available.append({"time": slot, "available": is_available})
            if is_available:
                available_count += 1

    return {"date": date, "slots": available}


@router.post("/", response_model=schemas.BookingResponse)
def create_booking(booking: schemas.BookingCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
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
        customer_tg_id=booking.customer_tg_id,
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

    # Уведомления в фоне — клиент не ждёт ответа Telegram API
    if master.telegram_id:
        background_tasks.add_task(
            send_booking_notification,
            chat_id=master.telegram_id,
            client_name=booking.customer_name,
            client_username=booking.customer_tg_username,
            master_name=master.name,
            service_title=service.title,
            service_price=service.price,
            booking_time=booking.booking_time,
        )

    if booking.customer_tg_id and booking.customer_tg_id > 0:
        background_tasks.add_task(
            send_client_confirmation,
            chat_id=booking.customer_tg_id,
            client_name=booking.customer_name,
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


@router.put("/{booking_id}/cancel")
def cancel_booking(booking_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Мастер отменяет запись (помечаем как отменённую, не удаляем)"""
    booking = db.query(models.Booking).options(
        joinedload(models.Booking.master),
        joinedload(models.Booking.service),
    ).filter(models.Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    if booking.is_cancelled:
        raise HTTPException(status_code=400, detail="Запись уже отменена")

    booking.is_cancelled = True
    db.commit()

    # Уведомляем клиента об отмене (в фоне)
    if booking.customer_tg_id and booking.customer_tg_id > 0:
        time_str = booking.booking_time.strftime("%d.%m.%Y в %H:%M")
        text = (
            f"❌ <b>Запись отменена</b>\n\n"
            f"💇 <b>Мастер:</b> {booking.master.name}\n"
            f"📋 <b>Услуга:</b> {booking.service.title}\n"
            f"📅 <b>Время:</b> {time_str}\n\n"
            f"Извините за неудобства. Вы можете записаться снова в приложении."
        )
        def _send_cancel_msg():
            _send_telegram_message(booking.customer_tg_id, text)
        background_tasks.add_task(_send_cancel_msg)

    return {"status": "cancelled"}


@router.post("/check-reminders")
def check_reminders(db: Session = Depends(get_db)):
    """Проверить и отправить напоминания о записях.
    Вызывать по крону: каждый час.
    """
    now = datetime.utcnow()
    sent = {"day_before": 0, "hour_before": 0}

    # Ищем неподтверждённые записи на завтра (за день)
    tomorrow = now + timedelta(days=1)
    tomorrow_start = tomorrow.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_end = tomorrow_start + timedelta(days=1)

    day_before_bookings = db.query(models.Booking).options(
        joinedload(models.Booking.master),
        joinedload(models.Booking.service),
    ).filter(
        models.Booking.is_cancelled == False,
        models.Booking.customer_tg_id.isnot(None),
        models.Booking.customer_tg_id > 0,
        models.Booking.notified_day_before == False,
        models.Booking.booking_time >= tomorrow_start,
        models.Booking.booking_time < tomorrow_end,
    ).all()

    for b in day_before_bookings:
        send_reminder(
            chat_id=b.customer_tg_id,
            client_name=b.customer_name,
            master_name=b.master.name,
            service_title=b.service.title,
            booking_time=b.booking_time,
            hours_before=24,
        )
        b.notified_day_before = True
        sent["day_before"] += 1

    # Ищем записи на сегодня, где до записи осталось ~1 час
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    in_one_hour = now + timedelta(hours=1)

    hour_before_bookings = db.query(models.Booking).options(
        joinedload(models.Booking.master),
        joinedload(models.Booking.service),
    ).filter(
        models.Booking.is_cancelled == False,
        models.Booking.customer_tg_id.isnot(None),
        models.Booking.customer_tg_id > 0,
        models.Booking.notified_hour_before == False,
        models.Booking.booking_time >= today_start,
        models.Booking.booking_time < today_end,
        models.Booking.booking_time <= in_one_hour,
    ).all()

    for b in hour_before_bookings:
        send_reminder(
            chat_id=b.customer_tg_id,
            client_name=b.customer_name,
            master_name=b.master.name,
            service_title=b.service.title,
            booking_time=b.booking_time,
            hours_before=1,
        )
        b.notified_hour_before = True
        sent["hour_before"] += 1

    db.commit()

    return {
        "status": "ok",
        "reminders_sent": sent,
    }
