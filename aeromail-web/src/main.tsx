import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import App from './App'
import { createAeroTheme } from './config/theme'
import { useConfigStore } from './store/configStore'

// Mount React immediately with default config so the root renders on first paint.
// fetchConfig() runs in background and updates the store when it resolves.
const initialConfig = useConfigStore.getState()

const root = ReactDOM.createRoot(document.getElementById('root')!)

function AppWithTheme() {
  const { primaryColor, appName } = useConfigStore()
  return (
    <ThemeProvider theme={createAeroTheme({ primaryColor, appName })}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

root.render(
  <React.StrictMode>
    <AppWithTheme />
  </React.StrictMode>
)

// Fetch config in background; store update will re-render with correct theme
useConfigStore.getState().fetchConfig()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error)
  })
}
