
import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'

import App from './app/App'
import { AuthProvider } from './app/AuthContext'
import './index.css'

// تسجيل التطبيق للتثبيت والتحديث التلقائي
registerSW({
  immediate: true,
})

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
)
