import { MONTHS_RU_GEN } from './CalendarWidget'

interface BookingSummaryProps {
  masterName: string
  serviceTitle: string
  servicePrice: number
  selectedDate: string
  selectedSlot: string
  customerName: string
  customerUsername?: string | null
  onConfirm: () => void
}

export default function BookingSummary({
  masterName,
  serviceTitle,
  servicePrice,
  selectedDate,
  selectedSlot,
  customerName,
  customerUsername,
  onConfirm,
}: BookingSummaryProps) {
  return (
    <>
      <div className="summary" style={{ marginTop: 20 }}>
        <div className="summary-row">
          <span className="summary-label">Мастер</span>
          <span className="summary-value">{masterName}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">Услуга</span>
          <span className="summary-value">{serviceTitle}</span>
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
            {customerName}
            {customerUsername ? ` (@${customerUsername})` : ''}
          </span>
        </div>
        <div className="summary-total">
          <span>Итого</span>
          <span className="summary-value">{servicePrice} ₽</span>
        </div>
      </div>
      <button className="btn btn-primary" onClick={onConfirm}>
        Записаться
      </button>
    </>
  )
}
