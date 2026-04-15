(function () {
    const STORAGE_KEY = 'thisman-theme';
    const DEFAULT_THEME = 'light';
    const THEMES = ['light', 'dark'];
    const root = document.documentElement;

    function readStoredTheme() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return THEMES.includes(stored) ? stored : null;
        } catch (error) {
            return null;
        }
    }

    function updateMetaThemeColor(theme) {
        const meta = document.querySelector('meta[name="theme-color"]');
        if (!meta) {
            return;
        }
        meta.setAttribute('content', theme === 'dark' ? '#000000' : '#f5f5f5');
    }

    function applyTheme(theme, persist = true) {
        const nextTheme = THEMES.includes(theme) ? theme : DEFAULT_THEME;
        root.dataset.theme = nextTheme;
        root.style.colorScheme = nextTheme;
        updateMetaThemeColor(nextTheme);

        if (persist) {
            try {
                localStorage.setItem(STORAGE_KEY, nextTheme);
            } catch (error) {
                /* no-op */
            }
        }

        const event = new CustomEvent('app-themechange', {
            detail: { theme: nextTheme }
        });
        document.dispatchEvent(event);
    }

    function updateToggleState(container) {
        if (!container) {
            return;
        }
        const activeTheme = root.dataset.theme || DEFAULT_THEME;
        container.querySelectorAll('[data-theme-option]').forEach((button) => {
            const isActive = button.getAttribute('data-theme-option') === activeTheme;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    }

    function mountToggle() {
        if (document.getElementById('theme-toggle')) {
            return;
        }

        const toggle = document.createElement('div');
        toggle.id = 'theme-toggle';
        toggle.className = 'theme-toggle';
        toggle.setAttribute('role', 'group');
        toggle.setAttribute('aria-label', 'Theme switcher');

        if (
            document.getElementById('game-canvas') ||
            document.getElementById('gameCanvas') ||
            document.getElementById('game')
        ) {
            toggle.classList.add('is-canvas-page');
        }

        toggle.innerHTML = [
            '<button type="button" class="theme-toggle__button" data-theme-option="light">Light</button>',
            '<button type="button" class="theme-toggle__button" data-theme-option="dark">Dark</button>'
        ].join('');

        toggle.addEventListener('click', (event) => {
            const button = event.target.closest('[data-theme-option]');
            if (!button) {
                return;
            }
            applyTheme(button.getAttribute('data-theme-option'));
            updateToggleState(toggle);
        });

        document.body.appendChild(toggle);
        updateToggleState(toggle);
        document.addEventListener('app-themechange', () => updateToggleState(toggle));
    }

    const initialTheme = readStoredTheme() || DEFAULT_THEME;
    applyTheme(initialTheme, false);

    window.__appTheme = {
        get: () => root.dataset.theme || DEFAULT_THEME,
        set: (theme) => applyTheme(theme)
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountToggle, { once: true });
    } else {
        mountToggle();
    }
})();
