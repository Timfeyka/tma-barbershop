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

    bookings = relationship("Booking", back_populates="master")


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
    booking_time = Column(DateTime, nullable=False)
    is_confirmed = Column(Boolean, default=False)

    master = relationship("Master", back_populates="bookings")
    service = relationship("Service", back_populates="bookings")
