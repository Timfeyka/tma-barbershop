import { useState } from 'react'
import { post } from '../api'
import type { Master, MasterRegisterResponse, TelegramUser } from '../types'
import Toast from './Toast'

interface InviteRegistrationProps {
  inviteToken: string
  tgUser: TelegramUser | null
  onRegister: (master: Master) => void
}

export default function InviteRegistration({ inviteToken, tgUser, onRegister }: InviteRegistrationProps) {
  const [registering, setRegistering] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualTgUsername, setManualTgUsername] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const getFullName = () => {
    if (!tgUser) return ''
    return [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Мастер'
  }

  const handleRegister = async (manualData?: { name: string; username: string | null; telegram_id: number }) => {
    const payload = manualData || {}
    if (!payload.name && !tgUser) return
    setRegistering(true)
    try {
      const res = await post<MasterRegisterResponse>('/masters/register-by-invite', {
        token: inviteToken,
        name: payload.name || getFullName(),
        telegram_id: payload.telegram_id || tgUser?.id || 0,
        username: payload.username || tgUser?.username || null,
        photo_url: tgUser?.photo_url || null,
      })
      setRegistering(false)
      showToast(res.message)
      setTimeout(() => onRegister(res.master), 500) // даём тосту показаться
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
      setRegistering(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">💈</div>
        <h1>Регистрация мастера</h1>
      </header>
      {tgUser ? (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>👋</span>
          <h2 style={{ marginBottom: 8 }}>{getFullName()}</h2>
          <p style={{ color: 'var(--text-dim)', marginBottom: 24 }}>
            Вы получили приглашение стать мастером в нашем барбершопе.
          </p>
          <button className="btn btn-primary" onClick={() => handleRegister()} disabled={registering}>
            {registering ? 'Регистрация...' : '✅ Стать мастером'}
          </button>
        </div>
      ) : (
        <div style={{ padding: 24 }}>
          <p style={{ color: 'var(--text-dim)', marginBottom: 16, textAlign: 'center' }}>
            Вы получили приглашение стать мастером.<br />Заполните данные ниже.
          </p>
          <div className="form-group">
            <label>Имя (будет отображаться клиентам)</label>
            <input className="form-input" placeholder="Иван" value={manualName}
              onChange={e => setManualName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Telegram @username (необязательно, но нужно для уведомлений)</label>
            <input className="form-input" placeholder="@username" value={manualTgUsername}
              onChange={e => setManualTgUsername(e.target.value.replace('@', ''))} />
          </div>
          <button className="btn btn-primary" style={{ marginTop: 8 }}
            onClick={() => handleRegister({ name: manualName, username: manualTgUsername || null, telegram_id: 0 })}
            disabled={registering || !manualName.trim()}>
            {registering ? 'Регистрация...' : '✅ Зарегистрироваться'}
          </button>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
            💡 После регистрации привяжите Telegram в дашборде мастера,<br />
            чтобы получать уведомления о записях.
          </p>
        </div>
      )}
      <Toast message={toast} onClose={() => setToast(null)} />
    </div>
  )
}
