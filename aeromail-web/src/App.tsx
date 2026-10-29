import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import LoginPage from './pages/LoginPage'
import InboxPage from './pages/InboxPage'
import SettingsPage from './pages/SettingsPage'
import SearchPage from './pages/SearchPage'
import SetupWizard from './pages/SetupWizard'
import ThreadPage from './pages/ThreadPage'
import Layout from './components/Layout'
import apiClient from './api/client'
import { CircularProgress, Box } from '@mui/material'

// App with setup-status check on load
function AppRouter() {
  const [checkingSetup, setCheckingSetup] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)

  useEffect(() => {
    apiClient.get('/setup/status')
      .then((res) => {
        if (!res.data.configured) {
          setSetupRequired(true)
        }
      })
      .catch(() => {
        // If endpoint unreachable, don't block app
      })
      .finally(() => setCheckingSetup(false))
  }, [])

  if (checkingSetup) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: '#1a73e8' }} />
      </Box>
    )
  }

  return (
    <Routes>
      {/* Unauthenticated routes — no Layout shell */}
      <Route path="/setup" element={<SetupWizard />} />
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated routes — wrapped in Layout (AppBar + Sidebar + Compose FAB) */}
      <Route path="/inbox" element={<Layout><InboxPage /></Layout>} />
      <Route path="/thread/:id" element={<Layout><ThreadPage /></Layout>} />
      <Route path="/search" element={<Layout><SearchPage /></Layout>} />
      <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />

      <Route path="/" element={
        setupRequired
          ? <Navigate to="/setup" replace />
          : <Navigate to="/login" replace />
      } />
      <Route path="*" element={
        setupRequired
          ? <Navigate to="/setup" replace />
          : <Navigate to="/login" replace />
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  )
}
