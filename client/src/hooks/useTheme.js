import { useTheme as useThemeContext } from '../contexts/ThemeContext';

export function useTheme() {
  const ctx = useThemeContext();
  return {
    theme: ctx.theme,
    toggleTheme: ctx.toggle,
    isDark: ctx.isDark,
  };
}
