import { createContext, useContext, useState, useEffect } from 'react';
import { THEME_STORAGE_KEY } from '../utils/themeEngine';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) || localStorage.getItem('gestschool-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const theme = isDark ? 'dark' : 'light';

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.removeItem('gestschool-theme');
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Notify tenant theme engine to re-derive dark-aware soft surfaces
    window.dispatchEvent(new CustomEvent('gestschool-theme-change', { detail: { isDark, theme } }));
  }, [isDark, theme]);

  const toggle = () => setIsDark((v) => !v);

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
