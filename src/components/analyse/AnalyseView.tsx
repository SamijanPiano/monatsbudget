import { useState } from 'react'
import { HistoryView } from '../history/HistoryView'
import { ReportsView } from '../reports/ReportsView'

type SubTab = 'verlauf' | 'berichte'

export function AnalyseView() {
  const [sub, setSub] = useState<SubTab>('verlauf')

  return (
    <div className="view-stack">
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div className="segmented">
          <button
            type="button"
            className={`segmented__btn ${sub === 'verlauf' ? 'is-active' : ''}`}
            onClick={() => setSub('verlauf')}
          >
            Verlauf
          </button>
          <button
            type="button"
            className={`segmented__btn ${sub === 'berichte' ? 'is-active' : ''}`}
            onClick={() => setSub('berichte')}
          >
            Berichte
          </button>
        </div>
      </div>

      {sub === 'verlauf' && <HistoryView />}
      {sub === 'berichte' && <ReportsView onBack={() => setSub('verlauf')} />}
    </div>
  )
}
