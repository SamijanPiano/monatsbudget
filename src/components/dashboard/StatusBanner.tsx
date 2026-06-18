import type { SituationCalc } from '../../types/budget'
import { formatMoney } from '../../lib/format'

interface StatusBannerProps {
  situation: SituationCalc
  currentKonto: number
}

export function StatusBanner({ situation, currentKonto }: StatusBannerProps) {
  const { isEnough, diff } = situation
  const noInput = currentKonto === 0

  return (
    <div className={`status-banner ${isEnough ? 'is-ok' : 'is-bad'}`}>
      <div className="status-banner__glow" aria-hidden="true" />
      <div className="status-banner__content">
        <span className="status-banner__eyebrow">Reicht dein Konto diesen Monat?</span>
        <div className="status-banner__headline">
          <span className="status-banner__icon" aria-hidden="true">
            {isEnough ? '✓' : '!'}
          </span>
          <span>{isEnough ? 'Ja, das Konto reicht' : 'Nein, es wird knapp'}</span>
        </div>
        <p className="status-banner__detail">
          {noInput ? (
            <>
              Auf Basis deines geplanten Budgets.{' '}
              {isEnough ? 'Puffer' : 'Es fehlen'} <strong>{formatMoney(diff)}</strong>.
              Trag deinen aktuellen Kontostand im Reicht-es-Check ein.
            </>
          ) : isEnough ? (
            <>
              Nach allen Ausgaben bleibt ein Puffer von <strong>{formatMoney(diff)}</strong>.
            </>
          ) : (
            <>
              Nach allen Ausgaben fehlen dir <strong>{formatMoney(diff)}</strong> auf dem Konto.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
