import { useEffect, useState, useRef, useCallback } from 'react'
import { get, post as apiPost, put, del } from '../api'
import type { Master, Booking, Service, MasterService, ScheduleItem, DateOverride } from '../types'
import Toast from './Toast'
import { MONTHS_RU_GEN } from './CalendarWidget'

const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const MONTHS_RU = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

interface MasterDashboardProps {
  master: Master
  masters: Master[]
  services: Service[]
  tgUser: { id: number; username?: string; first_name?: string; last_name?: string; photo_url?: string } | null
  onLogout: () => void
}

interface TimeInterval {
  start: string
  end: string
}

export default function MasterDashboard({ master, masters, services, tgUser, onLogout }: MasterDashboardProps) {
  const [tab, setTab] = useState('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [ownServices, setOwnServices] = useState<MasterService[]>([])
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [imgLoadFailed, setImgLoadFailed] = useState(false)

  useEffect(() => { setImgLoadFailed(false) }, [master.photo_url])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  const loadBookings = useCallback(async () => {
    const data = await get<Booking[]>(`/bookings/master/${master.id}`).catch(() => [])
    setBookings(data)
  }, [master.id])

  const loadOwnServices = useCallback(async () => {
    const data = await get<MasterService[]>(`/masters/${master.id}/services`).catch(() => [])
    setOwnServices(data)
  }, [master.id])

  const loadSchedule = useCallback(async () => {
    const data = await get<ScheduleItem[]>(`/masters/${master.id}/schedule`).catch(() => [])
    setSchedule(data)
  }, [master.id])

  const loadDateOverrides = useCallback(async () => {
    const now = new Date()
    const data = await get<DateOverride[]>(`/masters/${master.id}/date-overrides?year=${now.getFullYear()}&month=${now.getMonth() + 1}`).catch(() => [])
    setDateOverrides(data)
  }, [master.id])

  useEffect(() => { loadBookings() }, [loadBookings])

  const handleTabChange = (key: string) => {
    setTab(key)
    if (key === 'services') loadOwnServices()
    if (key === 'schedule') loadSchedule()
    if (key === 'dates') loadDateOverrides()
  }

  const handleLinkTelegram = async () => {
    if (!tgUser?.id) return
    try {
      await put(`/masters/${master.id}/link-telegram`, {
        telegram_id: tgUser.id,
        tg_username: tgUser.username || null,
        photo_url: tgUser.photo_url || null,
      })
      showToast('Telegram привязан! Теперь вы будете получать уведомления.')
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const handleCancelBooking = async (bookingId: number) => {
    try {
      await put(`/bookings/${bookingId}/cancel`)
      showToast('Запись отменена')
      loadBookings()
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const handleAddService = async (serviceId: number) => {
    try {
      await apiPost(`/admin/masters/${master.id}/services`, { service_id: serviceId })
      showToast('Услуга добавлена')
      loadOwnServices()
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const handleRemoveService = async (msId: number) => {
    await del(`/admin/masters/${master.id}/services/${msId}`)
    showToast('Услуга удалена')
    loadOwnServices()
  }

  const handleSaveSchedule = async () => {
    try {
      await put(`/masters/${master.id}/schedule`, { schedule })
      showToast('Расписание сохранено!')
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getDate()} ${MONTHS_RU_GEN[d.getMonth()]}, ${d.getFullYear()} в ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const getMasterLink = (masterId: number) =>
    window.location.origin + window.location.pathname + `#master/${masterId}`

  const isOwnServiceLinked = (serviceId: number) =>
    ownServices.some(ms => ms.service_id === serviceId)

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">💈</div>
        <h1>{master.name}</h1>
        <p className="header-sub">{master.role}</p>
      </header>

      <button className="back-btn" onClick={onLogout}>← Выйти</button>

      {!master.telegram_id && tgUser?.id && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <button
            className="btn btn-success btn-sm"
            style={{ display: 'inline-block', width: 'auto', padding: '6px 14px', fontSize: 13 }}
            onClick={handleLinkTelegram}
          >
            🔗 Привязать Telegram (для уведомлений)
          </button>
        </div>
      )}

      <div className="master-photo-section">
        <div className="master-avatar-wrapper" style={{ cursor: 'default' }}>
          {master.photo_url && !imgLoadFailed ? (
            <img src={master.photo_url} alt={master.name} className="master-avatar-img"
              onError={() => setImgLoadFailed(true)} />
          ) : (
            <div className="master-avatar-placeholder">
              {master.name[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <div className="master-photo-hint">Фото из профиля Telegram</div>
      </div>

      <nav className="nav-tabs" style={{ marginTop: 4 }}>
        {[
          { key: 'bookings', label: '📅 Записи' },
          { key: 'services', label: '✂️ Услуги' },
          { key: 'schedule', label: '📅 График' },
          { key: 'dates', label: '📌 Даты' },
        ].map(t => (
          <button key={t.key}
            className={`nav-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => handleTabChange(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'bookings' && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 8 }}>
            <button className="btn btn-secondary" style={{ display: 'inline-block', width: 'auto', padding: '8px 20px', fontSize: 14 }}
              onClick={() => { navigator.clipboard?.writeText(getMasterLink(master.id)); showToast('Ссылка скопирована!') }}>
              🔗 Скопировать ссылку на запись
            </button>
          </div>
          {bookings.length === 0 ? (
            <div className="empty-state"><div className="icon">📅</div><p>У вас пока нет записей</p></div>
          ) : (
            [...bookings].sort((a, b) => new Date(a.booking_time).getTime() - new Date(b.booking_time).getTime()).map(b => (
              <div key={b.id} className="booking-card" style={{ cursor: 'default' }}>
                <div className="booking-header">
                  <div className="booking-service">{b.service?.title}</div>
                  {b.is_cancelled ? (
                    <span className="admin-badge" style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}>Отменено</span>
                  ) : (
                    <span className={`admin-badge ${b.is_confirmed ? 'badge-confirmed' : 'badge-pending'}`}>
                      {b.is_confirmed ? 'Подтверждено' : 'Ожидает'}
                    </span>
                  )}
                </div>
                <div className="booking-details">
                  <strong>Клиент:</strong> {b.customer_name}{b.customer_tg_username ? ` (@${b.customer_tg_username})` : ''}<br />
                  <strong>Время:</strong> {formatDate(b.booking_time)}<br />
                  <strong>Цена:</strong> {b.service?.price} ₽
                </div>
                {!b.is_cancelled && (
                  <div className="booking-actions">
                    <button className="btn btn-sm btn-danger" onClick={() => handleCancelBooking(b.id)}>
                      ✕ Отменить запись
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {tab === 'services' && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ marginBottom: 12 }}>Мои услуги</h3>
          {ownServices.length === 0 ? (
            <div className="empty-state"><div className="icon">✂️</div><p>У вас пока нет услуг</p></div>
          ) : (
            ownServices.map(ms => {
              const price = ms.price || ms.service?.price
              const dur = ms.duration_minutes || ms.service?.duration_minutes
              return (
                <div key={ms.id} className="admin-item">
                  <div className="admin-item-info">
                    <h4>{ms.service?.title}</h4>
                    <span>{price} ₽ · {dur} мин</span>
                  </div>
                  <div className="admin-actions">
                    <button className="btn btn-sm btn-danger" onClick={() => handleRemoveService(ms.id)}>✕</button>
                  </div>
                </div>
              )
            })
          )}
          <details style={{ marginTop: 16 }}>
            <summary style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }}>➕ Добавить услугу</summary>
            <div style={{ marginTop: 12 }}>
              {services.filter(s => !isOwnServiceLinked(s.id)).map(s => (
                <div key={s.id} className="admin-item">
                  <div className="admin-item-info">
                    <h4 style={{ fontSize: 14 }}>{s.title}</h4>
                    <span style={{ fontSize: 12 }}>{s.price} ₽ · {s.duration_minutes} мин</span>
                  </div>
                  <div className="admin-actions">
                    <button className="btn btn-sm btn-success" onClick={() => handleAddService(s.id)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {tab === 'schedule' && (
        <div style={{ marginTop: 8 }}>
          <h3 style={{ marginBottom: 12 }}>Моё расписание</h3>
          {schedule.map((item, i) => (
            <div key={item.day_of_week} style={{
              display: 'flex', gap: 8, alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ minWidth: 90 }}>
                <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={item.is_working}
                    onChange={e => {
                      const next = [...schedule]
                      next[i] = { ...next[i], is_working: e.target.checked }
                      setSchedule(next)
                    }} />
                  {DAYS_FULL[item.day_of_week]}
                </label>
              </div>
              {item.is_working ? (
                <>
                  <input className="form-input" style={{ flex: 1, fontSize: 13, padding: '6px 8px' }}
                    type="time" value={item.start_time}
                    onChange={e => { const next = [...schedule]; next[i] = { ...next[i], start_time: e.target.value }; setSchedule(next) }} />
                  <span style={{ color: 'var(--text-dim)' }}>—</span>
                  <input className="form-input" style={{ flex: 1, fontSize: 13, padding: '6px 8px' }}
                    type="time" value={item.end_time}
                    onChange={e => { const next = [...schedule]; next[i] = { ...next[i], end_time: e.target.value }; setSchedule(next) }} />
                </>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Выходной</span>
              )}
            </div>
          ))}
          <button className="btn btn-primary" onClick={handleSaveSchedule} style={{ marginTop: 16 }}>
            💾 Сохранить расписание
          </button>
        </div>
      )}

      {tab === 'dates' && (
        <DatesView
          masterId={master.id}
          schedule={schedule}
          loadDateOverrides={loadDateOverrides}
        />
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}

// ——— Компонент календаря особых дат ———
const CALENDAR_DAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']

interface DatesViewProps {
  masterId: number
  schedule: ScheduleItem[]
  loadDateOverrides: () => Promise<void>
}

function DatesView({ masterId, schedule, loadDateOverrides }: DatesViewProps) {
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [overrides, setOverrides] = useState<DateOverride[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selIsWorking, setSelIsWorking] = useState(true)
  const [selIntervals, setSelIntervals] = useState<TimeInterval[]>([{ start: '10:00', end: '20:00' }])
  const [selNote, setSelNote] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  // Загружаем оверрайды на текущий месяц
  useEffect(() => {
    loadOverrides(calYear, calMonth)
  }, [calYear, calMonth])

  const loadOverrides = async (year: number, month: number) => {
    const data = await get<DateOverride[]>(
      `/masters/${masterId}/date-overrides?year=${year}&month=${month + 1}`
    ).catch(() => [])
    setOverrides(data)
  }

  // Получить оверрайд для даты
  const getOverride = (dateStr: string) => overrides.find(o => o.date === dateStr)

  // Клик по дню в календаре
  const handleDayClick = (day: number) => {
    const ym = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`
    const dateStr = `${ym}-${String(day).padStart(2, '0')}`
    setSelectedDate(dateStr)

    const existing = getOverride(dateStr)
    if (existing) {
      setSelIsWorking(existing.is_working)
      setSelNote(existing.note || '')
      if (existing.is_working && existing.working_intervals) {
        try {
          setSelIntervals(JSON.parse(existing.working_intervals))
        } catch {
          setSelIntervals([{ start: '10:00', end: '20:00' }])
        }
      } else {
        setSelIntervals([{ start: '10:00', end: '20:00' }])
      }
    } else {
      // Заполняем из расписания по дню недели
      const dow = new Date(calYear, calMonth, day).getDay()
      const mondayDow = dow === 0 ? 6 : dow - 1
      const schedItem = schedule.find(s => s.day_of_week === mondayDow)
      setSelIsWorking(schedItem?.is_working !== false)
      if (schedItem?.is_working && schedItem?.start_time && schedItem?.end_time) {
        setSelIntervals([{ start: schedItem.start_time, end: schedItem.end_time }])
      } else {
        setSelIntervals([{ start: '10:00', end: '20:00' }])
      }
      setSelNote('')
    }
  }

  // Заполнить из расписания
  const handleFillFromSchedule = () => {
    if (!selectedDate) return
    const d = new Date(selectedDate)
    const dow = d.getDay()
    const mondayDow = dow === 0 ? 6 : dow - 1
    const schedItem = schedule.find(s => s.day_of_week === mondayDow)
    if (schedItem?.is_working && schedItem?.start_time && schedItem?.end_time) {
      setSelIntervals([{ start: schedItem.start_time, end: schedItem.end_time }])
      setSelIsWorking(true)
    }
  }

  const handleSave = async () => {
    if (!selectedDate) return
    await put(`/masters/${masterId}/date-overrides`, {
      date: selectedDate,
      is_working: selIsWorking,
      working_intervals: selIsWorking && selIntervals.length > 0 ? JSON.stringify(selIntervals) : null,
      note: selNote || null,
    })
    showToast('Сохранено!')
    await loadOverrides(calYear, calMonth)
    await loadDateOverrides()
  }

  const handleDelete = async () => {
    if (!selectedDate) return
    const ov = getOverride(selectedDate)
    if (!ov) return
    await del(`/masters/${masterId}/date-overrides/${ov.id}`)
    showToast('Удалено')
    setSelectedDate(null)
    await loadOverrides(calYear, calMonth)
    await loadDateOverrides()
  }

  // Построение сетки календаря
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDay = new Date(calYear, calMonth, 1).getDay()
  // Сдвиг: ПН первый
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const weeks: (number | null)[][] = []
  let row: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) row.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d)
    if (row.length === 7) { weeks.push(row); row = [] }
  }
  if (row.length > 0) { while (row.length < 7) row.push(null); weeks.push(row) }

  return (
    <div style={{ marginTop: 8 }}>
      <h3 style={{ marginBottom: 8 }}>Особые даты</h3>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 12 }}>
        Нажмите на дату в календаре, чтобы настроить день.
      </p>

      {/* Навигация по месяцам */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button className="btn btn-sm btn-secondary" style={{ fontSize: 16, padding: '6px 12px' }}
          onClick={() => { if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11) } else setCalMonth(calMonth - 1) }}>
          ◀
        </button>
        <span style={{ fontWeight: 500, fontSize: 16 }}>{MONTHS_RU[calMonth]} {calYear}</span>
        <button className="btn btn-sm btn-secondary" style={{ fontSize: 16, padding: '6px 12px' }}
          onClick={() => { if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0) } else setCalMonth(calMonth + 1) }}>
          ▶
        </button>
      </div>

      {/* Сетка календаря */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {CALENDAR_DAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', padding: '4px 0' }}>
              {d}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
            {week.map((day, di) => {
              if (day === null) return <div key={di} />
              const ym = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`
              const dateStr = `${ym}-${String(day).padStart(2, '0')}`
              const ov = getOverride(dateStr)
              const isSelected = selectedDate === dateStr
              const isToday = dateStr === todayStr
              let bg = 'var(--card-bg)'
              let color = 'var(--text)'
              if (ov) {
                bg = ov.is_working ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.15)'
                color = ov.is_working ? '#27ae60' : '#e74c3c'
              }
              return (
                <div key={di} onClick={() => handleDayClick(day)}
                  style={{
                    textAlign: 'center', padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                    background: bg, color, fontWeight: isSelected || isToday ? 700 : 400,
                    border: isSelected ? '2px solid var(--accent)' : isToday ? '2px solid var(--border)' : '2px solid transparent',
                    fontSize: 14,
                  }}>
                  {day}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Форма редактирования даты */}
      {selectedDate && (
        <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h4 style={{ marginBottom: 12, fontSize: 15 }}>
            {selectedDate}
            {getOverride(selectedDate) && (
              <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 8, fontWeight: 400 }}>
                (редактирование)
              </span>
            )}
          </h4>
          <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" checked={selIsWorking} onChange={e => setSelIsWorking(e.target.checked)} />
            <span>Рабочий день</span>
          </label>

          {selIsWorking && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 500 }}>Время работы</label>
                <button className="btn btn-sm btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={handleFillFromSchedule}>
                  📅 Из расписания
                </button>
              </div>
              {selIntervals.map((interval, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <input className="form-input" style={{ flex: 1, fontSize: 13, padding: '8px', height: 44 }}
                    type="time" value={interval.start}
                    onChange={e => {
                      const next = [...selIntervals]
                      next[idx] = { ...next[idx], start: e.target.value }
                      setSelIntervals(next)
                    }} />
                  <span style={{ color: 'var(--text-dim)' }}>—</span>
                  <input className="form-input" style={{ flex: 1, fontSize: 13, padding: '8px', height: 44 }}
                    type="time" value={interval.end}
                    onChange={e => {
                      const next = [...selIntervals]
                      next[idx] = { ...next[idx], end: e.target.value }
                      setSelIntervals(next)
                    }} />
                  {selIntervals.length > 1 && (
                    <button className="btn btn-sm btn-danger" style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => setSelIntervals(selIntervals.filter((_, i) => i !== idx))}>✕</button>
                  )}
                </div>
              ))}
              <button className="btn btn-sm btn-secondary" style={{ fontSize: 12, marginTop: 4 }}
                onClick={() => setSelIntervals([...selIntervals, { start: '10:00', end: '20:00' }])}>
                ➕ Добавить интервал
              </button>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13 }}>Примечание</label>
            <input className="form-input" style={{ height: 44 }}
              placeholder="Например: сегодня только стрижки" value={selNote}
              onChange={e => setSelNote(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSave}>
              💾 Сохранить
            </button>
            {getOverride(selectedDate) && (
              <button className="btn btn-danger" onClick={handleDelete}>
                ✕ Удалить
              </button>
            )}
          </div>
        </div>
      )}

      {/* Список особых дат */}
      {overrides.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <h4 style={{ fontSize: 14, marginBottom: 8 }}>Все особые даты в этом месяце</h4>
          {overrides.map(o => {
            let intervalsText = ''
            if (o.is_working && o.working_intervals) {
              try {
                const intervals = JSON.parse(o.working_intervals)
                intervalsText = intervals.map((i: TimeInterval) => `${i.start}–${i.end}`).join(', ')
              } catch {}
            }
            return (
              <div key={o.id} className="admin-item" style={{ cursor: 'pointer' }} onClick={() => {
                setSelectedDate(o.date)
                setSelIsWorking(o.is_working)
                setSelNote(o.note || '')
                if (o.is_working && o.working_intervals) {
                  try { setSelIntervals(JSON.parse(o.working_intervals)) } catch { setSelIntervals([{ start: '10:00', end: '20:00' }]) }
                } else { setSelIntervals([{ start: '10:00', end: '20:00' }]) }
              }}>
                <div className="admin-item-info">
                  <h4 style={{ fontSize: 14 }}>{o.date}</h4>
                  <span style={{ fontSize: 12 }}>
                    {o.is_working
                      ? (intervalsText ? `✅ ${intervalsText}` : '✅ Рабочий день')
                      : '❌ Выходной'
                    }
                    {o.note ? ` · ${o.note}` : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
