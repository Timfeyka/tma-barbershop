from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# --- Схемы для Мастеров ---
class MasterBase(BaseModel):
    name: str
    role: str = "Барбер"
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    telegram_id: Optional[int] = None


class MasterCreate(MasterBase):
    pass


class MasterUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    photo_url: Optional[str] = None
    bio: Optional[str] = None
    telegram_id: Optional[int] = None


class MasterResponse(MasterBase):
    id: int

    class Config:
        from_attributes = True


# --- Схемы для Услуг ---
class ServiceBase(BaseModel):
    title: str
    price: float
    duration_minutes: int = 45
    category: str = "Стрижка"


class ServiceCreate(ServiceBase):
    pass


class ServiceUpdate(BaseModel):
    title: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    category: Optional[str] = None


class ServiceResponse(ServiceBase):
    id: int

    class Config:
        from_attributes = True


# --- Схемы для Записей (Bookings) ---
class BookingBase(BaseModel):
    master_id: int
    service_id: int
    customer_name: str
    customer_phone: Optional[str] = None
    customer_tg_username: Optional[str] = None
    booking_time: datetime


class BookingCreate(BookingBase):
    pass


class BookingResponse(BookingBase):
    id: int
    is_confirmed: bool
    master: Optional[MasterResponse] = None
    service: Optional[ServiceResponse] = None

    class Config:
        from_attributes = True


# --- Схемы для Админа ---
class AdminLogin(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Схема для статистики ---
class AdminStats(BaseModel):
    total_bookings: int
    confirmed_bookings: int
    pending_bookings: int
    total_masters: int
    total_services: int


# --- Схемы для услуг мастера ---
class MasterServiceCreate(BaseModel):
    service_id: int
    price: Optional[float] = None
    duration_minutes: Optional[int] = None


class MasterServiceResponse(BaseModel):
    id: int
    master_id: int
    service_id: int
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    service: Optional[ServiceResponse] = None

    class Config:
        from_attributes = True


# --- Схемы для расписания мастера ---
class MasterScheduleItem(BaseModel):
    day_of_week: int
    is_working: bool = True
    start_time: str = "10:00"
    end_time: str = "20:00"


class MasterScheduleUpdate(BaseModel):
    schedule: List[MasterScheduleItem]


# --- Схемы для инвайт-регистрации ---
class InviteLinkResponse(BaseModel):
    telegram_url: str | None = None
    direct_url: str
    token: str


class RegisterByInvite(BaseModel):
    token: str
    name: str
    telegram_id: int
    username: Optional[str] = None
    photo_url: Optional[str] = None


class MasterRegisterResponse(BaseModel):
    master: MasterResponse
    message: str = "Добро пожаловать! Вы зарегистрированы как мастер."
