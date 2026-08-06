import { createContext, useContext, useState, useEffect } from 'react';

const DensityContext = createContext(null);

const STORAGE_KEY = 'GestSchool-density';

export const useDensity = () => {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used within DensityProvider');
  return ctx;
};

export const DensityProvider = ({ children }) => {
  const [density, setDensity] = useState(() => localStorage.getItem(STORAGE_KEY) || 'comfortable');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, density);
    document.documentElement.setAttribute('data-density', density);
    document.documentElement.classList.toggle('compact', density === 'compact');
  }, [density]);

  const toggleDensity = () =>
    setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'));

  return (
    <DensityContext.Provider value={{ density, setDensity, toggleDensity }}>
      {children}
    </DensityContext.Provider>
  );
};

export default DensityContext;
