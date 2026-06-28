import { useState } from 'react'
import { post } from '../api'
import type { Master, MasterRegisterResponse, TelegramUser } from '../types'
import Toast from './Toast'

interface MasterLoginProps {
  masters: Master[]
  tgUser: TelegramUser | null
  getAutoMaster: () => Master | null
  inviteToken: string | null
  onLogin: (master: Master, bookings: any[]) => void
  onRegister: (master: Master) => void
  onBack: () => void
}

export default function MasterLogin({
  masters, tgUser, getAutoMaster, inviteToken,
  onLogin, onRegister, onBack,
}: MasterLoginProps) {
  const [manualInviteToken, setManualInviteToken] = useState('')
  const [registering, setRegistering] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const getFullName = () => {
    if (!tgUser) return ''
    return [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Мастер'
  }

  const autoMaster = getAutoMaster()

  const handleRegisterByInvite = async (manualData?: any, token?: string) => {
    const tk = token || inviteToken
    if (!tk) return
    setRegistering(true)
    try {
      const res = await post<MasterRegisterResponse>('/masters/register-by-invite', {
        token: tk,
        name: manualData?.name || getFullName(),
        telegram_id: manualData?.telegram_id || tgUser?.id || 0,
        username: manualData?.username || tgUser?.username || null,
        photo_url: tgUser?.photo_url || null,
      })
      onLogin(res.master, [])
      showToast(res.message)
      setRegistering(false)
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
      setRegistering(false)
    }
  }

  return (
    <>
      <button className="back-btn" onClick={onBack}>← Назад</button>
      <h2 className="section-title">Вход для мастера</h2>

      {autoMaster && (
        <div className="summary" style={{ marginBottom: 16 }}>
          <p style={{ textAlign: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 32 }}>👋</span>
          </p>
          <p style={{ textAlign: 'center', marginBottom: 12 }}>
            Привет, <strong>{autoMaster.name}</strong>!<br />
            Вы автоматически определены как мастер.
          </p>
          <button className="btn btn-primary" onClick={() => {
            get<unknown[]>(`/bookings/master/${autoMaster.id}`).then(bookings => {
              onLogin(autoMaster, bookings)
            }).catch(() => onLogin(autoMaster, []))
          }}>
            Войти как {autoMaster.name}
          </button>
        </div>
      )}

      {!autoMaster && tgUser && (
        <>
          <div className="summary" style={{ textAlign: 'center', marginBottom: 16 }}>
            <p style={{ marginBottom: 12 }}><span style={{ fontSize: 32 }}>🔗</span></p>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 12 }}>
              {tgUser.first_name}, ваш Telegram не привязан к мастеру.
            </p>
          </div>

          {inviteToken && (
            <div className="summary" style={{ marginBottom: 16 }}>
              <p style={{ color: 'var(--text)', fontSize: 14, marginBottom: 12 }}>
                Обнаружена инвайт-ссылка. Зарегистрироваться как мастер?
              </p>
              <button className="btn btn-primary" onClick={() => handleRegisterByInvite()}>
                Зарегистрироваться
              </button>
            </div>
          )}

          {!inviteToken && (
            <div className="summary" style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12, textAlign: 'center' }}>
                Есть инвайт-ссылка от администратора?<br />
                Введите токен из ссылки (<code>?invite=XXX</code>):
              </p>
              <div className="form-group" style={{ marginBottom: 12 }}>
                <input className="form-input" placeholder="Вставьте токен"
                  value={manualInviteToken}
                  onChange={e => setManualInviteToken(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} />
              </div>
              <button className="btn btn-primary"
                onClick={async () => {
                  if (!manualInviteToken.trim()) return
                  await handleRegisterByInvite({}, manualInviteToken.trim())
                  setManualInviteToken('')
                }}
                disabled={!manualInviteToken.trim() || registering}>
                {registering ? 'Регистрирую...' : '🔗 Привязать Telegram к мастеру'}
              </button>
            </div>
          )}
        </>
      )}

      {!autoMaster && !tgUser && (
        <div className="summary" style={{ textAlign: 'center', marginBottom: 16 }}>
          <p style={{ marginBottom: 12 }}><span style={{ fontSize: 32 }}>📱</span></p>
          <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 12 }}>
            Для входа как мастер откройте это приложение через Telegram.
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            Используйте поиск в Telegram → найдите бота → запустите Mini App.
          </p>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  )
}
