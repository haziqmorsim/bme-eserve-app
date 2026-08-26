export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'bme-theme';

function readInitial(): Theme {
    if (typeof document === 'undefined') return 'light';
    const attr = document.documentElement.getAttribute('data-theme');
    return attr === 'dark' ? 'dark' : 'light';
}

class ThemeStore {
    current = $state<Theme>(readInitial());

    set(theme: Theme) {
        this.current = theme;
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
        }
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(STORAGE_KEY, theme);
            } catch {
                // Private browsing / storage disabled
                // The toggle still works for the current page load, it just won't persist
            }
        }
    }

    toggle() {
        this.set(this.current === 'dark' ? 'light' : 'dark');
    }
}

export const theme = new ThemeStore();