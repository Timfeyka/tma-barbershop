import { useEffect, useState } from 'react'
import { get, post, put, del } from './api'
import './App.css'

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const DAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

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
  const [masterServices, setMasterServices] = useState([])

  // Мастер (просмотр записей)
  const [masterLoggedIn, setMasterLoggedIn] = useState(false)
  const [masterViewMaster, setMasterViewMaster] = useState(null)
  const [masterBookings, setMasterBookings] = useState([])
  const [masterLoginId, setMasterLoginId] = useState('')
  const [masterLoginError, setMasterLoginError] = useState('')
  const [masterTab, setMasterTab] = useState('bookings')
  const [masterServicesList, setMasterServicesList] = useState([])
  const [masterSchedule, setMasterSchedule] = useState([])

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

  // Инвайт-ссылка (админка)
  const [inviteLink, setInviteLink] = useState('')
  const [inviteLinkDirect, setInviteLinkDirect] = useState('')
  const [inviteLinkTg, setInviteLinkTg] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [botInfo, setBotInfo] = useState(null)

  // Управление услугами мастера (админка)
  const [editMasterServices, setEditMasterServices] = useState(null)
  const [editMasterServicesData, setEditMasterServicesData] = useState([])

  // Управление расписанием мастера (админка)
  const [editMasterSchedule, setEditMasterSchedule] = useState(null)
  const [editMasterScheduleData, setEditMasterScheduleData] = useState([])

  // Регистрация по инвайту
  const [inviteToken, setInviteToken] = useState(null)
  const [registering, setRegistering] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualTgUsername, setManualTgUsername] = useState('')

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

      // Проверяем start_param (когда открыто через t.me/bot/app?startapp=...)
      const startParam = app.initDataUnsafe?.start_param || ''
      if (startParam.startsWith('invite_')) {
        const token = startParam.replace('invite_', '')
        if (token) setInviteToken(token)
      }
    }

    // Разбор хэша и параметров
    const hash = window.location.hash
    if (hash.startsWith('#master/')) {
      const id = parseInt(hash.split('/')[1], 10)
      if (!isNaN(id)) setPreselectMasterId(id)
    }

    // Проверяем инвайт-ссылку из URL-параметров (?invite=TOKEN)
    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (token) setInviteToken(token)

    Promise.all([
      get('/masters/').catch(() => []),
      get('/services/').catch(() => []),
    ]).then(([m, s]) => {
      setMasters(m)
      setServices(s)

      // Если есть предвыбор мастера по ссылке — сразу выбираем
      if (hash.startsWith('#master/')) {
        const id = parseInt(hash.split('/')[1], 10)
        if (!isNaN(id)) {
          const master = m.find(m => m.id === id)
          if (master) {
            setSelectedMaster(master)
            setStep('services')
            loadMasterServices(master.id)
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
    setMasterServices([])
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

  // ===== УСЛУГИ МАСТЕРА =====

  const loadMasterServices = async (masterId) => {
    const data = await get(`/masters/${masterId}/services`).catch(() => [])
    setMasterServices(data)
    return data
  }

  // ===== РЕГИСТРАЦИЯ ПО ИНВАЙТУ =====

  const handleRegisterByInvite = async (manualData) => {
    const payload = manualData || {}
    if (!payload.name && !tgUser) return
    if (!inviteToken) return

    setRegistering(true)
    try {
      const res = await post('/masters/register-by-invite', {
        token: inviteToken,
        name: payload.name || tgUser?.first_name || tgUser?.username || 'Мастер',
        telegram_id: payload.telegram_id || tgUser?.id || 0,
        username: payload.username || tgUser?.username || null,
        photo_url: null,
      })
      // Авто-логин
      setMasterLoggedIn(true)
      setMasterViewMaster(res.master)
      loadMasterBookings(res.master.id)
      setInviteToken(null)
      setRegistering(false)
      showToast(res.message)
    } catch (e) {
      showToast('Ошибка: ' + e.message)
      setRegistering(false)
    }
  }

  // ===== БРОНИРОВАНИЕ =====

  const handleSelectMaster = async (master) => {
    setSelectedMaster(master)
    setStep('services')
    await loadMasterServices(master.id)
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
    const tgId = tgUser?.id || null

    try {
      await post('/bookings/', {
        master_id: selectedMaster.id,
        service_id: selectedService.id,
        customer_name: firstName,
        customer_phone: null,
        customer_tg_username: username,
        customer_tg_id: tgId,
        booking_time: dt.toISOString(),
      })
      setStep('confirmation')
    } catch (e) {
      showToast('Ошибка: ' + e.message)
    }
  }

  // ===== ВХОД МАСТЕРА =====
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
    setMasterTab('bookings')
    setStep('masters')
  }

  // ===== ДАШБОРД МАСТЕРА: УСЛУГИ =====

  const loadMasterOwnServices = async () => {
    if (!masterViewMaster) return
    const data = await get(`/masters/${masterViewMaster.id}/services`).catch(() => [])
    setMasterServicesList(data)
  }

  const loadMasterOwnSchedule = async () => {
    if (!masterViewMaster) return
    const data = await get(`/masters/${masterViewMaster.id}/schedule`).catch(() => [])
    setMasterSchedule(data)
  }

  const handleMasterAddService = async (serviceId) => {
    if (!masterViewMaster) return
    try {
      await post(`/admin/masters/${masterViewMaster.id}/services`, { service_id: serviceId })
      showToast('Услуга добавлена')
      loadMasterOwnServices()
    } catch (e) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const handleMasterRemoveService = async (msId) => {
    if (!masterViewMaster) return
    await del(`/admin/masters/${masterViewMaster.id}/services/${msId}`)
    showToast('Услуга удалена')
    loadMasterOwnServices()
  }

  const handleMasterSaveSchedule = async () => {
    if (!masterViewMaster) return
    try {
      await put(`/masters/${masterViewMaster.id}/schedule`, { schedule: masterSchedule })
      showToast('Расписание сохранено!')
    } catch (e) {
      showToast('Ошибка: ' + e.message)
    }
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
    const [s, b, m, sv, bi] = await Promise.all([
      get('/admin/stats').catch(() => null),
      get('/admin/bookings').catch(() => []),
      get('/admin/masters').catch(() => []),
      get('/admin/services').catch(() => []),
      get('/admin/bot-info').catch(() => null),
    ])
    if (s) setAdminStats(s)
    setAdminBookings(b)
    setAdminMasters(m)
    setAdminServices(sv)
    if (bi) setBotInfo(bi)
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

  // --- Инвайт ---

  const handleCreateInviteLink = async () => {
    setInviteLoading(true)
    try {
      const res = await post('/admin/invite-link')
      setInviteLinkDirect(res.direct_url)
      setInviteLinkTg(res.telegram_url || '')
      setInviteLink(res.telegram_url || res.direct_url)
    } catch (e) {
      showToast('Ошибка: ' + e.message)
    }
    setInviteLoading(false)
  }

  // --- Услуги мастера в админке ---

  const openEditMasterServices = async (master) => {
    setEditMasterServices(master)
    const data = await get(`/masters/${master.id}/services`).catch(() => [])
    setEditMasterServicesData(data)
  }

  const handleAdminLinkService = async (serviceId) => {
    if (!editMasterServices) return
    try {
      await post(`/admin/masters/${editMasterServices.id}/services`, { service_id: serviceId })
      showToast('Услуга добавлена мастеру')
      const data = await get(`/masters/${editMasterServices.id}/services`).catch(() => [])
      setEditMasterServicesData(data)
    } catch (e) {
      showToast('Ошибка: ' + e.message)
    }
  }

  const handleAdminUnlinkService = async (msId) => {
    if (!editMasterServices) return
    await del(`/admin/masters/${editMasterServices.id}/services/${msId}`)
    showToast('Услуга отвязана')
    const data = await get(`/masters/${editMasterServices.id}/services`).catch(() => [])
    setEditMasterServicesData(data)
  }

  // --- Расписание мастера в админке ---

  const openEditMasterSchedule = async (master) => {
    setEditMasterSchedule(master)
    const data = await get(`/masters/${master.id}/schedule`).catch(() => [])
    setEditMasterScheduleData(data.length ? data : getDefaultSchedule())
  }

  const handleAdminSaveSchedule = async () => {
    if (!editMasterSchedule) return
    try {
      await put(`/masters/${editMasterSchedule.id}/schedule`, { schedule: editMasterScheduleData })
      showToast('Расписание сохранено')
    } catch (e) {
      showToast('Ошибка: ' + e.message)
    }
  }

  // ===== УТИЛИТЫ =====

  const getDefaults = () => {
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

  const getDefaultSchedule = () => {
    return [
      { day_of_week: 0, is_working: true, start_time: "10:00", end_time: "20:00" },
      { day_of_week: 1, is_working: true, start_time: "10:00", end_time: "20:00" },
      { day_of_week: 2, is_working: true, start_time: "10:00", end_time: "20:00" },
      { day_of_week: 3, is_working: true, start_time: "10:00", end_time: "20:00" },
      { day_of_week: 4, is_working: true, start_time: "10:00", end_time: "20:00" },
      { day_of_week: 5, is_working: true, start_time: "10:00", end_time: "18:00" },
      { day_of_week: 6, is_working: false, start_time: "10:00", end_time: "18:00" },
    ]
  }

  const formatBookingDate = (iso) => {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric', month: 'long', weekday: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const getMasterLink = (masterId) => {
    return window.location.origin + window.location.pathname + `#master/${masterId}`
  }

  const isServiceLinked = (serviceId) => {
    return editMasterServicesData.some(ms => ms.service_id === serviceId)
  }

  const isOwnServiceLinked = (serviceId) => {
    return masterServicesList.some(ms => ms.service_id === serviceId)
  }

  // ===== РЕНДЕР =====

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

  // ===== ЭКРАН РЕГИСТРАЦИИ ПО ИНВАЙТУ =====
  if (inviteToken && !masterLoggedIn) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-logo">💈</div>
          <h1>Регистрация мастера</h1>
        </header>
        {tgUser ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>👋</span>
            <h2 style={{ marginBottom: 8 }}>{tgUser.first_name || tgUser.username}</h2>
            <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
              Вы получили приглашение стать мастером в нашем барбершопе.
            </p>
            <button
              className="btn btn-primary"
              onClick={() => handleRegisterByInvite()}
              disabled={registering}
            >
              {registering ? 'Регистрация...' : '✅ Стать мастером'}
            </button>
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            <p style={{ color: 'var(--text-dim)', marginBottom: 16, textAlign: 'center' }}>
              Вы получили приглашение стать мастером в барбершопе.<br />
              Заполните данные ниже.
            </p>
            <div className="form-group">
              <label>Имя (будет отображаться клиентам)</label>
              <input
                className="form-input"
                placeholder="Иван"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Telegram @username</label>
              <input
                className="form-input"
                placeholder="@username"
                value={manualTgUsername}
                onChange={e => setManualTgUsername(e.target.value.replace('@', ''))}
              />
              <small style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4, display: 'block' }}>
                Будет отображаться в админке. Если не укажете — не сможете получать уведомления в Telegram.
              </small>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => handleRegisterByInvite({
                name: manualName,
                username: manualTgUsername || null,
                telegram_id: 0,
              })}
              disabled={registering || !manualName.trim()}
              style={{ marginTop: 8 }}
            >
              {registering ? 'Регистрация...' : '✅ Зарегистрироваться'}
            </button>
          </div>
        )}
        {toast && <div className="toast">{toast}</div>}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h3 style={{ margin: 0 }}>Мастера</h3>
                  <button className="btn btn-sm btn-primary" onClick={handleCreateInviteLink} disabled={inviteLoading}>
                    {inviteLoading ? '...' : '➕ Добавить'}
                  </button>
                </div>

                {/* Инвайт-ссылка */}
                {inviteLink && (
                  <div className="summary" style={{ marginBottom: 16, fontSize: 14 }}>
                    <p style={{ marginBottom: 8, fontWeight: 500 }}>🔗 Отправьте ссылку мастеру:</p>

                    {inviteLinkTg && (
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                          Telegram (если настроен Mini App):
                        </label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="form-input"
                            style={{ flex: 1, fontSize: 12 }}
                            readOnly
                            value={inviteLinkTg}
                          />
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              navigator.clipboard?.writeText(inviteLinkTg)
                              showToast('Ссылка скопирована!')
                            }}
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    )}

                    {inviteLinkDirect !== inviteLinkTg && (
                      <div>
                        <label style={{ fontSize: 12, color: 'var(--text-dim)', display: 'block', marginBottom: 4 }}>
                          Прямая ссылка (браузер, если Mini App не настроен):
                        </label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            className="form-input"
                            style={{ flex: 1, fontSize: 12 }}
                            readOnly
                            value={inviteLinkDirect}
                          />
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              navigator.clipboard?.writeText(inviteLinkDirect)
                              showToast('Ссылка скопирована!')
                            }}
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    )}

                    {botInfo?.bot_username && !inviteLinkTg && (
                      <p style={{ color: 'var(--warning)', marginTop: 8, fontSize: 12 }}>
                        ⚠️ Telegram ссылка недоступна — нет BOT_TOKEN. Ссылка откроется в браузере.<br />
                        Чтобы работало внутри Telegram — настрой Mini App в @BotFather:
                      </p>
                    )}
                    {botInfo?.botfather_help && botInfo?.bot_username && !inviteLinkTg && (
                      <code style={{ display: 'block', background: 'var(--card)', padding: 6, marginTop: 4, borderRadius: 6, fontSize: 12 }}>
                        {botInfo.botfather_help}
                      </code>
                    )}
                  </div>
                )}

                {adminMasters.length === 0 ? (
                  <div className="empty-state"><div className="icon">👨‍💼</div><p>Нет мастеров</p></div>
                ) : (
                  adminMasters.map(m => (
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
                        <br />
                        <small style={{ color: 'var(--accent)' }}>
                          🔗 {getMasterLink(m.id)}
                        </small>
                      </div>
                      <div className="admin-actions">
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditMaster(m)} style={{ marginRight: 4 }} title="Изменить Telegram ID">
                          ✏️
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditMasterServices(m)} style={{ marginRight: 4 }} title="Услуги мастера">
                          🛠
                        </button>
                        <button className="btn btn-sm btn-secondary" onClick={() => openEditMasterSchedule(m)} style={{ marginRight: 4 }} title="Расписание">
                          📅
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

            {/* Модалка: Telegram ID мастера */}
            {editingMaster && (
              <div className="modal-overlay" onClick={() => setEditingMaster(null)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <h3>Редактировать: {editingMaster.name}</h3>
                  <div className="form-group">
                    <label>Telegram ID</label>
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
                    {adminServices.map(s => (
                      <div key={s.id} className="admin-item" style={{ padding: '8px 0' }}>
                        <div className="admin-item-info">
                          <h4 style={{ fontSize: 14, margin: 0 }}>
                            {isServiceLinked(s.id) ? '✅ ' : ''}{s.title}
                          </h4>
                          <span style={{ fontSize: 12 }}>{s.price} ₽ · {s.duration_minutes} мин</span>
                        </div>
                        <div className="admin-actions">
                          {isServiceLinked(s.id) ? (
                            <button className="btn btn-sm btn-danger" onClick={() => {
                              const ms = editMasterServicesData.find(x => x.service_id === s.id)
                              if (ms) handleAdminUnlinkService(ms.id)
                            }}>
                              ✕
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-success" onClick={() => handleAdminLinkService(s.id)}>
                              +
                            </button>
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
                          <input
                            type="checkbox"
                            checked={item.is_working}
                            onChange={e => {
                              const next = [...editMasterScheduleData]
                              next[i] = { ...next[i], is_working: e.target.checked }
                              setEditMasterScheduleData(next)
                            }}
                          />
                          {DAYS_FULL[item.day_of_week]}
                        </label>
                      </div>
                      {item.is_working && (
                        <>
                          <input
                            className="form-input"
                            style={{ flex: 1, fontSize: 13, padding: '6px 8px' }}
                            type="time"
                            value={item.start_time}
                            onChange={e => {
                              const next = [...editMasterScheduleData]
                              next[i] = { ...next[i], start_time: e.target.value }
                              setEditMasterScheduleData(next)
                            }}
                          />
                          <span style={{ color: 'var(--text-dim)' }}>—</span>
                          <input
                            className="form-input"
                            style={{ flex: 1, fontSize: 13, padding: '6px 8px' }}
                            type="time"
                            value={item.end_time}
                            onChange={e => {
                              const next = [...editMasterScheduleData]
                              next[i] = { ...next[i], end_time: e.target.value }
                              setEditMasterScheduleData(next)
                            }}
                          />
                        </>
                      )}
                      {!item.is_working && (
                        <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Выходной</span>
                      )}
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button className="btn btn-primary" onClick={() => {
                      handleAdminSaveSchedule()
                      setEditMasterSchedule(null)
                    }}>
                      Сохранить
                    </button>
                    <button className="btn btn-secondary" onClick={() => setEditMasterSchedule(null)}>Закрыть</button>
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

  // ===== ДАШБОРД МАСТЕРА =====
  if (masterLoggedIn && masterViewMaster) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-logo">💈</div>
          <h1>{masterViewMaster.name}</h1>
          <p className="header-sub">{masterViewMaster.role}</p>
        </header>

        <button className="back-btn" onClick={logoutMaster}>
          ← Выйти
        </button>

        {/* Табы мастера */}
        <nav className="nav-tabs" style={{ marginTop: 4 }}>
          {[
            { key: 'bookings', label: '📅 Записи' },
            { key: 'services', label: '✂️ Услуги' },
            { key: 'schedule', label: '📅 График' },
          ].map(t => (
            <button
              key={t.key}
              className={`nav-tab ${masterTab === t.key ? 'active' : ''}`}
              onClick={() => {
                setMasterTab(t.key)
                if (t.key === 'services') loadMasterOwnServices()
                if (t.key === 'schedule') loadMasterOwnSchedule()
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Записи мастера */}
        {masterTab === 'bookings' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 16, marginTop: 8 }}>
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
          </>
        )}

        {/* Услуги мастера */}
        {masterTab === 'services' && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ marginBottom: 12 }}>Мои услуги</h3>
            {masterServicesList.length === 0 ? (
              <div className="empty-state"><div className="icon">✂️</div><p>У вас пока нет услуг</p></div>
            ) : (
              masterServicesList.map(ms => {
                const price = ms.price || ms.service?.price
                const dur = ms.duration_minutes || ms.service?.duration_minutes
                return (
                  <div key={ms.id} className="admin-item">
                    <div className="admin-item-info">
                      <h4>{ms.service?.title}</h4>
                      <span>{price} ₽ · {dur} мин</span>
                    </div>
                    <div className="admin-actions">
                      <button className="btn btn-sm btn-danger" onClick={() => handleMasterRemoveService(ms.id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })
            )}
            <details style={{ marginTop: 16 }}>
              <summary style={{ color: 'var(--accent)', cursor: 'pointer', fontSize: 14 }}>
                ➕ Добавить услугу
              </summary>
              <div style={{ marginTop: 12 }}>
                {services.filter(s => !isOwnServiceLinked(s.id)).map(s => (
                  <div key={s.id} className="admin-item">
                    <div className="admin-item-info">
                      <h4 style={{ fontSize: 14 }}>{s.title}</h4>
                      <span style={{ fontSize: 12 }}>{s.price} ₽ · {s.duration_minutes} мин</span>
                    </div>
                    <div className="admin-actions">
                      <button className="btn btn-sm btn-success" onClick={() => handleMasterAddService(s.id)}>
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        )}

        {/* Расписание мастера */}
        {masterTab === 'schedule' && (
          <div style={{ marginTop: 8 }}>
            <h3 style={{ marginBottom: 12 }}>Моё расписание</h3>
            {masterSchedule.map((item, i) => (
              <div key={item.day_of_week} style={{
                display: 'flex', gap: 8, alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ minWidth: 90 }}>
                  <label style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={item.is_working}
                      onChange={e => {
                        const next = [...masterSchedule]
                        next[i] = { ...next[i], is_working: e.target.checked }
                        setMasterSchedule(next)
                      }}
                    />
                    {DAYS_FULL[item.day_of_week]}
                  </label>
                </div>
                {item.is_working ? (
                  <>
                    <input
                      className="form-input"
                      style={{ flex: 1, fontSize: 13, padding: '6px 8px' }}
                      type="time"
                      value={item.start_time}
                      onChange={e => {
                        const next = [...masterSchedule]
                        next[i] = { ...next[i], start_time: e.target.value }
                        setMasterSchedule(next)
                      }}
                    />
                    <span style={{ color: 'var(--text-dim)' }}>—</span>
                    <input
                      className="form-input"
                      style={{ flex: 1, fontSize: 13, padding: '6px 8px' }}
                      type="time"
                      value={item.end_time}
                      onChange={e => {
                        const next = [...masterSchedule]
                        next[i] = { ...next[i], end_time: e.target.value }
                        setMasterSchedule(next)
                      }}
                    />
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>Выходной</span>
                )}
              </div>
            ))}
            <button className="btn btn-primary" onClick={handleMasterSaveSchedule} style={{ marginTop: 16 }}>
              💾 Сохранить расписание
            </button>
          </div>
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

      {/* Кнопка "Я мастер" */}
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
          if (step === 'services') { setStep('masters'); setSelectedMaster(null); setMasterServices([]) }
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
          {/* Показываем услуги мастера, если они есть, иначе все услуги */}
          {(masterServices.length > 0 ? masterServices : services.map(s => ({ service: s, price: null, duration_minutes: null }))).length === 0 ? (
            <div className="empty-state"><div className="icon">✂️</div><p>У мастера пока нет услуг</p></div>
          ) : (
            (() => {
              const items = masterServices.length > 0
                ? masterServices.map(ms => ({
                    id: ms.service?.id || ms.id,
                    title: ms.service?.title,
                    price: ms.price || ms.service?.price,
                    duration_minutes: ms.duration_minutes || ms.service?.duration_minutes,
                    category: ms.service?.category,
                  }))
                : services.map(s => ({ ...s, id: s.id }))

              const categories = [...new Set(items.map(s => s.category).filter(Boolean))]
              return categories.map(cat => (
                <div key={cat}>
                  <div className="category-label">{cat}</div>
                  {items.filter(s => s.category === cat).map(s => (
                    <div key={s.id} className="service-card" onClick={() => handleSelectService(s)}>
                      <div className="service-left">
                        <h4>{s.title}</h4>
                        <span className="service-duration">{s.duration_minutes} мин</span>
                      </div>
                      <div className="service-price">{s.price} <small>₽</small></div>
                    </div>
                  ))}
                </div>
              ))
            })()
          )}
        </>
      )}

      {step === 'datetime' && (
        <>
          <h2 className="section-title">Выберите дату и время</h2>
          <div className="date-picker">
            {getDefaults().map(d => (
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
              Свободных слотов нет
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
