import { useEffect, useMemo, useRef, useState } from 'react'
import { useBudgetStore, sortedMonthIds } from '../../store/budgetStore'
import { formatMonthId, shiftMonthId } from '../../lib/format'
import { IconChevronLeft, IconChevronRight, IconPlus } from '../ui/icons'

export function MonthSwitcher() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const months = useBudgetStore((s) => s.months)
  const activeMonthId = useBudgetStore((s) => s.activeMonthId)
  const setActiveMonth = useBudgetStore((s) => s.setActiveMonth)
  const createMonth = useBudgetStore((s) => s.createMonth)

  const ids = useMemo(() => sortedMonthIds(months), [months])
  const index = ids.indexOf(activeMonthId)
  const hasPrev = index > 0
  const hasNext = index >= 0 && index < ids.length - 1

  const close = (returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  // Escape schließt das Menü und gibt den Fokus zurück; erstes Element fokussieren.
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const goPrev = () => hasPrev && setActiveMonth(ids[index - 1])
  const goNext = () => hasNext && setActiveMonth(ids[index + 1])

  const addNextMonth = () => {
    const latest = ids[ids.length - 1] ?? activeMonthId
    const nextId = shiftMonthId(latest, 1)
    createMonth(nextId, 'copy', latest)
    close()
  }

  return (
    <div className="month-switcher">
      <button
        type="button"
        className="month-switcher__arrow"
        aria-label="Vorheriger Monat"
        disabled={!hasPrev}
        onClick={goPrev}
      >
        <IconChevronLeft />
      </button>

      <button
        ref={triggerRef}
        type="button"
        className="month-switcher__label"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="month-menu"
        onClick={() => setOpen((v) => !v)}
      >
        {formatMonthId(activeMonthId)}
      </button>

      <button
        type="button"
        className="month-switcher__arrow"
        aria-label="Nächster Monat"
        disabled={!hasNext}
        onClick={goNext}
      >
        <IconChevronRight />
      </button>

      {open && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="month-switcher__backdrop"
            onClick={() => close(false)}
          />
          <div id="month-menu" ref={menuRef} className="month-switcher__menu" role="menu">
            <div className="month-switcher__list">
              {[...ids].reverse().map((id) => (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={id === activeMonthId}
                  className={`month-switcher__item ${
                    id === activeMonthId ? 'is-active' : ''
                  }`}
                  onClick={() => {
                    setActiveMonth(id)
                    close()
                  }}
                >
                  {formatMonthId(id)}
                </button>
              ))}
            </div>
            <button type="button" className="month-switcher__add" onClick={addNextMonth}>
              <IconPlus size={16} />
              Neuen Monat anlegen
            </button>
          </div>
        </>
      )}
    </div>
  )
}
