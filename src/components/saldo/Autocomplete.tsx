import { useId, useRef, useState } from 'react'
import { IconPlus } from '../ui/icons'

export interface Suggestion {
  id?: string
  name: string
  hint?: string
}

export interface PickResult {
  name: string
  id: string | null
  isNew: boolean
}

interface AutocompleteProps {
  placeholder: string
  ariaLabel: string
  listLabel?: string
  getSuggestions: (query: string) => Suggestion[]
  onPick: (pick: PickResult) => void
  allowCreate?: boolean
  createLabel?: (query: string) => string
  autoFocus?: boolean
}

/** Tipp-mit-Vorschlägen-Eingabe (ARIA-Combobox). */
export function Autocomplete({
  placeholder,
  ariaLabel,
  listLabel = 'Vorschläge',
  getSuggestions,
  onPick,
  allowCreate = true,
  createLabel,
  autoFocus = false,
}: AutocompleteProps) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const q = query.trim()
  const items = open ? getSuggestions(q) : []
  const exact = items.some((s) => s.name.toLowerCase() === q.toLowerCase())
  const showCreate = allowCreate && q !== '' && !exact
  const options: PickResult[] = [
    ...items.map((s) => ({ name: s.name, id: s.id ?? null, isNew: false })),
    ...(showCreate ? [{ name: q, id: null, isNew: true }] : []),
  ]

  const pick = (p: PickResult) => {
    onPick(p)
    setQuery('')
    setActive(-1)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault()
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && options[active]) return pick(options[active])
      if (!q) return
      const ex = items.find((s) => s.name.toLowerCase() === q.toLowerCase())
      if (ex) pick({ name: ex.name, id: ex.id ?? null, isNew: false })
      else if (allowCreate) pick({ name: q, id: null, isNew: true })
      else if (items[0]) pick({ name: items[0].name, id: items[0].id ?? null, isNew: false })
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  const isOpen = open && options.length > 0

  return (
    <div className={`sal-ac ${isOpen ? 'is-open' : ''}`}>
      <input
        ref={inputRef}
        className="sal-ac__input"
        type="text"
        role="combobox"
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        autoCapitalize="words"
        spellCheck={false}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setActive(-1)
        }}
        onKeyDown={onKeyDown}
      />
      <ul
        className="sal-ac__list"
        id={listId}
        role="listbox"
        aria-label={listLabel}
        hidden={!isOpen}
      >
        {options.map((opt, i) => (
          <li
            key={opt.isNew ? '__new__' : (opt.id ?? opt.name)}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            className={`sal-ac__item ${opt.isNew ? 'is-create' : ''} ${
              i === active ? 'is-active' : ''
            }`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(opt)}
          >
            {opt.isNew ? (
              <>
                <IconPlus size={16} />
                <span className="sal-ac__name">
                  {createLabel ? createLabel(opt.name) : `„${opt.name}" neu`}
                </span>
              </>
            ) : (
              <>
                <span className="sal-ac__name">{opt.name}</span>
                {items[i]?.hint != null && (
                  <span className="sal-ac__hint">{items[i].hint}</span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
