import { createTheme } from '@mui/material/styles'

interface ThemeConfig {
  primaryColor?: string
  appName?: string
}

export function createAeroTheme(config: ThemeConfig = {}) {
  const primaryColor = config.primaryColor ?? '#00BCD4'

  return createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#1a73e8' },
      secondary: { main: primaryColor },
      background: { default: '#1f1f1f', paper: '#2d2d2f' },
      text: { primary: '#e8eaed', secondary: '#9aa0a6' },
    },
    typography: {
      // Roboto is the standard sans-serif — no proprietary font dependencies
      fontFamily: 'Roboto, "Helvetica Neue", Arial, sans-serif',
    },
  })
}
