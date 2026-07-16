import React, { createContext, useContext, useState, useMemo } from 'react';
import { lightColors, darkColors, baseTheme } from '../styles/theme';

export const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  const toggleTheme = () => setIsDark(prev => !prev);

  const theme = useMemo(() => ({
    ...baseTheme,
    colors: isDark ? darkColors : lightColors,
  }), [isDark]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
