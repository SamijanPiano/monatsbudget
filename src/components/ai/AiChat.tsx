import { useState, useRef, useEffect } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import { aiChat } from '../../lib/bankApi'
import { getSyncConfig, isSyncConfigured } from '../../lib/syncConfig'
import { currentMonthId } from '../../lib/seed'
import { formatCents } from '../../lib/format'
import { Card, SectionTitle } from '../ui/Card'

interface Message {
  role: 'user' | 'ai'
  text: string
}

const QUICK_PROMPTS = [
  'Wie viel habe ich diesen Monat ausgegeben?',
  'Reicht mein Geld bis Ende des Monats?',
  'Was sind meine größten Ausgaben?',
  'Wann wird mein nächstes Abo abgebucht?',
  'Wo kann ich am meisten sparen?',
]

export function AiChat() {
  const transactions = useBudgetStore((s) => s.transactions)
  const recurringRules = useBudgetStore((s) => s.recurringRules)
  const accounts = useBudgetStore((s) => s.accounts)
  const categories = useBudgetStore((s) => s.categories)
  const aiCategorize = useBudgetStore((s) => s.aiCategorize)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [categorizingLoading, setCategorizingLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const checking = accounts.find((a) => a.type === 'checking') ?? accounts[0]
  const cashAccount = accounts.find((a) => a.type === 'cash')
  const monthKey = currentMonthId()

  const uncategorizedCount = transactions.filter((t) => t.categoryId === null).length

  const monthTxs = transactions.filter((t) => t.date.startsWith(monthKey))

  function buildContext() {
    const catMap = new Map(categories.map((c) => [c.id, c.label]))
    const catSummary: Record<string, number> = {}
    for (const t of monthTxs) {
      const label = t.categoryId ? (catMap.get(t.categoryId) ?? 'Sonstiges') : 'Unkategorisiert'
      catSummary[label] = (catSummary[label] ?? 0) + t.amount
    }
    return {
      kontostand: checking?.balance ?? null,
      bargeldstand: cashAccount?.balance ?? null,
      monat: monthKey,
      buchungenDiesenMonat: monthTxs.map((t) => ({
        datum: t.date,
        empfaenger: t.counterparty,
        betrag: t.amount,
        kategorie: t.categoryId ? (catMap.get(t.categoryId) ?? null) : null,
      })),
      kategorienUebersicht: Object.entries(catSummary).map(([label, total]) => ({ label, total })),
      dauerposten: recurringRules.map((r) => ({
        empfaenger: r.counterparty,
        betragApprox: r.amountApprox,
        naechstesErwartet: r.nextExpected,
      })),
    }
  }

  async function send(text: string) {
    if (!text.trim() || loading) return
    setError(null)
    const userMsg: Message = { role: 'user', text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    const cfg = getSyncConfig()
    if (!cfg) {
      setMessages((m) => [...m, { role: 'ai', text: 'Bitte richte erst den Bank-Sync ein (Mehr → Bank-Sync), damit die KI auf deine Daten zugreifen kann.' }])
      setLoading(false)
      return
    }

    try {
      const { reply } = await aiChat(cfg, text, buildContext())
      setMessages((m) => [...m, { role: 'ai', text: reply }])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleAiCategorize() {
    setCategorizingLoading(true)
    try {
      await aiCategorize()
    } finally {
      setCategorizingLoading(false)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const syncOk = isSyncConfigured()

  return (
    <div className="view-stack">
      {uncategorizedCount > 0 && syncOk && (
        <Card>
          <div className="ai-categorize-banner">
            <div>
              <span className="ai-categorize-banner__count">{uncategorizedCount}</span>
              <span className="ai-categorize-banner__label"> Buchungen noch nicht kategorisiert</span>
            </div>
            <button
              className="btn btn--sm btn--ai"
              onClick={handleAiCategorize}
              disabled={categorizingLoading}
            >
              {categorizingLoading ? 'KI läuft …' : 'KI kategorisieren'}
            </button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle title="KI-Assistent" hint="Frag mich alles über deine Finanzen" />

        {messages.length === 0 && (
          <div className="ai-welcome">
            <p className="ai-welcome__text">
              Ich habe Zugriff auf all deine Buchungen, Dauerposten und deinen Kontostand. Stell mir einfach eine Frage.
            </p>
            {!syncOk && (
              <p className="ai-welcome__hint">
                Richte erst den Bank-Sync ein, damit die KI auf deine Daten zugreifen kann.
              </p>
            )}
          </div>
        )}

        {messages.length === 0 && (
          <div className="ai-quick-prompts">
            {QUICK_PROMPTS.map((p) => (
              <button key={p} className="ai-chip" onClick={() => send(p)}>
                {p}
              </button>
            ))}
          </div>
        )}

        {messages.length > 0 && (
          <div className="ai-messages">
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg--${m.role}`}>
                <span className="ai-msg__text">{m.text}</span>
              </div>
            ))}
            {loading && (
              <div className="ai-msg ai-msg--ai">
                <span className="ai-msg__thinking">Denkt nach …</span>
              </div>
            )}
            {error && (
              <div className="ai-msg ai-msg--error">
                <span className="ai-msg__text">Fehler: {error}</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        <form
          className="ai-input-row"
          onSubmit={(e) => { e.preventDefault(); send(input) }}
        >
          <input
            className="ai-input"
            placeholder="Frag die KI …"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn--primary btn--sm"
            disabled={loading || !input.trim()}
          >
            →
          </button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Dein Überblick" hint="Basis für die KI" />
        <div className="result-list">
          <div className="result-row">
            <span>Kontostand</span>
            <span className="tnum">{checking?.balance != null ? formatCents(checking.balance) : '—'}</span>
          </div>
          <div className="result-row">
            <span>Buchungen diesen Monat</span>
            <span className="tnum">{monthTxs.length}</span>
          </div>
          <div className="result-row">
            <span>Erkannte Dauerposten</span>
            <span className="tnum">{recurringRules.length}</span>
          </div>
          <div className="result-row">
            <span>Buchungen ohne Kategorie</span>
            <span className={`tnum ${uncategorizedCount > 0 ? 'text-negative' : ''}`}>{uncategorizedCount}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
