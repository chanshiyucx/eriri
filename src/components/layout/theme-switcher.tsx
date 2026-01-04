import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style'
import { useUIStore, type ThemeMode } from '@/store/ui'

export function ThemeSwitcher() {
  const { theme, setTheme } = useUIStore()

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      // Re-trigger store to apply system theme
      useUIStore.getState().setTheme('system')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  const themes: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
    { mode: 'light', icon: Sun, label: '浅色' },
    { mode: 'system', icon: Monitor, label: '跟随系统' },
    { mode: 'dark', icon: Moon, label: '深色' },
  ]

  return (
    <div className="bg-overlay flex h-10 items-center justify-evenly gap-1 rounded-full">
      {themes.map(({ mode, icon: Icon, label }) => {
        const isActive = theme === mode
        return (
          <Button
            key={mode}
            onClick={() => setTheme(mode)}
            className={cn(
              'hover:bg-base h-8 w-8 rounded-full transition-all duration-300',
              isActive ? 'text-love' : 'text-text bg-transparent',
            )}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        )
      })}
    </div>
  )
}
