import { create } from 'zustand';
const DEFAULTS = {
    appName: 'AeroMail',
    primaryColor: '#00BCD4',
    logoUrl: null,
    faviconUrl: null,
    themeColor: '#00BCD4',
};
export const useConfigStore = create()((set) => ({
    ...DEFAULTS,
    loaded: false,
    fetchConfig: async () => {
        try {
            const res = await fetch('/api/config');
            if (!res.ok)
                throw new Error('config fetch failed');
            const data = await res.json();
            set({ ...data, loaded: true });
            // Inject CSS custom properties on :root for aero-ui design token overrides
            const root = document.documentElement;
            root.style.setProperty('--aero-primary', data.primaryColor);
            root.style.setProperty('--aero-theme-color', data.themeColor);
            // --aero-app-name is a string token (display use only via attr())
            root.style.setProperty('--aero-app-name', JSON.stringify(data.appName));
            // Apply favicon if provided
            if (data.faviconUrl) {
                const existing = document.querySelector('link[rel="icon"]');
                if (existing) {
                    existing.href = data.faviconUrl;
                }
                else {
                    const link = document.createElement('link');
                    link.rel = 'icon';
                    link.href = data.faviconUrl;
                    document.head.appendChild(link);
                }
            }
        }
        catch {
            // Network unavailable or backend not yet up — use defaults
            set({ ...DEFAULTS, loaded: true });
            const root = document.documentElement;
            root.style.setProperty('--aero-primary', DEFAULTS.primaryColor);
            root.style.setProperty('--aero-theme-color', DEFAULTS.themeColor);
            root.style.setProperty('--aero-app-name', JSON.stringify(DEFAULTS.appName));
        }
    },
}));
