import { useBudgetStore } from '../../store/budgetStore'
import { useLearningStore } from '../../store/learningStore'
import { learningStats } from '../../lib/learning/insights'
import type { SuggestionSurface } from '../../lib/learning/signals'
import { Card, SectionTitle } from '../ui/Card'
import { Button } from '../ui/Button'

const SURFACE_LABEL: Record<SuggestionSurface, string> = {
  category: 'Kategorien',
  item: 'Posten',
  budget: 'Budgets',
  recurring: 'Abos',
}

const SURFACE_ORDER: SuggestionSurface[] = ['category', 'item', 'budget', 'recurring']

/**
 * Einstellungs-Karte der Lern-Schicht: zeigt, wie viel die App bereits gelernt
 * hat (Signale, Trefferquote je Fläche), schaltet den optionalen KI-Fallback
 * und erlaubt das vollständige Zurücksetzen der Lerndaten.
 */
export function LearningSection() {
  const settings = useBudgetStore((s) => s.settings)
  const updateSettings = useBudgetStore((s) => s.updateSettings)
  const signals = useLearningStore((s) => s.signals)
  const clear = useLearningStore((s) => s.clear)

  const stats = learningStats(signals)
  const aiOn = settings.aiSuggestions === true
  const surfacesWithFeedback = SURFACE_ORDER.filter((s) => stats.surfaces[s] !== undefined)

  return (
    <Card>
      <SectionTitle
        title="Lernen"
        hint="Die App merkt sich deine Entscheidungen und schlägt sie beim nächsten Mal vor"
      />
      <p className="settings-text">
        {stats.total === 0
          ? 'Noch keine Lerndaten. Sobald du Kategorien zuordnest, Posten anlegst oder Budgets setzt, lernt die App mit — die Lerndaten bleiben lokal auf diesem Gerät.'
          : `${stats.total} Signale gespeichert. Die Lerndaten bleiben lokal auf diesem Gerät und sind nicht Teil des Backups.`}
      </p>

      {surfacesWithFeedback.length > 0 && (
        <div className="learning-stats">
          {surfacesWithFeedback.map((surface) => {
            const s = stats.surfaces[surface]
            if (!s) return null
            return (
              <div key={surface} className="learning-stats__row">
                <span className="learning-stats__label">{SURFACE_LABEL[surface]}</span>
                <span className="learning-stats__value tnum">
                  {Math.round(s.rate * 100)}% Trefferquote ({s.accepted}/{s.total})
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="settings-toggle-row">
        <span className="settings-toggle-label">
          KI-Vorschläge bei unsicheren Fällen (online)
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={aiOn}
          className={`settings-toggle ${aiOn ? 'settings-toggle--on' : ''}`}
          onClick={() => updateSettings({ aiSuggestions: !aiOn })}
        >
          <span className="settings-toggle__knob" />
        </button>
      </div>
      <p className="settings-text settings-text--muted">
        Nur wenn die lokale Vorhersage unsicher ist, wird der Backend-Dienst gefragt.
        KI-Vorschläge erscheinen immer als Chip und füllen nie automatisch aus.
      </p>

      {stats.total > 0 && (
        <div className="settings-actions">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm('Alle Lerndaten löschen? Vorschläge starten danach von vorn.')) {
                clear()
              }
            }}
          >
            Lerndaten zurücksetzen
          </Button>
        </div>
      )}
    </Card>
  )
}
