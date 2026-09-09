import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import GlobalErrorBoundary from './components/GlobalErrorBoundary'
import { initTelemetry } from './utils/telemetry'
import './index.css'

// Initialize Boss PC & Client Realtime Telemetry
initTelemetry()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </React.StrictMode>
)
