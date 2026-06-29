import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className={`
        w-9 h-9 rounded-lg flex items-center justify-center
        transition-all duration-200
        bg-gray-100 hover:bg-gray-200
        dark:bg-gray-800 dark:hover:bg-gray-700
        text-gray-600 dark:text-gray-300
        ${className}
      `}
    >
      {theme === 'dark'
        ? <Sun size={17} />
        : <Moon size={17} />
      }
    </button>
  );
}
