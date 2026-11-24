// Light/dark theme. index.html applies the saved choice (or the device setting) before the
// first paint; this module reads and changes it afterwards.
export type Theme = 'light' | 'dark';

const THEME_COLOR: Record<Theme, string> = { light: '#E6EBF2', dark: '#1B202A' };

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  try {
    localStorage.setItem('theme', theme);
  } catch {
    // Private mode or blocked storage: the choice just lasts for this visit.
  }
}
