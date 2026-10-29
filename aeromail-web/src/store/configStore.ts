import { create } from 'zustand'

export interface AppConfig {
  appName: string
  primaryColor: string
  logoUrl: string | null
  faviconUrl: string | null
  themeColor: string
}

const DEFAULTS: AppConfig = {
  appName: 'Team Archon Mail',
  primaryColor: '#2563eb',
  logoUrl: null,
  faviconUrl: null,
  themeColor: '#2563eb',
}

interface ConfigState extends AppConfig {
  loaded: boolean
  fetchConfig: () => Promise<void>
}

export const useConfigStore = create<ConfigState>()((set) => ({
  ...DEFAULTS,
  loaded: false,

  fetchConfig: async () => {
    try {
      const res = await fetch('/api/config')
      if (!res.ok) throw new Error('config fetch failed')
      const data: AppConfig = await res.json()
      set({ ...data, loaded: true })

      // Inject CSS custom properties on :root for aero-ui design token overrides
      const root = document.documentElement
      root.style.setProperty('--aero-primary', data.primaryColor)
      root.style.setProperty('--aero-theme-color', data.themeColor)
      // --aero-app-name is a string token (display use only via attr())
      root.style.setProperty('--aero-app-name', JSON.stringify(data.appName))

      // Apply favicon if provided
      if (data.faviconUrl) {
        const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
        if (existing) {
          existing.href = data.faviconUrl
        } else {
          const link = document.createElement('link')
          link.rel = 'icon'
          link.href = data.faviconUrl
          document.head.appendChild(link)
        }
      }
    } catch {
      // Network unavailable or backend not yet up — use defaults
      set({ ...DEFAULTS, loaded: true })
      const root = document.documentElement
      root.style.setProperty('--aero-primary', DEFAULTS.primaryColor)
      root.style.setProperty('--aero-theme-color', DEFAULTS.themeColor)
      root.style.setProperty('--aero-app-name', JSON.stringify(DEFAULTS.appName))
    }
  },
}))
