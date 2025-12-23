import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { withErrorOverlay } from './components/with-error-overlay'

const AppWithErrorOverlay = withErrorOverlay(App)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppWithErrorOverlay />
  </StrictMode>,
)
