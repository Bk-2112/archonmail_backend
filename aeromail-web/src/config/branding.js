export const DEFAULT_BRAND = {
    appName: 'AeroMail',
    primaryColor: '#00BCD4',
    accentColor: '#1a73e8',
    logoText: 'AeroMail',
};
// Load from window.AEROMAIL_CONFIG if set (injected by server), else defaults
export function getBrandConfig() {
    const win = window;
    return { ...DEFAULT_BRAND, ...(win.AEROMAIL_CONFIG || {}) };
}
