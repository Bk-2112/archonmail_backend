export interface BrandConfig {
  appName: string
  primaryColor: string
  accentColor: string
  logoText: string
  logoSubtext?: string
  faviconUrl?: string
}

export const DEFAULT_BRAND: BrandConfig = {
  appName: 'AeroMail',
  primaryColor: '#00BCD4',
  accentColor: '#1a73e8',
  logoText: 'AeroMail',
}

// Load from window.AEROMAIL_CONFIG if set (injected by server), else defaults
export function getBrandConfig(): BrandConfig {
  const win = window as typeof window & { AEROMAIL_CONFIG?: Partial<BrandConfig> }
  return { ...DEFAULT_BRAND, ...(win.AEROMAIL_CONFIG || {}) }
}
