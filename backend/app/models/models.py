from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from app.core.database import Base


class Master(Base):
    __tablename__ = "masters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, default="Барбер")
    photo_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    telegram_id = Column(Integer, nullable=True)
    tg_username = Column(String, nullable=True)

    bookings = relationship("Booking", back_populates="master")
    services = relationship("MasterService", back_populates="master", cascade="all, delete-orphan")
    schedule = relationship("MasterSchedule", back_populates="master", cascade="all, delete-orphan")


class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    duration_minutes = Column(Integer, default=45)
    category = Column(String, default="Стрижка")

    bookings = relationship("Booking", back_populates="service")


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    master_id = Column(Integer, ForeignKey("masters.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=True)
    customer_tg_username = Column(String, nullable=True)
    customer_tg_id = Column(Integer, nullable=True)
    booking_time = Column(DateTime, nullable=False)
    is_confirmed = Column(Boolean, default=False)
    notified_day_before = Column(Boolean, default=False)
    notified_hour_before = Column(Boolean, default=False)

    master = relationship("Master", back_populates="bookings")
    service = relationship("Service", back_populates="bookings")


# Связь мастер-услуга (у каждого мастера свои услуги)
class MasterService(Base):
    __tablename__ = "master_services"

    id = Column(Integer, primary_key=True, index=True)
    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id", ondelete="CASCADE"), nullable=False)
    price = Column(Float, nullable=True)            # своя цена (null = глобальная)
    duration_minutes = Column(Integer, nullable=True)  # своя длительность

    master = relationship("Master", back_populates="services")
    service = relationship("Service")


# График работы мастера
class MasterSchedule(Base):
    __tablename__ = "master_schedules"

    id = Column(Integer, primary_key=True, index=True)
    master_id = Column(Integer, ForeignKey("masters.id", ondelete="CASCADE"), nullable=False)
    day_of_week = Column(Integer, nullable=False)   # 0=пн ... 6=вс
    is_working = Column(Boolean, default=True)
    start_time = Column(String, default="10:00")
    end_time = Column(String, default="20:00")

    master = relationship("Master", back_populates="schedule")


# Инвайт-токен для регистрации мастера через Telegram
class MasterInvite(Base):
    __tablename__ = "master_invites"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_used = Column(Boolean, default=False)
    used_by_telegram_id = Column(Integer, nullable=True)
