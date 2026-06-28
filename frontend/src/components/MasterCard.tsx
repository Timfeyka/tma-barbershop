import type { Master } from '../types'

interface MasterCardProps {
  master: Master
  onSelect: (master: Master) => void
}

export default function MasterCard({ master, onSelect }: MasterCardProps) {
  return (
    <div className="master-card" onClick={() => onSelect(master)}>
      <div className="master-top">
        {master.photo_url && (
          <img src={master.photo_url} alt={master.name} className="master-photo" />
        )}
        <div className="master-info">
          <h3>{master.name}</h3>
          <span className="master-role">{master.role}</span>
          <p className="master-bio">{master.bio}</p>
        </div>
      </div>
    </div>
  )
}
