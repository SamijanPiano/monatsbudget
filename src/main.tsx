import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/global.css'
import './styles/ui.css'
import './styles/layout.css'
import './styles/views.css'
import './styles/saldo.css'
import './styles/onboarding.css'
import './styles/transactions.css'
import './styles/ai.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
