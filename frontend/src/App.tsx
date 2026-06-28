import { useEffect, useState, useCallback } from 'react'
import { get } from './api'
import type { Master, Service, TelegramUser } from './types'
import BookingFlow from './components/BookingFlow'
import MasterLogin from './components/MasterLogin'
import MasterDashboard from './components/MasterDashboard'
import AdminPanel from './components/AdminPanel'
import InviteRegistration from './components/InviteRegistration'
import './App.css'

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void
        expand: () => void
        initDataUnsafe: {
          user?: TelegramUser
          start_param?: string
        }
      }
    }
  }
}

function App() {
  const [tgUser, setTgUser] = useState<TelegramUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [masters, setMasters] = useState<Master[]>([])
  const [services, setServices] = useState<Service[]>([])

  // Состояния экранов
  const [isAdmin, setIsAdmin] = useState(window.location.hash === '#admin')
  const [masterLoggedIn, setMasterLoggedIn] = useState(false)
  const [masterViewMaster, setMasterViewMaster] = useState<Master | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)
  const [preselectMasterId, setPreselectMasterId] = useState<number | null>(null)
  const [showMasterLogin, setShowMasterLogin] = useState(false)

  // Секретный вход в админку
  const [tapCount, setTapCount] = useState(0)

  useEffect(() => {
    const tgApp = window.Telegram?.WebApp
    if (tgApp) {
      tgApp.ready()
      tgApp.expand()
      setTgUser(tgApp.initDataUnsafe?.user || null)

      const startParam = tgApp.initDataUnsafe?.start_param || ''
      if (startParam.startsWith('invite_')) {
        const token = startParam.replace('invite_', '')
        if (token) setInviteToken(token)
      }
    }

    const hash = window.location.hash
    if (hash.startsWith('#master/')) {
      const id = parseInt(hash.split('/')[1], 10)
      if (!isNaN(id)) setPreselectMasterId(id)
    }

    const params = new URLSearchParams(window.location.search)
    const token = params.get('invite')
    if (token) setInviteToken(token)

    Promise.all([
      get<Master[]>('/masters/').catch(() => []),
      get<Service[]>('/services/').catch(() => []),
    ]).then(([m, s]) => {
      setMasters(m)
      setServices(s)
      setLoading(false)
    })

    const onHash = () => setIsAdmin(window.location.hash === '#admin')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // 5 тапов по шапке → админка
  const handleHeaderTap = useCallback(() => {
    const newCount = tapCount + 1
    setTapCount(newCount)
    setTimeout(() => setTapCount(0), 1500)
    if (newCount >= 4) {
      setTapCount(0)
      window.location.hash = 'admin'
      setIsAdmin(true)
    }
  }, [tapCount])

  // Авто-определение мастера по Telegram
  const getAutoMaster = useCallback((): Master | null => {
    if (!tgUser || masters.length === 0) return null
    if (tgUser.id) {
      const byId = masters.find(m => m.telegram_id === tgUser.id)
      if (byId) return byId
    }
    if (tgUser.username) {
      const byUsername = masters.find(
        m => m.tg_username && m.tg_username.toLowerCase() === tgUser.username!.toLowerCase()
      )
      if (byUsername) return byUsername
    }
    return null
  }, [tgUser, masters])

  const handleMasterLogin = useCallback((master: Master) => {
    setMasterLoggedIn(true)
    setMasterViewMaster(master)
    setShowMasterLogin(false)
  }, [])

  const logoutMaster = useCallback(() => {
    setMasterLoggedIn(false)
    setMasterViewMaster(null)
    setShowMasterLogin(false)
  }, [])

  const handleRegistered = useCallback(() => {
    const auto = getAutoMaster()
    if (auto) {
      setMasterLoggedIn(true)
      setMasterViewMaster(auto)
      setInviteToken(null)
    }
  }, [getAutoMaster])

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
  if (inviteToken && !masterLoggedIn && !showMasterLogin) {
    return (
      <InviteRegistration
        inviteToken={inviteToken}
        tgUser={tgUser}
        onRegister={handleRegistered}
      />
    )
  }

  // ===== АДМИНКА =====
  if (isAdmin) {
    return <AdminPanel onBack={() => { window.location.hash = ''; setIsAdmin(false) }} />
  }

  // ===== ДАШБОРД МАСТЕРА =====
  if (masterLoggedIn && masterViewMaster) {
    return (
      <MasterDashboard
        master={masterViewMaster}
        masters={masters}
        services={services}
        tgUser={tgUser}
        onLogout={logoutMaster}
      />
    )
  }

  // ===== ОСНОВНОЙ ЭКРАН =====
  return (
    <div className="app">
      {showMasterLogin ? (
        <MasterLogin
          masters={masters}
          tgUser={tgUser}
          getAutoMaster={getAutoMaster}
          inviteToken={inviteToken}
          onLogin={handleMasterLogin}
          onRegister={handleRegistered}
          onBack={() => setShowMasterLogin(false)}
        />
      ) : (
        <BookingFlow
          masters={masters}
          services={services}
          tgUser={tgUser}
          preselectMasterId={preselectMasterId}
          onStartMasterLogin={() => setShowMasterLogin(true)}
          onHeaderTap={handleHeaderTap}
        />
      )}
    </div>
  )
}

export default App
