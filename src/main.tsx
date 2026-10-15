import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import './styles/ui.css'
import './styles/layout.css'
import './styles/views.css'
import './styles/saldo.css'
import './styles/transactions.css'
import './styles/ai.css'
import './styles/features.css'
import './styles/plan.css'
import App from './App.tsx'
import { pairFromLocation } from './lib/cloudSync/pairOnStart'

// Kopplungs-Link (#koppeln=…) erst einlösen, dann die App zeigen: so startet
// der erste Abgleich schon mit dem neuen Zugang.
await pairFromLocation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
