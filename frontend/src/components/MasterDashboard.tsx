import { useEffect, useState, useRef, useCallback } from 'react'
import { get, post as apiPost, put, del } from '../api'
import type { Master, Booking, Service, MasterService, ScheduleItem, DateOverride, DateOverrideForm as DOForm } from '../types'
import Toast from './Toast'
import { MONTHS_RU_GEN } from './CalendarWidget'

const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

interface MasterDashboardProps {
  master: Master
  masters: Master[]
  services: Service[]
  tgUser: { id: number; username?: string; first_name?: string } | null
  onLogout: () => void
}

export default function MasterDashboard({ master, masters, services, tgUser, onLogout }: MasterDashboardProps) {
  const [tab, setTab] = useState('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [ownServices, setOwnServices] = useState<MasterService[]>([])
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [dateOverrides, setDateOverrides] = useState<DateOverride[]>([])
  const [dateForm, setDateForm] = useState<DOForm>({ date: '', is_working: true, max_bookings: 999, note: '' })
  const [toast, setToast] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
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
      })
      showToast('Telegram привязан! Теперь вы будете получать уведомления.')
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/masters/${master.id}/photo`, { method: 'PUT', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || 'Ошибка загрузки')
      }
      showToast('✅ Фото обновлено!')
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
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

  const handleSaveDateOverride = async () => {
    if (!dateForm.date) return
    try {
      await put(`/masters/${master.id}/date-overrides`, {
        date: dateForm.date,
        is_working: dateForm.is_working,
        max_bookings: dateForm.is_working ? dateForm.max_bookings : 999,
        note: dateForm.note || null,
      })
      showToast('Дата сохранена!')
      setDateForm({ date: '', is_working: true, max_bookings: 999, note: '' })
      loadDateOverrides()
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const handleDeleteDateOverride = async (overrideId: number) => {
    await del(`/masters/${master.id}/date-overrides/${overrideId}`)
    showToast('Особая дата удалена')
    loadDateOverrides()
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
        <div className="master-avatar-wrapper" onClick={() => photoInputRef.current?.click()}>
          {master.photo_url && !imgLoadFailed ? (
            <img src={master.photo_url} alt={master.name} className="master-avatar-img"
              onError={() => setImgLoadFailed(true)} />
          ) : (
            <div className="master-avatar-placeholder">
              {master.name[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="master-avatar-overlay">{uploadingPhoto ? '⏳' : '📷'}</div>
        </div>
        <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={handlePhotoUpload} />
        <div className="master-photo-hint">Нажмите на фото для загрузки</div>
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
        <div style={{ marginTop: 8 }}>
          <h3 style={{ marginBottom: 8 }}>Особые даты</h3>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 16 }}>
            Можно указать, что в определённый день вы не работаете или принимаете ограниченное число клиентов.
          </p>
          <div className="date-override-card">
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Дата</label>
              <input className="form-input" style={{ height: 48 }} type="date"
                value={dateForm.date}
                onChange={e => setDateForm({ ...dateForm, date: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <label className="checkbox-label">
                <input type="checkbox" checked={dateForm.is_working}
                  onChange={e => setDateForm({ ...dateForm, is_working: e.target.checked })} />
                Рабочий день
              </label>
            </div>
            {dateForm.is_working && (
              <div className="form-group" style={{ marginBottom: 12 }}>
                <label>Макс. записей</label>
                <input className="form-input" style={{ height: 48 }} type="number" min="1" max="999"
                  placeholder="999 — без лимита" value={dateForm.max_bookings}
                  onChange={e => setDateForm({ ...dateForm, max_bookings: parseInt(e.target.value) || 999 })} />
              </div>
            )}
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Примечание (необязательно)</label>
              <input className="form-input" style={{ height: 48 }}
                placeholder="Например: только 1 запись" value={dateForm.note}
                onChange={e => setDateForm({ ...dateForm, note: e.target.value })} />
            </div>
            <button className="btn btn-primary" onClick={handleSaveDateOverride} disabled={!dateForm.date}>
              💾 Сохранить
            </button>
          </div>
          {dateOverrides.length === 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>Особых дат пока нет</p>
          ) : (
            dateOverrides.map(o => (
              <div key={o.id} className="admin-item">
                <div className="admin-item-info">
                  <h4>{o.date}</h4>
                  <span>{o.is_working ? `✅ Рабочий день · макс ${o.max_bookings} записей` : '❌ Выходной'}{o.note ? ` · ${o.note}` : ''}</span>
                </div>
                <div className="admin-actions">
                  <button className="btn btn-sm btn-danger" onClick={() => handleDeleteDateOverride(o.id)}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
