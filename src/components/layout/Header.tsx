import { MonthSwitcher } from './MonthSwitcher'

export function Header({ showMonth = true }: { showMonth?: boolean }) {
  return (
    <header className="app-header">
      <div className="app-header__inner">
        <div className="wordmark">
          <span className="wordmark__mark" aria-hidden="true">
            €
          </span>
          <span className="wordmark__text">
            Monats<span className="wordmark__accent">budget</span>
          </span>
        </div>
        {showMonth && <MonthSwitcher />}
      </div>
    </header>
  )
}
