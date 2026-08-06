import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('GestSchool-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const theme = isDark ? 'dark' : 'light';

  useEffect(() => {
    localStorage.setItem('GestSchool-theme', theme);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark, theme]);

  const toggle = () => setIsDark((v) => !v);

  return (
    <ThemeContext.Provider value={{ isDark, theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
