import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/style'
import { useUIStore, type ThemeMode } from '@/store/ui'

interface Theme {
  mode: ThemeMode
  icon: LucideIcon
  label: string
}

const themes: Theme[] = [
  { mode: 'light', icon: Sun, label: '浅色' },
  { mode: 'system', icon: Monitor, label: '跟随系统' },
  { mode: 'dark', icon: Moon, label: '深色' },
]

export function ThemeSwitcher() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

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
