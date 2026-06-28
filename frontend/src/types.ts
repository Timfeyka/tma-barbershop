// ===== Data models (match backend schemas) =====

export interface Master {
  id: number
  name: string
  role: string
  photo_url: string | null
  bio: string | null
  telegram_id: number | null
  tg_username: string | null
}

export interface Service {
  id: number
  title: string
  price: number
  duration_minutes: number
  category: string
}

export interface MasterService {
  id: number
  master_id: number
  service_id: number
  price: number | null
  duration_minutes: number | null
  service?: Service
}

export interface Booking {
  id: number
  master_id: number
  service_id: number
  customer_name: string
  customer_phone: string | null
  customer_tg_username: string | null
  customer_tg_id: number | null
  booking_time: string  // ISO datetime
  is_confirmed: boolean
  is_cancelled: boolean
  notified_day_before: boolean
  notified_hour_before: boolean
  master?: Master
  service?: Service
}

export interface ScheduleItem {
  day_of_week: number  // 0=Mon … 6=Sun
  is_working: boolean
  start_time: string  // "HH:MM"
  end_time: string    // "HH:MM"
  slot_interval_minutes?: number
}

export interface DateOverride {
  id: number
  master_id: number
  date: string  // "YYYY-MM-DD"
  is_working: boolean
  max_bookings: number
  note: string | null
}

export interface TimeSlot {
  time: string       // "HH:MM"
  available: boolean
  note?: string
}

export interface AvailableSlotsResponse {
  date: string
  slots: TimeSlot[]
  note?: string
}

export interface MasterInvite {
  id: number
  token: string
  created_at: string
  is_used: boolean
  used_by_telegram_id: number | null
}

export interface AdminStats {
  total_bookings: number
  confirmed_bookings: number
  pending_bookings: number
  total_masters: number
}

export interface BotInfo {
  has_bot_token: boolean
  webhook_url?: string
}

export interface InviteLinkResponse {
  direct_url: string
  telegram_url: string
  token: string
}

export interface MasterRegisterResponse {
  master: Master
  message: string
}

// ===== Telegram WebApp types =====

export interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
  photo_url?: string
}

export interface TelegramWebApp {
  ready: () => void
  expand: () => void
  close: () => void
  initDataUnsafe: {
    user?: TelegramUser
    start_param?: string
  }
  MainButton: {
    show: () => void
    hide: () => void
    setText: (text: string) => void
    onClick: (cb: () => void) => void
  }
  sendData: (data: string) => void
}

// ===== Calendar =====

export interface CalendarDay {
  day: number | null
  dateStr: string | null
  isToday: boolean
  isPast: boolean
  isOther: boolean
  dayOfWeek?: number
}

// ===== Form state helpers =====

export interface DateOverrideForm {
  date: string
  is_working: boolean
  max_bookings: number
  note: string
}
