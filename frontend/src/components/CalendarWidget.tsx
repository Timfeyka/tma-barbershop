import { useState } from 'react'
import type { CalendarDay, TimeSlot as TSType } from '../types'

const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

export const MONTHS_RU_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonthDays(month: number, year: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startWeekday = firstDay.getDay()
  const startOffset = startWeekday === 0 ? 6 : startWeekday - 1
  const today = new Date()
  const todayStr = toLocalDateStr(today)

  const days: CalendarDay[] = []
  for (let i = 0; i < startOffset; i++) {
    days.push({ day: null, dateStr: null, isToday: false, isPast: false, isOther: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const dateStr = toLocalDateStr(date)
    days.push({
      day: d,
      dateStr,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      isOther: false,
      dayOfWeek: date.getDay(),
    })
  }
  return days
}

interface DayStatus {
  is_working: boolean
  has_slots: boolean
}

interface CalendarWidgetProps {
  selectedDate: string | null
  onSelectDate: (dateStr: string) => void
  slots: TSType[]
  selectedSlot: string | null
  onSelectSlot: (time: string) => void
  /** Статус каждого дня месяца { "2026-07-10": { is_working, has_slots } } */
  dayStatus?: Record<string, DayStatus> | null
  /** Вызывается при смене месяца в календаре */
  onMonthChange?: (year: number, month: number) => void
}

export default function CalendarWidget({
  selectedDate,
  onSelectDate,
  slots,
  selectedSlot,
  onSelectSlot,
  dayStatus,
  onMonthChange,
}: CalendarWidgetProps) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())

  const days = getMonthDays(month, year)

  const changeMonth = (newMonth: number, newYear: number) => {
    setMonth(newMonth)
    setYear(newYear)
    onMonthChange?.(newYear, newMonth)
  }

  const prevMonth = () => {
    if (month === 0) changeMonth(11, year - 1)
    else changeMonth(month - 1, year)
  }
  const nextMonth = () => {
    if (month === 11) changeMonth(0, year + 1)
    else changeMonth(month + 1, year)
  }

  const getDayStyle = (d: CalendarDay): React.CSSProperties => {
    if (!d.dateStr || d.isPast || d.isOther) return {}
    const st = dayStatus?.[d.dateStr]
    if (!st) return {}
    if (st.is_working && st.has_slots) {
      return { background: 'rgba(46,204,113,0.2)', color: '#27ae60', fontWeight: 600 }
    }
    if (!st.is_working) {
      return { background: 'rgba(231,76,60,0.12)', color: '#e74c3c' }
    }
    // Рабочий, но всё занято
    return { color: 'var(--text-dim)', opacity: 0.5 }
  }

  return (
    <>
      <div className="calendar-nav">
        <button className="nav-arrow" onClick={prevMonth}>‹</button>
        <h3>{MONTHS_RU[month]} {year}</h3>
        <button className="nav-arrow" onClick={nextMonth}>›</button>
      </div>

      <div className="calendar-grid">
        {WEEKDAYS_SHORT.map(wd => (
          <div key={wd} className="calendar-weekday">{wd}</div>
        ))}
        {days.map((d, i) => {
          const customStyle = getDayStyle(d)
          const classes = [
            'calendar-day',
            d.isToday ? 'today' : '',
            d.isPast ? 'past' : '',
            d.isOther ? 'other-month' : '',
            selectedDate === d.dateStr ? 'selected' : '',
            !d.isPast && !d.isOther && dayStatus?.[d.dateStr || '']?.is_working === false ? 'day-off' : '',
            !d.isPast && !d.isOther && dayStatus?.[d.dateStr || '']?.is_working && dayStatus[d.dateStr]?.has_slots ? 'day-available' : '',
          ].filter(Boolean).join(' ')
          return (
            <button
              key={i}
              className={classes}
              disabled={!d.dateStr || d.isPast || d.isOther || dayStatus?.[d.dateStr || '']?.is_working === false}
              style={customStyle}
              onClick={() => d.dateStr && !d.isPast && onSelectDate(d.dateStr)}
            >
              {d.day}
            </button>
          )
        })}
      </div>

      {selectedDate && slots.length > 0 && (
        <>
          <h2 className="section-title">Выберите время</h2>
          <div className="slots-grid">
            {slots.map(s => (
              <button
                key={s.time}
                className={`slot-btn ${!s.available ? 'disabled' : ''} ${selectedSlot === s.time ? 'active' : ''}`}
                disabled={!s.available}
                onClick={() => s.available && onSelectSlot(s.time)}
              >
                {s.time}
              </button>
            ))}
          </div>
        </>
      )}
      {selectedDate && slots.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: 16 }}>
          Свободных слотов нет на этот день
        </p>
      )}
    </>
  )
}
