import React from 'react'
import ReactDOM from 'react-dom/client'
import ActionApp from './ActionApp.jsx'
import ErrorBoundary from '../ErrorBoundary.jsx'
import '../index.css'
import { apDungGiaoDienDaLuu } from '../lib/apDungGiaoDien'

// Đợt C 04/09/2026: trang không có ThemeProvider → gắn data-theme trước khi render để có giao diện tối.
apDungGiaoDienDaLuu()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ActionApp />
    </ErrorBoundary>
  </React.StrictMode>
)
