import { useState, useEffect, useCallback } from 'react'
import { get, post, put, del } from '../api'
import type { Master, Service, Booking, BotInfo, InviteLinkResponse, ScheduleItem, MasterService } from '../types'
import Toast from './Toast'

const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

interface AdminPanelProps {
  onBack: () => void
}

export default function AdminPanel({ onBack }: AdminPanelProps) {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [tab, setTab] = useState('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Инвайт
  const [inviteLink, setInviteLink] = useState('')
  const [inviteLinkDirect, setInviteLinkDirect] = useState('')
  const [inviteLinkTg, setInviteLinkTg] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  // Редактирование мастера
  const [editingMaster, setEditingMaster] = useState<Master | null>(null)
  const [editTgId, setEditTgId] = useState('')

  // Услуги мастера
  const [editMasterServices, setEditMasterServices] = useState<Master | null>(null)
  const [editMasterServicesData, setEditMasterServicesData] = useState<MasterService[]>([])

  // Расписание мастера
  const [editMasterSchedule, setEditMasterSchedule] = useState<Master | null>(null)
  const [editMasterScheduleData, setEditMasterScheduleData] = useState<ScheduleItem[]>([])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  const loadData = useCallback(async () => {
    const [b, m, sv, bi] = await Promise.all([
      get<Booking[]>('/admin/bookings').catch(() => []),
      get<Master[]>('/admin/masters').catch(() => []),
      get<Service[]>('/admin/services').catch(() => []),
      get<BotInfo>('/admin/bot-info').catch(() => null),
    ])
    setBookings(b)
    setMasters(m)
    setServices(sv)
    if (bi) setBotInfo(bi)
  }, [])

  const handleLogin = async () => {
    try {
      const res = await post<{ access_token: string }>('/admin/login', { password: pass })
      if (res.access_token) {
        setAuthed(true)
        loadData()
      }
    } catch {
      showToast('Неверный пароль')
    }
  }

  const confirmBooking = async (id: number) => {
    await put(`/admin/bookings/${id}/confirm`)
    showToast('Запись подтверждена')
    loadData()
  }

  const deleteBooking = async (id: number) => {
    await del(`/admin/bookings/${id}`)
    showToast('Запись удалена')
    loadData()
  }

  const deleteMaster = async (id: number) => {
    await del(`/admin/masters/${id}`)
    showToast('Мастер удалён')
    loadData()
  }

  const deleteSvc = async (id: number) => {
    await del(`/admin/services/${id}`)
    showToast('Услуга удалена')
    loadData()
  }

  const openEditMaster = (m: Master) => {
    setEditingMaster(m)
    setEditTgId(String(m.telegram_id || ''))
  }

  const saveEditMaster = async () => {
    if (!editingMaster) return
    const tgId = editTgId ? parseInt(editTgId, 10) : null
    await put(`/admin/masters/${editingMaster.id}`, { telegram_id: tgId })
    setEditingMaster(null)
    showToast('Сохранено')
    loadData()
  }

  const handleCreateInviteLink = async () => {
    setInviteLoading(true)
    try {
      const res = await post<InviteLinkResponse>('/admin/invite-link')
      setInviteLinkDirect(res.direct_url)
      setInviteLinkTg(res.telegram_url || '')
      setInviteLink(res.telegram_url || res.direct_url)
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
    setInviteLoading(false)
  }

  const openEditMasterServices = async (master: Master) => {
    setEditMasterServices(master)
    const data = await get<MasterService[]>(`/masters/${master.id}/services`).catch(() => [])
    setEditMasterServicesData(data)
  }

  const handleAdminLinkService = async (serviceId: number) => {
    if (!editMasterServices) return
    await post(`/admin/masters/${editMasterServices.id}/services`, { service_id: serviceId })
    showToast('Услуга добавлена мастеру')
    const data = await get<MasterService[]>(`/masters/${editMasterServices.id}/services`).catch(() => [])
    setEditMasterServicesData(data)
  }

  const handleAdminUnlinkService = async (msId: number) => {
    if (!editMasterServices) return
    await del(`/admin/masters/${editMasterServices.id}/services/${msId}`)
    showToast('Услуга отвязана')
    const data = await get<MasterService[]>(`/masters/${editMasterServices.id}/services`).catch(() => [])
    setEditMasterServicesData(data)
  }

  const openEditMasterSchedule = async (master: Master) => {
    setEditMasterSchedule(master)
    const data = await get<ScheduleItem[]>(`/masters/${master.id}/schedule`).catch(() => [])
    setEditMasterScheduleData(data.length ? data : getDefaultSchedule())
  }

  const handleAdminSaveSchedule = async () => {
    if (!editMasterSchedule) return
    try {
      await put(`/masters/${editMasterSchedule.id}/schedule`, { schedule: editMasterScheduleData })
      showToast('Расписание сохранено')
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const getDefaultSchedule = (): ScheduleItem[] => [
    { day_of_week: 0, is_working: true, start_time: "10:00", end_time: "20:00" },
    { day_of_week: 1, is_working: true, start_time: "10:00", end_time: "20:00" },
    { day_of_week: 2, is_working: true, start_time: "10:00", end_time: "20:00" },
    { day_of_week: 3, is_working: true, start_time: "10:00", end_time: "20:00" },
    { day_of_week: 4, is_working: true, start_time: "10:00", end_time: "20:00" },
    { day_of_week: 5, is_working: true, start_time: "10:00", end_time: "18:00" },
    { day_of_week: 6, is_working: false, start_time: "10:00", end_time: "18:00" },
  ]

  const getMasterLink = (masterId: number) =>
    window.location.origin + window.location.pathname + `#master/${masterId}`

  const isServiceLinked = (serviceId: number) =>
    editMasterServicesData.some(ms => ms.service_id === serviceId)

  if (!authed) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-logo">💈</div>
          <h1>Барбершоп</h1>
          <p className="header-sub">Панель управления</p>
        </header>
        <div className="admin-login">
          <h2>Вход в админку</h2>
          <p>Введите пароль для доступа к управлению</p>
          <div className="form-group">
            <input className="form-input" type="password" placeholder="Пароль"
              value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <button className="btn btn-primary" onClick={handleLogin}>Войти</button>
        </div>
        <Toast message={toast} onClose={() => setToast(null)} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">💈</div>
        <h1>Барбершоп</h1>
        <p className="header-sub">Панель управления</p>
      </header>

      <button className="back-btn" onClick={() => { setAuthed(false); setPass(''); onBack() }} style={{ marginTop: 8 }}>
        ← Выйти
      </button>

      <div className="summary" style={{ marginBottom: 16, padding: 12, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>🤖 Webhook: {!botInfo?.has_bot_token ? '⚠️ нет BOT_TOKEN' : 'настроен'}</span>
          <button className="btn btn-sm btn-secondary"
            onClick={async () => {
              try {
                const res = await post<{ webhook_url: string }>('/admin/setup-webhook')
                showToast('✅ Webhook настроен: ' + (res.webhook_url || '').slice(0, 40) + '...')
              } catch (e: any) { showToast('❌ Ошибка: ' + e.message) }
            }}>
            🔄 Настроить webhook заново
          </button>
        </div>
      </div>

      <nav className="nav-tabs" style={{ marginTop: 8 }}>
        {[{ key: 'bookings', label: 'Записи' }, { key: 'masters', label: 'Мастера' }, { key: 'services', label: 'Услуги' }]
          .map(t => (
            <button key={t.key} className={`nav-tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
      </nav>

      {tab === 'bookings' && (
        <div className="admin-section">
          {bookings.length === 0 ? (
            <div className="empty-state"><div className="icon">📋</div><p>Нет записей</p></div>
          ) : (
            bookings.map(b => (
              <div key={b.id} className="booking-card">
                <div className="booking-header">
                  <div>
                    <div className="booking-service">{b.service?.title}</div>
                    {b.is_cancelled ? (
                      <span className="admin-badge" style={{ background: 'rgba(231,76,60,0.15)', color: '#e74c3c' }}>Отменено</span>
                    ) : (
                      <span className={`admin-badge ${b.is_confirmed ? 'badge-confirmed' : 'badge-pending'}`}>
                        {b.is_confirmed ? 'Подтверждено' : 'Ожидает'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="booking-details">
                  {b.customer_name}{b.customer_tg_username ? ` (@${b.customer_tg_username})` : ''} · {b.customer_phone || 'без телефона'}<br />
                  {b.master?.name} · {new Date(b.booking_time).toLocaleString('ru-RU')}
                </div>
                <div className="booking-actions">
                  {!b.is_cancelled && !b.is_confirmed && (
                    <button className="btn btn-sm btn-success" onClick={() => confirmBooking(b.id)}>✓ Подтвердить</button>
                  )}
                  <button className="btn btn-sm btn-danger" onClick={() => deleteBooking(b.id)}>✕ Удалить</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'masters' && (
        <div className="admin-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Мастера</h3>
            <button className="btn btn-sm btn-primary" onClick={handleCreateInviteLink} disabled={inviteLoading}>
              {inviteLoading ? '...' : '➕ Добавить'}
            </button>
          </div>

          {inviteLink && (
            <div className="summary" style={{ marginBottom: 16, fontSize: 14 }}>
              <p style={{ marginBottom: 8, fontWeight: 500 }}>🔗 Отправьте мастеру (самый надёжный способ):</p>
              {inviteLinkTg && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                    Telegram: мастер нажимает → открывается чат с ботом → кнопка «Стать мастером»:
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input className="form-input" style={{ flex: 1, fontSize: 12 }} readOnly value={inviteLinkTg} />
                    <button className="btn btn-sm btn-secondary"
                      onClick={() => { navigator.clipboard?.writeText(inviteLinkTg); showToast('Ссылка скопирована!') }}>
                      📋
                    </button>
                  </div>
                </div>
              )}
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                  Прямая ссылка (если нет Telegram или хотите в браузере):
                </label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" style={{ flex: 1, fontSize: 12 }} readOnly value={inviteLinkDirect} />
                  <button className="btn btn-sm btn-secondary"
                    onClick={() => { navigator.clipboard?.writeText(inviteLinkDirect); showToast('Ссылка скопирована!') }}>
                    📋
                  </button>
                </div>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 4 }}>
                💡 Как это работает: мастер нажимает ссылку → пишет боту <code>/start</code> → бот присылает кнопку → открывается Mini App → регистрация.
              </p>
            </div>
          )}

          {masters.length === 0 ? (
            <div className="empty-state"><div className="icon">👨‍💼</div><p>Нет мастеров</p></div>
          ) : (
            masters.map(m => (
              <div key={m.id} className="admin-item">
                <div className="admin-item-info">
                  <h4>{m.name} (ID: {m.id})</h4>
                  <span>{m.role}</span>
                  {m.telegram_id ? (
                    <><br /><small style={{ color: 'var(--success)' }}>TG ID: {m.telegram_id}</small></>
                  ) : m.tg_username ? (
                    <><br /><small style={{ color: 'var(--accent)' }}>TG: @{m.tg_username}</small></>
                  ) : (
                    <><br /><small style={{ color: 'var(--text-dim)' }}>TG не привязан</small></>
                  )}
                  <br /><small style={{ color: 'var(--accent)' }}>🔗 {getMasterLink(m.id)}</small>
                </div>
                <div className="admin-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEditMaster(m)} title="Изменить Telegram ID">✏️</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEditMasterServices(m)} title="Услуги мастера">🛠</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEditMasterSchedule(m)} title="Расписание">📅</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteMaster(m.id)}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'services' && (
        <div className="admin-section">
          {services.length === 0 ? (
            <div className="empty-state"><div className="icon">✂️</div><p>Нет услуг</p></div>
          ) : (
            services.map(s => (
              <div key={s.id} className="admin-item">
                <div className="admin-item-info">
                  <h4>{s.title}</h4>
                  <span>{s.price} ₽ · {s.duration_minutes} мин</span>
                </div>
                <div className="admin-actions">
                  <button className="btn btn-sm btn-danger" onClick={() => deleteSvc(s.id)}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Модалка: Telegram ID мастера */}
      {editingMaster && (
        <div className="modal-overlay" onClick={() => setEditingMaster(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Редактировать: {editingMaster.name}</h3>
            <div className="form-group">
              <label>Telegram ID</label>
              <input className="form-input" type="number" placeholder="123456789"
                value={editTgId} onChange={e => setEditTgId(e.target.value)} />
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
              Как узнать ID: напишите боту <code>/start</code> → откройте<br />
              <code style={{ color: 'var(--accent)' }}>api.telegram.org/botТОКЕН/getUpdates</code>
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={saveEditMaster}>Сохранить</button>
              <button className="btn btn-secondary" onClick={() => setEditingMaster(null)}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка: услуги мастера */}
      {editMasterServices && (
        <div className="modal-overlay" onClick={() => setEditMasterServices(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Услуги: {editMasterServices.name}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>
              Отметьте услуги, которые оказывает этот мастер
            </p>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
              {services.map(s => (
                <div key={s.id} className="admin-item" style={{ padding: '8px 0' }}>
                  <div className="admin-item-info">
                    <h4 style={{ fontSize: 14, margin: 0 }}>{isServiceLinked(s.id) ? '✅ ' : ''}{s.title}</h4>
                    <span style={{ fontSize: 12 }}>{s.price} ₽ · {s.duration_minutes} мин</span>
                  </div>
                  <div className="admin-actions">
                    {isServiceLinked(s.id) ? (
                      <button className="btn btn-sm btn-danger" onClick={() => {
                        const ms = editMasterServicesData.find(x => x.service_id === s.id)
                        if (ms) handleAdminUnlinkService(ms.id)
                      }}>✕</button>
                    ) : (
                      <button className="btn btn-sm btn-success" onClick={() => handleAdminLinkService(s.id)}>+</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={() => setEditMasterServices(null)}>Закрыть</button>
          </div>
        </div>
      )}

      {/* Модалка: расписание мастера */}
      {editMasterSchedule && (
        <div className="modal-overlay" onClick={() => setEditMasterSchedule(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <h3>Расписание: {editMasterSchedule.name}</h3>
            {editMasterScheduleData.map((item, i) => (
              <div key={item.day_of_week} style={{
                display: 'flex', gap: 8, alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ minWidth: 100 }}>
                  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="checkbox" checked={item.is_working}
                      onChange={e => {
                        const next = [...editMasterScheduleData]
                        next[i] = { ...next[i], is_working: e.target.checked }
                        setEditMasterScheduleData(next)
                      }} />
                    {DAYS_FULL[item.day_of_week]}
                  </label>
                </div>
                {item.is_working ? (
                  <>
                    <input className="form-input" style={{ flex: 1, fontSize: 13, padding: '6px 8px' }}
                      type="time" value={item.start_time}
                      onChange={e => { const next = [...editMasterScheduleData]; next[i] = { ...next[i], start_time: e.target.value }; setEditMasterScheduleData(next) }} />
                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                    <input className="form-input" style={{ flex: 1, fontSize: 13, padding: '6px 8px' }}
                      type="time" value={item.end_time}
                      onChange={e => { const next = [...editMasterScheduleData]; next[i] = { ...next[i], end_time: e.target.value }; setEditMasterScheduleData(next) }} />
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Выходной</span>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => { handleAdminSaveSchedule(); setEditMasterSchedule(null) }}>
                Сохранить
              </button>
              <button className="btn btn-secondary" onClick={() => setEditMasterSchedule(null)}>Закрыть</button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
