import { useEffect, useState } from 'react'
import { get, post, put, del } from './api'
import './App.css'

function App() {
  const [tg, setTg] = useState(null)
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tgUser, setTgUser] = useState(null)

  // Состояние бронирования
  const [step, setStep] = useState('masters')
  const [masters, setMasters] = useState([])
  const [services, setServices] = useState([])
  const [selectedMaster, setSelectedMaster] = useState(null)
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [slots, setSlots] = useState([])

  // Мастер (просмотр записей)
  const [masterLoggedIn, setMasterLoggedIn] = useState(false)
  const [masterViewMaster, setMasterViewMaster] = useState(null)
  const [masterBookings, setMasterBookings] = useState([])
  const [masterLoginId, setMasterLoginId] = useState('')
  const [masterLoginError, setMasterLoginError] = useState('')

  // Админка
  const [isAdmin, setIsAdmin] = useState(window.location.hash === '#admin')
  const [adminAuthed, setAdminAuthed] = useState(false)
  const [adminPass, setAdminPass] = useState('')
  const [adminTab, setAdminTab] = useState('bookings')
  const [adminStats, setAdminStats] = useState(null)
  const [adminBookings, setAdminBookings] = useState([])
  const [adminMasters, setAdminMasters] = useState([])
  const [adminServices, setAdminServices] = useState([])
  const [editingMaster, setEditingMaster] = useState(null)
  const [editTgId, setEditTgId] = useState('')

  // Секретный вход в админку
  const [tapCount, setTapCount] = useState(0)
  const [tapTimer, setTapTimer] = useState(null)

  // Ссылка на конкретного мастера (#master/3)
  const [preselectMasterId, setPreselectMasterId] = useState(null)

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      const app = window.Telegram.WebApp
      app.ready()
      setTg(app)
      setTgUser(app.initDataUnsafe?.user || null)
    }

    // Разбор хэша
    const hash = window.location.hash
    if (hash.startsWith('#master/')) {
      const id = parseInt(hash.split('/')[1], 10)
      if (!isNaN(id)) setPreselectMasterId(id)
    }

    Promise.all([
      get('/masters/').catch(() => []),
      get('/services/').catch(() => []),
    ]).then(([m, s]) => {
      setMasters(m)
      setServices(s)

      // Если есть предвыбор мастера по ссылке — сразу выбираем
      const hash = window.location.hash
      if (hash.startsWith('#master/')) {
        const id = parseInt(hash.split('/')[1], 10)
        if (!isNaN(id)) {
          const master = m.find(m => m.id === id)
          if (master) {
            setSelectedMaster(master)
            setStep('services')
          }
        }
      }

      setLoading(false)
    })

    const onHash = () => setIsAdmin(window.location.hash === '#admin')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const resetBooking = () => {
    setStep('masters')
    setSelectedMaster(null)
    setSelectedService(null)
    setSelectedDate(null)
    setSelectedSlot(null)
    setSlots([])
  }

  // 5 тапов по шапке → админка
  const handleHeaderTap = () => {
    const newCount = tapCount + 1
    setTapCount(newCount)
    if (tapTimer) clearTimeout(tapTimer)
    if (newCount >= 5) {
      setTapCount(0)
      window.location.hash = 'admin'
      setIsAdmin(true)
      return
    }
    setTapTimer(setTimeout(() => setTapCount(0), 1500))
  }

  // ===== БРОНИРОВАНИЕ =====

  const handleSelectMaster = (master) => {
    setSelectedMaster(master)
    setStep('services')
  }

  const handleSelectService = (service) => {
    setSelectedService(service)
    setStep('datetime')
  }

  const handleSelectDate = async (dateStr) => {
    setSelectedDate(dateStr)
    setSelectedSlot(null)
    if (selectedMaster) {
      const data = await get(`/bookings/available-slots/${selectedMaster.id}/${dateStr}`).catch(() => ({ slots: [] }))
      setSlots(data.slots || [])
    }
  }

  const handleSubmitBooking = async () => {
    if (!selectedSlot) return
    const [h, m] = selectedSlot.split(':')
    const dt = new Date(selectedDate + 'T' + h + ':' + m + ':00')

    const firstName = tgUser?.first_name || tgUser?.username || 'Клиент'
    const username = tgUser?.username || null

    try {
      await post('/bookings/', {
        master_id: selectedMaster.id,
        service_id: selectedService.id,
        customer_name: firstName,
        customer_phone: null,
        customer_tg_username: username,
        booking_time: dt.toISOString(),
      })
      setStep('confirmation')
    } catch (e) {
      showToast('Ошибка: ' + e.message)
    }
  }

  // ===== ВХОД МАСТЕРА =====
  // Проверяем, может текущий Telegram user — мастер (по telegram_id)
  const getAutoMaster = () => {
    if (!tgUser?.id || masters.length === 0) return null
    return masters.find(m => m.telegram_id === tgUser.id) || null
  }

  const handleMasterLogin = () => {
    const id = parseInt(masterLoginId, 10)
    if (isNaN(id)) {
      setMasterLoginError('Введите ID мастера (число)')
      return
    }
    const master = masters.find(m => m.id === id)
    if (!master) {
      setMasterLoginError('Мастер с таким ID не найден')
      return
    }
    // Успешный вход
    setMasterLoggedIn(true)
    setMasterViewMaster(master)
    loadMasterBookings(master.id)
    setMasterLoginError('')
  }

  const loadMasterBookings = async (masterId) => {
    const bookings = await get(`/bookings/master/${masterId}`).catch(() => [])
    setMasterBookings(bookings)
  }

  const logoutMaster = () => {
    setMasterLoggedIn(false)
    setMasterViewMaster(null)
    setMasterBookings([])
    setMasterLoginId('')
    setStep('masters')
  }

  // ===== АДМИНКА =====

  const handleAdminLogin = async () => {
    try {
      const res = await post('/admin/login', { password: adminPass })
      if (res.access_token) {
        setAdminAuthed(true)
        loadAdminData()
      }
    } catch {
      showToast('Неверный пароль')
    }
  }

  const loadAdminData = async () => {
    const [s, b, m, sv] = await Promise.all([
      get('/admin/stats').catch(() => null),
      get('/admin/bookings').catch(() => []),
      get('/admin/masters').catch(() => []),
      get('/admin/services').catch(() => []),
    ])
    if (s) setAdminStats(s)
    setAdminBookings(b)
    setAdminMasters(m)
    setAdminServices(sv)
  }

  const confirmBooking = async (id) => {
    await put(`/admin/bookings/${id}/confirm`)
    showToast('Запись подтверждена')
    loadAdminData()
  }

  const deleteBooking = async (id) => {
    await del(`/admin/bookings/${id}`)
    showToast('Запись удалена')
    loadAdminData()
  }

  const deleteMaster = async (id) => {
    await del(`/admin/masters/${id}`)
    showToast('Мастер удалён')
    loadAdminData()
  }

  const deleteSvc = async (id) => {
    await del(`/admin/services/${id}`)
    showToast('Услуга удалена')
    loadAdminData()
  }

  const openEditMaster = (m) => {
    setEditingMaster(m)
    setEditTgId(String(m.telegram_id || ''))
  }

  const saveEditMaster = async () => {
    if (!editingMaster) return
    const tgId = editTgId ? parseInt(editTgId, 10) : null
    await put(`/admin/masters/${editingMaster.id}`, { telegram_id: tgId })
    setEditingMaster(null)
    showToast('Сохранено')
    loadAdminData()
  }

  // ===== УТИЛИТЫ =====

  const getDates = () => {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      return {
        dateStr: d.toISOString().slice(0, 10),
        dayName: days[d.getDay()],
        dayNum: d.getDate(),
        month: months[d.getMonth()],
      }
    })
  }

  const formatBookingDate = (iso) => {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'long', weekday: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  // Получаем ссылку на мастера (для копирования)
  const getMasterLink = (masterId) => {
    const url = window.location.origin + window.location.pathname + `#master/${masterId}`
    return url
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner" />
          Загрузка...
        </div>
      </div>
    )
  }

  // ===== АДМИНКА =====
  if (isAdmin) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-logo">💈</div>
          <h1>Барбершоп</h1>
          <p className="header-sub">Панель управления</p>
          {!adminAuthed && (
            <p className="welcome">
              <a href="#" onClick={(e) => { e.preventDefault(); window.location.hash = ''; setIsAdmin(false) }}>
                ← Вернуться к записи
              </a>
            </p>
          )}
        </header>

        {!adminAuthed ? (
          <div className="admin-login">
            <h2>Вход в админку</h2>
            <p>Введите пароль для доступа к управлению</p>
            <div className="form-group">
              <input
                className="form-input"
                type="password"
                placeholder="Пароль"
                value={adminPass}
                onChange={e => setAdminPass(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
              />
            </div>
            <button className="btn btn-primary" onClick={handleAdminLogin}>
              Войти
            </button>
          </div>
        ) : (
          <>
            <button className="back-btn" onClick={() => { setAdminAuthed(false); setAdminPass(''); }} style={{ marginTop: 8 }}>
              ← Выйти
            </button>

            {adminStats && (
              <div className="admin-stats">
                <div className="stat-card">
                  <div className="stat-num">{adminStats.total_bookings}</div>
                  <div className="stat-label">Всего записей</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num">{adminStats.confirmed_bookings}</div>
                  <div className="stat-label">Подтверждено</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num">{adminStats.pending_bookings}</div>
                  <div className="stat-label">Ожидают</div>
                </div>
                <div className="stat-card">
                  <div className="stat-num">{adminStats.total_masters}</div>
                  <div className="stat-label">Мастера</div>
                </div>
              </div>
            )}

            <nav className="nav-tabs" style={{ marginTop: 8 }}>
              {[
                { key: 'bookings', label: 'Записи' },
                { key: 'masters', label: 'Мастера' },
                { key: 'services', label: 'Услуги' },
              ].map(t => (
                <button
                  key={t.key}
                  className={`nav-tab ${adminTab === t.key ? 'active' : ''}`}
                  onClick={() => setAdminTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {adminTab === 'bookings' && (
              <div className="admin-section">
                {adminBookings.length === 0 ? (
                  <div className="empty-state"><div className="icon">📋</div><p>Нет записей</p></div>
                ) : (
                  adminBookings.map(b => (
                    <div key={b.id} className="booking-card">
                      <div className="booking-header">
                        <div>
                          <div className="booking-service">{b.service?.title}</div>
                          <span className={`admin-badge ${b.is_confirmed ? 'badge-confirmed' : 'badge-pending'}`}>
                            {b.is_confirmed ? 'Подтверждено' : 'Ожидает'}
                          </span>
                        </div>
                      </div>
                      <div className="booking-details">
                        {b.customer_name}{b.customer_tg_username ? ` (@${b.customer_tg_username})` : ''} · {b.customer_phone || 'без телефона'}<br />
                        {b.master?.name} · {new Date(b.booking_time).toLocaleString('ru-RU')}
                      </div>
                      <div className="booking-actions">
                        {!b.is_confirmed && (
                          <button className="btn btn-sm btn-success" onClick={() => confirmBooking(b.id)}>
                            ✓ Подтвердить
                          </button>
                        )}
                        <button className="btn btn-sm btn-danger" onClick={() => deleteBooking(b.id)}>
                          ✕ Удалить
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {adminTab === 'masters' && (
              <div className="admin-section">
                <h3>Мастера</h3>
                {adminMasters.length === 0 ? (
                  <div className="empty-state"><div className="icon">👨‍💼</div><p>Нет мастеров</p></div>
                ) : (
                  adminMasters.map(m => (
                    <div key={m.id} className="admin-item">
                      <div className="admin-item-info">
                        <h4>{m.name} (ID: {m.id})</h4>
                        <span>{m.role}{m.telegram_id ? ' · TG ID: ' + m.telegram_id : ' · TG не привязан'}</span>
                        <br />
                        <small style={{ color: 'var(--accent)' }}>
                          🔗 {getMasterLink(m.id)}
                        </small>
                      </div>
                      <div className="admin-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditMaster(m)} style={{ marginRight: 6 }}>
                          ✏️ TG
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => deleteMaster(m.id)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {adminTab === 'services' && (
              <div className="admin-section">
                {adminServices.length === 0 ? (
                  <div className="empty-state"><div className="icon">✂️</div><p>Нет услуг</p></div>
                ) : (
                  adminServices.map(s => (
                    <div key={s.id} className="admin-item">
                      <div className="admin-item-info">
                        <h4>{s.title}</h4>
                        <span>{s.price} ₽ · {s.duration_minutes} мин</span>
                      </div>
                      <div className="admin-actions">
                        <button className="btn btn-sm btn-danger" onClick={() => deleteSvc(s.id)}>
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Модалка редактирования мастера */}
            {editingMaster && (
              <div className="modal-overlay" onClick={() => setEditingMaster(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <h3>Редактировать: {editingMaster.name}</h3>
                  <div className="form-group">
                    <label>Telegram ID (для отправки уведомлений)</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="123456789"
                      value={editTgId}
                      onChange={e => setEditTgId(e.target.value)}
                    />
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
                    Как узнать ID: напишите боту /start → откройте<br />
                    <code style={{ color: 'var(--accent)' }}>api.telegram.org/botТОКЕН/getUpdates</code><br />
                    найдите "chat": {'{'}"id": 123456789{'}'}
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={saveEditMaster}>Сохранить</button>
                    <button className="btn btn-secondary" onClick={() => setEditingMaster(null)}>Отмена</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  // ===== ДАШБОРД МАСТЕРА (после входа) =====
  if (masterLoggedIn && masterViewMaster) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-logo">💈</div>
          <h1>{masterViewMaster.name}</h1>
          <p className="header-sub">{masterViewMaster.role} — мои записи</p>
        </header>

        <button className="back-btn" onClick={logoutMaster}>
          ← Выйти
        </button>

        {/* Кнопка копирования ссылки на мастера */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button
            className="btn btn-secondary"
            style={{ display: 'inline-block', width: 'auto', padding: '8px 20px', fontSize: 14 }}
            onClick={() => {
              navigator.clipboard?.writeText(getMasterLink(masterViewMaster.id))
              showToast('Ссылка скопирована!')
            }}
          >
            🔗 Скопировать ссылку на запись
          </button>
        </div>

        {masterBookings.length === 0 ? (
          <div className="empty-state"><div className="icon">📅</div><p>У вас пока нет записей</p></div>
        ) : (
          [...masterBookings]
            .sort((a, b) => new Date(a.booking_time) - new Date(b.booking_time))
            .map(b => (
              <div key={b.id} className="booking-card" style={{ cursor: 'default' }}>
                <div className="booking-header">
                  <div className="booking-service">{b.service?.title}</div>
                  <span className={`admin-badge ${b.is_confirmed ? 'badge-confirmed' : 'badge-pending'}`}>
                    {b.is_confirmed ? 'Подтверждено' : 'Ожидает'}
                  </span>
                </div>
                <div className="booking-details">
                  <strong>Клиент:</strong> {b.customer_name}{b.customer_tg_username ? ` (@${b.customer_tg_username})` : ''}<br />
                  <strong>Время:</strong> {formatBookingDate(b.booking_time)}<br />
                  <strong>Цена:</strong> {b.service?.price} ₽
                </div>
              </div>
            ))
        )}

        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  // ========== ОСНОВНОЙ ЭКРАН ==========
  return (
    <div className="app">
      <header className="header" onClick={handleHeaderTap}>
        <div className="header-logo">💈</div>
        <h1>Барбершоп</h1>
        <p className="header-sub">Стильные стрижки в центре города</p>
        {tgUser && (
          <p className="welcome">Привет, {tgUser.first_name || tgUser.username}!</p>
        )}
      </header>

      {/* Кнопка "Я мастер" — только на главном экране */}
      {step === 'masters' && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button
            className="btn btn-secondary"
            style={{ display: 'inline-block', width: 'auto', padding: '8px 20px', fontSize: 14 }}
            onClick={() => setStep('master_login')}
          >
            👤 Я мастер — войти
          </button>
          {getAutoMaster() && (
            <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>
              ✅ {getAutoMaster().name}, вы мастер! Нажмите для входа.
            </p>
          )}
        </div>
      )}

      {step !== 'masters' && (
        <button className="back-btn" onClick={() => {
          if (step === 'services') { setStep('masters'); setSelectedMaster(null) }
          else if (step === 'datetime') { setStep('services'); setSelectedService(null) }
          else if (step === 'master_login') { setStep('masters') }
          else if (step === 'confirmation') resetBooking()
        }}>
          ← Назад
        </button>
      )}

      {step === 'masters' && (
        <>
          <h2 className="section-title">
            {selectedMaster ? `Запись к ${selectedMaster.name}` : 'Выберите мастера'}
          </h2>
          {masters.length === 0 ? (
            <div className="empty-state"><div className="icon">👨‍💼</div><p>Мастера временно недоступны</p></div>
          ) : (
            masters.map(m => (
              <div key={m.id} className="master-card" onClick={() => handleSelectMaster(m)}>
                <div className="master-top">
                  {m.photo_url && <img src={m.photo_url} alt={m.name} className="master-photo" />}
                  <div className="master-info">
                    <h3>{m.name}</h3>
                    <span className="master-role">{m.role}</span>
                    <p className="master-bio">{m.bio}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {step === 'master_login' && (
        <>
          <h2 className="section-title">Вход для мастера</h2>

          {/* Автовход по Telegram ID */}
          {getAutoMaster() && (
            <div className="summary" style={{ marginBottom: 16 }}>
              <p style={{ textAlign: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 32 }}>👋</span>
              </p>
              <p style={{ textAlign: 'center', marginBottom: 12 }}>
                Привет, <strong>{getAutoMaster().name}</strong>!<br />
                Вы автоматически определены как мастер.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setMasterLoggedIn(true)
                  setMasterViewMaster(getAutoMaster())
                  loadMasterBookings(getAutoMaster().id)
                }}
              >
                Войти как {getAutoMaster().name}
              </button>
            </div>
          )}

          {!getAutoMaster() && (
            <>
              <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
                Введите свой ID, чтобы посмотреть записи
              </p>
              <div className="form-group">
                <label>ID мастера</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="Например: 1"
                  value={masterLoginId}
                  onChange={e => { setMasterLoginId(e.target.value); setMasterLoginError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleMasterLogin()}
                />
              </div>
              {masterLoginError && (
                <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{masterLoginError}</p>
              )}
              <button className="btn btn-primary" onClick={handleMasterLogin}>
                Войти
              </button>
              <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
                ID можно узнать у администратора
              </p>
            </>
          )}
        </>
      )}

      {step === 'services' && (
        <>
          <h2 className="section-title">
            {selectedMaster ? `Услуги у ${selectedMaster.name}` : 'Выберите услугу'}
          </h2>
          {Array.from(new Set(services.map(s => s.category))).map(cat => (
            <div key={cat}>
              <div className="category-label">{cat}</div>
              {services.filter(s => s.category === cat).map(s => (
                <div key={s.id} className="service-card" onClick={() => handleSelectService(s)}>
                  <div className="service-left">
                    <h4>{s.title}</h4>
                    <span className="service-duration">{s.duration_minutes} мин</span>
                  </div>
                  <div className="service-price">{s.price} <small>₽</small></div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {step === 'datetime' && (
        <>
          <h2 className="section-title">Выберите дату и время</h2>
          <div className="date-picker">
            {getDates().map(d => (
              <button
                key={d.dateStr}
                className={`date-btn ${selectedDate === d.dateStr ? 'active' : ''}`}
                onClick={() => handleSelectDate(d.dateStr)}
              >
                <span className="day-name">{d.dayName}</span>
                <span className="day-num">{d.dayNum}</span>
                <span className="month">{d.month}</span>
              </button>
            ))}
          </div>
          {slots.length > 0 && (
            <div className="slots-grid">
              {slots.map(s => (
                <button
                  key={s.time}
                  className={`slot-btn ${!s.available ? 'disabled' : ''} ${selectedSlot === s.time ? 'active' : ''}`}
                  disabled={!s.available}
                  onClick={() => s.available && setSelectedSlot(s.time)}
                >
                  {s.time}
                </button>
              ))}
            </div>
          )}
          {selectedDate && slots.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--text-dim)', marginTop: 24 }}>
              Загрузка расписания...
            </p>
          )}
          {selectedSlot && (
            <>
              <div className="summary" style={{ marginTop: 20 }}>
                <div className="summary-row">
                  <span className="summary-label">Мастер</span>
                  <span className="summary-value">{selectedMaster?.name}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Услуга</span>
                  <span className="summary-value">{selectedService?.title}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Дата</span>
                  <span className="summary-value">{selectedDate}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Время</span>
                  <span className="summary-value">{selectedSlot}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Вы</span>
                  <span className="summary-value">
                    {tgUser?.first_name || tgUser?.username || 'Клиент'}
                    {tgUser?.username ? ` (@${tgUser.username})` : ''}
                  </span>
                </div>
                <div className="summary-total">
                  <span>Итого</span>
                  <span className="summary-value">{selectedService?.price} ₽</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSubmitBooking}>
                Записаться
              </button>
            </>
          )}
        </>
      )}

      {step === 'confirmation' && (
        <div className="confirmation">
          <div className="confirm-icon">✅</div>
          <h2>Вы записаны!</h2>
          <p>
            {selectedMaster?.name} ждёт вас {selectedDate} в {selectedSlot}.<br />
            Услуга: {selectedService?.title}.
          </p>
          <button className="btn btn-primary" onClick={resetBooking}>
            Записаться ещё
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default App
