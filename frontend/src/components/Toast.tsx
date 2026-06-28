import { useEffect } from 'react'

interface ToastProps {
  message: string | null
  onClose?: () => void
}

export default function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    if (message && onClose) {
      const t = setTimeout(onClose, 2500)
      return () => clearTimeout(t)
    }
  }, [message, onClose])

  if (!message) return null
  return <div className="toast">{message}</div>
}
