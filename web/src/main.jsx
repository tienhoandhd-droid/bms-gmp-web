import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initWebVitals } from './lib/webVitals'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

// Mảng 4: đo Core Web Vitals (LCP/CLS/FCP/TTFB) — 0 dependency, gọi sau render.
initWebVitals()
