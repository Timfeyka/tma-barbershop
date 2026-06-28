import { useState, useEffect, useCallback } from 'react'
import { get, post } from '../api'
import type { Master, Service, MasterService, TelegramUser } from '../types'
import Toast from './Toast'
import CalendarWidget from './CalendarWidget'
import BookingSummary from './BookingSummary'
import MasterCard from './MasterCard'

interface BookingFlowProps {
  masters: Master[]
  services: Service[]
  tgUser: TelegramUser | null
  preselectMasterId: number | null
  onStartMasterLogin: () => void
  onHeaderTap: () => void
}

export default function BookingFlow({
  masters, services, tgUser, preselectMasterId, onStartMasterLogin, onHeaderTap,
}: BookingFlowProps) {
  const [step, setStep] = useState<'masters' | 'services' | 'datetime' | 'confirmation'>('masters')
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null)
  const [selectedService, setSelectedService] = useState<Service | MasterService | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [slots, setSlots] = useState<{ time: string; available: boolean; note?: string }[]>([])
  const [masterServices, setMasterServices] = useState<MasterService[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }, [])

  useEffect(() => {
    if (preselectMasterId) {
      const m = masters.find(m => m.id === preselectMasterId)
      if (m) {
        setSelectedMaster(m)
        setStep('services')
        loadMasterServices(m.id)
      }
    }
  }, [preselectMasterId, masters])

  const loadMasterServices = async (masterId: number) => {
    const data = await get<MasterService[]>(`/masters/${masterId}/services`).catch(() => [])
    setMasterServices(data)
    return data
  }

  const handleSelectMaster = async (master: Master) => {
    setSelectedMaster(master)
    setStep('services')
    await loadMasterServices(master.id)
  }

  const handleSelectService = (svc: any) => {
    setSelectedService(svc)
    setStep('datetime')
  }

  const handleSelectDate = async (dateStr: string) => {
    setSelectedDate(dateStr)
    setSelectedSlot(null)
    if (selectedMaster) {
      const data = await get<{ slots: { time: string; available: boolean }[] }>(
        `/bookings/available-slots/${selectedMaster.id}/${dateStr}`
      ).catch(() => ({ slots: [] }))
      setSlots(data.slots || [])
    }
  }

  const handleSubmitBooking = async () => {
    if (!selectedSlot || !selectedMaster || !selectedService) return
    const [h, m] = selectedSlot.split(':')
    const bookingTime = `${selectedDate}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`

    const customerName = tgUser
      ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Клиент'
      : 'Клиент'
    const username = tgUser?.username || null
    const tgId = tgUser?.id || null

    try {
      await post('/bookings/', {
        master_id: selectedMaster.id,
        service_id: ('service_id' in selectedService ? selectedService.service_id : selectedService.id),
        customer_name: customerName,
        customer_phone: null,
        customer_tg_username: username,
        customer_tg_id: tgId,
        booking_time: bookingTime,
      })
      setStep('confirmation')
    } catch (e: any) {
      showToast('Ошибка: ' + e.message)
    }
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

  const formatServiceItems = () => {
    if (masterServices.length > 0) {
      return masterServices.map(ms => ({
        id: ms.service?.id || ms.id,
        title: ms.service?.title,
        price: ms.price || ms.service?.price,
        duration_minutes: ms.duration_minutes || ms.service?.duration_minutes,
        category: ms.service?.category,
        service_id: ms.service_id,
      }))
    }
    return services.map(s => ({ ...s }))
  }

  const serviceItems = formatServiceItems()
  const categories = [...new Set(serviceItems.map(s => s.category).filter(Boolean))]

  const servicePrice = selectedService && 'price' in selectedService ? selectedService.price : 0
  const serviceTitle = selectedService && 'title' in selectedService ? selectedService.title : ''

  return (
    <>
      <header className="header" onClick={onHeaderTap}>
        <div className="header-logo">💈</div>
        <h1>Барбершоп</h1>
        <p className="header-sub">Стильные стрижки в центре города</p>
        {tgUser && (
          <p className="welcome">Привет, {[tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username}!</p>
        )}
      </header>

      {/* Кнопка "Я мастер" */}
      {step === 'masters' && (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <button className="btn btn-secondary"
            style={{ display: 'inline-block', width: 'auto', padding: '8px 20px', fontSize: 14 }}
            onClick={onStartMasterLogin}>
            👤 Я мастер — войти
          </button>
        </div>
      )}

      {step !== 'masters' && (
        <button className="back-btn" onClick={() => {
          if (step === 'services') { setStep('masters'); setSelectedMaster(null); setMasterServices([]) }
          else if (step === 'datetime') { setStep('services'); setSelectedService(null); setSelectedSlot(null); setSlots([]) }
          else if (step === 'confirmation') resetBooking()
        }}>
          ← Назад
        </button>
      )}

      {step === 'masters' && (
        <>
          <h2 className="section-title">Выберите мастера</h2>
          {masters.length === 0 ? (
            <div className="empty-state"><div className="icon">👨‍💼</div><p>Мастера временно недоступны</p></div>
          ) : (
            masters.map(m => <MasterCard key={m.id} master={m} onSelect={handleSelectMaster} />)
          )}
        </>
      )}

      {step === 'services' && (
        <>
          <h2 className="section-title">Услуги у {selectedMaster?.name}</h2>
          {serviceItems.length === 0 ? (
            <div className="empty-state"><div className="icon">✂️</div><p>У мастера пока нет услуг</p></div>
          ) : (
            categories.map(cat => (
              <div key={cat}>
                <div className="category-label">{cat}</div>
                {serviceItems.filter(s => s.category === cat).map(s => (
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
          )}
        </>
      )}

      {step === 'datetime' && (
        <>
          <h2 className="section-title">Выберите дату</h2>
          <CalendarWidget
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            slots={slots}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
          />
          {selectedSlot && (
            <BookingSummary
              masterName={selectedMaster?.name || ''}
              serviceTitle={serviceTitle}
              servicePrice={servicePrice}
              selectedDate={selectedDate || ''}
              selectedSlot={selectedSlot}
              customerName={tgUser ? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Клиент' : 'Клиент'}
              customerUsername={tgUser?.username}
              onConfirm={handleSubmitBooking}
            />
          )}
        </>
      )}

      {step === 'confirmation' && (
        <div className="confirmation">
          <div className="confirm-icon">✅</div>
          <h2>Вы записаны!</h2>
          <p>
            {selectedMaster?.name} ждёт вас {selectedDate} в {selectedSlot}.<br />
            Услуга: {serviceTitle}.
          </p>
          <button className="btn btn-primary" onClick={resetBooking}>
            Записаться ещё
          </button>
        </div>
      )}

      <Toast message={toast} onClose={() => setToast(null)} />
    </>
  )
}
