import React from 'react'
import ReactDOM from 'react-dom/client'
import DatLaiApp from './DatLaiApp.jsx'
import ErrorBoundary from '../ErrorBoundary.jsx'
import '../index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <DatLaiApp />
    </ErrorBoundary>
  </React.StrictMode>
)
