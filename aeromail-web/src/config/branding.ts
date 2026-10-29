export interface BrandConfig {
  appName: string
  primaryColor: string
  accentColor: string
  logoText: string
  logoSubtext?: string
  faviconUrl?: string
}

export const DEFAULT_BRAND: BrandConfig = {
  appName: 'Team Archon Mail',
  primaryColor: '#2563eb',
  accentColor: '#38bdf8',
  logoText: 'Team Archon',
  logoSubtext: 'Mail',
}

// Load from window.AEROMAIL_CONFIG if set (injected by server), else defaults
export function getBrandConfig(): BrandConfig {
  const win = window as typeof window & { AEROMAIL_CONFIG?: Partial<BrandConfig> }
  return { ...DEFAULT_BRAND, ...(win.AEROMAIL_CONFIG || {}) }
}
