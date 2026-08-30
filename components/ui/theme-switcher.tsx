'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

import { Monitor, Moon, Sun } from '@/components/icons'

type Theme = 'system' | 'light' | 'dark'

interface ThemeSwitcherProps {
  className?: string
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const options: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: 'system', icon: <Monitor size={16} />, label: 'System' },
    { value: 'light', icon: <Sun size={16} />, label: 'Light Mode' },
    { value: 'dark', icon: <Moon size={16} />, label: 'Dark Mode' },
  ]

  // Prevent hydration mismatch - show skeleton until mounted
  if (!mounted) {
    return (
      <fieldset className={cn('inline-flex rounded-md bg-muted p-0.5', className)}>
        <legend className="sr-only">Select a display theme:</legend>
        {options.map((option) => (
          <span key={option.value} className="h-full">
            <span className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground">
              {option.icon}
            </span>
          </span>
        ))}
      </fieldset>
    )
  }

  const currentTheme = theme || 'system'

  return (
    <TooltipProvider delayDuration={300}>
      <fieldset className={cn('inline-flex rounded-md bg-muted p-0.5', className)}>
        <legend className="sr-only">Select a display theme:</legend>
        {options.map((option) => {
          const isSelected = currentTheme === option.value
          return (
            <Tooltip key={option.value}>
              <TooltipTrigger asChild>
                <span className="h-full">
                  <input
                    aria-label={option.label}
                    type="radio"
                    name="theme-switcher"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => setTheme(option.value)}
                    id={`theme-switch-${option.value}`}
                    className="sr-only peer"
                  />
                  <label
                    htmlFor={`theme-switch-${option.value}`}
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-md cursor-pointer transition-colors',
                      isSelected
                        ? 'bg-background text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className="sr-only">{option.label}</span>
                    {option.icon}
                  </label>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{option.label}</p>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </fieldset>
    </TooltipProvider>
  )
}
