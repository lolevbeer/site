'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  const toggleTheme = React.useCallback(() => {
    const currentResolvedTheme = resolvedTheme || 'light';
    const newTheme = currentResolvedTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  }, [resolvedTheme, setTheme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative p-2"
      aria-label="Toggle theme"
    >
      {/* CSS-based visibility using next-themes class on <html> - no JS needed */}
      <Sun className="h-[1.2rem] w-[1.2rem] absolute rotate-90 scale-0 opacity-0 transition-all duration-200 dark:rotate-0 dark:scale-100 dark:opacity-100" />
      <Moon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 opacity-100 transition-all duration-200 dark:rotate-90 dark:scale-0 dark:opacity-0" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}