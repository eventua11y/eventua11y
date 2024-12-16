document.addEventListener('DOMContentLoaded', () => {
  // Find all elements with the "no-js" class and remove that class
  const noJsElements = document.querySelectorAll<HTMLElement>('.no-js');
  noJsElements.forEach((element) => {
    element.classList.remove('no-js');
  });

  // Theme selection functionality
  const LIGHT_MODE_ICON =
    '<sl-icon label="Light mode" name="sun-fill"></sl-icon>';
  const DARK_MODE_ICON =
    '<sl-icon label="Dark mode" name="moon-fill"></sl-icon>';

  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

  /**
   * Applies the selected theme to the document.
   * @param theme - The theme to apply ('light', 'dark', or null for system default).
   */
  function applyTheme(theme: string | null) {
    const themeSelectorButton = document.getElementById(
      'theme-selector-button'
    ) as HTMLElement;

    if (!themeSelectorButton) {
      console.error('Theme selector button not found');
      return;
    }

    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.classList.remove('sl-theme-dark');
      localStorage.setItem('theme', 'light');
      themeSelectorButton.innerHTML = LIGHT_MODE_ICON;
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('sl-theme-dark');
      localStorage.setItem('theme', 'dark');
      themeSelectorButton.innerHTML = DARK_MODE_ICON;
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('sl-theme-dark');
      localStorage.removeItem('theme');
      if (prefersDarkScheme.matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.classList.add('sl-theme-dark');
        themeSelectorButton.innerHTML = DARK_MODE_ICON;
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
        themeSelectorButton.innerHTML = LIGHT_MODE_ICON;
      }
    }
  }

  /**
   * Updates the theme selection UI based on the current theme.
   * @param theme - The current theme ('light', 'dark', or null for system default).
   */
  function updateSelection(theme: string | null) {
    const lightModeItem = document.getElementById(
      'light-mode'
    ) as HTMLInputElement;
    const darkModeItem = document.getElementById(
      'dark-mode'
    ) as HTMLInputElement;
    const systemDefaultItem = document.getElementById(
      'system-default'
    ) as HTMLInputElement;

    if (!lightModeItem || !darkModeItem || !systemDefaultItem) {
      console.error('Theme selection items not found');
      return;
    }

    lightModeItem.checked = theme === 'light';
    darkModeItem.checked = theme === 'dark';
    systemDefaultItem.checked = theme === null;
  }

  // Apply the stored theme or the system default theme on initial load
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) {
    applyTheme(storedTheme);
    updateSelection(storedTheme);
  } else {
    applyTheme(null);
    updateSelection(null);
  }

  // Add event listener for theme selection changes
  const menu = document.querySelector('sl-menu');
  if (menu) {
    menu.addEventListener('sl-select', (event: CustomEvent) => {
      const selectedTheme = event.detail.item.value;
      applyTheme(selectedTheme);
      updateSelection(selectedTheme);
    });
  }

  // Listen for changes to the user's system preference and update the theme accordingly
  prefersDarkScheme.addEventListener('change', (event) => {
    if (!localStorage.getItem('theme')) {
      if (event.matches) {
        applyTheme('dark');
      } else {
        applyTheme('light');
      }
    }
  });
});
