import React from 'react'
import ReactDOM from 'react-dom/client'
import App, { BannerCapNhat } from './App.jsx'
import TVMode from './components/TVMode.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { ThemeProvider } from './app/providers/ThemeProvider.jsx'
import './index.css'
import { initWebVitals } from './lib/webVitals'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        {/* ?tv=1 → màn hình treo tường phòng vận hành: chữ to, tự xoay, không điều hướng */}
        {new URLSearchParams(window.location.search).has('tv') ? <TVMode /> : <><App /><BannerCapNhat /></>}
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)

// Mảng 4: đo Core Web Vitals (LCP/CLS/FCP/TTFB) — 0 dependency, gọi sau render.
initWebVitals()
